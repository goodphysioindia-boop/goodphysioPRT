import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, Pencil, Trash2, Film, Users, UploadCloud, CheckCircle2, PlayCircle } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { FullPageSpinner, EmptyState, SearchBar, PageHeader } from '../../components/Ui';
import Modal from '../../components/Modal';
import { TextField, TextareaField, ToggleField } from '../../components/FormFields';
import { VideoThumb, VideoPlayerModal, fmtDuration, fmtSize } from '../../components/VideoParts';

const CATEGORY_SUGGESTIONS = ['Breathing', 'Neck & Shoulder', 'Back', 'Knee', 'Hip', 'Stretching', 'Strengthening', 'Balance'];
const idOf = (x) => String(x?._id || x);

export default function AdminVideos() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'access' ? 'access' : 'library';

  const [videos, setVideos] = useState([]);
  const [patients, setPatients] = useState([]);
  const [access, setAccess] = useState({}); // patientId -> { enabled, videoIds: [] }
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [v, p, a] = await Promise.all([api.get('/videos'), api.get('/patients'), api.get('/videos/access')]);
      setVideos(v.data);
      setPatients(p.data);
      const map = {};
      a.data.forEach((r) => {
        map[idOf(r.patient)] = { enabled: r.enabled, videoIds: (r.videoIds || []).map(idOf) };
      });
      setAccess(map);
    } catch (err) {
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setTab = (t) => {
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('patient');
    if (t === 'access') next.set('tab', 'access');
    else next.delete('tab');
    setParams(next);
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-4 pb-6">
      <button onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader title="Exercise Videos" />

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {[
          ['library', 'Video Library', Film],
          ['access', 'Patient Access', Users],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'library' ? (
        <LibraryTab videos={videos} reload={load} params={params} setParams={setParams} goAccess={() => setTab('access')} />
      ) : (
        <AccessTab videos={videos} patients={patients} access={access} reload={load} params={params} setParams={setParams} goLibrary={() => setTab('library')} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Library */

function LibraryTab({ videos, reload, params, setParams, goAccess }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(null);
  const [editing, setEditing] = useState(null);
  const uploadOpen = params.get('new') === '1';

  const closeUpload = () => {
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next);
  };

  const filtered = videos.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.title.toLowerCase().includes(q) || (v.category || '').toLowerCase().includes(q);
  });

  const remove = async (v) => {
    const extra = ' It will also be removed from every patient it was given to.';
    if (!window.confirm(`Delete "${v.title}"?${extra} This cannot be undone.`)) return;
    try {
      await api.delete(`/videos/${v._id}`);
      toast.success('Video deleted');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete video');
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search videos by title or category" />
        </div>
        <button className="btn-primary flex-shrink-0" onClick={() => setParams({ new: '1' })}>
          <Upload className="h-4 w-4" /> Add Video
        </button>
      </div>

      {videos.length === 0 ? (
        <EmptyState icon={Film} title="No videos yet" subtitle="Upload your first exercise video. You can then give it to any patient from the Patient Access tab." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Film} title="No videos match your search" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <div key={v._id} className="card overflow-hidden">
              <VideoThumb video={v} onPlay={() => setPlaying(v)} />
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{v.title}</p>
                    <p className="truncate text-xs text-slate-400">{v.source === 'youtube' ? 'YouTube link' : [fmtDuration(v.duration), fmtSize(v.bytes)].filter(Boolean).join(' · ')}</p>
                  </div>
                  {v.category && <span className="badge flex-shrink-0 bg-brand-50 text-brand-700">{v.category}</span>}
                </div>
                {v.description && <p className="line-clamp-2 text-xs text-slate-500">{v.description}</p>}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-xs text-slate-500">
                    {v.assignedCount ? `Given to ${v.assignedCount} ${isAdmin ? '' : 'of your '}patient${v.assignedCount === 1 ? '' : 's'}` : 'Not given to anyone yet'}
                  </span>
                  {v.canManage && (
                  <div className="flex items-center">
                    <button onClick={() => setEditing(v)} title="Edit details" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(v)} title="Delete video" className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  )}
                </div>
                {!v.canManage && v.uploadedByName && <p className="text-[11px] text-slate-400">Uploaded by {v.uploadedByName}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={closeUpload}
        categories={Array.from(new Set([...CATEGORY_SUGGESTIONS, ...videos.map((v) => v.category).filter(Boolean)]))}
        onDone={() => {
          closeUpload();
          reload();
        }}
        goAccess={goAccess}
      />
      <EditModal video={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

function UploadModal({ open, onClose, categories, onDone }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('file'); // 'file' | 'youtube'
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [form, setForm] = useState({ title: '', category: '', description: '' });
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('file');
      setYoutubeUrl('');
      setFile(null);
      setForm({ title: '', category: '', description: '' });
      setProgress(0);
      setUploading(false);
    }
  }, [open]);

  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) return toast.error('Please choose a video file (MP4, MOV or WebM)');
    if (f.size > 100 * 1024 * 1024) return toast.error('This video is larger than 100 MB. Please compress it first.');
    setFile(f);
    if (!form.title) {
      setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() }));
    }
  };

  const submit = async () => {
    if (mode === 'youtube') {
      if (!youtubeUrl.trim()) return toast.error('Please paste a YouTube link');
      if (!form.title.trim()) return toast.error('Please give the video a title');
      setUploading(true);
      try {
        await api.post('/videos', {
          title: form.title.trim(),
          category: form.category.trim(),
          description: form.description.trim(),
          youtubeUrl: youtubeUrl.trim(),
        });
        toast.success('YouTube video added');
        onDone();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not add the YouTube link. Please try again.');
        setUploading(false);
      }
      return;
    }
    if (!file) return toast.error('Please choose a video first');
    if (!form.title.trim()) return toast.error('Please give the video a title');
    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('category', form.category.trim());
    fd.append('description', form.description.trim());
    fd.append('file', file); // file last so the text fields are read first
    setUploading(true);
    setProgress(0);
    try {
      await api.post('/videos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      toast.success('Video uploaded');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !uploading && onClose()}
      title={mode === 'youtube' ? 'Add YouTube Video' : 'Upload Video'}
      footer={
        <>
          <button className="btn-secondary flex-1" disabled={uploading} onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={uploading || (mode === 'file' ? !file : !youtubeUrl.trim())} onClick={submit}>
            {mode === 'youtube' ? (uploading ? 'Adding…' : 'Add Video') : uploading ? (progress < 100 ? `Uploading ${progress}%` : 'Processing…') : 'Upload'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {[
          ['file', 'Upload file'],
          ['youtube', 'YouTube link'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={uploading}
            onClick={() => setMode(key)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'youtube' && (
        <TextField
          label="YouTube link"
          required
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
      )}

      {mode === 'file' && (
      <div>
        <label className="field-label field-required">Video file</label>
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
        >
          {file ? (
            <>
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              <span className="max-w-full truncate text-sm font-semibold text-slate-800">{file.name}</span>
              <span className="text-xs text-slate-400">{fmtSize(file.size)} · tap to choose a different video</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-7 w-7 text-brand-500" />
              <span className="text-sm font-semibold text-slate-700">Tap to choose a video</span>
              <span className="text-xs text-slate-400">MP4, MOV or WebM · up to 100 MB</span>
            </>
          )}
        </button>
        {uploading && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      )}

      <TextField label="Title" required value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="e.g. Deep breathing exercise" />
      <div>
        <label className="field-label">Category</label>
        <input className="input" list="video-categories" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} placeholder="Pick one or type your own" />
        <datalist id="video-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <TextareaField label="Instructions / notes (optional)" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="e.g. Do 10 reps, twice a day" />
    </Modal>
  );
}

function EditModal({ video, onClose, onDone }) {
  const [form, setForm] = useState({ title: '', category: '', description: '', youtubeUrl: '' });
  const [saving, setSaving] = useState(false);
  const isYoutube = video?.source === 'youtube';

  useEffect(() => {
    if (video) setForm({ title: video.title || '', category: video.category || '', description: video.description || '', youtubeUrl: video.source === 'youtube' ? video.url || '' : '' });
  }, [video]);

  const save = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const { youtubeUrl, ...rest } = form;
      await api.put(`/videos/${video._id}`, isYoutube ? { ...rest, youtubeUrl } : rest);
      toast.success('Video updated');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update video');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!video}
      onClose={onClose}
      title="Edit Video"
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </>
      }
    >
      <TextField label="Title" required value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
      {isYoutube && <TextField label="YouTube link" required value={form.youtubeUrl} onChange={(e) => setForm((s) => ({ ...s, youtubeUrl: e.target.value }))} />}
      <TextField label="Category" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} />
      <TextareaField label="Instructions / notes" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
    </Modal>
  );
}

/* ------------------------------------------------------------------- Access */

function AccessTab({ videos, patients, access, reload, params, setParams, goLibrary }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | on | off
  const [target, setTarget] = useState(null); // patient being managed

  // Deep link: /admin/videos?tab=access&patient=<id> opens that patient straight away
  useEffect(() => {
    const pid = params.get('patient');
    if (pid && patients.length) {
      const p = patients.find((x) => x._id === pid);
      if (p) setTarget(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  const closeTarget = () => {
    setTarget(null);
    if (params.get('patient')) {
      const next = new URLSearchParams(params);
      next.delete('patient');
      setParams(next);
    }
  };

  const isOn = (p) => !!access[p._id]?.enabled;
  const countFor = (p) => (access[p._id]?.videoIds || []).filter((id) => videos.some((v) => v._id === id)).length;

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const matches = !q || p.name.toLowerCase().includes(q) || (p.patientId || '').toLowerCase().includes(q) || (p.lungCondition || '').toLowerCase().includes(q);
    const status = filter === 'all' || (filter === 'on' ? isOn(p) : !isOn(p));
    return matches && status;
  });

  const onCount = patients.filter(isOn).length;

  return (
    <>
      <div className="card flex items-start gap-3 bg-brand-50/60 p-4">
        <PlayCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" />
        <p className="text-xs text-slate-600">
          Pick {isAdmin ? 'a patient' : 'one of your patients'}, switch on <b>Video access</b> and tick the videos they should see. Only patients you switch on get a
          <b> Videos</b> tab in their own app.
        </p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search patient by name, ID or diagnosis" />

      <div className="flex flex-wrap gap-2">
        {[
          ['all', `All patients (${patients.length})`],
          ['on', `Video access on (${onCount})`],
          ['off', `Not enabled (${patients.length - onCount})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No patients found" subtitle={!isAdmin && patients.length === 0 ? 'Patients you register will appear here.' : undefined} />
      ) : (
        <div className="card divide-y divide-slate-50 overflow-hidden">
          {filtered.map((p) => (
            <button key={p._id} onClick={() => setTarget(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {p.name?.slice(0, 1)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                <p className="truncate text-xs text-slate-400">{p.patientId} · {p.lungCondition}</p>
              </div>
              {isOn(p) ? (
                <span className="badge flex-shrink-0 bg-emerald-50 text-emerald-600">
                  {countFor(p)} video{countFor(p) === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="badge flex-shrink-0 bg-slate-100 text-slate-500">Not enabled</span>
              )}
              <span className="flex-shrink-0 text-xs font-medium text-brand-500">Manage →</span>
            </button>
          ))}
        </div>
      )}

      <ManageModal
        patient={target}
        videos={videos}
        current={target ? access[target._id] : null}
        onClose={closeTarget}
        onSaved={() => {
          closeTarget();
          reload();
        }}
        goLibrary={() => {
          closeTarget();
          goLibrary();
        }}
      />
    </>
  );
}

function ManageModal({ patient, videos, current, onClose, onSaved, goLibrary }) {
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      // Someone opening a patient who was never tagged almost certainly wants to turn it on
      setEnabled(current ? current.enabled : true);
      setSelected((current?.videoIds || []).filter((id) => videos.some((v) => v._id === id)));
      setSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const shown = videos.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.title.toLowerCase().includes(q) || (v.category || '').toLowerCase().includes(q);
  });
  const allShownSelected = shown.length > 0 && shown.every((v) => selected.includes(v._id));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/videos/access/${patient._id}`, { enabled, videoIds: selected });
      toast.success(enabled ? `Videos updated for ${patient.name}` : `Video access turned off for ${patient.name}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!patient}
      onClose={onClose}
      title="Manage Patient Videos"
      maxWidth="max-w-lg"
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      {patient && (
        <>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
              {patient.name?.slice(0, 1)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{patient.name}</p>
              <p className="truncate text-xs text-slate-400">{patient.patientId} · {patient.lungCondition}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 px-4 py-2">
            <ToggleField label="Video access" checked={enabled} onChange={setEnabled} />
            <p className="pb-1 text-xs text-slate-400">
              {enabled
                ? 'This patient will see a Videos tab in their app.'
                : 'Turned off. The patient sees no Videos tab. Your selection below is kept in case you turn it back on.'}
            </p>
          </div>

          {videos.length === 0 ? (
            <div className="space-y-2 py-4 text-center">
              <p className="text-sm text-slate-500">Your video library is empty.</p>
              <button className="btn-primary" onClick={goLibrary}>Go to Video Library</button>
            </div>
          ) : (
            <div className={enabled ? '' : 'pointer-events-none opacity-50'}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  Choose videos <span className="font-medium text-slate-400">({selected.length} selected)</span>
                </p>
                <button
                  className="text-xs font-semibold text-brand-600"
                  onClick={() =>
                    setSelected((s) =>
                      allShownSelected ? s.filter((id) => !shown.some((v) => v._id === id)) : Array.from(new Set([...s, ...shown.map((v) => v._id)]))
                    )
                  }
                >
                  {allShownSelected ? 'Clear' : 'Select all'}
                </button>
              </div>
              <SearchBar value={search} onChange={setSearch} placeholder="Search videos" />
              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-0.5">
                {shown.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No videos match.</p>}
                {shown.map((v) => {
                  const on = selected.includes(v._id);
                  return (
                    <label
                      key={v._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 transition ${
                        on ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input type="checkbox" className="h-4 w-4 flex-shrink-0 accent-brand-600" checked={on} onChange={() => toggle(v._id)} />
                      <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-slate-300"><Film className="h-5 w-5" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{v.title}</p>
                        <p className="truncate text-xs text-slate-400">{[v.category, fmtDuration(v.duration)].filter(Boolean).join(' · ') || ' '}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {enabled && selected.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">Nothing selected yet. The patient will see an empty Videos page.</p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
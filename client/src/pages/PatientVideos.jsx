import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlayCircle } from 'lucide-react';
import api from '../api/axios';
import { FullPageSpinner, EmptyState } from '../components/Ui';
import { VideoThumb, VideoPlayerModal } from '../components/VideoParts';

export default function PatientVideos() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [videos, setVideos] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    api
      .get('/videos/my')
      .then(({ data }) => {
        setEnabled(!!data.enabled);
        setVideos(data.videos || []);
      })
      .catch(() => toast.error('Failed to load your videos'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageSpinner />;

  if (!enabled) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="Exercise videos are not turned on for you"
        subtitle="If you would like exercise videos here instead of getting them on WhatsApp, please ask your PRT or the clinic."
      />
    );
  }

  const categories = ['All', ...Array.from(new Set(videos.map((v) => v.category).filter(Boolean)))];
  const shown = category === 'All' ? videos : videos.filter((v) => v.category === category);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">My Videos</p>
        <h1 className="text-xl font-extrabold text-slate-900">Your exercise videos</h1>
        <p className="text-xs text-slate-400">Tap a video to watch it. These were picked for you by your therapist.</p>
      </div>

      {videos.length === 0 ? (
        <EmptyState icon={PlayCircle} title="No videos yet" subtitle="Your therapist will add exercise videos here soon." />
      ) : (
        <>
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    category === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {shown.map((v) => (
              <div key={v._id} className="card overflow-hidden">
                <VideoThumb video={v} onPlay={() => setPlaying(v)} />
                <div className="space-y-1 p-4">
                  {v.category && <span className="badge bg-brand-50 text-brand-700">{v.category}</span>}
                  <p className="text-sm font-bold text-slate-900">{v.title}</p>
                  {v.description && <p className="line-clamp-2 text-xs text-slate-500">{v.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} protectDownload />
    </div>
  );
}
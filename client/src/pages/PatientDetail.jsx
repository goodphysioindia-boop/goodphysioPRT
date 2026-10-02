import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, addDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { ArrowLeft, MoreVertical, Plus, Activity, Pill, KeyRound, Video, Download, FileText, FileSpreadsheet, CreditCard } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, EmptyState } from '../components/Ui';
import Modal from '../components/Modal';
import { TextField, SelectField, TextareaField, RadioGroup } from '../components/FormFields';
import { exportPatientPdf, exportPatientExcel } from '../utils/patientExport';
import ScheduledSessionPicker from '../components/ScheduledSessionPicker';
import { SubscriptionBadge, SubscriptionBanner } from '../components/SubscriptionBadge';
import { Stars } from '../components/RatingCard';
import { getSubscriptionStatus, fmtSubDate, todayStr, PAYMENT_MODES } from '../utils/subscription';

const SESSION_TYPES = ['OPD', 'ICU/IPD', 'Home Visit', 'Online', 'Consultation'];

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'prt'; // PRT/Admin can add sessions & medicine; Doctor/Patient are view-only
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [sessionModal, setSessionModal] = useState(false);
  const [postVitalsModal, setPostVitalsModal] = useState(null); // holds session object
  const [sessionDetailModal, setSessionDetailModal] = useState(null); // holds session object for full view
  const [medicineModal, setMedicineModal] = useState(false);
  const [loginModal, setLoginModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratings, setRatings] = useState(null); // admin only: { ratings, count, average }
  const [subModal, setSubModal] = useState(false);
  const [subForm, setSubForm] = useState({ startDate: '', endDate: '', paymentMode: '' });
  const [exportModal, setExportModal] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null); // 'pdf' | 'excel' | null

  const [sessionForm, setSessionForm] = useState({ sessionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), sessionType: '', exerciseName: '', spo2Percent: '', heartRate: '', bpMmhg: '', remark: '', meetingLink: '', scheduledSession: '' });
  const [linkLocked, setLinkLocked] = useState(false); // true while the picked scheduled session supplies the link
  const [postForm, setPostForm] = useState({ heartRate: '', bpMmhg: '', respirationRate: '', sixMwtMeters: '', eq5d3lScore: '', remark: '' });
  const [medForm, setMedForm] = useState({ medicineName: '', dosage: '', frequency: '', notes: '' });
  const [loginForm, setLoginForm] = useState({ loginEmail: '', password: '' });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/patients/${id}`);
      setData(data);
    } catch (err) {
      toast.error('Failed to load patient');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Patient star ratings are for admins only
  useEffect(() => {
    if (!isAdmin) return;
    api.get(`/patients/${id}/ratings`).then(({ data }) => setRatings(data)).catch(() => {});
  }, [id, isAdmin]);

  if (loading) return <FullPageSpinner />;
  if (!data) return <EmptyState title="Patient not found" />;

  const { patient, sessions, medicines } = data;
  const subStatus = getSubscriptionStatus(patient);
  const subRunning = subStatus.key === 'active' || subStatus.key === 'expiring';

  const submitSession = async (e) => {
    e.preventDefault();
    const { sessionType, spo2Percent, heartRate, bpMmhg } = sessionForm;
    if (!sessionType || !spo2Percent || !heartRate || !bpMmhg) return toast.error('Please fill all required vitals');
    if (!sessionForm.sessionDate) return toast.error('Please set the session date');
    setSaving(true);
    try {
      await api.post(`/patients/${id}/sessions`, {
        ...sessionForm,
        sessionDate: new Date(sessionForm.sessionDate).toISOString(),
        spo2Percent: Number(spo2Percent),
        heartRate: Number(heartRate),
      });
      toast.success('Session started — pre-vitals recorded');
      setSessionModal(false);
      setSessionForm({ sessionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), sessionType: '', exerciseName: '', spo2Percent: '', heartRate: '', bpMmhg: '', remark: '', meetingLink: '', scheduledSession: '' });
      setLinkLocked(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add session');
    } finally {
      setSaving(false);
    }
  };

  // Opens the Activate / Extend popup. Extending a running subscription starts the
  // new period the day after the current one ends; otherwise it starts today.
  const openSubscriptionModal = () => {
    const start = subRunning ? format(addDays(parseISO(subStatus.endDate), 1), 'yyyy-MM-dd') : todayStr();
    setSubForm({ startDate: start, endDate: '', paymentMode: '' });
    setSubModal(true);
  };

  const submitSubscription = async (e) => {
    e.preventDefault();
    const { startDate, endDate, paymentMode } = subForm;
    if (!startDate || !endDate) return toast.error('Start date and end date are required');
    if (endDate < startDate) return toast.error('End date cannot be before the start date');
    if (!paymentMode) return toast.error('Please select how the payment was made');
    setSaving(true);
    try {
      await api.post(`/patients/${id}/subscription`, subForm);
      toast.success(subRunning ? 'Subscription extended' : 'Subscription activated');
      setSubModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const submitPostVitals = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patients/${id}/sessions/${postVitalsModal._id}`, {
        ...postForm,
        heartRate: postForm.heartRate ? Number(postForm.heartRate) : undefined,
        respirationRate: postForm.respirationRate ? Number(postForm.respirationRate) : undefined,
        sixMwtMeters: postForm.sixMwtMeters ? Number(postForm.sixMwtMeters) : undefined,
      });
      toast.success('Post-session vitals saved');
      setPostVitalsModal(null);
      setPostForm({ heartRate: '', bpMmhg: '', respirationRate: '', sixMwtMeters: '', eq5d3lScore: '', remark: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save post-vitals');
    } finally {
      setSaving(false);
    }
  };

  const submitMedicine = async (e) => {
    e.preventDefault();
    if (!medForm.medicineName) return toast.error('Medicine name is required');
    setSaving(true);
    try {
      await api.post(`/patients/${id}/medicines`, medForm);
      toast.success('Medicine data added');
      setMedicineModal(false);
      setMedForm({ medicineName: '', dosage: '', frequency: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add medicine');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePatient = async () => {
    setDeleting(true);
    try {
      await api.delete(`/patients/${id}`);
      toast.success('Patient deleted');
      navigate('/my-patients');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete patient');
    } finally {
      setDeleting(false);
      setDeleteModal(false);
    }
  };

  const submitPatientLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.loginEmail || !loginForm.password) return toast.error('Email and password are required');
    setSaving(true);
    try {
      await api.post(`/patients/${id}/create-login`, loginForm);
      toast.success('Patient portal login created');
      setLoginModal(false);
      setLoginForm({ loginEmail: '', password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create patient login');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (fmt) => {
    setExportingFormat(fmt);
    try {
      if (fmt === 'pdf') {
        exportPatientPdf(patient, sessions, medicines);
      } else {
        await exportPatientExcel(patient, sessions, medicines);
      }
      toast.success(`${fmt === 'pdf' ? 'PDF' : 'Excel'} report downloaded`);
      setExportModal(false);
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setExportingFormat(null);
    }
  };

  const gridItems = [
    ['Age', `${patient.age} Yrs`],
    ['Doctor', patient.assignedDoctor?.doctorName || '-'],
    ['Doctor Specialty', patient.assignedDoctor?.specialty || '-'],
    ['Primary Diagnosis', patient.lungCondition],
    ['Created Date', format(new Date(patient.createdAt), 'd MMM yyyy, h:mm a')],
    ['Creator Email', patient.addedByPrtEmail],
    ['Time Slot', patient.timeSlot || '-'],
    ['Phone Number', patient.phoneNumber],
    ['Secondary Conditions', patient.secondaryConditions?.join(', ') || 'None'],
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setExportModal(true)} className="btn-secondary text-xs">
            <Download className="h-4 w-4" /> Export
          </button>
        {(canWrite || isAdmin) && (
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 w-48 rounded-xl border border-slate-100 bg-white py-1 shadow-pop">
                {canWrite && (
                  <button
                    className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setMedicineModal(true);
                    }}
                  >
                    + Add Medicine
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setLoginModal(true);
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Create Patient Login
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/my-patients/${id}/edit`);
                    }}
                  >
                    Edit Patient
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteModal(true);
                    }}
                  >
                    Delete Patient
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Patient Name</p>
        <h1 className="text-xl font-extrabold text-slate-900">{patient.name}</h1>
        <p className="text-xs text-slate-400">{patient.patientId}</p>
      </div>

      <div className="card divide-y divide-slate-50 px-4">
        {gridItems.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="max-w-[60%] text-right font-medium text-slate-700">{value}</span>
          </div>
        ))}
      </div>

      {/* Subscription */}
      <div className="space-y-3">
        <SubscriptionBanner status={subStatus} />
        <div className="card divide-y divide-slate-50 px-4">
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-1.5 text-slate-400">
              <CreditCard className="h-4 w-4" /> Subscription
            </span>
            <SubscriptionBadge status={subStatus} />
          </div>
          {subStatus.key !== 'none' &&
            [
              ['Plan', subStatus.planLabel],
              ['Valid From', fmtSubDate(subStatus.startDate)],
              ['Valid Till', fmtSubDate(subStatus.endDate)],
              ...(patient.subscription?.paymentMode ? [['Payment', patient.subscription.paymentMode]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="max-w-[60%] text-right font-medium text-slate-700">{value}</span>
              </div>
            ))}
        </div>
        {canWrite && (
          <button onClick={openSubscriptionModal} className="btn-secondary w-full">
            <CreditCard className="h-4 w-4" /> {subRunning ? 'Extend Subscription' : 'Activate Subscription'}
          </button>
        )}
      </div>

      {isAdmin && ratings && (
        <div className="card px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Patient Rating</span>
            {ratings.count > 0 ? (
              <span className="flex items-center gap-2">
                <Stars value={ratings.average} />
                <span className="font-semibold text-slate-700">{ratings.average.toFixed(1)}</span>
                <span className="text-xs text-slate-400">({ratings.count})</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400">Not rated yet</span>
            )}
          </div>
          {ratings.count > 0 && (
            <div className="mt-2 max-h-40 divide-y divide-slate-50 overflow-y-auto border-t border-slate-50">
              {ratings.ratings.map((r) => (
                <div key={r._id} className="flex items-center justify-between py-1.5 text-xs">
                  <Stars value={r.stars} size="h-3.5 w-3.5" />
                  <span className="text-slate-400">{format(parseISO(r.day), 'd MMM yyyy')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="field-label">Patient Consent Form</p>
        <a href={patient.consentFormUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200">
          <img src={patient.consentFormUrl} alt="Consent form" className="w-full object-contain bg-slate-50 max-h-80" />
        </a>
      </div>

      {canWrite && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              // Default the session date to "now" each time the form opens (still editable)
              setSessionForm((f) => ({ ...f, sessionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") }));
              setSessionModal(true);
            }}
            className="btn-primary flex-1"
          >
            <Plus className="h-4 w-4" /> Add Session
          </button>
          <button onClick={() => setMedicineModal(true)} className="btn-secondary flex-1">
            <Pill className="h-4 w-4" /> Add Medicine Data
          </button>
        </div>
      )}

      {/* Sessions */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <Activity className="h-4 w-4 text-brand-500" /> Session Log
        </h2>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" />
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s._id}
                role="button"
                tabIndex={0}
                onClick={() => setSessionDetailModal(s)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSessionDetailModal(s); }}
                className="card cursor-pointer p-4 text-sm transition hover:border-brand-200 hover:shadow-pop"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="badge bg-brand-50 text-brand-700">Session {s.sessionNumber}</span>
                  <span className={`badge ${s.status === 'complete' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {s.status === 'complete' ? 'Complete' : 'Pre-vitals only'}
                  </span>
                </div>
                <p className="mb-2 font-semibold text-slate-700">{s.sessionType}{s.exerciseName ? ` — ${s.exerciseName}` : ''}</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div><span className="block text-slate-400">SPO2 Pre</span>{s.preVitals?.spo2Percent}%</div>
                  <div><span className="block text-slate-400">HR Pre</span>{s.preVitals?.heartRate} bpm</div>
                  <div><span className="block text-slate-400">BP Pre</span>{s.preVitals?.bpMmhg}</div>
                </div>
                {s.meetingLink && (
                  <a
                    href={s.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-600 underline decoration-dotted"
                  >
                    <Video className="h-3.5 w-3.5" /> Join link shared with patient
                  </a>
                )}
                {s.status === 'complete' ? (
                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-50 pt-2 text-xs text-slate-500">
                    <div><span className="block text-slate-400">HR Post</span>{s.postVitals?.heartRate} bpm</div>
                    <div><span className="block text-slate-400">BP Post</span>{s.postVitals?.bpMmhg}</div>
                    <div><span className="block text-slate-400">6MWT</span>{s.postVitals?.sixMwtMeters ?? '-'} m</div>
                  </div>
                ) : (
                  canWrite && (
                    <button
                      className="btn-secondary mt-3 w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPostForm({ heartRate: '', bpMmhg: '', respirationRate: '', sixMwtMeters: '', eq5d3lScore: '', remark: '' });
                        setPostVitalsModal(s);
                      }}
                    >
                      Record Post-Session Vitals
                    </button>
                  )
                )}
                <p className="mt-2 text-right text-[11px] font-medium text-brand-500">Tap for full session data →</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Medicines */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <Pill className="h-4 w-4 text-brand-500" /> Medicine Data
        </h2>
        {medicines.length === 0 ? (
          <EmptyState title="No medicine data yet" />
        ) : (
          <div className="space-y-2">
            {medicines.map((m) => (
              <div key={m._id} className="card p-3.5 text-sm">
                <p className="font-semibold text-slate-800">{m.medicineName}</p>
                <p className="text-xs text-slate-400">{[m.dosage, m.frequency].filter(Boolean).join(' · ')}</p>
                {m.notes && <p className="mt-1 text-xs text-slate-500">{m.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Session Modal (Pre-Vitals) */}
      <Modal
        open={sessionModal}
        onClose={() => setSessionModal(false)}
        title="Add Session Data"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setSessionModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitSession}>{saving ? 'Saving…' : 'Submit'}</button>
          </>
        }
      >
        <div className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
          Current Session No: {sessions.length + 1}
        </div>
        <ScheduledSessionPicker
          active={sessionModal}
          patientId={id}
          value={sessionForm.scheduledSession}
          onPick={(picked) => {
            const sessionLink = picked?.meetingLink || '';
            setSessionForm((f) => ({
              ...f,
              scheduledSession: picked?._id || '',
              // Session type is pre-filled (still editable); the link is taken from the session and locked
              sessionType: picked && SESSION_TYPES.includes(picked.sessionType) ? picked.sessionType : f.sessionType,
              meetingLink: sessionLink || (linkLocked ? '' : f.meetingLink),
            }));
            setLinkLocked(!!sessionLink);
          }}
        />
        <SelectField label="Session Type" required options={SESSION_TYPES} value={sessionForm.sessionType} onChange={(e) => setSessionForm((f) => ({ ...f, sessionType: e.target.value }))} />
        <TextField label="Session Date & Time" required type="datetime-local" value={sessionForm.sessionDate} onChange={(e) => setSessionForm((f) => ({ ...f, sessionDate: e.target.value }))} />
        <TextField label="Exercise" value={sessionForm.exerciseName} onChange={(e) => setSessionForm((f) => ({ ...f, exerciseName: e.target.value }))} />
        <p className="pt-1 text-xs font-bold uppercase text-slate-400">Pre Session Vitals</p>
        <TextField label="SPO2 (Pre-Session) %" required type="number" value={sessionForm.spo2Percent} onChange={(e) => setSessionForm((f) => ({ ...f, spo2Percent: e.target.value }))} />
        <TextField label="HeartRate Pre" required type="number" value={sessionForm.heartRate} onChange={(e) => setSessionForm((f) => ({ ...f, heartRate: e.target.value }))} />
        <TextField label="BP (Pre-Session) mmHg" required value={sessionForm.bpMmhg} onChange={(e) => setSessionForm((f) => ({ ...f, bpMmhg: e.target.value }))} placeholder="125/86" />
        <TextareaField label="Remark" value={sessionForm.remark} onChange={(e) => setSessionForm((f) => ({ ...f, remark: e.target.value }))} placeholder="Any additional notes about this session" />
        <TextField
          label="Meeting / Join Link"
          value={sessionForm.meetingLink}
          onChange={(e) => setSessionForm((f) => ({ ...f, meetingLink: e.target.value }))}
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          disabled={linkLocked}
        />
        <p className="-mt-2 text-xs text-slate-400">
          {linkLocked
            ? 'Using the selected session\'s shared link — it can only be changed by editing the scheduled session.'
            : 'This link will appear as a "Join" button on the patient\'s Sessions tab.'}
        </p>
      </Modal>

      {/* Activate / Extend Subscription Modal */}
      <Modal
        open={subModal}
        onClose={() => setSubModal(false)}
        title={subRunning ? 'Extend Subscription' : 'Activate Subscription'}
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setSubModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitSubscription}>
              {saving ? 'Saving…' : subRunning ? 'Extend' : 'Activate'}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-400">
          Set the new subscription period for {patient.name}. Their sessions unlock from the start date and lock again after the end date.
        </p>
        <TextField label="Start Date" required type="date" value={subForm.startDate} onChange={(e) => setSubForm((f) => ({ ...f, startDate: e.target.value }))} />
        <TextField label="End Date" required type="date" min={subForm.startDate || undefined} value={subForm.endDate} onChange={(e) => setSubForm((f) => ({ ...f, endDate: e.target.value }))} />
        <RadioGroup label="Payment Mode" required options={PAYMENT_MODES} value={subForm.paymentMode} onChange={(v) => setSubForm((f) => ({ ...f, paymentMode: v }))} />
      </Modal>

      {/* Post-Session Vitals Modal */}
      <Modal
        open={!!postVitalsModal}
        onClose={() => setPostVitalsModal(null)}
        title="Add Session Data"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setPostVitalsModal(null)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitPostVitals}>{saving ? 'Saving…' : 'Submit'}</button>
          </>
        }
      >
        <TextField label="HeartRate Post" required type="number" value={postForm.heartRate} onChange={(e) => setPostForm((f) => ({ ...f, heartRate: e.target.value }))} />
        <TextField label="BP (Post Session) mmHg" required value={postForm.bpMmhg} onChange={(e) => setPostForm((f) => ({ ...f, bpMmhg: e.target.value }))} placeholder="130/88" />
        <TextField label="Post - Respirate (breaths/minute)" type="number" value={postForm.respirationRate} onChange={(e) => setPostForm((f) => ({ ...f, respirationRate: e.target.value }))} />
        <TextField label="6MWT (Distance covered in 6 Minutes)" type="number" value={postForm.sixMwtMeters} onChange={(e) => setPostForm((f) => ({ ...f, sixMwtMeters: e.target.value }))} />
        <TextField
          label="EQ5D3L (e.g. 32132 | 3 M-Mobility, 2 SC-Self Care, 1 UA-Usual Activity, 3 P/D-Pain/Discomfort, 2 A/D-Anxiety/Depression)"
          maxLength={5}
          value={postForm.eq5d3lScore}
          onChange={(e) => setPostForm((f) => ({ ...f, eq5d3lScore: e.target.value }))}
        />
        <TextareaField label="Remark" value={postForm.remark} onChange={(e) => setPostForm((f) => ({ ...f, remark: e.target.value }))} placeholder="Any additional notes about this session" />
      </Modal>

      {/* Full Session Data Modal (read-only view) */}
      <Modal
        open={!!sessionDetailModal}
        onClose={() => setSessionDetailModal(null)}
        title={sessionDetailModal ? `Session ${sessionDetailModal.sessionNumber} — Full Data` : ''}
        footer={
          <button className="btn-secondary flex-1" onClick={() => setSessionDetailModal(null)}>Close</button>
        }
      >
        {sessionDetailModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="badge bg-brand-50 text-brand-700">Session {sessionDetailModal.sessionNumber}</span>
              <span className={`badge ${sessionDetailModal.status === 'complete' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {sessionDetailModal.status === 'complete' ? 'Complete' : 'Pre-vitals only'}
              </span>
            </div>

            <div className="card divide-y divide-slate-50 px-3.5">
              {[
                ['Session ID', sessionDetailModal.sessionId || '-'],
                ['Session Type', sessionDetailModal.sessionType],
                ['Exercise', sessionDetailModal.exerciseName || '-'],
                ...(sessionDetailModal.scheduledSession?.name ? [['Scheduled Session', `${sessionDetailModal.scheduledSession.name} (${sessionDetailModal.scheduledSession.scheduleId})`]] : []),
                ['Session Date', (sessionDetailModal.sessionDate || sessionDetailModal.createdAt) ? format(new Date(sessionDetailModal.sessionDate || sessionDetailModal.createdAt), 'd MMM yyyy, h:mm a') : '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="max-w-[60%] text-right font-medium text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            {sessionDetailModal.meetingLink && (
              <a
                href={sessionDetailModal.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 underline decoration-dotted"
              >
                <Video className="h-3.5 w-3.5" /> Join link shared with patient
              </a>
            )}

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase text-slate-400">Pre-Session Vitals</p>
              <div className="card divide-y divide-slate-50 px-3.5">
                {[
                  ['SPO2', sessionDetailModal.preVitals?.spo2Percent != null ? `${sessionDetailModal.preVitals.spo2Percent}%` : '-'],
                  ['Heart Rate', sessionDetailModal.preVitals?.heartRate != null ? `${sessionDetailModal.preVitals.heartRate} bpm` : '-'],
                  ['BP', sessionDetailModal.preVitals?.bpMmhg || '-'],
                  ['Remark', sessionDetailModal.preVitals?.remark || '-'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-medium text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase text-slate-400">Post-Session Vitals</p>
              {sessionDetailModal.status === 'complete' ? (
                <div className="card divide-y divide-slate-50 px-3.5">
                  {[
                    ['Heart Rate', sessionDetailModal.postVitals?.heartRate != null ? `${sessionDetailModal.postVitals.heartRate} bpm` : '-'],
                    ['BP', sessionDetailModal.postVitals?.bpMmhg || '-'],
                    ['Respiration Rate', sessionDetailModal.postVitals?.respirationRate != null ? `${sessionDetailModal.postVitals.respirationRate} breaths/min` : '-'],
                    ['6MWT', sessionDetailModal.postVitals?.sixMwtMeters != null ? `${sessionDetailModal.postVitals.sixMwtMeters} m` : '-'],
                    ['EQ5D3L Score', sessionDetailModal.postVitals?.eq5d3lScore || '-'],
                    ['Remark', sessionDetailModal.postVitals?.remark || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-medium text-slate-700">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Post-session vitals not recorded yet" />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Medicine Modal */}
      <Modal
        open={medicineModal}
        onClose={() => setMedicineModal(false)}
        title="Add Medicine Data"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setMedicineModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitMedicine}>{saving ? 'Saving…' : 'Submit'}</button>
          </>
        }
      >
        <TextField label="Medicine Name" required value={medForm.medicineName} onChange={(e) => setMedForm((f) => ({ ...f, medicineName: e.target.value }))} />
        <TextField label="Dosage" value={medForm.dosage} onChange={(e) => setMedForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 500mg" />
        <TextField label="Frequency" value={medForm.frequency} onChange={(e) => setMedForm((f) => ({ ...f, frequency: e.target.value }))} placeholder="e.g. 1-0-1 after food" />
        <TextareaField label="Notes" value={medForm.notes} onChange={(e) => setMedForm((f) => ({ ...f, notes: e.target.value }))} />
      </Modal>

      {/* Create Patient Login Modal (Admin only) */}
      <Modal
        open={loginModal}
        onClose={() => setLoginModal(false)}
        title="Create Patient Login"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setLoginModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitPatientLogin}>{saving ? 'Creating…' : 'Create Login'}</button>
          </>
        }
      >
        <p className="text-xs text-slate-400">
          This gives {patient.name} their own portal access to view their profile and join online sessions.
        </p>
        <TextField label="Login Email" required type="email" value={loginForm.loginEmail} onChange={(e) => setLoginForm((f) => ({ ...f, loginEmail: e.target.value }))} placeholder={patient.email || 'patient@example.com'} />
        <TextField label="Temporary Password" required value={loginForm.password} onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
      </Modal>

      {/* Delete Patient Confirmation (Admin only) */}
      <Modal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Patient"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setDeleteModal(false)}>Cancel</button>
            <button
              className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={confirmDeletePatient}
            >
              {deleting ? 'Deleting…' : 'Delete Patient'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <span className="font-semibold">{patient.name}</span>? This will permanently remove their record, all session logs, and all medicine data. This action cannot be undone.
        </p>
      </Modal>

      {/* Export Patient Report Modal */}
      <Modal open={exportModal} onClose={() => setExportModal(false)} title="Export Patient Report">
        <p className="text-xs text-slate-400">
          Includes patient details, the full session log, and medicine data for {patient.name}.
        </p>
        <div className="space-y-2.5">
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!exportingFormat}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <FileText className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-800">
                {exportingFormat === 'pdf' ? 'Generating PDF…' : 'Export as PDF'}
              </span>
              <span className="block text-xs text-slate-400">A print-ready clinical report</span>
            </span>
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={!!exportingFormat}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-800">
                {exportingFormat === 'excel' ? 'Generating Excel…' : 'Export as Excel'}
              </span>
              <span className="block text-xs text-slate-400">Formatted spreadsheet with separate sheets</span>
            </span>
          </button>
        </div>
      </Modal>
    </div>
  );
}
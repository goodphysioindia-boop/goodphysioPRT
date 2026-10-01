import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../api/axios';
import Modal from './Modal';
import PickerList from './PickerList';
import { TextField, SelectField, RadioGroup } from './FormFields';
import { Spinner } from './Ui';
import { SESSION_TYPES, SESSION_MODES, TIME_SLOTS, modeLabel, slotFromTimes, timesFromSlot } from '../utils/sessionSchedule';

const CUSTOM_SLOT = 'Custom time';

const blankForm = () => ({
  name: '',
  mode: 'group',
  sessionType: '',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: '',
  slot: '',
  customFrom: '',
  customTo: '',
  meetingLink: '',
  prts: [],
  doctors: [],
  patients: [],
});

const formFromSession = (s) => {
  const preset = TIME_SLOTS.includes(s.timeSlot);
  const t = preset ? { from: '', to: '' } : timesFromSlot(s.timeSlot);
  return {
    name: s.name,
    mode: s.mode,
    sessionType: s.sessionType,
    startDate: s.startDate,
    endDate: s.endDate,
    slot: preset ? s.timeSlot : CUSTOM_SLOT,
    customFrom: t.from,
    customTo: t.to,
    meetingLink: s.meetingLink || '',
    prts: (s.prts || []).map((p) => p._id),
    doctors: (s.doctors || []).map((d) => d._id),
    patients: (s.patients || []).map((p) => p._id),
  };
};

// Fetched list + anything already on the session (so edits never lose a participant
// that the current user's own lists don't happen to include)
const mergeById = (primary, extra) => {
  const seen = new Set(primary.map((i) => i.id));
  return [...primary, ...extra.filter((i) => !seen.has(i.id))];
};

// Create (initial = null) or edit (initial = session) a scheduled session.
export default function ScheduledSessionForm({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prts, setPrts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);

  const isOneOnOne = form.mode === 'one-on-one';

  useEffect(() => {
    if (!open) return;
    setForm(initial ? formFromSession(initial) : blankForm());
    let cancelled = false;
    setLoading(true);
    Promise.all([api.get('/users?role=prt'), api.get('/doctors'), api.get('/patients')])
      .then(([u, d, p]) => {
        if (cancelled) return;
        setPrts(u.data.filter((x) => !x.isInactive));
        setDoctors(d.data);
        setPatients(p.data);
      })
      .catch(() => !cancelled && toast.error('Failed to load PRTs, doctors or patients'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, initial]);

  const prtItems = useMemo(
    () =>
      mergeById(
        prts.map((u) => ({ id: u._id, label: u.name, sub: [u.prtId, u.zone].filter(Boolean).join(' · ') })),
        (initial?.prts || []).map((u) => ({ id: u._id, label: u.name, sub: [u.prtId, u.zone].filter(Boolean).join(' · ') }))
      ),
    [prts, initial]
  );
  const doctorItems = useMemo(
    () =>
      mergeById(
        doctors.map((d) => ({ id: d._id, label: d.doctorName || 'Unnamed doctor', sub: `${d.doctorId} · ${d.specialty}` })),
        (initial?.doctors || []).map((d) => ({ id: d._id, label: d.doctorName || 'Unnamed doctor', sub: `${d.doctorId} · ${d.specialty}` }))
      ),
    [doctors, initial]
  );
  const patientItems = useMemo(
    () =>
      mergeById(
        patients.map((p) => ({
          id: p._id,
          label: p.name,
          sub: [p.patientId, p.addedBy?.name && `PRT: ${p.addedBy.name}`, p.assignedDoctor?.doctorName].filter(Boolean).join(' · '),
        })),
        (initial?.patients || []).map((p) => ({ id: p._id, label: p.name, sub: p.patientId }))
      ),
    [patients, initial]
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setMode = (label) => {
    const mode = SESSION_MODES.find((m) => m.label === label)?.value || 'group';
    // One-on-one allows a single patient — keep the first one if several were picked
    setForm((f) => ({ ...f, mode, patients: mode === 'one-on-one' ? f.patients.slice(0, 1) : f.patients }));
  };

  const submit = async () => {
    const f = form;
    if (!f.name.trim()) return toast.error('Session name is required');
    if (!f.sessionType) return toast.error('Please select a session type');
    if (!f.startDate || !f.endDate) return toast.error('Start date and end date are required');
    if (f.endDate < f.startDate) return toast.error('End date cannot be before the start date');

    let timeSlot = f.slot;
    if (!timeSlot) return toast.error('Please select a time slot');
    if (timeSlot === CUSTOM_SLOT) {
      if (!f.customFrom || !f.customTo) return toast.error('Enter both a from and to time');
      if (f.customTo <= f.customFrom) return toast.error('The slot end time must be after the start time');
      timeSlot = slotFromTimes(f.customFrom, f.customTo);
    }

    const link = f.meetingLink.trim();
    if (f.sessionType === 'Online' && !link) return toast.error('A meeting link is required for Online sessions');
    if (link && !/^https?:\/\/\S+$/i.test(link)) return toast.error('Meeting link must start with http:// or https://');

    if (isOneOnOne && f.patients.length !== 1) return toast.error('Select exactly one patient for a one-on-one session');
    if (!isOneOnOne && f.patients.length < 1) return toast.error('Select at least one patient');

    const payload = {
      name: f.name.trim(),
      mode: f.mode,
      sessionType: f.sessionType,
      startDate: f.startDate,
      endDate: f.endDate,
      timeSlot,
      meetingLink: link,
      prts: f.prts,
      doctors: f.doctors,
      patients: f.patients,
    };

    setSaving(true);
    try {
      const { data } = initial
        ? await api.put(`/scheduled-sessions/${initial._id}`, payload)
        : await api.post('/scheduled-sessions', payload);
      toast.success(initial ? 'Session updated' : 'Session scheduled');
      onSaved?.(data);
      onClose();
    } catch (err) {
      const d = err.response?.data;
      // Include the server's detail on a 500 so the real cause is visible on screen
      toast.error(d?.error ? `${d.message}: ${d.error}` : d?.message || 'Failed to save session', { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      title={initial ? 'Edit Session' : 'Add Session'}
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={saving || loading} onClick={submit}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Schedule Session'}
          </button>
        </>
      }
    >
      <RadioGroup label="Session Mode" required options={SESSION_MODES.map((m) => m.label)} value={modeLabel(form.mode)} onChange={setMode} />
      <TextField label="Session Name" required value={form.name} onChange={set('name')} placeholder="e.g. Morning Breathing Batch" />
      <SelectField label="Session Type" required options={SESSION_TYPES} value={form.sessionType} onChange={set('sessionType')} />

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start Date" required type="date" value={form.startDate} onChange={set('startDate')} />
        <TextField label="End Date" required type="date" min={form.startDate || undefined} value={form.endDate} onChange={set('endDate')} />
      </div>

      <SelectField label="Time Slot" required options={[...TIME_SLOTS, CUSTOM_SLOT]} value={form.slot} onChange={set('slot')} />
      {form.slot === CUSTOM_SLOT && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="From" required type="time" value={form.customFrom} onChange={set('customFrom')} />
          <TextField label="To" required type="time" value={form.customTo} onChange={set('customTo')} />
        </div>
      )}

      <TextField
        label="Meeting Link"
        required={form.sessionType === 'Online'}
        value={form.meetingLink}
        onChange={set('meetingLink')}
        placeholder="https://meet.google.com/xxx-xxxx-xxx"
      />
      <p className="-mt-2 text-xs text-slate-400">
        One link for the whole session — every selected patient joins with it.
      </p>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <>
          <PickerList
            label={isOneOnOne ? 'Patient' : 'Patients'}
            required
            single={isOneOnOne}
            hint={isOneOnOne ? 'Only one patient can be selected for a one-on-one session.' : undefined}
            items={patientItems}
            selected={form.patients}
            onChange={(patients) => setForm((f) => ({ ...f, patients }))}
            placeholder="Search by patient, ID, PRT or doctor"
            emptyText="No patients available"
          />
          <PickerList
            label="PRTs"
            items={prtItems}
            selected={form.prts}
            onChange={(prts) => setForm((f) => ({ ...f, prts }))}
            placeholder="Search PRTs"
            emptyText="No PRTs available"
          />
          <PickerList
            label="Doctors"
            items={doctorItems}
            selected={form.doctors}
            onChange={(doctors) => setForm((f) => ({ ...f, doctors }))}
            placeholder="Search doctors"
            emptyText="No doctors available"
          />
          <p className="text-xs text-slate-400">Everyone selected above will be able to see this session.</p>
        </>
      )}
    </Modal>
  );
}
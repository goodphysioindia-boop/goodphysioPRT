import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { SelectField } from './FormFields';
import { getSessionStatus, fmtRange, modeLabel } from '../utils/sessionSchedule';

// "Scheduled Session (optional)" dropdown shared by both Add Session forms
// (Register a Patient → pre-vitals, and Patient Detail → Add Session).
//
// Lists the running / upcoming scheduled sessions the logged-in user can see
// (the API already scopes this: admin → all, PRT → the ones they created or
// were selected for). Group sessions are always offered; one-on-one sessions
// only when this patient is already the one in them.
//
// onPick(session | null) lets the parent pre-fill session type / meeting link.
export default function ScheduledSessionPicker({ active = true, patientId, value, onPick }) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    api
      .get('/scheduled-sessions')
      .then(({ data }) => {
        if (cancelled) return;
        const isIn = (s) => (s.patients || []).some((p) => String(p?._id || p) === String(patientId));
        setOptions(data.filter((s) => getSessionStatus(s).key !== 'ended' && (s.mode === 'group' || isIn(s))));
      })
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [active, patientId]);

  if (options.length === 0) return null;

  const picked = options.find((s) => s._id === value);
  const alreadyIn = picked && (picked.patients || []).some((p) => String(p?._id || p) === String(patientId));

  return (
    <>
      <SelectField
        label="Scheduled Session (optional)"
        placeholder="Not linked to a scheduled session"
        options={options.map((s) => ({
          value: s._id,
          label: `${s.name} · ${modeLabel(s.mode)} · ${fmtRange(s.startDate, s.endDate)} · ${s.timeSlot}`,
        }))}
        value={value}
        onChange={(e) => onPick(options.find((s) => s._id === e.target.value) || null)}
      />
      <p className="-mt-2 text-xs text-slate-400">
        {picked && !alreadyIn
          ? 'This patient will be added to the selected session. Its session type and meeting link are filled in below — both stay editable.'
          : 'Picking one fills in the session type and shared meeting link.'}
      </p>
    </>
  );
}
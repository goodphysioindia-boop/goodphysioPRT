import React from 'react';
import { CalendarDays, Clock, Video, Users, Stethoscope, UserCog, AlertTriangle } from 'lucide-react';
import { getSessionStatus, fmtRange, fmtDate, modeLabel } from '../utils/sessionSchedule';

const TONES = {
  upcoming: 'bg-sky-50 text-sky-700',
  ongoing: 'bg-emerald-50 text-emerald-600',
  'ending-soon': 'bg-amber-100 text-amber-700',
  ended: 'bg-slate-100 text-slate-500',
};

export function SessionStatusBadge({ status }) {
  return (
    <span className={`badge gap-1.5 ${TONES[status.key]}`}>
      {status.key === 'ending-soon' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
      {status.label}
    </span>
  );
}

// Amber strip that makes an approaching end date impossible to miss
export function EndingAlert({ session, status }) {
  if (status.key !== 'ending-soon') return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 animate-pulse text-amber-500" />
      <span>
        {status.label} — last day is {fmtDate(session.endDate)}
      </span>
    </div>
  );
}

// `onClick` makes the whole card tappable (staff view); omit it for a static card (patient view).
export default function ScheduledSessionCard({ session, onClick }) {
  const status = getSessionStatus(session);
  const ended = status.key === 'ended';
  const endingSoon = status.key === 'ending-soon';
  const interactive = typeof onClick === 'function';

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`card space-y-3 p-4 transition ${interactive ? 'cursor-pointer hover:border-brand-200 hover:shadow-pop' : ''} ${
        endingSoon ? 'border-amber-300 ring-1 ring-amber-200' : ''
      } ${ended ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge bg-brand-50 text-brand-700">{modeLabel(session.mode)}</span>
          <span className="badge bg-slate-100 text-slate-600">{session.sessionType}</span>
        </div>
        <SessionStatusBadge status={status} />
      </div>

      <div>
        <p className="truncate text-sm font-bold text-slate-900">{session.name}</p>
        <p className="text-xs text-slate-400">{session.scheduleId}</p>
      </div>

      <div className="space-y-1 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          {fmtRange(session.startDate, session.endDate)}
        </p>
        <p className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {session.timeSlot}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          {session.patientCount ?? session.patients?.length ?? 0} patient{(session.patientCount ?? session.patients?.length) === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1.5">
          <UserCog className="h-3.5 w-3.5 text-slate-400" />
          {session.prts?.length || 0} PRT{session.prts?.length === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
          {session.doctors?.length || 0} doctor{session.doctors?.length === 1 ? '' : 's'}
        </span>
      </div>

      <EndingAlert session={session} status={status} />

      {session.meetingLink &&
        (ended ? (
          <button disabled className="btn-secondary w-full opacity-60" onClick={(e) => e.stopPropagation()}>
            Session ended
          </button>
        ) : (
          <a
            href={session.meetingLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn-primary w-full"
          >
            <Video className="h-4 w-4" /> Join Now
          </a>
        ))}
    </div>
  );
}
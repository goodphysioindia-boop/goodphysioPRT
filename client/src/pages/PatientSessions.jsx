import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Video, Clock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, EmptyState } from '../components/Ui';
import ScheduledSessionCard from '../components/ScheduledSessionCard';
import { sortSessions, getSessionStatus, getJoinState } from '../utils/sessionSchedule';
import { getSubscriptionStatus } from '../utils/subscription';
import { SubscriptionBanner } from '../components/SubscriptionBadge';
import useNow from '../utils/useNow';
import RatingCard from '../components/RatingCard';

export default function PatientSessions() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [patient, setPatient] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.linkedPatient) {
      setLoading(false);
      return;
    }
    Promise.all([
      // Patient record (subscription + time slot) together with their session log
      api.get(`/patients/${user.linkedPatient}`),
      // Sessions the admin / a PRT / a doctor scheduled this patient into
      api.get('/scheduled-sessions').catch(() => ({ data: [] })),
    ])
      .then(([sess, sched]) => {
        // Sessions come back sorted oldest -> newest; the current session is
        // the most recently created one.
        setPatient(sess.data.patient);
        setSession(sess.data.sessions.length ? sess.data.sessions[sess.data.sessions.length - 1] : null);
        setScheduled(sortSessions(sched.data));
      })
      .catch(() => toast.error('Failed to load your session'))
      .finally(() => setLoading(false));
  }, [user]);

  const now = useNow(!!patient);
  if (loading) return <FullPageSpinner />;

  const subStatus = getSubscriptionStatus(patient, now);

  // The older single "Join Now" link follows the patient's own time slot and subscription
  const legacyJoin = getJoinState(patient?.timeSlot, now);
  const legacyLock = !subStatus.active ? 'Subscription expired' : !legacyJoin.open ? legacyJoin.label : null;

  const endingSoon = scheduled.filter((s) => getSessionStatus(s).key === 'ending-soon');

  // The older single "Join Now" link (entered by the PRT when logging a session) is
  // kept as is. When scheduled sessions exist it only shows if its link is different,
  // so the same link is never offered twice.
  const showLegacyJoin = scheduled.length === 0 || (session?.meetingLink && !scheduled.some((s) => s.meetingLink === session.meetingLink));

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Session</h1>
        <p className="text-sm text-slate-400">Join your session using the button below</p>
      </div>

      <SubscriptionBanner status={subStatus} patientView />

      {endingSoon.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
          {endingSoon.length === 1
            ? `Your session "${endingSoon[0].name}" is ending soon.`
            : `${endingSoon.length} of your sessions are ending soon.`}
        </div>
      )}

      {scheduled.length > 0 && (
        <div className="space-y-3">
          {scheduled.map((s) => (
            <ScheduledSessionCard key={s._id} session={s} restrictJoin subscriptionActive={subStatus.active} />
          ))}
        </div>
      )}

      {scheduled.length === 0 && !session ? (
        <EmptyState icon={Video} title="No session scheduled yet" />
      ) : (
        showLegacyJoin &&
        (session?.meetingLink && legacyLock ? (
          <button disabled className="btn-secondary w-full opacity-60">
            <Clock className="h-4 w-4" /> {legacyLock}
          </button>
        ) : session?.meetingLink ? (
          <a href={session.meetingLink} target="_blank" rel="noreferrer" className="btn-primary w-full">
            <Video className="h-4 w-4" /> Join Now
          </a>
        ) : scheduled.length === 0 ? (
          <button disabled className="btn-secondary w-full opacity-60">
            Join Now
          </button>
        ) : null)
      )}

      {patient && <RatingCard patientId={patient._id} />}
    </div>
  );
}
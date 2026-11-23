import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, Trash2, Video, Users, Stethoscope, UserCog } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, EmptyState } from '../components/Ui';
import Modal from '../components/Modal';
import ScheduledSessionForm from '../components/ScheduledSessionForm';
import { SessionStatusBadge, EndingAlert } from '../components/ScheduledSessionCard';
import { getSessionStatus, fmtRange, modeLabel } from '../utils/sessionSchedule';

function ParticipantList({ icon: Icon, title, items, render, onOpen, emptyText }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <Icon className="h-4 w-4 text-brand-500" /> {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="card px-4 py-5 text-center text-xs text-slate-400">{emptyText}</div>
      ) : (
        <div className="card divide-y divide-slate-50 overflow-hidden">
          {items.map((it) => {
            const { primary, secondary, to } = render(it);
            const clickable = onOpen && to;
            const Tag = clickable ? 'button' : 'div';
            return (
              <Tag
                key={it._id}
                {...(clickable ? { onClick: () => onOpen(to) } : {})}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${clickable ? 'hover:bg-slate-50' : ''}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{primary}</p>
                  {secondary && <p className="truncate text-xs text-slate-400">{secondary}</p>}
                </div>
                {clickable && <span className="whitespace-nowrap text-xs font-medium text-brand-500">View →</span>}
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/scheduled-sessions/${id}`);
      setSession(data);
    } catch (err) {
      setSession(null);
      toast.error(err.response?.data?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/scheduled-sessions/${id}`);
      toast.success('Session deleted');
      navigate('/sessions', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete session');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <FullPageSpinner />;

  const back = (
    <button onClick={() => navigate('/sessions')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  if (!session) {
    return (
      <div className="space-y-4 pb-6">
        {back}
        <EmptyState title="Session not found" />
      </div>
    );
  }

  const status = getSessionStatus(session);
  const ended = status.key === 'ended';

  const rows = [
    ['Session ID', session.scheduleId],
    ['Mode', modeLabel(session.mode)],
    ['Session Type', session.sessionType],
    ['Dates', fmtRange(session.startDate, session.endDate)],
    ['Time Slot', session.timeSlot],
    ['Created By', session.createdBy ? `${session.createdBy.name} (${session.createdBy.role})` : '-'],
    ['Created On', session.createdAt ? format(new Date(session.createdAt), 'd MMM yyyy, h:mm a') : '-'],
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        {back}
        {session.canEdit && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button className="btn-secondary text-red-600" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge bg-brand-50 text-brand-700">{modeLabel(session.mode)}</span>
          <span className="badge bg-slate-100 text-slate-600">{session.sessionType}</span>
          <SessionStatusBadge status={status} />
        </div>
        <h1 className="text-lg font-bold text-slate-900">{session.name}</h1>
        <EndingAlert session={session} status={status} />
      </div>

      <div className="card divide-y divide-slate-50 px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="max-w-[60%] text-right font-medium text-slate-700">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="text-slate-400">Meeting Link</span>
          {session.meetingLink ? (
            ended && !session.canEdit ? (
              <span className="font-medium text-slate-400">Session ended</span>
            ) : (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1.5 font-semibold text-brand-600 underline decoration-dotted"
              >
                <Video className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{session.meetingLink}</span>
              </a>
            )
          ) : (
            <span className="font-medium text-slate-700">—</span>
          )}
        </div>
      </div>

      <ParticipantList
        icon={Users}
        title="Patients"
        items={session.patients || []}
        emptyText="No patients in this session."
        onOpen={isAdmin ? (to) => navigate(to) : undefined}
        render={(p) => ({ primary: p.name, secondary: p.patientId, to: `/my-patients/${p._id}` })}
      />
      <ParticipantList
        icon={UserCog}
        title="PRTs"
        items={session.prts || []}
        emptyText="No PRTs selected."
        onOpen={isAdmin ? (to) => navigate(to) : undefined}
        render={(r) => ({ primary: r.name, secondary: [r.prtId, r.zone].filter(Boolean).join(' · '), to: `/admin/prts/${r._id}` })}
      />
      <ParticipantList
        icon={Stethoscope}
        title="Doctors"
        items={session.doctors || []}
        emptyText="No doctors selected."
        onOpen={isAdmin ? (to) => navigate(to) : undefined}
        render={(d) => ({ primary: d.doctorName || 'Unnamed doctor', secondary: `${d.doctorId} · ${d.specialty}`, to: `/admin/doctors/${d._id}` })}
      />

      <ScheduledSessionForm open={editOpen} onClose={() => setEditOpen(false)} initial={session} onSaved={load} />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Session"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setDeleteOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1 bg-red-600 hover:bg-red-700" disabled={deleting} onClick={confirmDelete}>
              {deleting ? 'Deleting…' : 'Delete Session'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold">{session.name}</span>? Everyone selected will lose access to it and its meeting link. Patients' recorded session logs are not affected.
        </p>
      </Modal>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from './Modal';
import { Spinner, EmptyState, SearchBar } from './Ui';

// Admin-only: choose which PRTs and Doctors are allowed to add sessions.
export default function SessionAccessModal({ open, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setLoading(true);
    api
      .get('/scheduled-sessions/access')
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [open]);

  const toggle = async (u) => {
    const next = !u.canManageSessions;
    setBusyId(u._id);
    try {
      await api.put(`/scheduled-sessions/access/${u._id}`, { canManageSessions: next });
      setUsers((list) => list.map((x) => (x._id === u._id ? { ...x, canManageSessions: next } : x)));
      toast.success(next ? `${u.name} can now add sessions` : `${u.name} can no longer add sessions`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update access');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.loginEmail} ${u.prtId || ''}`.toLowerCase().includes(q));
  }, [users, search]);

  const groups = [
    { title: 'PRTs', items: filtered.filter((u) => u.role === 'prt') },
    { title: 'Doctors', items: filtered.filter((u) => u.role === 'doctor') },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      title="Who can add sessions?"
      footer={
        <button className="btn-secondary flex-1" onClick={onClose}>
          Done
        </button>
      }
    >
      <p className="text-xs text-slate-400">
        Admins can always add and edit every session. Switch a PRT or Doctor on to let them add sessions too — they can then edit and delete only the sessions they created.
      </p>
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email" />

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-7 w-7" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState title="No PRTs or doctors with logins yet" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">{g.title}</p>
              <div className="card divide-y divide-slate-50 px-3.5">
                {g.items.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {u.name}
                        {u.isInactive && <span className="ml-1.5 text-[10px] font-bold uppercase text-red-400">Inactive</span>}
                      </p>
                      <p className="truncate text-xs text-slate-400">{u.loginEmail}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!u.canManageSessions}
                      aria-label={`Allow ${u.name} to add sessions`}
                      disabled={busyId === u._id}
                      onClick={() => toggle(u)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                        u.canManageSessions ? 'bg-brand-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          u.canManageSessions ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </Modal>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import api from '../api/axios';
import Modal from './Modal';
import { Switch } from './FormFields';
import { Spinner } from './Ui';

const TABS = [
  { key: 'prt', label: 'PRTs' },
  { key: 'doctor', label: 'Doctors' },
];

// Admin-only popup to grant / revoke "can schedule sessions" for many PRTs / doctors at once.
export default function ManageSessionAccess({ open, onClose }) {
  const [tab, setTab] = useState('prt');
  const [users, setUsers] = useState({ prt: [], doctor: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('prt');
    setSearch('');
    setSelected([]);
    let cancelled = false;
    setLoading(true);
    Promise.all([api.get('/users?role=prt'), api.get('/users?role=doctor')])
      .then(([p, d]) => !cancelled && setUsers({ prt: p.data, doctor: d.data }))
      .catch(() => !cancelled && toast.error('Failed to load users'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const list = users[tab];
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      list.filter(
        (u) =>
          !q ||
          u.name?.toLowerCase().includes(q) ||
          u.loginEmail?.toLowerCase().includes(q) ||
          u.prtId?.toLowerCase().includes(q) ||
          u.zone?.toLowerCase().includes(q)
      ),
    [list, q]
  );

  const allowedCount = list.filter((u) => u.canCreateSessions).length;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selectedSet.has(u._id));

  const switchTab = (key) => {
    setTab(key);
    setSelected([]);
    setSearch('');
  };

  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAllFiltered = () =>
    setSelected((s) =>
      allFilteredSelected
        ? s.filter((id) => !filtered.some((u) => u._id === id))
        : [...new Set([...s, ...filtered.map((u) => u._id)])]
    );

  // One code path for single switches and bulk buttons
  const apply = async (ids, value) => {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      await api.put('/users/session-access', { userIds: ids, canCreateSessions: value });
      const idSet = new Set(ids);
      setUsers((prev) => ({
        ...prev,
        [tab]: prev[tab].map((u) => (idSet.has(u._id) ? { ...u, canCreateSessions: value } : u)),
      }));
      setSelected((s) => s.filter((id) => !idSet.has(id)));
      toast.success(
        ids.length === 1
          ? value ? 'Access granted' : 'Access revoked'
          : `${value ? 'Access granted to' : 'Access revoked from'} ${ids.length} ${tab === 'prt' ? 'PRTs' : 'doctors'}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update access');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      title="Manage Session Access"
      footer={<button className="btn-secondary flex-1" onClick={onClose}>Done</button>}
    >
      <p className="text-xs text-slate-400">
        People with access can add sessions and edit the ones they created. Everyone always sees the sessions they are selected for.
      </p>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label} ({users[t.key].length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'prt' ? 'Search PRTs by name, ID, email or zone' : 'Search doctors by name or email'}
            className="input py-2"
          />

          {/* Bulk bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                disabled={filtered.length === 0}
              />
              {selected.length > 0 ? `${selected.length} selected` : 'Select all'}
            </label>
            <div className="flex gap-2">
              <button
                className="btn-primary px-3 py-1.5 text-xs"
                disabled={busy || selected.length === 0}
                onClick={() => apply(selected, true)}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Grant
              </button>
              <button
                className="btn-secondary px-3 py-1.5 text-xs text-red-600"
                disabled={busy || selected.length === 0}
                onClick={() => apply(selected, false)}
              >
                <ShieldOff className="h-3.5 w-3.5" /> Revoke
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            {allowedCount} of {list.length} {tab === 'prt' ? 'PRTs' : 'doctors'} can schedule sessions.
          </p>

          <div className="max-h-72 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">
                {list.length === 0
                  ? tab === 'doctor'
                    ? 'No doctors have a portal login yet. Create one from the Doctor list (key icon).'
                    : 'No PRTs found.'
                  : 'No matches'}
              </p>
            ) : (
              filtered.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 flex-shrink-0 accent-brand-600"
                    checked={selectedSet.has(u._id)}
                    onChange={() => toggleOne(u._id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {u.name}
                      {u.isInactive && <span className="badge ml-1.5 bg-red-50 text-red-600">Inactive</span>}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {[u.prtId, u.zone, u.loginEmail].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Switch
                    checked={!!u.canCreateSessions}
                    disabled={busy}
                    label={`Session access for ${u.name}`}
                    onChange={(v) => apply([u._id], v)}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
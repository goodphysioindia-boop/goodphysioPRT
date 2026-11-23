import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarDays, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, EmptyState, SearchBar, PageHeader } from '../components/Ui';
import ScheduledSessionCard from '../components/ScheduledSessionCard';
import ScheduledSessionForm from '../components/ScheduledSessionForm';
import ManageSessionAccess from '../components/ManageSessionAccess';
import { getSessionStatus, sortSessions, modeLabel, ENDING_SOON_DAYS } from '../utils/sessionSchedule';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'ending-soon', label: 'Ending Soon' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended' },
];

export default function Sessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');

  // Admin always; PRT / doctor only if an admin has allowed it
  const canSchedule = user?.role === 'admin' || (['prt', 'doctor'].includes(user?.role) && user?.canCreateSessions === true);
  const addOpen = params.get('new') === '1' && canSchedule;
  const accessOpen = params.get('access') === '1' && user?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/scheduled-sessions');
      setSessions(data);
    } catch (err) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeAdd = () => {
    params.delete('new');
    setParams(params);
  };
  const closeAccess = () => {
    params.delete('access');
    setParams(params);
  };

  const withStatus = useMemo(() => sortSessions(sessions).map((s) => ({ s, status: getSessionStatus(s) })), [sessions]);

  const counts = useMemo(() => {
    const c = { all: withStatus.length, 'ending-soon': 0, ongoing: 0, upcoming: 0, ended: 0 };
    withStatus.forEach(({ status }) => {
      if (status.key === 'ending-soon') {
        c['ending-soon'] += 1;
        c.ongoing += 1; // an ending-soon session is still ongoing
      } else {
        c[status.key] += 1;
      }
    });
    return c;
  }, [withStatus]);

  const q = search.trim().toLowerCase();
  const visible = withStatus.filter(({ s, status }) => {
    const inTab =
      tab === 'all' ||
      status.key === tab ||
      (tab === 'ongoing' && status.key === 'ending-soon');
    const inSearch =
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.scheduleId?.toLowerCase().includes(q) ||
      s.sessionType?.toLowerCase().includes(q) ||
      modeLabel(s.mode).toLowerCase().includes(q);
    return inTab && inSearch;
  });

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Sessions"
        right={
          (canSchedule || user?.role === 'admin') && (
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <button className="btn-secondary" onClick={() => setParams({ access: '1' })}>
                  <ShieldCheck className="h-4 w-4" /> Manage Access
                </button>
              )}
              {canSchedule && (
                <button className="btn-primary" onClick={() => setParams({ new: '1' })}>
                  Add Session
                </button>
              )}
            </div>
          )
        }
      />

      {counts['ending-soon'] > 0 && (
        <button
          onClick={() => setTab('ending-soon')}
          className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-xs font-semibold text-amber-800"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 animate-pulse text-amber-500" />
          {counts['ending-soon']} session{counts['ending-soon'] === 1 ? ' is' : 's are'} ending within {ENDING_SOON_DAYS} days — tap to view
        </button>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Search by session name, ID or type" />

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={sessions.length === 0 ? 'No sessions yet' : 'No sessions match'}
          subtitle={
            sessions.length === 0
              ? canSchedule
                ? 'Tap Add Session to schedule your first one.'
                : 'Sessions you are selected for will appear here.'
              : 'Try a different search or filter.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ s }) => (
            <ScheduledSessionCard key={s._id} session={s} onClick={() => navigate(`/sessions/${s._id}`)} />
          ))}
        </div>
      )}

      <ScheduledSessionForm open={addOpen} onClose={closeAdd} initial={null} onSaved={load} />
      <ManageSessionAccess open={accessOpen} onClose={closeAccess} />
    </div>
  );
}
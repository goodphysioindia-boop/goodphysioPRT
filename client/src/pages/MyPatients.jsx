import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, EmptyState, SearchBar, PageHeader } from '../components/Ui';
import DoctorPrtPanel from '../components/DoctorPrtPanel';
import PrtDoctorPanel from '../components/PrtDoctorPanel';
import { SubscriptionBadge } from '../components/SubscriptionBadge';
import { getSubscriptionStatus } from '../utils/subscription';

export default function MyPatients() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get('/patients')
      .then(({ data }) => setPatients(data))
      .catch(() => toast.error('Failed to load patients'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.lungCondition?.toLowerCase().includes(q) ||
      p.assignedDoctor?.doctorName?.toLowerCase().includes(q)
    );
  });

  if (loading) return <FullPageSpinner />;

  const content = (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="My Patients"
        right={
          isAdmin && (
            <button className="btn-secondary" onClick={() => navigate('/admin/prts')}>
              Edit PRT Data
            </button>
          )
        }
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search Patient Name, Diagnosis, or Doctor" />

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No patients yet" subtitle="Register your first patient from the Register a Patient tab." />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => {
            const sub = getSubscriptionStatus(p);
            return (
            <Link
              key={p._id}
              to={`/my-patients/${p._id}`}
              className="card flex items-center justify-between gap-3 p-4 transition hover:shadow-pop"
            >
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand-600">
                  {p.assignedDoctor?.doctorName || 'No doctor assigned'}
                </p>
                <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-400">{format(new Date(p.createdAt), "d MMM yyyy 'at' h:mm a")}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SubscriptionBadge status={sub} />
                  {sub.reminder && (
                    <span className={`text-[11px] font-semibold ${sub.key === 'expiring' ? 'text-amber-600' : 'text-red-500'}`}>
                      {sub.reminder}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" />
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  // Admin: unchanged single-column list.
  if (user?.role !== 'doctor' && user?.role !== 'prt') return content;

  // Doctor: patient list on the left, mapped-PRT cards on the right.
  // PRT: patient list on the left, their doctors' cards on the right.
  // (The card strip sits on top on small screens.)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      {content}
      <aside className="order-first min-w-0 lg:order-none lg:sticky lg:top-0">
        {user?.role === 'doctor' ? <DoctorPrtPanel /> : <PrtDoctorPanel />}
      </aside>
    </div>
  );
}
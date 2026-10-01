import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight, Users, Hash, Building2, Map as MapIcon, Network } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from './Modal';
import { Spinner } from './Ui';

// Every zone gets its own colour so PRTs are recognisable at a glance.
// (Full class strings on purpose — Tailwind can't see dynamically built names.)
const ZONE_STYLES = {
  East: { grad: 'from-amber-400 to-orange-500', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  West: { grad: 'from-sky-400 to-blue-500', badge: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  North: { grad: 'from-emerald-400 to-teal-500', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  South: { grad: 'from-rose-400 to-pink-500', badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  Central: { grad: 'from-violet-400 to-brand-600', badge: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
};
const DEFAULT_ZONE = { grad: 'from-slate-400 to-slate-500', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
const zoneStyle = (zone) => ZONE_STYLES[zone] || DEFAULT_ZONE;

function PrtAvatar({ name, zone, size = 'h-10 w-10 text-sm' }) {
  return (
    <div
      className={`grid ${size} flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br font-bold text-white shadow-card ${zoneStyle(zone).grad}`}
    >
      {name?.slice(0, 1)?.toUpperCase() || '?'}
    </div>
  );
}

function ZoneBadge({ zone }) {
  if (!zone) return null;
  const s = zoneStyle(zone);
  return (
    <span className={`badge gap-1.5 !normal-case ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {zone} Zone
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ${className}`}>
      <Icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value || '—'}</p>
      </div>
    </div>
  );
}

function PrtCard({ prt, onClick }) {
  const s = zoneStyle(prt.zone);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card group relative w-64 flex-shrink-0 overflow-hidden p-4 pt-5 text-left transition hover:-translate-y-0.5 hover:shadow-pop lg:w-full"
    >
      {/* zone-coloured accent strip */}
      <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${s.grad}`} />

      <div className="flex items-center gap-3">
        <PrtAvatar name={prt.name} zone={prt.zone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{prt.name}</p>
          <p className="truncate text-[11px] font-medium text-slate-400">{prt.prtId || 'PRT'}</p>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {prt.zone ? <ZoneBadge zone={prt.zone} /> : <span className="text-xs text-slate-400">No zone set</span>}
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          {prt.patientCount} {prt.patientCount === 1 ? 'patient' : 'patients'}
        </span>
      </div>
    </button>
  );
}

function PrtDetailModal({ prtId, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prtId) return undefined;
    let cancelled = false;
    setLoading(true);
    setData(null);
    api
      .get(`/doctors/me/prts/${prtId}`)
      .then(({ data: d }) => !cancelled && setData(d))
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.message || 'Failed to load PRT details');
        onClose();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prtId]);

  const prt = data?.prt;
  const patients = data?.patients || [];
  const s = zoneStyle(prt?.zone);

  return (
    <Modal open={!!prtId} onClose={onClose} title="PRT Details" maxWidth="max-w-lg">
      {loading || !prt ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <>
          {/* hero */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${s.grad}`} />
            <div className="flex items-center gap-3 pt-1">
              <PrtAvatar name={prt.name} zone={prt.zone} size="h-14 w-14 text-xl" />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">{prt.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <ZoneBadge zone={prt.zone} />
                  {prt.isInactive && <span className="badge bg-slate-200 text-slate-600">Inactive</span>}
                </div>
              </div>
            </div>
          </div>

          {/* general details only */}
          <div className="grid grid-cols-2 gap-2">
            <InfoTile icon={Hash} label="PRT ID" value={prt.prtId} />
            <InfoTile icon={Building2} label="HQ" value={prt.hq} />
            <InfoTile icon={MapIcon} label="State" value={prt.state} className="col-span-2" />
          </div>

          {/* related patients */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Patients with this PRT</p>
              <span className="badge bg-brand-50 text-brand-700">{patients.length}</span>
            </div>

            {patients.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                This PRT hasn&apos;t registered any patients under you yet.
              </p>
            ) : (
              <div className="space-y-2">
                {patients.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/my-patients/${p._id}`);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {[p.lungCondition, p.createdAt && format(new Date(p.createdAt), 'd MMM yyyy')]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

// "My PRTs" — sits to the right of the patient list on the doctor dashboard.
// Stacked/scrollable row on mobile, vertical card column on desktop.
export default function DoctorPrtPanel() {
  const [prts, setPrts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api
      .get('/doctors/me/prts')
      .then(({ data }) => setPrts(data))
      .catch(() => toast.error('Failed to load your PRTs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">My PRTs</h2>
        {!loading && prts.length > 0 && <span className="badge bg-brand-50 text-brand-700">{prts.length}</span>}
      </div>

      {loading ? (
        <div className="card flex justify-center py-8">
          <Spinner />
        </div>
      ) : prts.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-8 text-center">
          <Network className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-slate-500">No PRT mapped yet</p>
          <p className="max-w-[220px] text-xs text-slate-400">
            Once an admin maps a PRT to you, they&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {prts.map((p) => (
            <PrtCard key={p._id} prt={p} onClick={() => setSelectedId(p._id)} />
          ))}
        </div>
      )}

      <PrtDetailModal prtId={selectedId} onClose={() => setSelectedId(null)} />
    </section>
  );
}
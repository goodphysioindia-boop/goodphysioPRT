import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, Mail, MapPin, Pencil, Stethoscope, Users, Activity, Link2 } from 'lucide-react';
import api from '../../api/axios';
import { FullPageSpinner, EmptyState } from '../../components/Ui';
import Modal from '../../components/Modal';
import { TextField, SelectField, ToggleField } from '../../components/FormFields';

function InfoRow({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm text-slate-800">{value || '—'}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold leading-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export default function PrtDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [prt, setPrt] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]); // doctors mapped to this PRT
  const [allDoctors, setAllDoctors] = useState([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapDoctorId, setMapDoctorId] = useState('');
  const [mapping, setMapping] = useState(false);
  const [totalSessions, setTotalSessions] = useState(null);

  const load = useCallback(async () => {
    try {
      const [u, p, d, s] = await Promise.all([
        api.get(`/users/${id}`),
        api.get('/patients'),
        api.get('/doctors'),
        api.get('/users/prt-stats').catch(() => ({ data: [] })),
      ]);
      setPrt(u.data);
      setPatients(p.data.filter((pt) => (pt.addedBy?._id || pt.addedBy) === id));
      setAllDoctors(d.data);
      setDoctors(d.data.filter((doc) => (doc.assignedPRTs || []).some((a) => (a?._id || a) === id)));
      const stat = (s.data || []).find((x) => x._id === id);
      setTotalSessions(stat ? stat.totalSessions : null);
    } catch (err) {
      toast.error('Failed to load PRT details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Admin switch: lets this PRT schedule sessions (they can then edit only their own)
  const toggleSessionAccess = async (value) => {
    setPrt((p) => ({ ...p, canCreateSessions: value }));
    try {
      await api.put(`/users/${id}`, { canCreateSessions: value });
      toast.success(value ? 'This PRT can now schedule sessions' : 'Session scheduling turned off for this PRT');
    } catch (err) {
      setPrt((p) => ({ ...p, canCreateSessions: !value }));
      toast.error(err.response?.data?.message || 'Failed to update access');
    }
  };

  // Only doctors not already mapped to this PRT can be picked
  const mappedIds = new Set(doctors.map((d) => d._id));
  const unmappedDoctors = allDoctors.filter((d) => !mappedIds.has(d._id));

  const closeMap = () => {
    setMapOpen(false);
    setMapDoctorId('');
  };

  const submitMap = async () => {
    if (!mapDoctorId) return toast.error('Select a doctor');
    setMapping(true);
    try {
      await api.post('/doctors/map', { doctorId: mapDoctorId, prtId: id });
      toast.success('Doctor mapped to PRT');
      closeMap();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to map doctor');
    } finally {
      setMapping(false);
    }
  };

  if (loading) return <FullPageSpinner />;

  if (!prt) {
    return (
      <div className="space-y-4 pb-6">
        <button onClick={() => navigate('/admin/prts')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <EmptyState title="PRT not found" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <button onClick={() => navigate('/admin/prts')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
            {prt.name?.slice(0, 1)?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">{prt.name}</h1>
            <p className="text-xs text-slate-400">{prt.prtId || 'No PRT ID'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="badge bg-brand-50 text-brand-700">{prt.zone || 'No Zone'}</span>
              <span className={`badge ${prt.isInactive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {prt.isInactive ? 'Inactive' : 'Active'}
              </span>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => navigate(`/admin/prts/${prt._id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={Users} label="Patients" value={patients.length} />
        <StatTile icon={Stethoscope} label="Mapped Doctors" value={doctors.length} />
        <StatTile icon={Activity} label="Total Sessions" value={totalSessions ?? '—'} />
      </div>

      {/* Details */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">PRT Details</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoRow label="Login Email" value={prt.loginEmail} />
          <InfoRow label="User Email" value={prt.userEmail} />
          <InfoRow label="Contact Number" value={prt.contactNumber} />
          <InfoRow label="Role" value={prt.role} />
          <InfoRow label="Zone" value={prt.zone} />
          <InfoRow label="State" value={prt.state} />
          <InfoRow label="HQ" value={prt.hq} />
          <InfoRow label="Reporting Manager Email" value={prt.reportingManagerEmail} />
          <InfoRow label="Agency" value={prt.agency} />
          <InfoRow label="RBM" value={prt.rbm} />
          <InfoRow label="Team" value={prt.team} />
          <InfoRow label="Joined" value={prt.createdAt ? new Date(prt.createdAt).toLocaleDateString() : ''} />
        </div>
      </div>

      {/* Session scheduling access (PRTs only) */}
      {prt.role === 'prt' && (
        <div className="card p-5">
          <h2 className="mb-1 text-sm font-bold text-slate-900">Session Scheduling Access</h2>
          <p className="mb-2 text-xs text-slate-400">
            When on, this PRT can add sessions and edit the ones they created. They always see sessions they are selected for.
          </p>
          <ToggleField label="Can schedule sessions" checked={!!prt.canCreateSessions} onChange={toggleSessionAccess} />
        </div>
      )}

      {/* Mapped doctors */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Mapped Doctors ({doctors.length})</h2>
          <button className="btn-primary px-3 py-1.5" onClick={() => setMapOpen(true)}>
            <Link2 className="h-4 w-4" /> Map Doctor
          </button>
        </div>
        {doctors.length === 0 ? (
          <div className="card px-4 py-6 text-center text-xs text-slate-400">No doctors are mapped to this PRT yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {doctors.map((d) => (
              <div
                key={d._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/doctors/${d._id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/doctors/${d._id}`)}
                className="card cursor-pointer p-4 transition hover:border-brand-200 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{d.doctorName}</p>
                    <p className="text-xs text-slate-400">{d.doctorId} · {d.specialty}</p>
                  </div>
                  <span className="badge bg-brand-50 text-brand-700">{d.zone}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {d.phoneNumber && (
                    <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{d.phoneNumber}</p>
                  )}
                  {d.email && (
                    <p className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" />{d.email}</p>
                  )}
                  {d.clinicLocation && (
                    <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" />{d.clinicLocation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patients */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Patients ({patients.length})</h2>
        {patients.length === 0 ? (
          <div className="card px-4 py-6 text-center text-xs text-slate-400">No patients registered by this PRT yet.</div>
        ) : (
          <div className="card divide-y divide-slate-50 overflow-hidden">
            {patients.map((p) => (
              <button
                key={p._id}
                onClick={() => navigate(`/my-patients/${p._id}`)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {p.patientId} · {p.lungCondition}
                    {p.assignedDoctor?.doctorName ? ` · ${p.assignedDoctor.doctorName}` : ''}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs font-medium text-brand-500">View →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Doctor Modal — PRT is fixed (this page), only the doctor is chosen */}
      <Modal
        open={mapOpen}
        onClose={closeMap}
        title="Map Doctor"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={closeMap}>Cancel</button>
            <button className="btn-primary flex-1" disabled={mapping || !mapDoctorId} onClick={submitMap}>
              {mapping ? 'Saving…' : 'Submit'}
            </button>
          </>
        }
      >
        <TextField label="PRT" value={`${prt.name} (${prt.loginEmail})`} readOnly disabled />
        {unmappedDoctors.length === 0 ? (
          <p className="text-sm text-slate-500">
            {allDoctors.length === 0
              ? 'No doctors exist yet. Add a doctor first from the Doctor page.'
              : 'Every doctor is already mapped to this PRT.'}
          </p>
        ) : (
          <SelectField
            label="Doctor Name"
            required
            placeholder="Choose a doctor"
            options={unmappedDoctors.map((d) => ({
              value: d._id,
              label: `${d.doctorName || 'Unnamed doctor'} (${d.doctorId}) · ${d.zone}`,
            }))}
            value={mapDoctorId}
            onChange={(e) => setMapDoctorId(e.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}
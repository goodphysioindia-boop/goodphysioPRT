import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, Mail, MapPin, Stethoscope, Users, UserCog, Link2 } from 'lucide-react';
import api from '../../api/axios';
import { FullPageSpinner, EmptyState } from '../../components/Ui';
import Modal from '../../components/Modal';
import { TextField, SelectField } from '../../components/FormFields';

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

export default function DoctorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState(null);
  const [prts, setPrts] = useState([]); // full PRT user records mapped to this doctor
  const [allPrts, setAllPrts] = useState([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPrtId, setMapPrtId] = useState('');
  const [mapping, setMapping] = useState(false);
  const [patients, setPatients] = useState([]);
  const [login, setLogin] = useState(null); // doctor's portal login (User), if any

  const load = useCallback(async () => {
    try {
      const [d, p, u, dl] = await Promise.all([
        api.get(`/doctors/${id}`),
        api.get('/patients'),
        api.get('/users?role=prt'),
        api.get('/users?role=doctor').catch(() => ({ data: [] })),
      ]);
      setDoctor(d.data);
      setPatients(p.data.filter((pt) => (pt.assignedDoctor?._id || pt.assignedDoctor) === id));
      setAllPrts(u.data);

      // assignedPRTs only carries name + email; pull full records for zone / PRT ID
      const mappedIds = (d.data.assignedPRTs || []).map((a) => a?._id || a);
      setPrts(
        mappedIds.map((pid) => u.data.find((x) => x._id === pid) || (d.data.assignedPRTs || []).find((a) => a?._id === pid)).filter(Boolean)
      );
      setLogin(dl.data.find((x) => (x.linkedDoctor?._id || x.linkedDoctor) === id) || null);
    } catch (err) {
      toast.error('Failed to load doctor details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Only PRTs not already mapped to this doctor can be picked
  const mappedPrtIds = new Set(prts.map((r) => r._id));
  const unmappedPrts = allPrts.filter((r) => !mappedPrtIds.has(r._id));

  const closeMap = () => {
    setMapOpen(false);
    setMapPrtId('');
  };

  const submitMap = async () => {
    if (!mapPrtId) return toast.error('Select a PRT');
    setMapping(true);
    try {
      await api.post('/doctors/map', { doctorId: id, prtId: mapPrtId });
      toast.success('Doctor mapped to PRT');
      closeMap();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to map PRT');
    } finally {
      setMapping(false);
    }
  };

  const prtName = (pt) => pt.addedBy?.name;

  if (loading) return <FullPageSpinner />;

  if (!doctor) {
    return (
      <div className="space-y-4 pb-6">
        <button onClick={() => navigate('/admin/doctors')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <EmptyState title="Doctor not found" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <button onClick={() => navigate('/admin/doctors')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">{doctor.doctorName || 'Unnamed doctor'}</h1>
            <p className="text-xs text-slate-400">{doctor.doctorId} · {doctor.specialty}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="badge bg-brand-50 text-brand-700">{doctor.zone}</span>
              <span className={`badge ${login ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {login ? 'Portal login active' : 'No portal login'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile icon={UserCog} label="Mapped PRTs" value={prts.length} />
        <StatTile icon={Users} label="Assigned Patients" value={patients.length} />
      </div>

      {/* Details */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Doctor Details</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoRow label="Doctor ID" value={doctor.doctorId} />
          <InfoRow label="Specialty" value={doctor.specialty} />
          <InfoRow label="Phone" value={doctor.phoneNumber} />
          <InfoRow label="Email" value={doctor.email} />
          <InfoRow label="Clinic / Hospital Location" value={doctor.clinicLocation} />
          <InfoRow label="Zone" value={doctor.zone} />
          <InfoRow label="Portal Login Email" value={login?.loginEmail} />
          <InfoRow label="Added On" value={doctor.createdAt ? new Date(doctor.createdAt).toLocaleDateString() : ''} />
        </div>
      </div>

      {/* Mapped PRTs */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Mapped PRTs ({prts.length})</h2>
          <button className="btn-primary px-3 py-1.5" onClick={() => setMapOpen(true)}>
            <Link2 className="h-4 w-4" /> Map PRT
          </button>
        </div>
        {prts.length === 0 ? (
          <div className="card px-4 py-6 text-center text-xs text-slate-400">No PRTs are mapped to this doctor yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {prts.map((r) => (
              <div
                key={r._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/prts/${r._id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/prts/${r._id}`)}
                className="card cursor-pointer p-4 transition hover:border-brand-200 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{r.name}</p>
                    <p className="truncate text-xs text-slate-400">{r.prtId ? `${r.prtId} · ` : ''}{r.loginEmail}</p>
                  </div>
                  {r.zone !== undefined && <span className="badge bg-brand-50 text-brand-700">{r.zone || 'No Zone'}</span>}
                </div>
                {(r.contactNumber || r.hq || r.state) && (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {r.contactNumber && (
                      <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{r.contactNumber}</p>
                    )}
                    {(r.hq || r.state) && (
                      <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" />{[r.hq, r.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned patients */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Assigned Patients ({patients.length})</h2>
        {patients.length === 0 ? (
          <div className="card px-4 py-6 text-center text-xs text-slate-400">No patients are assigned to this doctor yet.</div>
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
                    {prtName(p) ? ` · PRT: ${prtName(p)}` : ''}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs font-medium text-brand-500">View →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map PRT Modal — doctor is fixed (this page), only the PRT is chosen */}
      <Modal
        open={mapOpen}
        onClose={closeMap}
        title="Map PRT"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={closeMap}>Cancel</button>
            <button className="btn-primary flex-1" disabled={mapping || !mapPrtId} onClick={submitMap}>
              {mapping ? 'Saving…' : 'Submit'}
            </button>
          </>
        }
      >
        <TextField label="Doctor" value={`${doctor.doctorName || 'Unnamed doctor'} (${doctor.doctorId})`} readOnly disabled />
        {unmappedPrts.length === 0 ? (
          <p className="text-sm text-slate-500">
            {allPrts.length === 0
              ? 'No PRTs exist yet. Add a PRT first from the All PRTs page.'
              : 'Every PRT is already mapped to this doctor.'}
          </p>
        ) : (
          <SelectField
            label="PRT Email"
            required
            placeholder="Choose a PRT"
            options={unmappedPrts.map((r) => ({
              value: r._id,
              label: `${r.name} (${r.loginEmail})`,
            }))}
            value={mapPrtId}
            onChange={(e) => setMapPrtId(e.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, MoreVertical, Phone, MapPin, Stethoscope, Users } from 'lucide-react';
import api from '../../api/axios';
import { FullPageSpinner, EmptyState, SearchBar, PageHeader } from '../../components/Ui';
import Modal from '../../components/Modal';
import { TextField, SelectField } from '../../components/FormFields';

const ZONES = ['East', 'West', 'North', 'South', 'Central'];
const ROLES = ['prt', 'admin'];

export default function AdminPrts() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [doctors, setDoctors] = useState([]);

  const addOpen = params.get('add') === '1';

  const [form, setForm] = useState({
    name: '', loginEmail: '', userEmail: '', password: '', role: 'prt', contactNumber: '',
    zone: '', state: '', hq: '', reportingManagerEmail: '', agency: '', rbm: '', team: '',
  });

  const load = useCallback(async () => {
    try {
      const [{ data: usersData }, { data: patientsData }, { data: doctorsData }] = await Promise.all([
        api.get('/users?role=prt'),
        api.get('/patients'),
        api.get('/doctors'),
      ]);
      setUsers(usersData);
      setPatients(patientsData);
      setDoctors(doctorsData);
    } catch (err) {
      toast.error('Failed to load PRTs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patientsFor = (prtId) => patients.filter((p) => (p.addedBy?._id || p.addedBy) === prtId);

  const doctorsFor = (prtId) =>
    doctors.filter((d) => (d.assignedPRTs || []).some((a) => (a?._id || a) === prtId));

  const closeModal = () => {
    params.delete('add');
    setParams(params);
  };

  const submitUser = async (e) => {
    e.preventDefault();
    const { name, loginEmail, userEmail, password } = form;
    if (!name || !loginEmail || !userEmail || !password) return toast.error('Please fill all required fields');
    if (loginEmail.toLowerCase() !== userEmail.toLowerCase()) return toast.error('Login Email and User Email must match');
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('User created');
      setForm({ name: '', loginEmail: '', userEmail: '', password: '', role: 'prt', contactNumber: '', zone: '', state: '', hq: '', reportingManagerEmail: '', agency: '', rbm: '', team: '' });
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.zone?.toLowerCase().includes(q) ||
      u.loginEmail?.toLowerCase().includes(q) ||
      u.prtId?.toLowerCase().includes(q)
  );

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-4 pb-6" onClick={() => openMenuId && setOpenMenuId(null)}>
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm font-medium text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader
        title="All PRTs"
        right={
          <button className="btn-primary" onClick={() => setParams({ add: '1' })}>
            Add User
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search by PRT Name or Zone" />

      {filtered.length === 0 ? (
        <EmptyState title="No PRTs found" subtitle={users.length === 0 ? 'Add your first user to get started.' : 'Try a different search.'} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => {
            const patientCount = patientsFor(u._id).length;
            const doctorCount = doctorsFor(u._id).length;
            return (
              <div
                key={u._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/prts/${u._id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/prts/${u._id}`)}
                className="card relative cursor-pointer p-4 transition hover:border-brand-200 hover:shadow-pop"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                    {u.name?.slice(0, 1)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{u.name}</p>
                    <p className="truncate text-xs text-slate-400">{u.prtId ? `${u.prtId} · ` : ''}{u.loginEmail}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="badge bg-brand-50 text-brand-700">{u.zone || 'No Zone'}</span>
                      {u.isInactive && <span className="badge bg-red-50 text-red-600">Inactive</span>}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === u._id ? null : u._id);
                      }}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {openMenuId === u._id && (
                      <div className="absolute right-0 top-9 z-10 w-32 rounded-xl border border-slate-100 bg-white py-1 shadow-pop">
                        <button
                          className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/prts/${u._id}/edit`);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {patientCount} patient{patientCount === 1 ? '' : 's'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                    {doctorCount} doctor{doctorCount === 1 ? '' : 's'}
                  </div>
                  {u.contactNumber && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{u.contactNumber}</span>
                    </div>
                  )}
                  {(u.hq || u.state) && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{[u.hq, u.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add User Modal (scrollable bottom sheet) */}
      <Modal
        open={addOpen}
        onClose={closeModal}
        title="Add User"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitUser}>{saving ? 'Saving…' : 'Submit'}</button>
          </>
        }
      >
        <TextField label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <p className="-mt-2 text-xs text-slate-400">Please keep both email same.</p>
        <TextField label="Login Email" required type="email" value={form.loginEmail} onChange={(e) => setForm((f) => ({ ...f, loginEmail: e.target.value }))} />
        <TextField label="User Email" required type="email" value={form.userEmail} onChange={(e) => setForm((f) => ({ ...f, userEmail: e.target.value }))} />
        <TextField label="Temporary Password" required type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
        <SelectField label="Role" required options={ROLES} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
        <TextField label="Contact Number" required value={form.contactNumber} onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))} />
        <SelectField label="Zone" required options={ZONES} value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} />
        <TextField label="State" required value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        <TextField label="HQ" required value={form.hq} onChange={(e) => setForm((f) => ({ ...f, hq: e.target.value }))} />
        <TextField label="Reporting Manager Email" required type="email" value={form.reportingManagerEmail} onChange={(e) => setForm((f) => ({ ...f, reportingManagerEmail: e.target.value }))} />
        <TextField label="Agency" value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} />
        <TextField label="RBM" value={form.rbm} onChange={(e) => setForm((f) => ({ ...f, rbm: e.target.value }))} />
        <TextField label="Team" value={form.team} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))} />
      </Modal>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogOut, KeyRound, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { TextField } from '../components/FormFields';
import ProfilePictureUploader from '../components/ProfilePictureUploader';
import { RatingSummary, Stars } from '../components/RatingCard';

export default function Me() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pwModal, setPwModal] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [myRating, setMyRating] = useState(null); // { average, count } — PRT only

  useEffect(() => {
    if (user?.role !== 'prt') return;
    api.get('/users/my-rating').then(({ data }) => setMyRating(data)).catch(() => {});
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/change-password', form);
      toast.success('Password updated');
      setPwModal(false);
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { icon: Mail, label: 'Login Email', value: user?.loginEmail },
    { icon: Phone, label: 'Contact Number', value: user?.contactNumber || '-' },
    { icon: MapPin, label: 'Zone', value: user?.zone || '-' },
    { icon: Building2, label: 'HQ', value: user?.hq || '-' },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <ProfilePictureUploader name={user?.name} />
        <div>
          <p className="text-lg font-bold text-slate-900">{user?.name}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
            {user?.role === 'admin' ? 'Administrator' : 'PRT / Field Staff'} {user?.prtId ? `· ${user.prtId}` : ''}
          </p>
        </div>
        {user?.role === 'prt' && myRating && (
          <div className="flex flex-col items-center gap-1">
            {myRating.count > 0 && <Stars value={myRating.average} size="h-5 w-5" />}
            <RatingSummary rating={myRating} className="!text-sm" />
          </div>
        )}
      </div>

      <div className="card divide-y divide-slate-50 px-4">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 py-3">
            <Icon className="h-4 w-4 text-slate-300" />
            <span className="flex-1 text-sm text-slate-400">{label}</span>
            <span className="text-sm font-medium text-slate-700">{value}</span>
          </div>
        ))}
      </div>

      <button className="btn-secondary w-full" onClick={() => setPwModal(true)}>
        <KeyRound className="h-4 w-4" /> Change Password
      </button>
      <button className="btn-primary w-full !bg-red-500 hover:!bg-red-600" onClick={handleLogout}>
        <LogOut className="h-4 w-4" /> Log Out
      </button>

      <Modal
        open={pwModal}
        onClose={() => setPwModal(false)}
        title="Change Password"
        footer={
          <>
            <button className="btn-secondary flex-1" onClick={() => setPwModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={saving} onClick={submitPasswordChange}>{saving ? 'Saving…' : 'Update'}</button>
          </>
        }
      >
        <TextField label="Current Password" type="password" required value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} />
        <TextField label="New Password" type="password" required value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
      </Modal>
    </div>
  );
}
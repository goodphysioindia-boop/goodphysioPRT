import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

// Crops to a centred square and shrinks to 512px so uploads are small and fast on any phone.
async function toSquareJpeg(file, size = 512) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.85));
}

// Profile picture with a camera button to change it. Works for every role — it always edits
// the logged-in user's own picture.
export default function ProfilePictureUploader({ name, size = 'h-24 w-24', textSize = 'text-3xl' }) {
  const { user, setUser } = useAuth();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const save = async (url) => {
    const { data } = await api.put('/auth/profile-picture', { url });
    setUser(data.user);
    localStorage.setItem('prt_user', JSON.stringify(data.user));
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image (JPG or PNG)');

    setBusy(true);
    try {
      let blob;
      try {
        blob = await toSquareJpeg(file);
      } catch {
        setBusy(false);
        return toast.error("Couldn't read that image. Please choose a JPG or PNG photo.");
      }
      const fd = new FormData();
      fd.append('file', blob, 'profile.jpg');
      const { data } = await api.post('/uploads?purpose=profile-pictures', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await save(data.url);
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload the picture. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await save('');
      toast.success('Profile picture removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the picture');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Avatar src={user?.profilePicture} name={name || user?.name} className={`${size} ${textSize}`} />
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label="Change profile picture"
          className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-brand-600 text-white shadow hover:bg-brand-700 disabled:opacity-60"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>
      {user?.profilePicture && !busy && (
        <button type="button" onClick={remove} className="text-[11px] font-medium text-slate-400 hover:text-red-500">
          Remove photo
        </button>
      )}
    </div>
  );
}
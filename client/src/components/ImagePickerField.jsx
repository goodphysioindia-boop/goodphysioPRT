import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';
import api from '../api/axios';
import Avatar from './Avatar';

// Crops to a centred square and shrinks to 512px so uploads stay small on any phone.
async function toSquareJpeg(file, size = 512) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.85));
}

// A profile-picture field for FORMS (value / onChange), unlike ProfilePictureUploader which always
// edits the logged-in user's own picture. Used by admins to set a PRT's photo while creating or
// editing that PRT. The picture is uploaded straight away and `onChange(url)` receives its address
// ('' when removed); the form then saves it together with the rest of the PRT's data.
export default function ImagePickerField({ label = 'Profile Photo', value, onChange, name = '' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

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
        return toast.error("Couldn't read that image. Please choose a JPG or PNG photo.");
      }
      const fd = new FormData();
      fd.append('file', blob, 'profile.jpg');
      const { data } = await api.post('/uploads?purpose=profile-pictures', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(data.url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar src={value} name={name} className="h-20 w-20 text-2xl" />
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label="Choose photo"
            className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-600 text-white shadow hover:bg-brand-700 disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </div>
        <div className="space-y-1 text-xs text-slate-400">
          <p>{value ? 'Photo added.' : 'No photo yet.'} Tap the camera to {value ? 'change' : 'add'} it.</p>
          {value && !busy && (
            <button type="button" onClick={() => onChange('')} className="font-medium text-slate-500 hover:text-red-500">
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
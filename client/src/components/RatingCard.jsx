import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';
import api from '../api/axios';

const FACES = ['', '😞', '🙁', '😐', '🙂', '😍'];

// Read-only row of stars (used by the admin view)
export function Stars({ value = 0, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
      ))}
    </span>
  );
}

// Compact "★ 4.3 (12)" summary for admin views; muted text when nothing has been rated yet
export function RatingSummary({ rating, className = '' }) {
  if (!rating || !rating.count) {
    return <span className={`flex items-center gap-1.5 text-xs text-slate-400 ${className}`}><Star className="h-3.5 w-3.5 text-slate-300" /> No ratings yet</span>;
  }
  return (
    <span className={`flex items-center gap-1.5 text-xs text-slate-500 ${className}`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-slate-700">{rating.average.toFixed(1)}</span>
      <span className="text-slate-400">({rating.count})</span>
    </span>
  );
}

// Patient-facing rating: five big stars, one tap saves. Kept deliberately simple for
// patients who may not read well — big tap targets, a face that matches the stars, and
// a short prompt. The patient can change it any time that same day.
export default function RatingCard({ patientId }) {
  const day = format(new Date(), 'yyyy-MM-dd');
  const [stars, setStars] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    api
      .get(`/patients/${patientId}/ratings`, { params: { day } })
      .then(({ data }) => {
        if (data.today) {
          setStars(data.today.stars);
          setSaved(true);
        }
      })
      .catch(() => {});
  }, [patientId, day]);

  const rate = async (n) => {
    const previous = { stars, saved };
    setStars(n);
    setSaving(true);
    try {
      await api.post(`/patients/${patientId}/ratings`, { stars: n, day });
      setSaved(true);
    } catch (err) {
      setStars(previous.stars);
      setSaved(previous.saved);
      toast.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-3 p-5 text-center">
      <p className="text-base font-bold text-slate-900">How was your session?</p>

      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={saving}
            onClick={() => rate(n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className="rounded-xl p-1 transition active:scale-90 disabled:opacity-60"
          >
            <Star className={`h-11 w-11 ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>

      {stars > 0 && (
        <div className="space-y-0.5">
          <p className="text-4xl leading-none">{FACES[stars]}</p>
          {saved && <p className="text-sm font-semibold text-emerald-600">Thank you!</p>}
        </div>
      )}
    </div>
  );
}
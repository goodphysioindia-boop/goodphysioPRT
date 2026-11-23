import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { fmtSubDate } from '../utils/subscription';

// "Active" / "Inactive" pill
export function SubscriptionBadge({ status }) {
  const tone = status.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600';
  return (
    <span className={`badge gap-1.5 ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {status.label}
    </span>
  );
}

// Reminder strip — amber when about to expire / not started, red once expired.
// `patientView` words it for the patient themselves instead of staff.
export function SubscriptionBanner({ status, patientView = false }) {
  if (!status.reminder) return null;
  const expired = status.key === 'expired';
  const upcoming = status.key === 'upcoming';

  let text;
  if (patientView) {
    if (expired) text = `Your ${status.planLabel.toLowerCase()} ended on ${fmtSubDate(status.endDate)}. Your sessions are locked — please contact your PRT to renew.`;
    else if (upcoming) text = `Your ${status.planLabel.toLowerCase()} begins on ${fmtSubDate(status.startDate)}. Sessions unlock from that day.`;
    else text = `Your ${status.planLabel.toLowerCase()} is ${status.reminder.replace(`${status.planLabel} `, '')} (last day ${fmtSubDate(status.endDate)}). Please contact your PRT to renew.`;
  } else {
    text = expired
      ? `${status.reminder} — last day was ${fmtSubDate(status.endDate)}`
      : upcoming
      ? `${status.reminder} — from ${fmtSubDate(status.startDate)}`
      : `${status.reminder} — last day is ${fmtSubDate(status.endDate)}`;
  }

  const Icon = expired ? Lock : AlertTriangle;
  const tone = expired ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}
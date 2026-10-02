import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const TRIAL_DAYS = 7; // the start day counts as day 1, so a trial ends on start + 6
export const EXPIRING_SOON_DAYS = 3;
export const PAYMENT_MODES = ['Online', 'Cash'];

export const todayStr = () => format(new Date(), 'yyyy-MM-dd');
export const trialEndFor = (startStr) => format(addDays(parseISO(startStr), TRIAL_DAYS - 1), 'yyyy-MM-dd');
export const fmtSubDate = (s) => format(parseISO(s), 'd MMM yyyy');

// Where a patient's subscription stands today (calendar-day based, end date inclusive).
//  key:    'none' | 'upcoming' | 'active' | 'expiring' | 'expired'
//  active: whether the patient currently has access to their sessions
//  label:  'Active' | 'Inactive'
//  reminder: short sentence for lists / badges (null when nothing needs attention)
// Patients registered before subscriptions existed have no data and count as active.
export function getSubscriptionStatus(patient, now = new Date()) {
  const sub = patient?.subscription;
  if (!sub?.startDate || !sub?.endDate) {
    return { key: 'none', active: true, label: 'Active', reminder: null, planLabel: null };
  }

  const planLabel = sub.plan === 'trial' ? 'Free trial' : 'Subscription';
  const toStart = differenceInCalendarDays(parseISO(sub.startDate), now);
  const toEnd = differenceInCalendarDays(parseISO(sub.endDate), now);
  const base = { planLabel, daysLeft: toEnd + 1, endDate: sub.endDate, startDate: sub.startDate };

  if (toStart > 0) {
    return {
      ...base,
      key: 'upcoming',
      active: false,
      label: 'Inactive',
      reminder: toStart === 1 ? `${planLabel} starts tomorrow` : `${planLabel} starts in ${toStart} days`,
    };
  }
  if (toEnd < 0) {
    const ago = -toEnd;
    return {
      ...base,
      key: 'expired',
      active: false,
      label: 'Inactive',
      reminder: ago === 1 ? `${planLabel} expired yesterday` : `${planLabel} expired ${ago} days ago`,
    };
  }
  if (toEnd <= EXPIRING_SOON_DAYS) {
    return {
      ...base,
      key: 'expiring',
      active: true,
      label: 'Active',
      reminder: toEnd === 0 ? `${planLabel} expiring today` : toEnd === 1 ? `${planLabel} expiring tomorrow` : `${planLabel} expiring in ${toEnd} days`,
    };
  }
  return { ...base, key: 'active', active: true, label: 'Active', reminder: null };
}
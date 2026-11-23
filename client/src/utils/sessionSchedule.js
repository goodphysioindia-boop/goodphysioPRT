import { differenceInCalendarDays, parseISO, format } from 'date-fns';

// Same options as the existing "Add Session" form
export const SESSION_TYPES = ['OPD', 'ICU/IPD', 'Home Visit', 'Online', 'Consultation'];

// Same slots as the patient registration form
export const TIME_SLOTS = ['9:00 AM - 10:00 AM', '10:30 AM - 11:30 AM', '12:00 PM - 1:00 PM', '2:00 PM - 3:00 PM', '4:00 PM - 5:00 PM'];

export const SESSION_MODES = [
  { value: 'group', label: 'Group Session' },
  { value: 'one-on-one', label: 'One-on-One Session' },
];
export const modeLabel = (m) => SESSION_MODES.find((x) => x.value === m)?.label || m;

// A session counts as "ending soon" when its last day is within this many days
export const ENDING_SOON_DAYS = 3;

// Status of a scheduled session relative to today (calendar-day based, end date inclusive).
//  key: 'upcoming' | 'ongoing' | 'ending-soon' | 'ended'
export function getSessionStatus(session, now = new Date()) {
  const toStart = differenceInCalendarDays(parseISO(session.startDate), now);
  const toEnd = differenceInCalendarDays(parseISO(session.endDate), now);

  if (toStart > 0) {
    return {
      key: 'upcoming',
      label: toStart === 1 ? 'Starts tomorrow' : `Starts in ${toStart} days`,
      daysToEnd: toEnd,
    };
  }
  if (toEnd < 0) return { key: 'ended', label: 'Ended', daysToEnd: toEnd };
  if (toEnd <= ENDING_SOON_DAYS) {
    return {
      key: 'ending-soon',
      label: toEnd === 0 ? 'Ends today' : toEnd === 1 ? 'Ends tomorrow' : `Ends in ${toEnd} days`,
      daysToEnd: toEnd,
    };
  }
  return { key: 'ongoing', label: 'Ongoing', daysToEnd: toEnd };
}

export const fmtDate = (s) => format(parseISO(s), 'd MMM yyyy');
export const fmtRange = (start, end) => (start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`);

// Ending-soon first (soonest end on top), then ongoing, then upcoming, then ended (latest first)
export function sortSessions(list) {
  const rank = { 'ending-soon': 0, ongoing: 1, upcoming: 2, ended: 3 };
  return [...list].sort((a, b) => {
    const sa = getSessionStatus(a).key;
    const sb = getSessionStatus(b).key;
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
    if (sa === 'upcoming') return a.startDate.localeCompare(b.startDate);
    if (sa === 'ended') return b.endDate.localeCompare(a.endDate);
    return a.endDate.localeCompare(b.endDate);
  });
}

// ---- custom time slot helpers ("HH:mm" <-> "h:mm AM - h:mm PM") ----
function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}
function to24h(text) {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
export const slotFromTimes = (from, to) => `${to12h(from)} - ${to12h(to)}`;
export function timesFromSlot(slot) {
  const parts = String(slot || '').split('-');
  if (parts.length !== 2) return { from: '', to: '' };
  return { from: to24h(parts[0]), to: to24h(parts[1]) };
}

// ---- Join window (patients) ----
// The Join button is only usable from JOIN_OPENS_BEFORE_MIN minutes before the
// time slot starts until JOIN_CLOSES_AFTER_MIN minutes after it ends, every day
// of the session's date range. Outside that it is shown disabled with a reason.
export const JOIN_OPENS_BEFORE_MIN = 10;
export const JOIN_CLOSES_AFTER_MIN = 10;

const slotMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const minutesTo12h = (mins) => to12h(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);

// slot: "10:30 AM - 11:30 AM". range (optional): { startDate, endDate } as YYYY-MM-DD.
// Returns { open: true } or { open: false, label }. A missing / unreadable slot never blocks joining.
export function getJoinState(slot, now = new Date(), range = {}) {
  const { from, to } = timesFromSlot(slot);
  if (!from || !to) return { open: true };
  const start = slotMinutes(from);
  const end = slotMinutes(to);
  if (end <= start) return { open: true };

  const opensAt = start - JOIN_OPENS_BEFORE_MIN;
  const closesAt = end + JOIN_CLOSES_AFTER_MIN;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const today = format(now, 'yyyy-MM-dd');

  if (range.startDate && today < range.startDate) {
    return { open: false, label: `Join opens ${fmtDate(range.startDate)} at ${minutesTo12h(opensAt)}` };
  }
  if (range.endDate && today > range.endDate) return { open: false, label: 'Session ended' };
  if (nowMin >= opensAt && nowMin <= closesAt) return { open: true };
  if (nowMin < opensAt) return { open: false, label: `Join opens today at ${minutesTo12h(opensAt)}` };
  if (range.endDate && today >= range.endDate) return { open: false, label: 'Session over for today' };
  return { open: false, label: `Join opens tomorrow at ${minutesTo12h(opensAt)}` };
}
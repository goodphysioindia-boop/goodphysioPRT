import { useEffect, useState } from 'react';

// Current time that re-renders the component on an interval, so time-based UI
// (e.g. the Join button window) flips on its own without a page refresh.
export default function useNow(enabled = true, intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [enabled, intervalMs]);
  return now;
}
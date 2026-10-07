'use client';
import { useEffect, useRef, useState } from 'react';

// Counts up to a number instead of snapping to it. Non-numbers (a dash while
// loading) render as-is. Lifted from the OVP app.
export default function CountUp({ value, duration = 500 }) {
  const target = typeof value === 'number' ? value : null;
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (target == null) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target); from.current = target; return undefined;
    }
    const begin = from.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (target - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  if (target == null) return <>{value}</>;
  return <>{shown}</>;
}

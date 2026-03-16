"use client";

import { useState, useEffect } from "react";

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "Fermée";

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function useCountdown(targetDate: Date) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return { formatted: "--:--", isExpired: false, isUrgent: false, diffMs: 1 };
  }

  const diffMs = targetDate.getTime() - now.getTime();
  const isExpired = diffMs <= 0;
  const isUrgent = diffMs > 0 && diffMs < 2 * 60 * 60 * 1000;
  const formatted = formatCountdown(diffMs);

  return { formatted, isExpired, isUrgent, diffMs };
}

export function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const { formatted, isUrgent } = useCountdown(targetDate);

  return (
    <span className={`tabular-nums font-medium ${isUrgent ? "text-rouge" : "text-gold"}`}>
      {formatted}
    </span>
  );
}

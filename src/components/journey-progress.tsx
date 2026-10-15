"use client";

import { Flag, MapPin } from "lucide-react";

export function JourneyProgress({ progress, label, compact = false }: { progress: number; label: string; compact?: boolean }) {
  const position = Math.max(5, Math.min(96, progress));
  return <div className={`journey ${compact ? "journey-compact" : ""}`} aria-label={`${label}: ${Math.round(progress)}%`}>
    <div className="journey-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={label}>
      <span className="journey-track-fill" style={{ width: `${position}%` }} />
      <span className="journey-car" style={{ left: `${position}%` }} aria-hidden="true"><span className="journey-car-top"/><span className="journey-car-body"/><span className="journey-wheel journey-wheel-left"/><span className="journey-wheel journey-wheel-right"/></span>
      <MapPin className="journey-start" size={17} aria-hidden="true"/>
      <Flag className="journey-end" size={18} aria-hidden="true"/>
    </div>
  </div>;
}

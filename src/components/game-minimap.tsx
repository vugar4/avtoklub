"use client";

import { memo, useMemo } from "react";
import roads from "./baku-roads.json";
import { project, type CarState, type Position } from "./drive-physics";

type Stop = { id: string; point: Position };
const SIZE = 180;
const SCALE = .24;

function GameMinimap({ car, target, stops }: { car: CarState; target: Position; stops: Stop[] }) {
  const paths = useMemo(() => roads.filter(road => road.points.some(coord => {
    const point = project(coord as [number, number]);
    return Math.abs(point.x - car.x) < 430 && Math.abs(point.y - car.y) < 430;
  })).map((road, index) => ({
    id: index,
    kind: road.kind,
    d: road.points.map((coord, pointIndex) => {
      const point = project(coord as [number, number]);
      return `${pointIndex ? "L" : "M"}${(SIZE / 2 + (point.x - car.x) * SCALE).toFixed(1)} ${(SIZE / 2 + (point.y - car.y) * SCALE).toFixed(1)}`;
    }).join(" "),
  })), [car.x, car.y]);
  const pin = (point: Position) => ({ x: SIZE / 2 + (point.x - car.x) * SCALE, y: SIZE / 2 + (point.y - car.y) * SCALE });
  const destination = pin(target);
  return <div className="game-minimap" aria-label="Yaxın küçələrin mini xəritəsi">
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <circle cx="90" cy="90" r="90" fill="#d6eac4" />
      {paths.map(path => <path key={path.id} d={path.d} fill="none" stroke="#f4eee3" strokeWidth={path.kind === "trunk" || path.kind === "primary" ? 6 : 4} strokeLinecap="round" strokeLinejoin="round"/>)}
      <line x1="90" y1="90" x2={destination.x} y2={destination.y} stroke="#2973e7" strokeWidth="2" strokeDasharray="4 5"/>
      {stops.map(stop => { const p = pin(stop.point); return <circle key={stop.id} cx={p.x} cy={p.y} r="5" fill={stop.point === target ? "#246ce1" : "#fff"} stroke="#246ce1" strokeWidth="2"/>; })}
      <circle cx="90" cy="90" r="11" fill="#fff" stroke="#1e52b5" strokeWidth="2"/>
      <path d="M90 80 L95 97 L90 93 L85 97Z" fill="#1d5fd2" transform={`rotate(${car.angle} 90 90)`}/>
    </svg>
    <span className="game-minimap-north">N</span>
  </div>;
}
export default memo(GameMinimap);

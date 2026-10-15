"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, CalendarDays, CarFront, CircleHelp, Gauge, Map as MapIcon, MapPin, Maximize2, Menu, Minimize2, RotateCcw, ShoppingBag, UsersRound, X, Zap } from "lucide-react";
import routeCoordinates from "./baku-route.json";
import { drivingStart, nearestRoad, project, roadPath, stepDrive, type CarState, type Position } from "./drive-physics";
import type { WorldStop } from "./baku-world";

const BakuWorld = dynamic(() => import("./baku-world"), { ssr: false });
const GameMinimap = dynamic(() => import("./game-minimap"), { ssr: false });
const route = routeCoordinates as [number, number][];
const points = route.map(project);
const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
const totalLength = lengths.reduce((sum, length) => sum + length, 0);
const places = [
  { id: "events", index: 20, title: "Tədbirlər", detail: "Bakıdakı avtomobil görüşlərini və yürüşlərini kəşf et.", icon: CalendarDays, href: "/events" },
  { id: "clubs", index: 25, title: "Klublar", detail: "Maraqlarına uyğun yol yoldaşlarını tap.", icon: UsersRound, href: "/clubs" },
  { id: "market", index: 30, title: "Elanlar", detail: "İcmanın avtomobil və hissə elanlarına bax.", icon: ShoppingBag, href: "/marketplace" },
  { id: "garage", index: 37, title: "Qaraj", detail: "Öz avtomobillərini bir profildə topla.", icon: CarFront, href: "/garage" },
];
const stops: WorldStop[] = places.map((place, index) => {
  const road = nearestRoad(points[place.index], 350);
  return { id: place.id, title: place.title, point: road ? { x: road.x, y: road.y } : points[place.index], number: index + 1 };
});

function onRoute(progress: number) {
  let left = Math.max(0, Math.min(1, progress)) * totalLength;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (left <= length || index === lengths.length - 1) {
      const ratio = Math.max(0, Math.min(1, left / length));
      const start = points[index], end = points[index + 1];
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio, angle: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 90 };
    }
    left -= length;
  }
  return { ...points[0], angle: 0 };
}
const INITIAL_CAR = drivingStart(onRoute(.12));
// The passive preview uses only connected road nodes. Endpoint connectors can cross buildings.
const tourLeg = roadPath(stops[0].point, stops[1].point)?.slice(1, -1) ?? [];
const tourPath: Position[] = tourLeg.length > 1
  ? [...tourLeg, ...tourLeg.slice(0, -1).reverse()]
  : [INITIAL_CAR, ...(roadPath(INITIAL_CAR, stops[0].point)?.slice(1, -1) ?? [])];
const tourLengths = tourPath.slice(1).map((point, index) => Math.hypot(point.x - tourPath[index].x, point.y - tourPath[index].y));
const tourLength = tourLengths.reduce((sum, length) => sum + length, 0);
function tourPoint(distance: number): Position {
  let remaining = tourLength ? distance % tourLength : 0;
  for (let index = 0; index < tourLengths.length; index++) {
    const length = tourLengths[index];
    if (remaining <= length || index === tourLengths.length - 1) {
      const ratio = length ? remaining / length : 0;
      const a = tourPath[index], b = tourPath[index + 1];
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    }
    remaining -= length;
  }
  return INITIAL_CAR;
}
function tourCarAt(distance: number): CarState {
  const point = tourPoint(distance), ahead = tourPoint(distance + 2);
  return { ...point, angle: Math.atan2(ahead.x - point.x, point.y - ahead.y) * 180 / Math.PI, speed: 13 };
}
const INITIAL_TOUR_CAR = tourCarAt(0);

function Joystick({ onMove }: { onMove: (throttle: number, steer: number) => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const move = (event: React.PointerEvent) => {
    if (!pad.current) return;
    const rect = pad.current.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * .32)));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height * .32)));
    setKnob({ x, y });
    onMove(-y, x);
  };
  const stop = () => { setKnob({ x: 0, y: 0 }); onMove(0, 0); };
  return <div ref={pad} className="game-joystick" role="group" aria-label="Toxunma ilə qaz və sükan" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (event.buttons) move(event); }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
    <div className="game-joystick-cross"/><div className="game-joystick-knob" style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }}/>
  </div>;
}

export default function BakuDrive() {
  const frame = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const axes = useRef({ throttle: 0, steer: 0 });
  const tourDistanceRef = useRef(0);
  const carRef = useRef<CarState>({ ...INITIAL_TOUR_CAR });
  const modeRef = useRef<"tour" | "play">("tour");
  const overviewRef = useRef(false);
  const autoPath = useRef<Position[] | null>(null);
  const autoIndex = useRef(1);
  const targetRef = useRef(0);
  const actionsRef = useRef({ toggleOverview: () => {}, beginAuto: () => {}, stopAuto: () => {}, openNearby: () => {} });
  const [mode, setMode] = useState<"tour" | "play">("tour");
  const [immersive, setImmersive] = useState(false);
  const [car, setCar] = useState<CarState>(() => ({ ...INITIAL_TOUR_CAR }));
  const [minimapCar, setMinimapCar] = useState<CarState>(() => ({ ...INITIAL_TOUR_CAR }));
  const [selected, setSelected] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [visited, setVisited] = useState<string[]>([]);
  const [overview, setOverview] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const chooseTarget = (id: string) => {
    const index = stops.findIndex(stop => stop.id === id);
    if (index < 0) return;
    targetRef.current = index;
    setTargetIndex(index);
  };
  const beginAuto = (id = stops[targetRef.current].id) => {
    chooseTarget(id);
    const stop = stops.find(item => item.id === id)!;
    const path = roadPath(carRef.current, stop.point);
    if (!path) { setNotice("Bu məkana uyğun yol tapılmadı."); return; }
    autoPath.current = path;
    autoIndex.current = 1;
    setAutopilot(true);
    overviewRef.current = false;
    setOverview(false);
    setSelected(null);
    setNotice(`${stop.title} məkanına avtomatik sürüş başladı`);
  };
  const stopAuto = () => { autoPath.current = null; setAutopilot(false); };
  const toggleOverview = () => {
    overviewRef.current = !overviewRef.current;
    setOverview(overviewRef.current);
    setMenu(false);
  };
  const openNearby = () => {
    const stop = stops.find(item => Math.hypot(item.point.x - carRef.current.x, item.point.y - carRef.current.y) < 43);
    if (!stop) { setNotice("Məkanın mavi dairəsində dayanıb Enter bas."); return; }
    if (Math.abs(carRef.current.speed) > 12) { setNotice("Məkanı açmaq üçün əvvəlcə dayan."); return; }
    setSelected(stop.id);
    setVisited(previous => previous.includes(stop.id) ? previous : [...previous, stop.id]);
    setNotice("");
    stopAuto();
    const next = stops.find(item => item.id !== stop.id && !visited.includes(item.id));
    if (next) chooseTarget(next.id);
  };
  useEffect(() => { actionsRef.current = { toggleOverview, beginAuto: () => beginAuto(), stopAuto, openNearby }; });
  const startDrive = async () => {
    const initial = { ...carRef.current, speed: 0 };
    carRef.current = initial;
    setCar(initial);
    setMinimapCar(initial);
    keys.current.clear();
    axes.current = { throttle: 0, steer: 0 };
    modeRef.current = "play";
    setMode("play");
    setImmersive(true);
    setSelected(null);
    setMenu(false);
    setHelp(false);
    setNotice("W ilə qaz ver, A və D ilə dön. Məkanın dairəsində dayan.");
    try { await frame.current?.requestFullscreen(); } catch { /* Fixed-position fallback keeps the game available. */ }
  };
  const exitDrive = async () => {
    keys.current.clear();
    axes.current = { throttle: 0, steer: 0 };
    stopAuto();
    modeRef.current = "tour";
    setMode("tour");
    setImmersive(false);
    overviewRef.current = false;
    setOverview(false);
    if (document.fullscreenElement === frame.current) await document.exitFullscreen();
  };

  useEffect(() => {
    const fullscreenChange = () => {
      if (document.fullscreenElement === frame.current || modeRef.current !== "play") return;
      keys.current.clear();
      axes.current = { throttle: 0, steer: 0 };
      autoPath.current = null;
      modeRef.current = "tour";
      setMode("tour");
      setImmersive(false);
      setAutopilot(false);
      overviewRef.current = false;
      setOverview(false);
    };
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => document.removeEventListener("fullscreenchange", fullscreenChange);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (modeRef.current !== "play" || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright", " ", "shift", "e"].includes(key)) {
        event.preventDefault();
        if (autoPath.current && key !== " " && key !== "shift" && key !== "e") { autoPath.current = null; setAutopilot(false); setNotice("İdarəetmə səndədir"); }
        keys.current.add(key);
      }
      if (event.repeat) return;
      if (key === "o") { event.preventDefault(); actionsRef.current.toggleOverview(); }
      if (key === "m") { event.preventDefault(); setMenu(previous => !previous); }
      if (key === "f") { event.preventDefault(); if (autoPath.current) actionsRef.current.stopAuto(); else actionsRef.current.beginAuto(); }
      if (key === "enter") { event.preventDefault(); actionsRef.current.openNearby(); }
      if (key === "r") {
        event.preventDefault();
        const road = nearestRoad(carRef.current, 120);
        if (road) carRef.current = { x: road.x, y: road.y, angle: road.angle, speed: 0 };
        actionsRef.current.stopAuto();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => { keys.current.clear(); axes.current = { throttle: 0, steer: 0 }; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation = 0, last = 0, rendered = 0, minimapRendered = 0;
    let lastCar = carRef.current;
    const tick = (time: number) => {
      const delta = Math.min((time - (last || time)) / 1000, .05);
      last = time;
      if (modeRef.current === "tour" && !reducedMotion.matches) {
        tourDistanceRef.current += delta * 13;
        const next = tourCarAt(tourDistanceRef.current);
        const turn = ((next.angle - carRef.current.angle + 540) % 360) - 180;
        carRef.current = { ...next, angle: carRef.current.angle + turn * Math.min(1, delta * 3.5) };
      } else if (modeRef.current === "play") {
        if (autoPath.current && !overviewRef.current) {
          const path = autoPath.current;
          let move = delta * 48;
          while (move > 0 && autoIndex.current < path.length) {
            const goal = path[autoIndex.current];
            const dx = goal.x - carRef.current.x, dy = goal.y - carRef.current.y;
            const distance = Math.hypot(dx, dy);
            if (distance < .01) { autoIndex.current++; continue; }
            const portion = Math.min(move, distance);
            carRef.current = { x: carRef.current.x + dx / distance * portion, y: carRef.current.y + dy / distance * portion, angle: Math.atan2(dx, -dy) * 180 / Math.PI, speed: 48 };
            move -= portion;
            if (portion >= distance - .01) autoIndex.current++;
          }
          if (autoIndex.current >= path.length) {
            carRef.current = { ...carRef.current, speed: 0 };
            autoPath.current = null;
            setAutopilot(false);
            setNotice("Məkana çatdın. Dayanacaqda Enter bas.");
          }
        } else if (!overviewRef.current) {
          const forward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown"));
          const steer = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
          carRef.current = stepDrive(carRef.current, Math.max(-1, Math.min(1, forward + axes.current.throttle)), Math.max(-1, Math.min(1, steer + axes.current.steer)), delta, keys.current.has("shift") || keys.current.has("e"), keys.current.has(" "));
        }
      }
      if (time - rendered > 33) {
        if ((modeRef.current === "play" || modeRef.current === "tour") && (Math.abs(lastCar.x - carRef.current.x) > .015 || Math.abs(lastCar.y - carRef.current.y) > .015 || Math.abs(lastCar.angle - carRef.current.angle) > .05 || Math.abs(lastCar.speed - carRef.current.speed) > .04)) {
          lastCar = carRef.current;
          setCar(carRef.current);
          if (modeRef.current === "play" && time - minimapRendered > 150) { setMinimapCar(carRef.current); minimapRendered = time; }
        }
        rendered = time;
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, []);

  const activePlace = places.find(place => place.id === selected);
  const target = stops[targetIndex];
  const targetDistance = Math.round(Math.hypot(target.point.x - car.x, target.point.y - car.y) * .91);
  const targetBearing = Math.atan2(target.point.x - car.x, car.y - target.point.y) * 180 / Math.PI - car.angle;
  const gameSpeed = Math.round(Math.abs(car.speed) * 1.45);
  const onWorldStop = (id: string) => {
    if (modeRef.current === "tour") { setSelected(id); return; }
    chooseTarget(id);
    if (overviewRef.current) { beginAuto(id); return; }
    const stop = stops.find(item => item.id === id)!;
    if (Math.hypot(stop.point.x - carRef.current.x, stop.point.y - carRef.current.y) < 43 && Math.abs(carRef.current.speed) < 12) {
      setSelected(id);
      setVisited(previous => previous.includes(id) ? previous : [...previous, id]);
      const next = stops.find(item => item.id !== id && !visited.includes(item.id));
      if (next) chooseTarget(next.id);
      setNotice("");
      return;
    }
    setNotice(`${stop.title} seçildi. F ilə avtomatik sür.`);
  };
  const manualTouch = (key: string, pressed: boolean) => {
    if (pressed) keys.current.add(key); else keys.current.delete(key);
  };

  return <div ref={frame} className={`drive-frame ${immersive ? "drive-immersive" : ""}`}>
    <div className={`drive-map drive-game ${mode === "tour" ? "drive-tour" : ""}`} role="application" aria-label="Bakı küçələrində avtomobil oyunu. W S qaz və əyləc, A D sükan, O xəritə, F avtomatik sürüş, Enter məkan, R yola qaytarır." onWheel={event => { if (mode === "play") setZoom(previous => Math.max(.75, Math.min(1.55, previous + (event.deltaY < 0 ? .08 : -.08)))); }}>
      <BakuWorld car={car} stops={stops} overview={mode === "play" && overview} zoom={mode === "tour" ? 1.2 : zoom} onStop={onWorldStop}/>
      {mode === "tour" ? <>
        <button className="drive-enter" type="button" onClick={() => void startDrive()}><Maximize2 size={17}/> Sürməyə başla</button>
        <button className="drive-help" type="button" onClick={() => setHelp(!help)} aria-label="İdarəetmə qaydası"><CircleHelp size={19}/></button>
        <div className="drive-map-location"><MapPin size={14}/> BAKI</div>
      </> : <>
        <div className="game-topbar">
          <button className="game-exit" type="button" onClick={() => void exitDrive()}><Minimize2 size={17}/><span>Oyundan çıx</span></button>
          {!overview && <button className="game-target" type="button" onClick={() => beginAuto()} title="Məkana avtomatik sür"><span className="game-target-arrow" style={{ transform: `rotate(${targetBearing - 90}deg)` }}>➤</span><span><small>NÖVBƏTİ MƏKAN · {visited.length}/{stops.length}</small><strong>{target.title}</strong><em>{targetDistance} m</em></span></button>}
          <div className="game-top-actions"><button type="button" onClick={toggleOverview} aria-label="Ümumi xəritə" title="Ümumi xəritə (O)"><MapIcon size={20}/></button><button type="button" onClick={() => setMenu(!menu)} aria-label="Oyun menyusu" title="Menyu (M)"><Menu size={21}/></button></div>
        </div>
        {!overview && <><GameMinimap car={minimapCar} target={target.point} stops={stops}/><div className="game-speed"><Gauge size={15}/><strong>{gameSpeed}</strong><span>KM/SAAT</span></div>
          <div className="game-control-strip"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> sür</span><span><kbd>Enter</kbd> məkan</span><span><kbd>O</kbd> xəritə</span><span><kbd>F</kbd> avtopilot</span></div>
          <div className="game-touch-controls"><Joystick onMove={(throttle, steer) => { if (autoPath.current && (throttle || steer)) stopAuto(); axes.current = { throttle, steer }; }}/><div className="game-action-controls"><button type="button" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); manualTouch(" ", true); }} onPointerUp={() => manualTouch(" ", false)} onPointerCancel={() => manualTouch(" ", false)} aria-label="Əyləc">ƏYLƏC</button><button type="button" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); manualTouch("shift", true); }} onPointerUp={() => manualTouch("shift", false)} onPointerCancel={() => manualTouch("shift", false)} aria-label="Turbo"><Zap size={23}/></button></div></div>
          {autopilot && <button className="game-auto-status" type="button" onClick={stopAuto}>Avtopilot işləyir · Dayandır <X size={14}/></button>}
        </>}
        {overview && <div className="game-overview-panel"><h2>Hara sürək?</h2><p>Məkan seç, maşın yol ilə özü getsin.</p>{stops.map(stop => <button type="button" key={stop.id} onClick={() => beginAuto(stop.id)}><span>{stop.number}</span><strong>{stop.title}</strong><small>{visited.includes(stop.id) ? "Kəşf edildi" : `${Math.round(Math.hypot(stop.point.x - car.x, stop.point.y - car.y) * .91)} m`}</small><ArrowRight size={17}/></button>)}<button className="game-overview-close" type="button" onClick={toggleOverview}>Sürüşə qayıt</button></div>}
        {menu && <div className="game-menu"><button className="game-menu-close" type="button" onClick={() => setMenu(false)} aria-label="Menyunu bağla"><X size={17}/></button><h2>Oyun menyusu</h2><button type="button" onClick={toggleOverview}><MapIcon size={17}/> Məkanlar və xəritə</button><button type="button" onClick={() => { setHelp(true); setMenu(false); }}><CircleHelp size={17}/> İdarəetmə</button><button type="button" onClick={() => { const road = nearestRoad(carRef.current, 120); if (road) carRef.current = { x: road.x, y: road.y, angle: road.angle, speed: 0 }; setMenu(false); }}><RotateCcw size={17}/> Maşını yola qaytar</button><button type="button" onClick={() => void exitDrive()}><Minimize2 size={17}/> Oyundan çıx</button></div>}
        {help && <div className="game-help"><button type="button" onClick={() => setHelp(false)} aria-label="Bağla"><X size={18}/></button><h2>İdarəetmə</h2><p><kbd>W</kbd>/<kbd>↑</kbd> qaz · <kbd>S</kbd>/<kbd>↓</kbd> əyləc və geri</p><p><kbd>A</kbd>/<kbd>D</kbd> sükan · <kbd>Space</kbd> əl əyləci</p><p><kbd>Shift</kbd> turbo · <kbd>O</kbd> xəritə · <kbd>F</kbd> avtopilot</p><p><kbd>Enter</kbd> dayanacaqda məkanı aç · <kbd>R</kbd> yola qaytar</p><p>Mobil telefonda joystick və sağdakı düymələrdən istifadə et.</p></div>}
        {notice && !overview && <div className="game-notice" role="status" onClick={() => setNotice("")}>{notice}</div>}
      </>}
      {activePlace && <div className="drive-info"><button type="button" onClick={() => setSelected(null)} aria-label="Bağla"><X size={16}/></button><strong>{activePlace.title}</strong><p>{activePlace.detail}</p><Link href={activePlace.href}>Bax <ArrowRight size={15}/></Link></div>}
      {mode === "tour" && help && <div className="drive-instructions"><button type="button" onClick={() => setHelp(false)} aria-label="Bağla"><X size={15}/></button><b>İdarəetmə</b><span>W / ↑ qaz · S / ↓ əyləc və geri</span><span>A / ← sola · D / → sağa dön</span><span>O ilə ümumi xəritə, F ilə avtopilot.</span></div>}
      <div className="drive-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</div>
    </div>
  </div>;
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  axisIds, axisPlanes, lineEnds, legendWords, MAP_BOTTOM, metricsOf, rolePaint, strandInk, textDefaults, textExtent, textRoleLabels, textRoles, type LegendWord, type TextPaint, type TextRole, checkMap, defaultStyle, markerBox, markerFillKind, markerFillLabels, markerFills, shapeBounds, shapesOf, type Shape, diffMaps, fills, fontLabels, fonts, grounds, hatches, influenceDashes, kindLabels, kinds, labelBox, labelLines, markerLabels, markers,
  nearestOnPolyline, newId, outlines, renderMapInner, renderMapSvg, routeLabels, routes, snapBetween, snapDirection, strandDashes, styleOf, stylePresets,
  type Issue, type Item, type LogEntry, type MapStyle, type MarkerPaint, type MarkerType, type Pt, type ResearchMap, type Strand,
} from "@/lib/research-map";
import { seedMap } from "@/lib/research-map-seed";
import { deleteResearchMapSnapshot, saveResearchMap, saveResearchMapSnapshot, saveResearchMapToLibrary } from "@/app/(workspace)/tenure/map/actions";

type Snapshot = { id: string; name: string; createdAt: string; map: ResearchMap; mediaId?: string };
type Selection = { type: "item" | "strand" | "project" | "zone" | "shape" | "text"; id: string; point?: number } | null;
type Drag =
  | { kind: "label"; id: string; dx: number; dy: number }
  | { kind: "marker"; id: string }
  | { kind: "feed"; id: string }
  | { kind: "point"; id: string; index: number }
  | { kind: "project"; id: string; dx: number; dy: number }
  | { kind: "zone"; dx: number; dy: number }
  | { kind: "zone-size" }
  | { kind: "zone-move"; sx: number; sy: number; ox: number; oy: number }
  | { kind: "shape"; id: string; sx: number; sy: number; orig: Pt[] }
  | { kind: "shape-point"; id: string; index: number }
  | { kind: "pan"; sx: number; sy: number; cx: number; cy: number; moved: boolean; pick?: Selection };
type View = { cx: number; cy: number; scale: number };
const MIN_SCALE = 0.08; const MAX_SCALE = 8;
const clampScale = (n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
const fitFor = (mw: number, mh: number, w: number, h: number): View => ({ cx: mw / 2, cy: mh / 2, scale: clampScale(Math.min(w / mw, h / mh) * 0.97) });
// Zooms about a point on screen, so whatever is under the pointer stays put.
function zoomView(v: View, factor: number, clientX?: number, clientY?: number, rect?: DOMRect): View {
  const scale = clampScale(v.scale * factor); const k = v.scale / scale;
  if (!rect || clientX === undefined || clientY === undefined) return { ...v, scale };
  const px = v.cx + (clientX - rect.left - rect.width / 2) / v.scale; const py = v.cy + (clientY - rect.top - rect.height / 2) / v.scale;
  return { cx: px - (px - v.cx) * k, cy: py - (py - v.cy) * k, scale };
}
type Tab = "content" | "checks" | "map" | "layers" | "style" | "history";

const grid = (n: number, on: boolean, step = 5) => on ? Math.round(n / step) * step : Math.round(n * 10) / 10;
const dateLabel = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const today = () => new Date().toISOString().slice(0, 10);
const lineEndLabels: Record<(typeof lineEnds)[number], string> = { none: "None", arrow: "Arrow", circle: "Open circle", dot: "Dot", tick: "Tick", bar: "Heavy bar" };
const defaultMetricsLike = { scale: 1, wide: 1.1 };
const oneLine = (name: string) => name.replace(/\n/g, " ") || "Untitled";
// Edits shapes on a map whose planes may still be generated from the style: the first edit makes them real shapes.
const withShapes = (map: ResearchMap, change: (shapes: Shape[]) => Shape[]): ResearchMap => ({ ...map, shapes: change(shapesOf(map)) });
type ShapeTemplate = { name: string; kind: Shape["kind"]; points: [number, number][]; extra?: Partial<Shape> };
const shapeTemplates: Record<string, ShapeTemplate> = {
  rectangle: { name: "Rectangle", kind: "polygon", points: [[0, 0], [360, 0], [360, 220], [0, 220]] },
  circle: { name: "Circle", kind: "ellipse", points: [[0, 0], [260, 260]] },
  triangle: { name: "Triangle", kind: "polygon", points: [[180, 0], [360, 260], [0, 260]] },
  plane: { name: "Skewed plane", kind: "polygon", points: [[120, 0], [600, 0], [480, 220], [0, 220]] },
  slab: { name: "Hatched slab", kind: "polygon", points: [[0, 0], [300, 0], [300, 180], [0, 180]], extra: { fill: "#E7B4D6", opacity: 0.85, hatch: "heavy", hatchColor: "#141414", hatchOpacity: 0.85, outline: "solid", strokeWidth: 1.5 } },
  graph: { name: "Graph-paper plate", kind: "polygon", points: [[0, 0], [320, 0], [320, 240], [0, 240]], extra: { fill: "#CFEBDD", opacity: 0.9, hatch: "grid", hatchColor: "#4E8F72", hatchOpacity: 0.55, shadow: true } },
  leader: { name: "Leader", kind: "line", points: [[0, 0], [160, 0], [300, -110]], extra: { strokeWidth: 1, outline: "solid", end: "circle", front: true } },
  arrow: { name: "Dashed arrow", kind: "line", points: [[0, 120], [160, 0], [360, 60]], extra: { strokeWidth: 2.5, outline: "dashed", curve: true, end: "arrow", start: "dot", front: true } },
  dimension: { name: "Dimension", kind: "line", points: [[0, 0], [360, 0]], extra: { strokeWidth: 2.5, outline: "solid", start: "bar", end: "bar", front: true } },
  number: { name: "Big number", kind: "text", points: [[0, 0], [10, 150]], extra: { text: "001", fill: "#C77DB0", opacity: 1, weight: 900, front: true } },
  stencil: { name: "Stencil label", kind: "text", points: [[0, 0], [10, 26]], extra: { text: "HOLD THE LINE", fill: "#141414", opacity: 1, weight: 900, front: true } },
};

export function strandName(map: ResearchMap, strand: Strand) {
  const start = map.items.find(item => item.marker?.type === "start" && item.marker.strand === strand.id);
  return start ? oneLine(start.name) : `Unnamed ${strand.axis} strand`;
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ResearchMapEditor({ initial, isNew, log: initialLog, snapshots: initialSnapshots, projects, openVersion }: { initial: ResearchMap; isNew: boolean; log: LogEntry[]; snapshots: Snapshot[]; projects: { id: string; title: string }[]; openVersion?: string }) {
  const [map, setMap] = useState(initial);
  const [past, setPast] = useState<ResearchMap[]>([]);
  const [future, setFuture] = useState<ResearchMap[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>(openVersion ? "history" : "content");
  const [snap, setSnap] = useState(false);
  const [dirty, setDirty] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string; href?: string } | null>(null);
  const [log, setLog] = useState(initialLog);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [snapshotName, setSnapshotName] = useState("");
  const [compare, setCompare] = useState<Snapshot | null>(() => initialSnapshots.find(s => s.id === openVersion) || null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 1200, h: 750 });
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const sizeRef = useRef({ w: 1200, h: 750, mw: initial.width, mh: initial.height });
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { sizeRef.current = { w: frame.w, h: frame.h, mw: map.width, mh: map.height }; }, [frame, map.width, map.height]);
  const fitView = () => fitFor(map.width, map.height, frame.w, frame.h);
  const current = view || fitView();
  const vb = { w: frame.w / current.scale, h: frame.h / current.scale };
  const viewBox = `${current.cx - vb.w / 2} ${current.cy - vb.h / 2} ${vb.w} ${vb.h}`;
  const hs = Math.min(4, Math.max(0.5, 1 / current.scale));
  const zoomAt = (factor: number, clientX?: number, clientY?: number) => setView(prev => zoomView(prev || fitView(), factor, clientX, clientY, frameRef.current?.getBoundingClientRect()));
  useEffect(() => {
    const el = frameRef.current; if (!el) return;
    const resize = new ResizeObserver(entries => { const r = entries[0].contentRect; if (r.width > 0 && r.height > 0) setFrame({ w: r.width, h: r.height }); });
    resize.observe(el);
    // Pinch or Ctrl/⌘ + wheel zooms at the pointer; a plain wheel or two-finger swipe pans, as in Illustrator and Figma.
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const size = sizeRef.current;
      setView(prev => {
        const v = prev || fitFor(size.mw, size.mh, size.w, size.h);
        if (event.ctrlKey || event.metaKey) return zoomView(v, Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.06 : Math.abs(event.deltaY) < 40 ? 0.01 : 0.002)), event.clientX, event.clientY, el.getBoundingClientRect());
        const line = event.deltaMode === 1 ? 16 : 1;
        const dx = (event.shiftKey ? event.deltaY : event.deltaX) * line; const dy = event.shiftKey ? 0 : event.deltaY * line;
        return { ...v, cx: v.cx + dx / v.scale, cy: v.cy + dy / v.scale };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { resize.disconnect(); el.removeEventListener("wheel", wheel); };
  }, [compare]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; scale: number } | null>(null);
  const spaceDown = useRef(false);
  const nameRef = useRef<HTMLTextAreaElement>(null);

  const issues = useMemo(() => checkMap(map), [map]);
  const metrics = useMemo(() => metricsOf(map), [map]);
  const inner = useMemo(() => renderMapInner(map), [map]);
  const fixes = issues.filter(issue => issue.level === "fix").length;

  // Every change goes through here so it can be undone.
  const commit = useCallback((next: ResearchMap | ((current: ResearchMap) => ResearchMap)) => {
    setMap(current => {
      const value = typeof next === "function" ? next(current) : next;
      if (value === current) return current;
      setPast(list => [...list.slice(-99), current]); setFuture([]); setDirty(true);
      return value;
    });
  }, []);
  const undo = useCallback(() => setPast(list => { if (!list.length) return list; const prev = list[list.length - 1]; setMap(current => { setFuture(f => [current, ...f].slice(0, 100)); return prev; }); setDirty(true); return list.slice(0, -1); }), []);
  const redo = useCallback(() => setFuture(list => { if (!list.length) return list; const next = list[0]; setMap(current => { setPast(p => [...p, current].slice(-100)); return next; }); setDirty(true); return list.slice(1); }), []);

  const save = useCallback(async () => {
    setSaving(true); setMessage(null);
    try { const result = await saveResearchMap(map); setLog(result.log); setDirty(false); setMessage({ text: "Saved." }); }
    catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Could not save the map. Please retry." }); }
    finally { setSaving(false); }
  }, [map]);

  const updateItem = (id: string, change: Partial<Item> | ((item: Item) => Item)) => commit(current => ({ ...current, items: current.items.map(item => item.id === id ? (typeof change === "function" ? change(item) : { ...item, ...change }) : item) }));
  const removeSelection = useCallback(() => {
    if (!selection) return;
    if (selection.type === "item") commit(current => ({ ...current, items: current.items.filter(item => item.id !== selection.id).map(item => item.from === selection.id ? { ...item, from: undefined } : item) }));
    if (selection.type === "project") commit(current => ({ ...current, projects: current.projects.filter(p => p.id !== selection.id) }));
    if (selection.type === "strand") {
      if (selection.point !== undefined) {
        commit(current => ({ ...current, strands: current.strands.map(s => s.id === selection.id && s.points.length > 2 ? { ...s, points: s.points.filter((_, i) => i !== selection.point) } : s) }));
        setSelection({ type: "strand", id: selection.id }); return;
      }
      if (!window.confirm("Delete this strand? Its influences and stations stay on the map, unattached, so you can move them.")) return;
      commit(current => ({ ...current, strands: current.strands.filter(s => s.id !== selection.id) }));
    }
    if (selection.type === "zone") commit(current => ({ ...current, zone: null }));
    if (selection.type === "shape") {
      if (selection.point !== undefined) {
        commit(current => withShapes(current, list => list.map(sh => sh.id === selection.id && ((sh.kind === "polygon" && sh.points.length > 3) || (sh.kind === "line" && sh.points.length > 2)) ? { ...sh, points: sh.points.filter((_, i) => i !== selection.point) } : sh)));
        setSelection({ type: "shape", id: selection.id }); return;
      }
      commit(current => withShapes(current, list => list.filter(sh => sh.id !== selection.id)));
    }
    setSelection(null);
  }, [selection, commit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); return; }
      if (typing) return;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && selection) { event.preventDefault(); removeSelection(); return; }
      if (event.key === "Escape") { setSelection(null); return; }
      if (!mod && (event.key === "=" || event.key === "+")) { event.preventDefault(); zoomAt(1.25); return; }
      if (!mod && (event.key === "-" || event.key === "_")) { event.preventDefault(); zoomAt(0.8); return; }
      if (!mod && event.key === "0") { event.preventDefault(); setView(fitView()); return; }
      if (!mod && event.key === "1") { event.preventDefault(); setView(v => ({ ...(v || fitView()), scale: 1 })); return; }
      const step = event.shiftKey ? 10 : 1;
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (move && selection?.type === "item") { event.preventDefault(); updateItem(selection.id, item => ({ ...item, x: item.x + move[0], y: item.y + move[1] })); }
      if (move && selection?.type === "shape") { event.preventDefault(); commit(c => withShapes(c, list => list.map(sh => sh.id === selection.id ? { ...sh, points: sh.points.map(p => [p[0] + move[0], p[1] + move[1]] as Pt) } : sh))); }
      if (move && selection?.type === "zone") { event.preventDefault(); commit(c => ({ ...c, zone: c.zone && { ...c.zone, x: c.zone.x + move[0], y: c.zone.y + move[1] } })); }
      if (move && selection?.type === "project") { event.preventDefault(); commit(c => ({ ...c, projects: c.projects.map(p => p.id === selection.id ? { ...p, x: p.x + move[0], y: p.y + move[1] } : p) })); }
    };
    const onSpace = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (event.code !== "Space" || typing) return;
      if (event.type === "keydown") event.preventDefault();
      spaceDown.current = event.type === "keydown"; frameRef.current?.classList.toggle("research-map-panning", spaceDown.current);
    };
    window.addEventListener("keydown", onKey); window.addEventListener("keydown", onSpace); window.addEventListener("keyup", onSpace);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keydown", onSpace); window.removeEventListener("keyup", onSpace); };
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---------- canvas dragging ----------
  const toMap = (event: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current; if (!svg) return [0, 0];
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const p = point.matrixTransform(svg.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };
  const startPan = (event: ReactPointerEvent, pick?: Selection) => {
    const v = viewRef.current || fitView();
    svgRef.current?.setPointerCapture(event.pointerId);
    drag.current = { kind: "pan", sx: event.clientX, sy: event.clientY, cx: v.cx, cy: v.cy, moved: false, pick };
  };
  // Large shapes and the core zone sit under everything: a click selects them, a drag still pans,
  // and once selected, dragging moves them.
  const onAreaDown = (event: ReactPointerEvent, pick: Selection, move: Drag) => {
    event.stopPropagation();
    const selected = selection?.type === pick?.type && selection?.id === pick?.id;
    if (selected && event.button === 0 && !spaceDown.current && pointers.current.size === 0) { begin(event, move, pick); return; }
    onBackgroundDown(event, pick);
  };
  const onBackgroundDown = (event: ReactPointerEvent, pick?: Selection) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: (viewRef.current || fitView()).scale }; drag.current = null; return;
    }
    startPan(event, pick);
  };

  const begin = (event: ReactPointerEvent, next: Drag, select: Selection) => {
    event.stopPropagation(); event.preventDefault();
    if (event.button === 1 || spaceDown.current) { startPan(event); return; }
    svgRef.current?.setPointerCapture(event.pointerId);
    drag.current = next; setSelection(select);
    setPast(list => [...list.slice(-99), map]); setFuture([]);
  };
  const reattach = (current: ResearchMap, strand: Strand) => ({
    ...current,
    items: current.items.map(item => {
      let next = item;
      if (item.feeds?.strand === strand.id) next = { ...next, feeds: { ...item.feeds, at: nearestOnPolyline(strand.points, item.feeds.at).point } };
      if (item.marker?.strand === strand.id && (item.marker.type === "start" || item.marker.type === "stop")) { const p = nearestOnPolyline(strand.points, [item.marker.x, item.marker.y]).point; next = { ...next, marker: { ...item.marker, x: p[0], y: p[1] } }; }
      return next;
    }),
  });
  const onMove = (event: ReactPointerEvent) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = clampScale(pinch.current.scale * d / Math.max(1, pinch.current.d)); const v = viewRef.current || fitView();
      zoomAt(target / v.scale, (a.x + b.x) / 2, (a.y + b.y) / 2); return;
    }
    const d = drag.current; if (!d) return;
    if (d.kind === "pan") {
      const dx = event.clientX - d.sx; const dy = event.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      const v = viewRef.current || fitView();
      setView({ ...v, cx: d.cx - dx / v.scale, cy: d.cy - dy / v.scale }); return;
    }
    const [x, y] = toMap(event); const free = snap ? event.altKey : !event.shiftKey;
    setDirty(true);
    setMap(current => {
      if (d.kind === "label") return { ...current, items: current.items.map(item => item.id === d.id ? { ...item, x: grid(x - d.dx, !free), y: grid(y - d.dy, !free) } : item) };
      if (d.kind === "project") return { ...current, projects: current.projects.map(p => p.id === d.id ? { ...p, x: grid(x - d.dx, !free), y: grid(y - d.dy, !free) } : p) };
      if (d.kind === "zone" && current.zone) return { ...current, zone: { ...current.zone, x: grid(x - d.dx, !free), y: grid(y - d.dy, !free) } };
      if (d.kind === "zone-move" && current.zone) { const [sx, sy] = toMap({ clientX: d.sx, clientY: d.sy }); return { ...current, zone: { ...current.zone, x: grid(d.ox + x - sx, !free), y: grid(d.oy + y - sy, !free) } }; }
      if (d.kind === "shape") {
        const [sx, sy] = toMap({ clientX: d.sx, clientY: d.sy }); const dx = grid(x - sx, !free); const dy = grid(y - sy, !free);
        return withShapes(current, list => list.map(sh => sh.id === d.id ? { ...sh, points: d.orig.map(p => [p[0] + dx, p[1] + dy] as Pt) } : sh));
      }
      if (d.kind === "shape-point") return withShapes(current, list => list.map(sh => sh.id === d.id ? { ...sh, points: sh.points.map((q, i) => i === d.index ? [grid(x, !free), grid(y, !free)] as Pt : q) } : sh));
      if (d.kind === "zone-size" && current.zone) return { ...current, zone: { ...current.zone, w: Math.max(80, grid(x - current.zone.x, !free)), h: Math.max(60, grid(y - current.zone.y, !free)) } };
      if (d.kind === "feed") return { ...current, items: current.items.map(item => {
        if (item.id !== d.id || !item.feeds) return item;
        const strand = current.strands.find(s => s.id === item.feeds!.strand);
        return { ...item, feeds: { ...item.feeds, at: strand ? nearestOnPolyline(strand.points, [x, y]).point : [grid(x, !free), grid(y, !free)] as Pt } };
      }) };
      if (d.kind === "marker") return { ...current, items: current.items.map(item => {
        if (item.id !== d.id || !item.marker) return item;
        const strand = current.strands.find(s => s.id === item.marker!.strand);
        const onLine = strand && (item.marker.type === "start" || item.marker.type === "stop");
        const p: Pt = onLine ? nearestOnPolyline(strand!.points, [x, y]).point : [grid(x, !free), grid(y, !free)];
        const shift = item.marker.y2 !== undefined ? p[1] - item.marker.y : 0;
        return { ...item, marker: { ...item.marker, x: p[0], y: p[1], ...(item.marker.y2 !== undefined ? { y2: item.marker.y2 + shift } : {}) } };
      }) };
      if (d.kind === "point") {
        const strands = current.strands.map(s => {
          if (s.id !== d.id) return s;
          const prev = s.points[d.index - 1]; const next = s.points[d.index + 1];
          const p: Pt = free ? [grid(x, false), grid(y, false)] : prev && next ? snapBetween(prev, next, [x, y]) : prev ? snapDirection(prev, [x, y]) : next ? snapDirection(next, [x, y]) : [grid(x, true), grid(y, true)];
          return { ...s, points: s.points.map((q, i) => i === d.index ? p : q) };
        });
        return reattach({ ...current, strands }, strands.find(s => s.id === d.id)!);
      }
      return current;
    });
  };
  const onUp = (event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current; drag.current = null;
    if (d?.kind === "pan" && !d.moved) setSelection(d.pick ?? null);
  };
  const addPointAt = (strand: Strand, event: React.MouseEvent) => {
    const p = toMap(event); let best = { i: 1, d: Infinity };
    for (let i = 1; i < strand.points.length; i++) { const d = nearestOnPolyline([strand.points[i - 1], strand.points[i]], p).distance; if (d < best.d) best = { i, d }; }
    const point = nearestOnPolyline(strand.points, p).point;
    commit(current => ({ ...current, strands: current.strands.map(s => s.id === strand.id ? { ...s, points: [...s.points.slice(0, best.i), point, ...s.points.slice(best.i)] } : s) }));
    setSelection({ type: "strand", id: strand.id, point: best.i });
  };

  // ---------- adding ----------
  const targetStrand = () => {
    if (selection?.type === "strand") return map.strands.find(s => s.id === selection.id);
    if (selection?.type === "item") { const item = map.items.find(i => i.id === selection.id); const sid = item?.feeds?.strand || item?.marker?.strand; return map.strands.find(s => s.id === sid); }
    return map.strands[0];
  };
  const midpoint = (strand: Strand): Pt => { const a = strand.points[Math.floor((strand.points.length - 1) / 2)]; const b = strand.points[Math.floor((strand.points.length - 1) / 2) + 1] || a; return [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]; };
  const focusName = () => setTimeout(() => { nameRef.current?.focus(); nameRef.current?.select(); }, 30);
  const addInfluence = () => {
    const strand = targetStrand(); const id = newId("i", map.items.map(i => i.id));
    const [mx, my] = strand ? midpoint(strand) : [1200, 300];
    const item: Item = { id, name: "New term", kind: "concept", main: false, x: mx - 180, y: my - 40, anchor: "start", ...(strand ? { feeds: { strand: strand.id, at: [mx, my] as Pt, route: "under" as const } } : {}) };
    commit(c => ({ ...c, items: [...c.items, item] })); setSelection({ type: "item", id }); setTab("content"); focusName();
  };
  const addStation = () => {
    const strand = targetStrand(); if (!strand) return;
    const id = newId("i", map.items.map(i => i.id)); const [mx, my] = midpoint(strand);
    const item: Item = { id, name: "New station", kind: "technique", main: true, x: mx + 18, y: my - 16, anchor: "start", marker: { type: "stop", x: mx, y: my, strand: strand.id } };
    commit(c => ({ ...c, items: [...c.items, item] })); setSelection({ type: "item", id }); setTab("content"); focusName();
  };
  const addStrand = () => {
    const sid = newId("s", map.strands.map(s => s.id)); const id = newId("i", map.items.map(i => i.id));
    const y = 1235;
    commit(c => ({ ...c, strands: [...c.strands, { id: sid, axis: "material", points: [[110, y], [700, y]] }], items: [...c.items, { id, name: "New strand", kind: "concept", main: true, x: 135, y: y - 12, anchor: "start", marker: { type: "start", x: 110, y, strand: sid } }] }));
    setSelection({ type: "item", id }); setTab("content"); focusName();
  };
  const addProject = () => {
    const id = newId("p", map.projects.map(p => p.id));
    const used = new Set(map.projects.map(p => p.code)); let n = 1; while (used.has(`P${n}`)) n++;
    const z = map.zone;
    commit(c => ({ ...c, projects: [...c.projects, { id, code: `P${n}`, name: "", x: z ? z.x + 40 : 1200, y: z ? z.y + z.h - 30 : 600 }] }));
    setSelection({ type: "project", id }); setTab("content");
  };

  const addShape = (key: keyof typeof shapeTemplates) => {
    const t = shapeTemplates[key]; const id = newId("shape", shapesOf(map).map(sh => sh.id));
    const v = viewRef.current || fitView(); const ox = Math.round(v.cx - 180); const oy = Math.round(v.cy - 120);
    const shape: Shape = { id, name: t.name, kind: t.kind, points: t.points.map(p => [p[0] + ox, p[1] + oy] as Pt), fill: "#F2A890", opacity: 0.35, hatch: "none", stroke: styleOf(map).ink, strokeWidth: 1.5, outline: "none", ...t.extra };
    commit(c => withShapes(c, list => [...list, shape])); setSelection({ type: "shape", id }); setTab("content");
  };
  const addAxisPlanes = () => commit(c => withShapes(c, list => { const taken = new Set(list.map(sh => sh.id)); return [...axisPlanes(c).map(sh => taken.has(sh.id) ? { ...sh, id: newId(`${sh.id}-`, [...taken]) } : sh), ...list]; }));

  // ---------- export ----------
  const exportSvg = () => download(`research-map-${today()}.svg`, new Blob([renderMapSvg(map)], { type: "image/svg+xml" }));
  const pngBlob = () => new Promise<Blob>((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(new Blob([renderMapSvg(map)], { type: "image/svg+xml" }));
    img.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = map.width * 2; canvas.height = map.height * 2;
      const ctx = canvas.getContext("2d")!; ctx.scale(2, 2); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The map image could not be made.")), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The map image could not be made.")); };
    img.src = url;
  });
  const exportPng = () => { pngBlob().then(blob => download(`research-map-${today()}.png`, blob)).catch(error => setMessage({ error: true, text: error.message })); };
  // Saves this version to the Library as an image, with its data kept so it can be reopened or restored.
  const saveToLibrary = async () => {
    const name = window.prompt("Name this version for the Library", snapshotName.trim() || `${map.title}, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
    if (!name?.trim()) return;
    setLibraryBusy(true); setMessage(null);
    try {
      const form = new FormData();
      form.set("name", name.trim()); form.set("map", JSON.stringify(map)); form.set("width", String(map.width * 2)); form.set("height", String(map.height * 2));
      form.set("image", new File([await pngBlob()], "research-map.png", { type: "image/png" }));
      const { snapshot } = await saveResearchMapToLibrary(form);
      setSnapshots(list => [snapshot, ...list]); setSnapshotName("");
      setMessage({ text: `Saved “${snapshot.name}” to the Library.`, href: `/library/items/media/${snapshot.mediaId}` });
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Could not save to the Library. Please retry." }); }
    finally { setLibraryBusy(false); }
  };
  const exportPdf = () => {
    const win = window.open("", "_blank"); if (!win) { setMessage({ error: true, text: "Allow pop-ups to print or save a PDF." }); return; }
    win.document.write(`<!doctype html><html><head><title>${map.title}</title><style>@page{size:17in 10.625in;margin:0}html,body{margin:0}svg{width:100vw;height:auto;display:block}</style></head><body>${renderMapSvg(map)}<script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
    win.document.close();
  };

  // ---------- snapshots ----------
  const takeSnapshot = async () => {
    try { const snap = await saveResearchMapSnapshot(snapshotName || `Snapshot ${today()}`, map); setSnapshots(list => [snap, ...list]); setSnapshotName(""); setMessage({ text: `Saved snapshot “${snap.name}”.` }); }
    catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Could not save the snapshot." }); }
  };
  const removeSnapshot = async (snap: Snapshot) => {
    if (!window.confirm(`Delete the snapshot “${snap.name}”? This can't be undone.${snap.mediaId ? " Its image stays in the Library." : ""}`)) return;
    try { await deleteResearchMapSnapshot(snap.id); setSnapshots(list => list.filter(s => s.id !== snap.id)); if (compare?.id === snap.id) setCompare(null); }
    catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Could not delete the snapshot." }); }
  };

  const selectIssue = (issue: Issue) => {
    if (issue.item) setSelection({ type: "item", id: issue.item });
    else if (issue.strand) setSelection({ type: "strand", id: issue.strand });
    else if (issue.project) setSelection({ type: "project", id: issue.project });
    else if (map.zone && /zone/.test(issue.message)) setSelection({ type: "zone", id: "zone" });
    if (issue.item || issue.strand || issue.project) setTab("content");
  };

  const selectedItem = selection?.type === "item" ? map.items.find(i => i.id === selection.id) : undefined;
  const selectedStrand = selection?.type === "strand" ? map.strands.find(s => s.id === selection.id) : undefined;
  const selectedProject = selection?.type === "project" ? map.projects.find(p => p.id === selection.id) : undefined;
  const shapes = shapesOf(map);
  const selectedShape = selection?.type === "shape" ? shapes.find(sh => sh.id === selection.id) : undefined;
  const style = styleOf(map);
  // Areas of the fixed text (title, columns, caption, legend) that can be clicked to edit.
  const textHits = useMemo(() => {
    const t = metrics; const sc = (r: TextRole) => rolePaint(map, r).scale;
    const line = (id: string, label: string, x: number, y: number, text: string, size: number, caps = false) => ({ id, label, x0: x, y0: y - size * 0.85, x1: x + textExtent(text, size, t, caps), y1: y + size * 0.25 });
    const LY = MAP_BOTTOM + 30;
    return [
      line("title", "Title", 60, 70, map.title, 30 * sc("title"), true),
      line("axesLine", "Categories", 60, 104, axisIds(map).map(a => map.axes[a].label).join("  ×  "), 19 * sc("axesLine")),
      ...(map.subtitle ? [line("subtitle", "Subtitle", 60, 132, map.subtitle, 14 * sc("subtitle"))] : []),
      ...map.columns.flatMap((col, i) => [line(`col:${i}:title`, "Column title", col.x0 + 20, 200, `00  ${col.title}`, 15 * sc("columnTitle"), true), ...(col.subtitle ? [line(`col:${i}:note`, "Column note", col.x0 + 20, 222, col.subtitle, 13 * sc("columnNote"))] : [])]),
      { id: "caption", label: "How to read this", x0: 60, y0: LY, x1: 720, y1: LY + 190 },
      { id: "legend", label: "Legend", x0: 750, y0: LY, x1: map.width - 60, y1: LY + 190 },
    ];
  }, [map, metrics]);
  const updateShape = (id: string, change: Partial<Shape>) => commit(c => withShapes(c, list => list.map(sh => sh.id === id ? { ...sh, ...change } : sh)));
  const issueIds = useMemo(() => new Set(issues.flatMap(i => [i.item, i.strand, i.project].filter(Boolean) as string[])), [issues]);

  // ---------- render ----------
  const handleR = 9;
  const z = map.zone;
  return <div className="research-map">
    <div className="research-map-toolbar">
      <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      <span className={dirty ? "research-map-status research-map-status-dirty" : "research-map-status"}>{dirty ? "Unsaved changes" : "All changes saved"}</span>
      <span className="research-map-divider" />
      <button type="button" className="button" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">Undo</button>
      <button type="button" className="button" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
      <span className="research-map-divider" />
      <button type="button" className="button" onClick={addInfluence} title="Add a term: an idea, person, technique or output. It feeds the selected strand.">+ Term</button>
      <button type="button" className="button" onClick={addStation}>+ Station</button>
      <button type="button" className="button" onClick={addStrand}>+ Strand</button>
      <button type="button" className="button" onClick={addProject}>+ Project</button>
      <select className="button research-map-add-shape" value="" aria-label="Add a shape" onChange={e => { if (e.target.value) addShape(e.target.value as keyof typeof shapeTemplates); }}>
        <option value="">+ Shape</option>{Object.entries(shapeTemplates).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
      </select>
      <label className="research-map-toggle"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap to 45° <span className="research-map-hint-inline">(or hold Shift)</span></label>
      <span className="research-map-spacer" />
      <button type="button" className={issues.length ? "button research-map-checks-button research-map-checks-open" : "button research-map-checks-button"} onClick={() => setTab("checks")}>{issues.length ? `${issues.length} to review${fixes ? ` · ${fixes} to fix` : ""}` : "All checks pass"}</button>
      <button type="button" className="button" onClick={() => void saveToLibrary()} disabled={libraryBusy} title="Save this version to the Library as an image, with its data kept so you can reopen it">{libraryBusy ? "Saving to Library…" : "Save to Library"}</button>
      <button type="button" className="button" onClick={exportSvg}>SVG</button>
      <button type="button" className="button" onClick={exportPng}>PNG</button>
      <button type="button" className="button" onClick={exportPdf}>Print / PDF</button>
    </div>
    {message && <p className={message.error ? "notice notice-error" : "research-map-message"} role={message.error ? "alert" : "status"}>{message.text}{message.href && <> <a href={message.href}>Open in the Library ↗</a></>}</p>}

    <div className="research-map-body">
      <div className="research-map-stage">
        {compare ? <div className="research-map-compare">
          <div className="research-map-compare-head"><strong>Comparing with “{compare.name}”</strong><span>{dateLabel(compare.createdAt)}</span><button type="button" className="button" onClick={() => setCompare(null)}>Close comparison</button></div>
          <div className="research-map-compare-grid">
            <figure><figcaption>{compare.name}</figcaption><div className="research-map-frame" dangerouslySetInnerHTML={{ __html: renderMapSvg(compare.map) }} /></figure>
            <figure><figcaption>Now</figcaption><div className="research-map-frame" dangerouslySetInnerHTML={{ __html: renderMapSvg(map) }} /></figure>
          </div>
          {(() => { const changes = diffMaps(compare.map, map); return changes.length ? <ul className="research-map-changes">{changes.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="research-map-hint">No changes since this snapshot.</p>; })()}
        </div> :
        <div className="research-map-frame research-map-canvas" ref={frameRef}>
          <svg ref={svgRef} viewBox={viewBox} width={frame.w} height={frame.h} fontFamily="'Helvetica Neue', Helvetica, Inter, Arial, sans-serif" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={onBackgroundDown} role="img" aria-label={`${map.title}, editable research map`}>
            <rect x={-20000} y={-20000} width={40000} height={40000} fill="#dcdcd8" />
            <g dangerouslySetInnerHTML={{ __html: inner }} />
            <g className="research-map-hits">
              {z && <rect x={z.x} y={z.y} width={z.w} height={z.h} className={selection?.type === "zone" ? "research-map-area-hit research-map-area-selected" : "research-map-area-hit"}
                onPointerDown={e => onAreaDown(e, { type: "zone", id: "zone" }, { kind: "zone-move", sx: e.clientX, sy: e.clientY, ox: z.x, oy: z.y })}><title>Core zone: click to select, then drag to move</title></rect>}
              {shapes.filter(sh => !sh.hidden).map(sh => { const b = shapeBounds(sh); const cls = selection?.type === "shape" && selection.id === sh.id ? "research-map-area-hit research-map-area-selected" : "research-map-area-hit";
                const down = (e: ReactPointerEvent) => onAreaDown(e, { type: "shape", id: sh.id }, { kind: "shape", id: sh.id, sx: e.clientX, sy: e.clientY, orig: sh.points });
                if (sh.kind === "line") return <path key={sh.id} d={`M${sh.points.map(p => p.join(",")).join(" L")}`} className={`${cls} research-map-line-hit`} strokeWidth={14 * hs} onPointerDown={down}><title>{sh.name || "Line"}</title></path>;
                if (sh.kind === "text") return <rect key={sh.id} x={b.x0} y={b.y0} width={Math.max(20, textExtent(sh.text || "", b.y1 - b.y0, defaultMetricsLike, false) * 1.15)} height={b.y1 - b.y0} className={cls} strokeWidth={1.5 * hs} onPointerDown={down}><title>{sh.name || "Text"}</title></rect>;
                return sh.kind === "ellipse"
                  ? <ellipse key={sh.id} cx={(b.x0 + b.x1) / 2} cy={(b.y0 + b.y1) / 2} rx={(b.x1 - b.x0) / 2} ry={(b.y1 - b.y0) / 2} className={cls} strokeWidth={1.5 * hs} onPointerDown={down}><title>{sh.name || "Shape"}</title></ellipse>
                  : <polygon key={sh.id} points={sh.points.map(p => p.join(",")).join(" ")} className={cls} strokeWidth={1.5 * hs} onPointerDown={down}><title>{sh.name || "Shape"}</title></polygon>; })}
              {map.strands.map(strand => <path key={strand.id} d={`M${strand.points.map(p => p.join(",")).join(" L")}`} className={selection?.type === "strand" && selection.id === strand.id ? "research-map-strand-hit research-map-selected-strand" : "research-map-strand-hit"} strokeWidth={18 * hs}
                onPointerDown={e => { e.stopPropagation(); setSelection({ type: "strand", id: strand.id }); }} onDoubleClick={e => addPointAt(strand, e)}><title>{`${strandName(map, strand)}: double-click to add a bend`}</title></path>)}
              {map.items.filter(item => item.name.trim()).map(item => { const box = labelBox(item, metrics); return <rect key={item.id} x={box.x0 - 3} y={box.y0 - 3} width={box.x1 - box.x0 + 6} height={box.y1 - box.y0 + 6} rx={3}
                className={selection?.type === "item" && selection.id === item.id ? "research-map-label-hit research-map-selected" : issueIds.has(item.id) && tab === "checks" ? "research-map-label-hit research-map-flagged" : "research-map-label-hit"}
                onPointerDown={e => { const [x, y] = toMap(e); begin(e, { kind: "label", id: item.id, dx: x - item.x, dy: y - item.y }, { type: "item", id: item.id }); }}><title>{oneLine(item.name)}</title></rect>; })}
              {textHits.map(h => <rect key={h.id} x={h.x0 - 4} y={h.y0 - 4} width={h.x1 - h.x0 + 8} height={h.y1 - h.y0 + 8} rx={3} className={selection?.type === "text" && selection.id === h.id ? "research-map-text-hit research-map-selected" : "research-map-text-hit"}
                onPointerDown={e => { e.stopPropagation(); setSelection({ type: "text", id: h.id }); setTab("content"); }}><title>{`${h.label}: click to edit`}</title></rect>)}
              {map.items.filter(item => item.marker && item.marker.type !== "none").map(item => { const b = markerBox(item.marker!, style); return <rect key={`m-${item.id}`} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={b.r}
                className={selection?.type === "item" && selection.id === item.id ? "research-map-marker-hit research-map-selected" : "research-map-marker-hit"}
                onPointerDown={e => begin(e, { kind: "marker", id: item.id }, { type: "item", id: item.id })}><title>{`${markerLabels[item.marker!.type]}: ${oneLine(item.name)}`}</title></rect>; })}
              {map.projects.map(p => <circle key={p.id} cx={p.x} cy={p.y} r={19} className={selection?.type === "project" && selection.id === p.id ? "research-map-project-hit research-map-selected" : "research-map-project-hit"}
                onPointerDown={e => { const [x, y] = toMap(e); begin(e, { kind: "project", id: p.id, dx: x - p.x, dy: y - p.y }, { type: "project", id: p.id }); }}><title>{`${p.code}${p.name ? `: ${p.name}` : " (placeholder)"}`}</title></circle>)}
              {z && <rect x={z.x + z.w - 220} y={z.y + 6} width={210} height={28} className={selection?.type === "zone" ? "research-map-label-hit research-map-selected" : "research-map-label-hit"}
                onPointerDown={e => { const [x, y] = toMap(e); begin(e, { kind: "zone", dx: x - z.x, dy: y - z.y }, { type: "zone", id: "zone" }); }}><title>Core zone: drag to move</title></rect>}
            </g>
            <g className="research-map-handles">
              {selectedStrand && selectedStrand.points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={handleR * hs} className={selection?.point === i ? "research-map-handle research-map-handle-active" : "research-map-handle"}
                onPointerDown={e => begin(e, { kind: "point", id: selectedStrand.id, index: i }, { type: "strand", id: selectedStrand.id, point: i })}><title>Drag this bend. Hold Alt to place it freely.</title></circle>)}
              {selectedItem?.marker && selectedItem.marker.type !== "none" && <circle cx={selectedItem.marker.x} cy={selectedItem.marker.y} r={(handleR + 3) * hs} className="research-map-handle research-map-handle-marker"
                onPointerDown={e => begin(e, { kind: "marker", id: selectedItem.id }, { type: "item", id: selectedItem.id })}><title>Drag the station</title></circle>}
              {selectedItem?.feeds && <circle cx={selectedItem.feeds.at[0]} cy={selectedItem.feeds.at[1]} r={(handleR - 2) * hs} className="research-map-handle research-map-handle-feed"
                onPointerDown={e => begin(e, { kind: "feed", id: selectedItem.id }, { type: "item", id: selectedItem.id })}><title>Drag where this joins its strand</title></circle>}
              {selectedShape && selectedShape.points.map((p, i) => <rect key={i} x={p[0] - 7 * hs} y={p[1] - 7 * hs} width={14 * hs} height={14 * hs} className={selection?.point === i ? "research-map-handle research-map-handle-active" : "research-map-handle"}
                onPointerDown={e => begin(e, { kind: "shape-point", id: selectedShape.id, index: i }, { type: "shape", id: selectedShape.id, point: i })}><title>{selectedShape.kind === "ellipse" ? "Drag to resize" : "Drag this corner"}</title></rect>)}
              {z && selection?.type === "zone" && <rect x={z.x + z.w - 9 * hs} y={z.y + z.h - 9 * hs} width={18 * hs} height={18 * hs} className="research-map-handle"
                onPointerDown={e => begin(e, { kind: "zone-size" }, { type: "zone", id: "zone" })}><title>Drag to resize the zone</title></rect>}
            </g>
          </svg>
          <div className="research-map-zoom" onPointerDown={e => e.stopPropagation()}>
            <button type="button" onClick={() => zoomAt(0.8)} aria-label="Zoom out" title="Zoom out (−)">−</button>
            <button type="button" className="research-map-zoom-level" onClick={() => setView(v => ({ ...(v || fitView()), scale: 1 }))} title="Actual size (1)">{Math.round(current.scale * 100)}%</button>
            <button type="button" onClick={() => zoomAt(1.25)} aria-label="Zoom in" title="Zoom in (+)">+</button>
            <button type="button" onClick={() => setView(fitView())} title="Fit the whole map (0)">Fit</button>
          </div>
        </div>}
        <p className="research-map-hint">Zoom with pinch or Ctrl/⌘ + scroll; scroll or drag the background to pan (hold Space to pan from anywhere). Keys: + and − zoom, 0 fits, 1 is actual size. Click a station, shape or the core zone to select it, then drag to move it; drag the square handles to reshape. Drag labels and project circles. Select a strand to drag its bends; double-click a strand to add a bend. Bends and line ends move freely; hold Shift, or turn on Snap, to keep 0°, 45° and 90°. Click any text to edit it. Arrow keys nudge, Delete removes, Ctrl+Z undoes.</p>
      </div>

      <aside className="research-map-panel">
        <div className="research-map-tabs" role="tablist">
          {(["content", "checks", "map", "layers", "style", "history"] as Tab[]).map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "research-map-tab research-map-tab-active" : "research-map-tab"} onClick={() => setTab(t)}>
            {{ content: "Content", checks: `Checks${issues.length ? ` (${issues.length})` : ""}`, map: "Map", layers: "Layers", style: "Style", history: "History" }[t]}</button>)}
        </div>

        {tab === "content" && <div className="research-map-pane">
          {selectedItem && <ItemForm key={selectedItem.id} item={selectedItem} map={map} nameRef={nameRef} onChange={change => updateItem(selectedItem.id, change)} onDelete={removeSelection} onClose={() => setSelection(null)} issues={issues.filter(i => i.item === selectedItem.id)} />}
          {selectedItem?.marker && selectedItem.marker.type !== "none" && <MarkerPaintForm item={selectedItem} map={map} onChange={paint => updateItem(selectedItem.id, current => { const marker = { ...current.marker! }; if (paint) marker.paint = paint; else delete marker.paint; return { ...current, marker }; })} />}
          {selection?.type === "text" && <TextForm key={selection.id} id={selection.id} map={map} commit={commit} onClose={() => setSelection(null)} />}
          {selectedShape && <ShapeForm key={selectedShape.id} shape={selectedShape} onChange={change => updateShape(selectedShape.id, change)} onClose={() => setSelection(null)}
            onDuplicate={() => { const id = newId("shape", shapes.map(sh => sh.id)); commit(c => withShapes(c, list => [...list, { ...selectedShape, id, name: `${selectedShape.name} copy`, points: selectedShape.points.map(p => [p[0] + 30, p[1] + 30] as Pt) }])); setSelection({ type: "shape", id }); }}
            onDelete={() => { commit(c => withShapes(c, list => list.filter(sh => sh.id !== selectedShape.id))); setSelection(null); }}
            onRemovePoint={selection?.point !== undefined && ((selectedShape.kind === "polygon" && selectedShape.points.length > 3) || (selectedShape.kind === "line" && selectedShape.points.length > 2)) ? removeSelection : undefined}
            onAddPoint={selectedShape.kind === "polygon" || selectedShape.kind === "line" ? () => updateShape(selectedShape.id, { points: (() => { const pts = selectedShape.points; const i = Math.min(selection?.point ?? pts.length - 2, selectedShape.kind === "line" ? pts.length - 2 : pts.length - 1); const a = pts[i]; const b = pts[(i + 1) % pts.length]; const mid: Pt = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]; return [...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)]; })() }) : undefined} />}
          {selectedStrand && <div className="research-map-form">
            <div className="research-map-form-head"><span className="research-map-swatch" style={{ background: map.axes[selectedStrand.axis].color }} /><strong>{strandName(map, selectedStrand)}</strong><button type="button" className="text-button" onClick={() => setSelection(null)}>Done</button></div>
            <label>Category<select value={selectedStrand.axis} onChange={e => commit(c => ({ ...c, strands: c.strands.map(s => s.id === selectedStrand.id ? { ...s, axis: e.target.value as Strand["axis"] } : s) }))}>{axisIds(map).map(a => <option key={a} value={a}>{map.axes[a].label}</option>)}</select></label>
            <label className="research-map-color">Line color<span className="research-map-row"><input type="color" value={strandInk(map, selectedStrand)} onChange={e => commit(c => ({ ...c, strands: c.strands.map(s => s.id === selectedStrand.id ? { ...s, color: e.target.value } : s) }))} />{selectedStrand.color && <button type="button" className="text-button" onClick={() => commit(c => ({ ...c, strands: c.strands.map(s => { if (s.id !== selectedStrand.id) return s; const next = { ...s }; delete next.color; return next; }) }))}>Use the category color</button>}</span></label>
            <p className="research-map-hint">{selectedStrand.points.length} points. Drag the round handles anywhere to re-route it (hold Shift to keep 45° angles), and double-click the line to add a bend. Terms and stations on it follow along.</p>
            {selection?.point !== undefined && <button type="button" className="button" onClick={removeSelection} disabled={selectedStrand.points.length <= 2}>Remove selected bend</button>}
            {issues.filter(i => i.strand === selectedStrand.id).map((i, n) => <p key={n} className="research-map-issue">{i.message}</p>)}
            <button type="button" className="text-button research-map-danger" onClick={() => { setSelection({ type: "strand", id: selectedStrand.id }); if (window.confirm("Delete this strand? Its influences and stations stay on the map, unattached.")) { commit(c => ({ ...c, strands: c.strands.filter(s => s.id !== selectedStrand.id) })); setSelection(null); } }}>Delete strand</button>
          </div>}
          {selectedProject && <div className="research-map-form">
            <div className="research-map-form-head"><strong>Project station {selectedProject.code}</strong><button type="button" className="text-button" onClick={() => setSelection(null)}>Done</button></div>
            <label>Code<input value={selectedProject.code} maxLength={6} onChange={e => commit(c => ({ ...c, projects: c.projects.map(p => p.id === selectedProject.id ? { ...p, code: e.target.value } : p) }))} /></label>
            <label>Project<input list="research-map-projects" value={selectedProject.name} spellCheck placeholder="Name the project, or pick one of yours" onChange={e => { const name = e.target.value; const match = projects.find(p => p.title === name); commit(c => ({ ...c, projects: c.projects.map(p => p.id === selectedProject.id ? { ...p, name, projectId: match?.id } : p) })); }} /></label>
            <datalist id="research-map-projects">{projects.map(p => <option key={p.id} value={p.title} />)}</datalist>
            {selectedProject.projectId && <a className="text-button" href={`/projects/${selectedProject.projectId}`}>Open project ↗</a>}
            <label className="research-map-color">Circle color<span className="research-map-row"><input type="color" value={selectedProject.color || (selectedProject.name.trim() ? "#F6D78B" : "#ffffff")} onChange={e => commit(c => ({ ...c, projects: c.projects.map(p => p.id === selectedProject.id ? { ...p, color: e.target.value } : p) }))} />{selectedProject.color && <button type="button" className="text-button" onClick={() => commit(c => ({ ...c, projects: c.projects.map(p => { if (p.id !== selectedProject.id) return p; const next = { ...p }; delete next.color; return next; }) }))}>Default</button>}</span></label>
            <label>Note<textarea rows={3} value={selectedProject.note || ""} spellCheck placeholder="Why it sits here" onChange={e => commit(c => ({ ...c, projects: c.projects.map(p => p.id === selectedProject.id ? { ...p, note: e.target.value } : p) }))} /></label>
            <button type="button" className="text-button research-map-danger" onClick={removeSelection}>Delete project station</button>
          </div>}
          {selection?.type === "zone" && z && <div className="research-map-form">
            <div className="research-map-form-head"><strong>Core zone</strong><button type="button" className="text-button" onClick={() => setSelection(null)}>Done</button></div>
            <p className="research-map-hint">Drag it to move it (arrow keys nudge), and drag the square handle at its corner to resize it.</p>
            <label>Title<input value={z.title} onChange={e => commit(c => ({ ...c, zone: c.zone && { ...c.zone, title: e.target.value } }))} /></label>
            <TextPaintFields label="Title" paint={map.text?.zoneTitle || {}} fallback={rolePaint(map, "zoneTitle").color} onChange={paint => commit(c => setRole(c, "zoneTitle", paint))} />
            <AppearanceFields fill={style.zoneFill} opacity={style.zoneOpacity} hatch={style.zoneHatch} outline={style.zoneOutline}
              onChange={change => commit(c => ({ ...c, style: { ...styleOf(c), ...(change.fill !== undefined ? { zoneFill: change.fill } : {}), ...(change.opacity !== undefined ? { zoneOpacity: change.opacity } : {}), ...(change.hatch ? { zoneHatch: change.hatch } : {}), ...(change.outline ? { zoneOutline: change.outline } : {}) } }))} />
            <button type="button" className="text-button research-map-danger" onClick={removeSelection}>Delete the core zone</button>
          </div>}

          {!selection && <>
            <input type="search" placeholder="Find on the map" value={filter} onChange={e => setFilter(e.target.value)} />
            <ContentList map={map} filter={filter} issueIds={issueIds} onSelect={setSelection} />
          </>}
        </div>}

        {tab === "checks" && <div className="research-map-pane">
          {!issues.length && <p className="research-map-pass">Everything checks out: every item is connected, names are unique, labels are clear of lines and each other, and strands read left to right.</p>}
          {(["fix", "check"] as const).map(level => { const list = issues.filter(i => i.level === level); return list.length ? <section key={level} className="research-map-check-group">
            <h3>{level === "fix" ? "Fix" : "Worth a look"} <span>{list.length}</span></h3>
            <ul>{list.map((issue, i) => <li key={i}><button type="button" onClick={() => selectIssue(issue)}>{issue.message}</button></li>)}</ul>
          </section> : null; })}
          <p className="research-map-hint">Checks run on every edit. Name spelling uses your browser&apos;s spell checker as you type, plus a list of misspellings seen on this map before.</p>
        </div>}

        {tab === "map" && <div className="research-map-pane research-map-form">
          <label>Title<input value={map.title} spellCheck onChange={e => commit(c => ({ ...c, title: e.target.value }))} /></label>
          <label>Subtitle<input value={map.subtitle} spellCheck onChange={e => commit(c => ({ ...c, subtitle: e.target.value }))} /></label>
          <label>How to read this<textarea rows={7} value={map.caption} spellCheck onChange={e => commit(c => ({ ...c, caption: e.target.value }))} /></label>
          <h3>Categories</h3>
          <p className="research-map-hint">Each strand belongs to a category, which sets its color and its place in the legend.</p>
          {axisIds(map).map(a => { const count = map.strands.filter(s => s.axis === a).length; return <div key={a} className="research-map-row research-map-category"><input type="color" value={map.axes[a].color} aria-label={`${map.axes[a].label} color`} onChange={e => commit(c => ({ ...c, axes: { ...c.axes, [a]: { ...c.axes[a], color: e.target.value } } }))} /><input value={map.axes[a].label} aria-label="Category name" onChange={e => commit(c => ({ ...c, axes: { ...c.axes, [a]: { ...c.axes[a], label: e.target.value } } }))} />
            <span className="research-map-count" title="Strands in this category">{count}</span>
            <button type="button" className="text-button research-map-danger" disabled={axisIds(map).length < 2} title="Remove this category" onClick={() => { const rest = axisIds(map).filter(k => k !== a); if (count && !window.confirm(`Remove “${map.axes[a].label}”? Its ${count} strand${count === 1 ? "" : "s"} move to “${map.axes[rest[0]].label}”.`)) return; commit(c => { const axesNext = { ...c.axes }; delete axesNext[a]; return { ...c, axes: axesNext, strands: c.strands.map(s => s.axis === a ? { ...s, axis: rest[0] } : s) }; }); }}>✕</button></div>; })}
          <button type="button" className="button" onClick={() => { const key = newId("category", axisIds(map)); const palette = ["#3E8E5A", "#D9A633", "#0F7C8C", "#B3446C", "#6B6B6B", "#7A5C3E"]; commit(c => ({ ...c, axes: { ...c.axes, [key]: { label: "New category", color: palette[axisIds(c).length % palette.length] } } })); }}>+ Add a category</button>
          <h3>Text</h3>
          <p className="research-map-hint">Color and size for each kind of text. Click any text on the map to edit it there too.</p>
          {textRoles.map(role => <TextRoleRow key={role} map={map} role={role} commit={commit} />)}
          <h3>Legend wording</h3>
          {(Object.keys(legendWords) as LegendWord[]).map(key => <label key={key}>{legendWords[key]}<input value={map.words?.[key] ?? legendWords[key]} onChange={e => commit(c => ({ ...c, words: { ...c.words, [key]: e.target.value } }))} /></label>)}
          <h3>Columns</h3>
          {map.columns.map((col, i) => <div key={i} className="research-map-column">
            <input value={col.title} aria-label="Column title" onChange={e => commit(c => ({ ...c, columns: c.columns.map((x, n) => n === i ? { ...x, title: e.target.value } : x) }))} />
            <input value={col.subtitle} aria-label="Column subtitle" onChange={e => commit(c => ({ ...c, columns: c.columns.map((x, n) => n === i ? { ...x, subtitle: e.target.value } : x) }))} />
            <div className="research-map-row"><label>From<input type="number" value={col.x0} onChange={e => commit(c => ({ ...c, columns: c.columns.map((x, n) => n === i ? { ...x, x0: Number(e.target.value) } : x) }))} /></label><label>To<input type="number" value={col.x1} onChange={e => commit(c => ({ ...c, columns: c.columns.map((x, n) => n === i ? { ...x, x1: Number(e.target.value) } : x) }))} /></label></div>
          </div>)}
          <h3>Core zone</h3>
          {map.zone ? <>
            <label>Title<input value={map.zone.title} onChange={e => commit(c => ({ ...c, zone: c.zone && { ...c.zone, title: e.target.value } }))} /></label>
            <button type="button" className="text-button research-map-danger" onClick={() => commit(c => ({ ...c, zone: null }))}>Remove the core zone</button>
          </> : <button type="button" className="button" onClick={() => commit(c => ({ ...c, zone: { x: 1050, y: 555, w: 615, h: 190, title: "Core contribution" } }))}>Add a core zone</button>}
          <h3>Start over</h3>
          <button type="button" className="text-button research-map-danger" onClick={() => { if (window.confirm("Replace this map with the November 2026 redraw? You can undo this until you leave the page.")) commit(structuredClone(seedMap)); }}>Reset to the November 2026 redraw</button>
        </div>}

        {tab === "layers" && <div className="research-map-pane research-map-form research-map-layers">
          <h3>Shapes</h3>
          <p className="research-map-hint">Listed top to bottom in drawing order. Shapes “over lines” are drawn above the strands.</p>
          {shapes.length ? <ul>{[...shapes].reverse().map(sh => { const i = shapes.indexOf(sh); return <li key={sh.id} className={selectedShape?.id === sh.id ? "research-map-layer research-map-layer-active" : "research-map-layer"}>
            <button type="button" className="research-map-eye" aria-label={sh.hidden ? "Show" : "Hide"} title={sh.hidden ? "Show" : "Hide"} onClick={() => updateShape(sh.id, { hidden: !sh.hidden })}>{sh.hidden ? "○" : "●"}</button>
            <span className="research-map-swatch" style={{ background: sh.fill, opacity: sh.hidden ? 0.3 : 1 }} />
            <button type="button" className="research-map-layer-name" onClick={() => { setSelection({ type: "shape", id: sh.id }); setTab("content"); }}>{sh.name || "Untitled"}{sh.front ? " · over lines" : ""}</button>
            <button type="button" aria-label="Move up" title="Move up" disabled={i === shapes.length - 1} onClick={() => commit(c => withShapes(c, list => { const next = [...list]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next; }))}>↑</button>
            <button type="button" aria-label="Move down" title="Move down" disabled={i === 0} onClick={() => commit(c => withShapes(c, list => { const next = [...list]; [next[i], next[i - 1]] = [next[i - 1], next[i]]; return next; }))}>↓</button>
            <button type="button" className="research-map-danger" aria-label="Delete" title="Delete" onClick={() => { commit(c => withShapes(c, list => list.filter(x => x.id !== sh.id))); if (selectedShape?.id === sh.id) setSelection(null); }}>✕</button>
          </li>; })}</ul> : <p className="research-map-hint">No shapes yet.</p>}
          <div className="research-map-row research-map-wrap">{Object.entries(shapeTemplates).map(([k, t]) => <button key={k} type="button" className="button" onClick={() => addShape(k as keyof typeof shapeTemplates)}>+ {t.name}</button>)}<button type="button" className="button" onClick={addAxisPlanes}>+ Axis planes</button></div>
          <h3>Drawing layers</h3>
          <label className="research-map-check"><input type="checkbox" checked={!!map.zone} onChange={e => commit(c => ({ ...c, zone: e.target.checked ? { x: 1050, y: 555, w: 615, h: 190, title: "Core contribution" } : null }))} />Core zone</label>
          <label className="research-map-check"><input type="checkbox" checked={style.scale} onChange={e => commit(c => ({ ...c, style: { ...styleOf(c), scale: e.target.checked } }))} />Section scale and registration crosses at the column divisions</label>
          <label className="research-map-check"><input type="checkbox" checked={style.construction} onChange={e => commit(c => ({ ...c, style: { ...styleOf(c), construction: e.target.checked } }))} />Construction hairlines at strand ends and bends</label>
          <label className="research-map-check"><input type="checkbox" checked={style.bands > 0} onChange={e => commit(c => ({ ...c, style: { ...styleOf(c), bands: e.target.checked ? 0.025 : 0 } }))} />Column shading</label>
          <label className="research-map-check"><input type="checkbox" checked={style.ground !== "plain"} onChange={e => commit(c => ({ ...c, style: { ...styleOf(c), ground: e.target.checked ? "ledger" : "plain" } }))} />Ruled ground (ledger lines or grid)</label>
          <p className="research-map-hint">Click a shape, station or the core zone on the canvas to select it. Delete removes the selection.</p>
        </div>}

        {tab === "style" && <StylePane map={map} commit={commit} />}

        {tab === "history" && <div className="research-map-pane">
          <section className="research-map-form">
            <h3>Saved versions</h3>
            <p className="research-map-hint">Freeze the map at a milestone, such as a review, and compare later versions with it. “Save to Library” also puts an image of it in your Library, where it can go on boards and in projects.</p>
            <div className="research-map-row"><input value={snapshotName} placeholder="e.g. Third-year review" onChange={e => setSnapshotName(e.target.value)} /><button type="button" className="button" onClick={() => void takeSnapshot()}>Save snapshot</button></div>
            <button type="button" className="button" onClick={() => void saveToLibrary()} disabled={libraryBusy}>{libraryBusy ? "Saving to Library…" : "Save to Library"}</button>
            {snapshots.length ? <ul className="research-map-snapshots">{snapshots.map(s => <li key={s.id}><div><strong>{s.name}</strong><span>{dateLabel(s.createdAt)}{s.mediaId && <> · <a href={`/library/items/media/${s.mediaId}`}>In Library ↗</a></>}</span></div>
              <button type="button" className="text-button" onClick={() => setCompare(s)}>Compare</button>
              <button type="button" className="text-button" onClick={() => { if (window.confirm(`Replace the current map with “${s.name}”? You can undo this.`)) commit(structuredClone(s.map)); }}>Restore</button>
              <button type="button" className="text-button research-map-danger" onClick={() => void removeSnapshot(s)}>Delete</button></li>)}</ul> : <p className="research-map-hint">No snapshots yet.</p>}
          </section>
          <section className="research-map-form">
            <h3>Change log</h3>
            {log.length ? <ol className="research-map-log">{log.map((entry, i) => <li key={i}><span>{dateLabel(entry.at)}</span><ul>{entry.changes.map((c, n) => <li key={n}>{c}</li>)}</ul></li>)}</ol> : <p className="research-map-hint">Each save is listed here with what changed.</p>}
          </section>
        </div>}
      </aside>
    </div>
  </div>;
}

function ItemForm({ item, map, nameRef, onChange, onDelete, onClose, issues }: { item: Item; map: ResearchMap; nameRef: React.RefObject<HTMLTextAreaElement | null>; onChange: (change: Partial<Item> | ((item: Item) => Item)) => void; onDelete: () => void; onClose: () => void; issues: Issue[] }) {
  const markerType = item.marker?.type || "none";
  const setMarker = (type: MarkerType) => onChange(current => {
    if (type === "none") { const next = { ...current }; delete next.marker; return next; }
    const strand = map.strands.find(s => s.id === current.marker?.strand) || map.strands.find(s => s.id === current.feeds?.strand) || map.strands[0];
    const at: Pt = current.marker ? [current.marker.x, current.marker.y] : strand ? nearestOnPolyline(strand.points, [current.x, current.y + 15]).point : [current.x, current.y + 15];
    return { ...current, marker: { type, x: at[0], y: at[1], ...(strand && type !== "interchange" ? { strand: strand.id } : {}), ...(current.marker?.y2 !== undefined && (type === "interchange" || type === "outcome") ? { y2: current.marker.y2 } : {}) } };
  });
  return <div className="research-map-form">
    <div className="research-map-form-head"><strong>{oneLine(item.name)}</strong><button type="button" className="text-button" onClick={onClose}>Done</button></div>
    <label>Name<textarea ref={nameRef} rows={labelLines(item.name).length > 1 ? 2 : 1} value={item.name} spellCheck onChange={e => onChange({ name: e.target.value })} /></label>
    <div className="research-map-row">
      <label>Kind<select value={item.kind} onChange={e => onChange({ kind: e.target.value as Item["kind"] })}>{kinds.map(k => <option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
      <label>Align<select value={item.anchor} onChange={e => onChange({ anchor: e.target.value as Item["anchor"] })}><option value="start">Left</option><option value="middle">Centre</option><option value="end">Right</option></select></label>
    </div>
    <label className="research-map-toggle"><input type="checkbox" checked={item.main} onChange={e => onChange({ main: e.target.checked })} /> Large label (strand, station or outcome)</label>
    <label>Feeds strand<select value={item.feeds?.strand || ""} onChange={e => onChange(current => {
      const strand = map.strands.find(s => s.id === e.target.value);
      if (!strand) { const next = { ...current }; delete next.feeds; return next; }
      return { ...current, from: undefined, feeds: { strand: strand.id, at: nearestOnPolyline(strand.points, current.feeds?.at || [current.x + 150, current.y + 30]).point, route: current.feeds?.route || "under" } };
    })}><option value="">Doesn&apos;t feed a strand</option>{map.strands.map(s => <option key={s.id} value={s.id}>{strandName(map, s)}</option>)}</select></label>
    {item.feeds && <label>Connector<select value={item.feeds.route} onChange={e => onChange(current => ({ ...current, feeds: { ...current.feeds!, route: e.target.value as NonNullable<Item["feeds"]>["route"] } }))}>{routes.map(r => <option key={r} value={r}>{routeLabels[r]}</option>)}</select></label>}
    {!item.feeds && <label>Branches from<select value={item.from || ""} onChange={e => onChange({ from: e.target.value || undefined })}><option value="">Nothing</option>{map.items.filter(other => other.id !== item.id && other.main).map(other => <option key={other.id} value={other.id}>{oneLine(other.name)}</option>)}</select></label>}
    <label>Station<select value={markerType} onChange={e => setMarker(e.target.value as MarkerType)}>{markers.map(m => <option key={m} value={m}>{markerLabels[m]}</option>)}</select></label>
    {item.marker && item.marker.type !== "none" && <>
      {item.marker.type !== "interchange" && <label>On strand<select value={item.marker.strand || ""} onChange={e => onChange(current => ({ ...current, marker: { ...current.marker!, strand: e.target.value || undefined } }))}><option value="">Black (several strands)</option>{map.strands.map(s => <option key={s.id} value={s.id}>{strandName(map, s)}</option>)}</select></label>}
      {(item.marker.type === "interchange" || item.marker.type === "outcome") && <label>Height (to span parallel strands)<input type="number" min={0} step={1} value={item.marker.y2 !== undefined ? Math.round(item.marker.y2 - item.marker.y) : 0} onChange={e => { const h = Number(e.target.value); onChange(current => { const m = { ...current.marker! }; if (h > 0) m.y2 = m.y + h; else delete m.y2; return { ...current, marker: m }; }); }} /></label>}
    </>}
    <h3>Label appearance</h3>
    <TextPaintFields paint={item.paint || {}} fallback={item.paint?.color || map.text?.[item.kind]?.color || (item.kind === "person" ? "#6b6b6b" : item.main ? styleOf(map).ink : "#3a3a3a")} onChange={paint => onChange(current => { const next = { ...current }; if (paint) next.paint = paint; else delete next.paint; return next; })} />
    {issues.map((i, n) => <p key={n} className="research-map-issue">{i.message}</p>)}
    <button type="button" className="text-button research-map-danger" onClick={onDelete}>Delete “{oneLine(item.name)}”</button>
  </div>;
}

function ContentList({ map, filter, issueIds, onSelect }: { map: ResearchMap; filter: string; issueIds: Set<string>; onSelect: (s: Selection) => void }) {
  const q = filter.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);
  const strandOf = (item: Item) => map.strands.find(s => s.id === (item.feeds?.strand || item.marker?.strand));
  const dot = (id: string) => issueIds.has(id) ? <span className="research-map-dot" title="Has something to review" /> : null;
  const groups = [
    { title: "Stations", items: map.items.filter(i => i.marker && i.marker.type !== "none") },
    { title: "Influences", items: map.items.filter(i => i.feeds && !(i.marker && i.marker.type !== "none")) },
    { title: "Outputs", items: map.items.filter(i => i.from && !i.feeds) },
    { title: "Unconnected", items: map.items.filter(i => !i.feeds && !i.from && !(i.marker && i.marker.type !== "none")) },
  ];
  return <div className="research-map-list">
    <section><h3>Strands <span>{map.strands.length}</span></h3><ul>{map.strands.filter(s => match(strandName(map, s))).map(s => <li key={s.id}><button type="button" onClick={() => onSelect({ type: "strand", id: s.id })}><span className="research-map-swatch" style={{ background: map.axes[s.axis].color }} />{strandName(map, s)}{dot(s.id)}</button></li>)}</ul></section>
    {groups.map(group => { const items = group.items.filter(i => match(i.name)); return items.length ? <section key={group.title}><h3>{group.title} <span>{items.length}</span></h3><ul>{items.map(item => { const strand = strandOf(item); return <li key={item.id}><button type="button" onClick={() => onSelect({ type: "item", id: item.id })}>
      <span className="research-map-swatch" style={{ background: strand ? map.axes[strand.axis].color : "#1d1d1f" }} /><span className={`research-map-kind research-map-kind-${item.kind}`}>{oneLine(item.name)}</span>{dot(item.id)}</button></li>; })}</ul></section> : null; })}
    <section><h3>Projects <span>{map.projects.length}</span></h3><ul>{map.projects.filter(p => match(`${p.code} ${p.name}`)).map(p => <li key={p.id}><button type="button" onClick={() => onSelect({ type: "project", id: p.id })}><span className="research-map-code">{p.code}</span>{p.name || <em>Placeholder</em>}{dot(p.id)}</button></li>)}</ul></section>
  </div>;
}

const styleNames = {
  ground: { plain: "Plain", ledger: "Ledger sheet", grid: "Drafting grid", dots: "Dot grid", dashed: "Dashed grid with scale" },
  strandDash: { solid: "Solid", dash: "Dashed", long: "Long dash" },
  influenceDash: { dash: "Dashed", dot: "Dotted", solid: "Solid" },
  interchangeFill: { white: "White", stripes: "Hazard stripes", black: "Solid ink" },
  zoneHatch: { none: "None", stripes: "Hazard stripes", lines: "Fine lines", heavy: "Heavy stripes", chevrons: "Chevrons", grid: "Graph grid", dots: "Dots", cross: "Crosshatch" },
  zoneOutline: { solid: "Solid", dashed: "Dashed", none: "None" },
} as const;

const isPlane = (shape: Shape) => shape.id.startsWith("plane-");
// Turns the generated axis planes on or off, keeping any other shapes as they are.
function setPlanes(map: ResearchMap, on: boolean): ResearchMap {
  const next = { ...map, style: { ...styleOf(map), planes: on } };
  if (!map.shapes) return next;
  const others = map.shapes.filter(sh => !isPlane(sh));
  return { ...next, shapes: on ? (map.shapes.some(isPlane) ? map.shapes : [...axisPlanes(map), ...others]) : others };
}

// Every graphic setting for the whole map, plus presets to start from.
function StylePane({ map, commit }: { map: ResearchMap; commit: (change: (current: ResearchMap) => ResearchMap) => void }) {
  const style = styleOf(map);
  const [preset, setPreset] = useState(stylePresets[0].key);
  const [presetName, setPresetName] = useState("");
  const set = (change: Partial<MapStyle>) => commit(c => ({ ...c, style: { ...styleOf(c), ...change } }));
  const chosen = stylePresets.find(p => p.key === preset) || null;
  const saved = map.stylePresets || [];
  const savedChoice = preset.startsWith("saved:") ? saved[Number(preset.slice(6))] : null;
  const apply = (withColors: boolean) => commit(c => {
    const picked = { ...(savedChoice ? savedChoice.style : chosen?.style || defaultStyle) };
    const next: ResearchMap = c.shapes ? setPlanes({ ...c, style: picked }, picked.planes) : { ...c, style: picked };
    if (withColors && chosen?.colors) { const colors = chosen.colors; next.axes = Object.fromEntries(Object.entries(c.axes).map(([k, a]) => [k, colors[k] ? { ...a, color: colors[k] } : a])); }
    return next;
  });
  const select = <K extends keyof typeof styleNames>(key: K, list: readonly string[], label: string) => <label>{label}<select value={style[key] as string} onChange={e => set({ [key]: e.target.value } as Partial<MapStyle>)}>{list.map(v => <option key={v} value={v}>{(styleNames[key] as Record<string, string>)[v]}</option>)}</select></label>;
  const range = (key: keyof MapStyle, label: string, min: number, max: number, step: number, unit = "") => <label className="research-map-range">{label}<span><input type="range" min={min} max={max} step={step} value={style[key] as number} onChange={e => set({ [key]: Number(e.target.value) } as Partial<MapStyle>)} /><output>{Math.round((style[key] as number) * 100) / 100}{unit}</output></span></label>;
  const color = (key: keyof MapStyle, label: string) => <label className="research-map-color">{label}<input type="color" value={style[key] as string} onChange={e => set({ [key]: e.target.value } as Partial<MapStyle>)} /></label>;
  const toggle = (key: keyof MapStyle, label: string) => <label className="research-map-check"><input type="checkbox" checked={style[key] as boolean} onChange={e => set({ [key]: e.target.checked } as Partial<MapStyle>)} />{label}</label>;

  return <div className="research-map-pane research-map-form research-map-style">
    <h3>Presets</h3>
    <select value={preset} onChange={e => setPreset(e.target.value)} aria-label="Style preset">
      <optgroup label="Built in">{stylePresets.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>
      {saved.length > 0 && <optgroup label="Saved on this map">{saved.map((p, i) => <option key={i} value={`saved:${i}`}>{p.name}</option>)}</optgroup>}
    </select>
    {chosen && !savedChoice && <p className="research-map-hint">{chosen.note}</p>}
    <div className="research-map-row">
      <button type="button" className="button" onClick={() => apply(false)}>Apply style</button>
      {chosen?.colors && !savedChoice && <button type="button" className="button" onClick={() => apply(true)}>Apply style + colors</button>}
      {savedChoice && <button type="button" className="text-button research-map-danger" onClick={() => { const i = Number(preset.slice(6)); setPreset(stylePresets[0].key); commit(c => ({ ...c, stylePresets: (c.stylePresets || []).filter((_, n) => n !== i) })); }}>Delete</button>}
    </div>
    <div className="research-map-row"><input value={presetName} maxLength={40} placeholder="Name this style" onChange={e => setPresetName(e.target.value)} /><button type="button" className="button" disabled={!presetName.trim()} onClick={() => { const name = presetName.trim(); commit(c => ({ ...c, stylePresets: [...(c.stylePresets || []).filter(p => p.name !== name), { name, style: { ...styleOf(c) } }].slice(-20) })); setPresetName(""); }}>Save current</button></div>

    <h3>Ground</h3>
    {select("ground", grounds, "Sheet")}
    {color("background", "Paper")}
    {color("rule", "Rules and column lines")}
    {range("bands", "Column shading", 0, 0.12, 0.005)}
    <label className="research-map-check"><input type="checkbox" checked={shapesOf(map).some(isPlane)} onChange={e => commit(c => setPlanes(c, e.target.checked))} />Translucent axis planes (edit each one under Layers)</label>
    {toggle("scale", "Section scale and registration crosses")}
    {toggle("construction", "Construction hairlines at strand ends and bends")}

    <h3>Strands</h3>
    {range("strandWidth", "Line weight", 1, 14, 0.5)}
    {range("corner", "Corner radius", 0, 60, 1)}
    {select("strandDash", strandDashes, "Line")}
    {toggle("casing", "Paper casing around lines")}

    <h3>Influence lines</h3>
    {range("influenceWidth", "Line weight", 0.3, 4, 0.1)}
    {select("influenceDash", influenceDashes, "Line")}
    {range("influenceOpacity", "Strength", 0.1, 1, 0.05)}
    {toggle("influenceInk", "Draw in ink instead of the axis color")}

    <h3>Stations</h3>
    {range("stationScale", "Size", 0.4, 2, 0.05, "×")}
    {range("stationStroke", "Outline weight", 0.3, 3, 0.1, "×")}
    {select("interchangeFill", fills, "Interchanges")}

    <h3>Type</h3>
    <label>Font<select value={style.font} onChange={e => set({ font: e.target.value as MapStyle["font"] })}>{fonts.map(f => <option key={f} value={f}>{fontLabels[f]}</option>)}</select></label>
    {range("textScale", "Size", 0.7, 1.4, 0.02, "×")}
    {color("ink", "Ink")}
    <p className="research-map-hint">Checks measure labels in the chosen font and size, so overlaps show up under Checks.</p>

    <h3>Core zone</h3>
    {color("zoneFill", "Fill")}
    {range("zoneOpacity", "Fill strength", 0, 1, 0.05)}
    {select("zoneHatch", hatches, "Pattern")}
    {select("zoneOutline", outlines, "Outline")}

    <button type="button" className="text-button" onClick={() => commit(c => { const next = { ...c }; delete next.style; return next; })}>Back to the default style</button>
  </div>;
}

type Appearance = { fill: string; opacity: number; hatch: Shape["hatch"]; outline: Shape["outline"] };
function AppearanceFields({ fill, opacity, hatch, outline, onChange }: Appearance & { onChange: (change: Partial<Appearance>) => void }) {
  return <>
    <label className="research-map-color">Fill<input type="color" value={fill} onChange={e => onChange({ fill: e.target.value })} /></label>
    <label className="research-map-range">Fill strength<span><input type="range" min={0} max={1} step={0.01} value={opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} /><output>{Math.round(opacity * 100)}%</output></span></label>
    <label>Pattern<select value={hatch} onChange={e => onChange({ hatch: e.target.value as Shape["hatch"] })}>{hatches.map(h => <option key={h} value={h}>{styleNames.zoneHatch[h]}</option>)}</select></label>
    <label>Outline<select value={outline} onChange={e => onChange({ outline: e.target.value as Shape["outline"] })}>{outlines.map(o => <option key={o} value={o}>{styleNames.zoneOutline[o]}</option>)}</select></label>
  </>;
}

function ShapeForm({ shape, onChange, onClose, onDuplicate, onDelete, onAddPoint, onRemovePoint }: { shape: Shape; onChange: (change: Partial<Shape>) => void; onClose: () => void; onDuplicate: () => void; onDelete: () => void; onAddPoint?: () => void; onRemovePoint?: () => void }) {
  return <div className="research-map-form">
    <div className="research-map-form-head"><span className="research-map-swatch" style={{ background: shape.fill }} /><strong>{shape.name || "Shape"}</strong><button type="button" className="text-button" onClick={onClose}>Done</button></div>
    <label>Name<input value={shape.name} maxLength={60} onChange={e => onChange({ name: e.target.value })} /></label>
    {shape.kind === "text" && <>
      <label>Text<input value={shape.text || ""} maxLength={80} onChange={e => onChange({ text: e.target.value })} /></label>
      <label className="research-map-color">Color<input type="color" value={shape.outlined ? shape.stroke : shape.fill} onChange={e => onChange(shape.outlined ? { stroke: e.target.value } : { fill: e.target.value })} /></label>
      <label className="research-map-range">Strength<span><input type="range" min={0.05} max={1} step={0.05} value={shape.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} /><output>{Math.round(shape.opacity * 100)}%</output></span></label>
      <div className="research-map-row">
        <label>Weight<select value={shape.weight ?? 800} onChange={e => onChange({ weight: Number(e.target.value) })}>{[300, 400, 600, 800, 900].map(w => <option key={w} value={w}>{({ 300: "Light", 400: "Regular", 600: "Semibold", 800: "Bold", 900: "Black" } as Record<number, string>)[w]}</option>)}</select></label>
        <label>Letters<select value={shape.outlined ? "outline" : "solid"} onChange={e => onChange({ outlined: e.target.value === "outline" || undefined })}><option value="solid">Solid</option><option value="outline">Outlined</option></select></label>
      </div>
      {shape.outlined && <label className="research-map-range">Outline weight<span><input type="range" min={0.5} max={8} step={0.1} value={shape.strokeWidth} onChange={e => onChange({ strokeWidth: Number(e.target.value) })} /><output>{shape.strokeWidth}</output></span></label>}
      <p className="research-map-hint">Drag the lower handle up or down to change the size.</p>
    </>}
    {shape.kind === "line" && <>
      <label className="research-map-color">Line color<input type="color" value={shape.stroke} onChange={e => onChange({ stroke: e.target.value })} /></label>
      <label className="research-map-range">Line weight<span><input type="range" min={0.3} max={10} step={0.1} value={shape.strokeWidth} onChange={e => onChange({ strokeWidth: Number(e.target.value) })} /><output>{shape.strokeWidth}</output></span></label>
      <label>Line<select value={shape.outline === "dashed" ? "dashed" : "solid"} onChange={e => onChange({ outline: e.target.value as Shape["outline"] })}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>
      <div className="research-map-row">
        <label>Start<select value={shape.start || "none"} onChange={e => onChange({ start: e.target.value === "none" ? undefined : e.target.value as Shape["start"] })}>{lineEnds.map(k => <option key={k} value={k}>{lineEndLabels[k]}</option>)}</select></label>
        <label>End<select value={shape.end || "none"} onChange={e => onChange({ end: e.target.value === "none" ? undefined : e.target.value as Shape["end"] })}>{lineEnds.map(k => <option key={k} value={k}>{lineEndLabels[k]}</option>)}</select></label>
      </div>
      <label className="research-map-check"><input type="checkbox" checked={!!shape.curve} onChange={e => onChange({ curve: e.target.checked || undefined })} />Curve smoothly through its points</label>
    </>}
    {(shape.kind === "polygon" || shape.kind === "ellipse") && <>
    <AppearanceFields fill={shape.fill} opacity={shape.opacity} hatch={shape.hatch} outline={shape.outline} onChange={onChange} />
    {shape.hatch !== "none" && <>
      <label className="research-map-color">Pattern color<input type="color" value={shape.hatchColor || "#141414"} onChange={e => onChange({ hatchColor: e.target.value })} /></label>
      <label className="research-map-range">Pattern strength<span><input type="range" min={0.05} max={1} step={0.05} value={shape.hatchOpacity ?? 0.16} onChange={e => onChange({ hatchOpacity: Number(e.target.value) })} /><output>{Math.round((shape.hatchOpacity ?? 0.16) * 100)}%</output></span></label>
    </>}
    </>}
    {shape.kind !== "line" && shape.kind !== "text" && shape.outline !== "none" && <>
      <label className="research-map-color">Outline color<input type="color" value={shape.stroke} onChange={e => onChange({ stroke: e.target.value })} /></label>
      <label className="research-map-range">Outline weight<span><input type="range" min={0.2} max={8} step={0.1} value={shape.strokeWidth} onChange={e => onChange({ strokeWidth: Number(e.target.value) })} /><output>{shape.strokeWidth}</output></span></label>
    </>}
    <label className="research-map-check"><input type="checkbox" checked={!!shape.shadow} onChange={e => onChange({ shadow: e.target.checked || undefined })} />Drop shadow</label>
    <label>Layer<select value={shape.front ? "front" : "back"} onChange={e => onChange({ front: e.target.value === "front" || undefined })}><option value="back">Behind the strands</option><option value="front">Over the strands</option></select></label>
    <label className="research-map-check"><input type="checkbox" checked={!!shape.hidden} onChange={e => onChange({ hidden: e.target.checked || undefined })} />Hidden</label>
    <p className="research-map-hint">{shape.kind === "ellipse" ? "Drag the square handles to resize it, or drag the shape to move it." : shape.kind === "text" ? "Drag it to move it." : "Drag the square handles to reshape it, or drag it to move it. Select a point to add one after it or remove it."}</p>
    <div className="research-map-row research-map-wrap">
      {onAddPoint && <button type="button" className="button" onClick={onAddPoint}>Add a point</button>}
      {onRemovePoint && <button type="button" className="button" onClick={onRemovePoint}>Remove point</button>}
      <button type="button" className="button" onClick={onDuplicate}>Duplicate</button>
    </div>
    <button type="button" className="text-button research-map-danger" onClick={onDelete}>Delete shape</button>
  </div>;
}

// Overrides for one station; anything left alone follows the Style tab.
function MarkerPaintForm({ item, map, onChange }: { item: Item; map: ResearchMap; onChange: (paint: MarkerPaint | undefined) => void }) {
  const paint = item.marker?.paint || {}; const style = styleOf(map);
  const set = (change: Partial<MarkerPaint>) => { const next: MarkerPaint = { ...paint, ...change }; (Object.keys(next) as (keyof MarkerPaint)[]).forEach(k => { if (next[k] === undefined || next[k] === "") delete next[k]; }); onChange(Object.keys(next).length ? next : undefined); };
  const kind = markerFillKind(paint.fill);
  return <div className="research-map-form">
    <h3>Station appearance</h3>
    <label>Fill<select value={kind} onChange={e => { const v = e.target.value as typeof kind; set({ fill: v === "color" ? (paint.fill && kind === "color" ? paint.fill : "#F2A890") : v || undefined }); }}>{markerFills.map(f => <option key={f} value={f}>{markerFillLabels[f]}</option>)}</select></label>
    {kind === "color" && <label className="research-map-color">Fill color<input type="color" value={paint.fill} onChange={e => set({ fill: e.target.value })} /></label>}
    <label className="research-map-color">Outline and stripe color<span className="research-map-row"><input type="color" value={paint.stroke || style.ink} onChange={e => set({ stroke: e.target.value })} />{paint.stroke && <button type="button" className="text-button" onClick={() => set({ stroke: undefined })}>Default</button>}</span></label>
    <label className="research-map-range">Size<span><input type="range" min={0.4} max={3} step={0.05} value={paint.scale ?? 1} onChange={e => set({ scale: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })} /><output>{(paint.scale ?? 1).toFixed(2)}×</output></span></label>
    <label className="research-map-range">Outline weight<span><input type="range" min={0.2} max={3} step={0.05} value={paint.weight ?? 1} onChange={e => set({ weight: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })} /><output>{(paint.weight ?? 1).toFixed(2)}×</output></span></label>
    {item.marker?.paint && <button type="button" className="text-button" onClick={() => onChange(undefined)}>Reset to the map style</button>}
  </div>;
}

// Color, size, bold and italic for a piece of text; unset values follow the map.
function TextPaintFields({ paint, fallback, onChange, label = "Text" }: { paint: TextPaint; fallback: string; onChange: (paint: TextPaint | undefined) => void; label?: string }) {
  const set = (change: Partial<TextPaint>) => { const next: TextPaint = { ...paint, ...change }; (Object.keys(next) as (keyof TextPaint)[]).forEach(k => { if (next[k] === undefined) delete next[k]; }); onChange(Object.keys(next).length ? next : undefined); };
  const tri = (v: boolean | undefined) => v === undefined ? "" : v ? "on" : "off";
  const fromTri = (v: string) => v === "" ? undefined : v === "on";
  return <>
    <label className="research-map-color">{label} color<span className="research-map-row"><input type="color" value={paint.color || fallback} onChange={e => set({ color: e.target.value })} />{paint.color && <button type="button" className="text-button" onClick={() => set({ color: undefined })}>Default</button>}</span></label>
    <label className="research-map-range">{label} size<span><input type="range" min={0.5} max={3} step={0.05} value={paint.scale ?? 1} onChange={e => set({ scale: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })} /><output>{(paint.scale ?? 1).toFixed(2)}×</output></span></label>
    <div className="research-map-row">
      <label>Weight<select value={tri(paint.bold)} onChange={e => set({ bold: fromTri(e.target.value) })}><option value="">Default</option><option value="on">Bold</option><option value="off">Regular</option></select></label>
      <label>Slant<select value={tri(paint.italic)} onChange={e => set({ italic: fromTri(e.target.value) })}><option value="">Default</option><option value="on">Italic</option><option value="off">Upright</option></select></label>
    </div>
  </>;
}

const setRole = (map: ResearchMap, role: TextRole, paint: TextPaint | undefined): ResearchMap => {
  const text = { ...map.text }; if (paint) text[role] = paint; else delete text[role];
  const next: ResearchMap = { ...map, text }; if (!Object.keys(text).length) delete next.text; return next;
};

function TextRoleRow({ map, role, commit }: { map: ResearchMap; role: TextRole; commit: (change: (current: ResearchMap) => ResearchMap) => void }) {
  const paint = map.text?.[role] || {};
  const fallback = textDefaults[role] || styleOf(map).ink;
  return <div className="research-map-row research-map-text-row">
    <input type="color" value={paint.color || fallback} aria-label={`${textRoleLabels[role]} color`} onChange={e => commit(c => setRole(c, role, { ...c.text?.[role], color: e.target.value }))} />
    <span className="research-map-text-role">{textRoleLabels[role]}</span>
    <input type="number" min={50} max={300} step={5} aria-label={`${textRoleLabels[role]} size`} title="Size, %" value={Math.round((paint.scale ?? 1) * 100)} onChange={e => { const v = Math.min(300, Math.max(50, Number(e.target.value) || 100)) / 100; commit(c => setRole(c, role, { ...c.text?.[role], scale: v === 1 ? undefined : v })); }} />
    {map.text?.[role] && <button type="button" className="text-button" title="Back to default" onClick={() => commit(c => setRole(c, role, undefined))}>↺</button>}
  </div>;
}

// The form for text clicked on the canvas: its words where they're stored on the map, and its look.
function TextForm({ id, map, commit, onClose }: { id: string; map: ResearchMap; commit: (change: (current: ResearchMap) => ResearchMap) => void; onClose: () => void }) {
  const col = /^col:(\d+):(title|note)$/.exec(id);
  const role: TextRole = col ? (col[2] === "title" ? "columnTitle" : "columnNote") : (id as TextRole);
  const roleFields = (r: TextRole, label?: string) => <TextPaintFields key={r} label={label} paint={map.text?.[r] || {}} fallback={rolePaint(map, r).color} onChange={paint => commit(c => setRole(c, r, paint))} />;
  const title = col ? `Column ${Number(col[1]) + 1}` : id === "legend" ? "Legend" : textRoleLabels[role];
  return <div className="research-map-form">
    <div className="research-map-form-head"><strong>{title}</strong><button type="button" className="text-button" onClick={onClose}>Done</button></div>
    {id === "title" && <label>Title<input value={map.title} spellCheck onChange={e => commit(c => ({ ...c, title: e.target.value }))} /></label>}
    {id === "subtitle" && <label>Subtitle<input value={map.subtitle} spellCheck onChange={e => commit(c => ({ ...c, subtitle: e.target.value }))} /></label>}
    {id === "caption" && <label>How to read this<textarea rows={7} value={map.caption} spellCheck onChange={e => commit(c => ({ ...c, caption: e.target.value }))} /></label>}
    {id === "axesLine" && axisIds(map).map(a => <div key={a} className="research-map-row"><input type="color" value={map.axes[a].color} aria-label="Category color" onChange={e => commit(c => ({ ...c, axes: { ...c.axes, [a]: { ...c.axes[a], color: e.target.value } } }))} /><input value={map.axes[a].label} aria-label="Category name" onChange={e => commit(c => ({ ...c, axes: { ...c.axes, [a]: { ...c.axes[a], label: e.target.value } } }))} /></div>)}
    {col && (() => { const i = Number(col[1]); const c0 = map.columns[i]; return c0 ? <>
      <label>Title<input value={c0.title} spellCheck onChange={e => commit(c => ({ ...c, columns: c.columns.map((x, n) => n === i ? { ...x, title: e.target.value } : x) }))} /></label>
      <label>Note<input value={c0.subtitle} spellCheck onChange={e => commit(c => ({ ...c, columns: c.columns.map((x, n) => n === i ? { ...x, subtitle: e.target.value } : x) }))} /></label>
    </> : null; })()}
    {id === "legend" ? <>
      {(Object.keys(legendWords) as LegendWord[]).map(key => <label key={key}>{legendWords[key]}<input value={map.words?.[key] ?? legendWords[key]} onChange={e => commit(c => ({ ...c, words: { ...c.words, [key]: e.target.value } }))} /></label>)}
      <h3>Look</h3>{roleFields("legendHead", "Heading")}{roleFields("legend", "Text")}
    </> : col ? <>{roleFields("columnTitle", "Title")}{roleFields("columnNote", "Note")}</> : roleFields(role)}
    <p className="research-map-hint">Changes here apply to every {col ? "column" : "piece of text of this kind"}. All text colors and sizes are also listed under Map.</p>
  </div>;
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  axes, checkMap, defaultStyle, diffMaps, fills, fontLabels, fonts, grounds, hatches, influenceDashes, kindLabels, kinds, labelBox, labelLines, markerLabels, markers, metricsFor,
  nearestOnPolyline, newId, outlines, renderMapInner, renderMapSvg, routeLabels, routes, snapBetween, snapDirection, strandDashes, styleOf, stylePresets,
  type Issue, type Item, type LogEntry, type MapStyle, type MarkerType, type Pt, type ResearchMap, type Strand,
} from "@/lib/research-map";
import { seedMap } from "@/lib/research-map-seed";
import { deleteResearchMapSnapshot, saveResearchMap, saveResearchMapSnapshot } from "@/app/(workspace)/tenure/map/actions";

type Snapshot = { id: string; name: string; createdAt: string; map: ResearchMap };
type Selection = { type: "item" | "strand" | "project" | "zone"; id: string; point?: number } | null;
type Drag =
  | { kind: "label"; id: string; dx: number; dy: number }
  | { kind: "marker"; id: string }
  | { kind: "feed"; id: string }
  | { kind: "point"; id: string; index: number }
  | { kind: "project"; id: string; dx: number; dy: number }
  | { kind: "zone"; dx: number; dy: number }
  | { kind: "zone-size" }
  | { kind: "pan"; sx: number; sy: number; cx: number; cy: number; moved: boolean };
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
type Tab = "content" | "checks" | "map" | "style" | "history";

const grid = (n: number, on: boolean, step = 5) => on ? Math.round(n / step) * step : Math.round(n * 10) / 10;
const dateLabel = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const today = () => new Date().toISOString().slice(0, 10);
const oneLine = (name: string) => name.replace(/\n/g, " ") || "Untitled";

export function strandName(map: ResearchMap, strand: Strand) {
  const start = map.items.find(item => item.marker?.type === "start" && item.marker.strand === strand.id);
  return start ? oneLine(start.name) : `Unnamed ${strand.axis} strand`;
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ResearchMapEditor({ initial, isNew, log: initialLog, snapshots: initialSnapshots, projects }: { initial: ResearchMap; isNew: boolean; log: LogEntry[]; snapshots: Snapshot[]; projects: { id: string; title: string }[] }) {
  const [map, setMap] = useState(initial);
  const [past, setPast] = useState<ResearchMap[]>([]);
  const [future, setFuture] = useState<ResearchMap[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [snap, setSnap] = useState(true);
  const [dirty, setDirty] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);
  const [log, setLog] = useState(initialLog);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [snapshotName, setSnapshotName] = useState("");
  const [compare, setCompare] = useState<Snapshot | null>(null);
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
  const metrics = useMemo(() => metricsFor(styleOf(map)), [map]);
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
  const startPan = (event: ReactPointerEvent) => {
    const v = viewRef.current || fitView();
    svgRef.current?.setPointerCapture(event.pointerId);
    drag.current = { kind: "pan", sx: event.clientX, sy: event.clientY, cx: v.cx, cy: v.cy, moved: false };
  };
  const onBackgroundDown = (event: ReactPointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: (viewRef.current || fitView()).scale }; drag.current = null; return;
    }
    startPan(event);
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
    const [x, y] = toMap(event); const free = event.altKey || !snap;
    setDirty(true);
    setMap(current => {
      if (d.kind === "label") return { ...current, items: current.items.map(item => item.id === d.id ? { ...item, x: grid(x - d.dx, !free), y: grid(y - d.dy, !free) } : item) };
      if (d.kind === "project") return { ...current, projects: current.projects.map(p => p.id === d.id ? { ...p, x: grid(x - d.dx, !free), y: grid(y - d.dy, !free) } : p) };
      if (d.kind === "zone" && current.zone) return { ...current, zone: { ...current.zone, x: grid(x - d.dx, !free), y: grid(y - d.dy, !free) } };
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
    if (d?.kind === "pan" && !d.moved && event.target === svgRef.current) setSelection(null);
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
    const item: Item = { id, name: "New influence", kind: "concept", main: false, x: mx - 180, y: my - 40, anchor: "start", ...(strand ? { feeds: { strand: strand.id, at: [mx, my] as Pt, route: "under" as const } } : {}) };
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

  // ---------- export ----------
  const exportSvg = () => download(`research-map-${today()}.svg`, new Blob([renderMapSvg(map)], { type: "image/svg+xml" }));
  const exportPng = () => {
    const img = new Image(); const url = URL.createObjectURL(new Blob([renderMapSvg(map)], { type: "image/svg+xml" }));
    img.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = map.width * 2; canvas.height = map.height * 2;
      const ctx = canvas.getContext("2d")!; ctx.scale(2, 2); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      canvas.toBlob(blob => { if (blob) download(`research-map-${today()}.png`, blob); }, "image/png");
    };
    img.src = url;
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
    if (!window.confirm(`Delete the snapshot “${snap.name}”? This can't be undone.`)) return;
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
      <button type="button" className="button" onClick={addInfluence}>+ Influence</button>
      <button type="button" className="button" onClick={addStation}>+ Station</button>
      <button type="button" className="button" onClick={addStrand}>+ Strand</button>
      <button type="button" className="button" onClick={addProject}>+ Project</button>
      <label className="research-map-toggle"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap to 45°</label>
      <span className="research-map-spacer" />
      <button type="button" className={issues.length ? "button research-map-checks-button research-map-checks-open" : "button research-map-checks-button"} onClick={() => setTab("checks")}>{issues.length ? `${issues.length} to review${fixes ? ` · ${fixes} to fix` : ""}` : "All checks pass"}</button>
      <button type="button" className="button" onClick={exportSvg}>SVG</button>
      <button type="button" className="button" onClick={exportPng}>PNG</button>
      <button type="button" className="button" onClick={exportPdf}>Print / PDF</button>
    </div>
    {message && <p className={message.error ? "notice notice-error" : "research-map-message"} role={message.error ? "alert" : "status"}>{message.text}</p>}

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
              {map.strands.map(strand => <path key={strand.id} d={`M${strand.points.map(p => p.join(",")).join(" L")}`} className={selection?.type === "strand" && selection.id === strand.id ? "research-map-strand-hit research-map-selected-strand" : "research-map-strand-hit"} strokeWidth={18 * hs}
                onPointerDown={e => { e.stopPropagation(); setSelection({ type: "strand", id: strand.id }); }} onDoubleClick={e => addPointAt(strand, e)}><title>{`${strandName(map, strand)}: double-click to add a bend`}</title></path>)}
              {map.items.filter(item => item.name.trim()).map(item => { const box = labelBox(item, metrics); return <rect key={item.id} x={box.x0 - 3} y={box.y0 - 3} width={box.x1 - box.x0 + 6} height={box.y1 - box.y0 + 6} rx={3}
                className={selection?.type === "item" && selection.id === item.id ? "research-map-label-hit research-map-selected" : issueIds.has(item.id) && tab === "checks" ? "research-map-label-hit research-map-flagged" : "research-map-label-hit"}
                onPointerDown={e => { const [x, y] = toMap(e); begin(e, { kind: "label", id: item.id, dx: x - item.x, dy: y - item.y }, { type: "item", id: item.id }); }}><title>{oneLine(item.name)}</title></rect>; })}
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
        <p className="research-map-hint">Zoom with pinch or Ctrl/⌘ + scroll; scroll or drag the background to pan (hold Space to pan from anywhere). Keys: + and − zoom, 0 fits, 1 is actual size. Drag labels, stations and project circles. Select a strand to drag its bends; double-click a strand to add a bend. Bends snap to 0°, 45° and 90° (hold Alt to place freely). Arrow keys nudge, Delete removes, Ctrl+Z undoes.</p>
      </div>

      <aside className="research-map-panel">
        <div className="research-map-tabs" role="tablist">
          {(["content", "checks", "map", "style", "history"] as Tab[]).map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "research-map-tab research-map-tab-active" : "research-map-tab"} onClick={() => setTab(t)}>
            {{ content: "Content", checks: `Checks${issues.length ? ` (${issues.length})` : ""}`, map: "Map", style: "Style", history: "History" }[t]}</button>)}
        </div>

        {tab === "content" && <div className="research-map-pane">
          {selectedItem && <ItemForm key={selectedItem.id} item={selectedItem} map={map} nameRef={nameRef} onChange={change => updateItem(selectedItem.id, change)} onDelete={removeSelection} onClose={() => setSelection(null)} issues={issues.filter(i => i.item === selectedItem.id)} />}
          {selectedStrand && <div className="research-map-form">
            <div className="research-map-form-head"><span className="research-map-swatch" style={{ background: map.axes[selectedStrand.axis].color }} /><strong>{strandName(map, selectedStrand)}</strong><button type="button" className="text-button" onClick={() => setSelection(null)}>Done</button></div>
            <label>Axis<select value={selectedStrand.axis} onChange={e => commit(c => ({ ...c, strands: c.strands.map(s => s.id === selectedStrand.id ? { ...s, axis: e.target.value as Strand["axis"] } : s) }))}>{axes.map(a => <option key={a} value={a}>{map.axes[a].label}</option>)}</select></label>
            <p className="research-map-hint">{selectedStrand.points.length} points. Drag the round handles on the map to re-route it; influences and stations on it follow along.</p>
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
            <label>Note<textarea rows={3} value={selectedProject.note || ""} spellCheck placeholder="Why it sits here" onChange={e => commit(c => ({ ...c, projects: c.projects.map(p => p.id === selectedProject.id ? { ...p, note: e.target.value } : p) }))} /></label>
            <button type="button" className="text-button research-map-danger" onClick={removeSelection}>Delete project station</button>
          </div>}
          {selection?.type === "zone" && z && <div className="research-map-form">
            <div className="research-map-form-head"><strong>Core zone</strong><button type="button" className="text-button" onClick={() => setSelection(null)}>Done</button></div>
            <p className="research-map-hint">Drag its title to move it, and the square handle at its corner to resize. Its title and size are also under Map.</p>
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
          <h3>Axes</h3>
          {axes.map(a => <div key={a} className="research-map-row"><input type="color" value={map.axes[a].color} aria-label={`${map.axes[a].label} colour`} onChange={e => commit(c => ({ ...c, axes: { ...c.axes, [a]: { ...c.axes[a], color: e.target.value } } }))} /><input value={map.axes[a].label} aria-label={`${a} axis name`} onChange={e => commit(c => ({ ...c, axes: { ...c.axes, [a]: { ...c.axes[a], label: e.target.value } } }))} /></div>)}
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

        {tab === "style" && <StylePane map={map} commit={commit} />}

        {tab === "history" && <div className="research-map-pane">
          <section className="research-map-form">
            <h3>Snapshots</h3>
            <p className="research-map-hint">Freeze the map at a milestone, such as a review, and compare later versions with it.</p>
            <div className="research-map-row"><input value={snapshotName} placeholder="e.g. Third-year review" onChange={e => setSnapshotName(e.target.value)} /><button type="button" className="button" onClick={() => void takeSnapshot()}>Save snapshot</button></div>
            {snapshots.length ? <ul className="research-map-snapshots">{snapshots.map(s => <li key={s.id}><div><strong>{s.name}</strong><span>{dateLabel(s.createdAt)}</span></div>
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
  ground: { plain: "Plain", ledger: "Ledger sheet", grid: "Drafting grid" },
  strandDash: { solid: "Solid", dash: "Dashed", long: "Long dash" },
  influenceDash: { dash: "Dashed", dot: "Dotted", solid: "Solid" },
  interchangeFill: { white: "White", stripes: "Hazard stripes", black: "Solid ink" },
  zoneHatch: { none: "None", stripes: "Hazard stripes", chevrons: "Chevrons" },
  zoneOutline: { solid: "Solid", dashed: "Dashed", none: "None" },
} as const;

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
    const next: ResearchMap = { ...c, style: { ...(savedChoice ? savedChoice.style : chosen?.style || defaultStyle) } };
    if (withColors && chosen?.colors) { const colors = chosen.colors; next.axes = { material: { ...c.axes.material, color: colors.material }, structure: { ...c.axes.structure, color: colors.structure }, computation: { ...c.axes.computation, color: colors.computation } }; }
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
    {toggle("planes", "Translucent axis planes")}
    {toggle("construction", "Construction lines, scale and registration marks")}

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

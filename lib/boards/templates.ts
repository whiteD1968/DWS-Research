// Board templates: slide layouts, starter boards and diagram starters, described as plain data
// so they can be tested without the canvas. The canvas turns each piece into a tldraw shape.
import type { BoxSpec, LineSpec } from "./lines";
export type TemplateColor = "black" | "grey" | "light-violet" | "violet" | "blue" | "light-blue" | "yellow" | "orange" | "green" | "light-green" | "light-red" | "red" | "white";
export type TemplatePiece =
  | { kind: "frame"; ref: string; x: number; y: number; w: number; h: number; name: string; slide?: boolean; notes?: string }
  | { kind: "text"; ref?: string; parent?: string; x: number; y: number; w: number; text: string; size: "s" | "m" | "l" | "xl"; align?: "start" | "middle" | "end"; font?: "sans" | "serif" | "draw" | "mono"; color?: TemplateColor }
  | { kind: "placeholder"; ref?: string; parent?: string; x: number; y: number; w: number; h: number; label: string }
  | { kind: "shape"; ref?: string; parent?: string; x: number; y: number; w: number; h: number; geo: "rectangle" | "ellipse" | "diamond"; label?: string; color?: TemplateColor; fill?: "none" | "semi" | "solid"; dash?: "solid" | "dashed" | "dotted" }
  | { kind: "note"; ref?: string; parent?: string; x: number; y: number; text: string; color?: TemplateColor }
  | { kind: "box"; ref: string; parent?: string; x: number; y: number; w: number; h: number; title: string; body?: string; color?: TemplateColor; box?: Partial<BoxSpec>; locked?: boolean }
  | { kind: "line"; parent?: string; x: number; y: number; dx: number; dy: number; dash?: "solid" | "dashed" | "dotted"; end?: "none" | "arrow"; line?: Partial<LineSpec> }
  | { kind: "connect"; from: string; to: string; label?: string; line?: Partial<LineSpec> }
  | { kind: "rating"; parent?: string; x: number; y: number; w: number; h: number; label: string; value: number; max?: number; ink?: string }
  | { kind: "grid"; parent?: string; x: number; y: number; w: number; h: number; rows: number; cols: number; ink?: string }
  | { kind: "numeral"; parent?: string; x: number; y: number; w: number; h: number; text: string; style?: "hatch" | "outline" | "solid"; ink?: string }
  | { kind: "brackets"; parent?: string; x: number; y: number; w: number; h: number; arm?: number; dashed?: boolean; ink?: string };
export type TemplateGroup = "Slide layouts" | "Decks" | "Starter boards" | "Diagrams" | "Studio";
export type BoardTemplate = { id: string; group: TemplateGroup; label: string; description: string; pieces: TemplatePiece[] };

const SW = 1280, SH = 720, GAP = 160;
const M = 72; // slide margin

// ---------- Slide layouts: one 16:9 frame each ----------
type SlideBody = (f: string) => TemplatePiece[];
const slideBodies: Record<string, { label: string; description: string; body: SlideBody }> = {
  title: { label: "Title slide", description: "Large title, subtitle and presenter line.", body: f => [
    { kind: "text", parent: f, x: M, y: 250, w: SW - M * 2, text: "Presentation title", size: "xl", font: "serif" },
    { kind: "text", parent: f, x: M, y: 360, w: SW - M * 2, text: "Subtitle or project question", size: "m" },
    { kind: "text", parent: f, x: M, y: SH - 110, w: SW - M * 2, text: "Name · Course · Date", size: "s", color: "grey" },
  ] },
  imageCaption: { label: "Image + caption", description: "One large image with a caption column.", body: f => [
    { kind: "placeholder", parent: f, x: M, y: M, w: 760, h: SH - M * 2, label: "Image" },
    { kind: "text", parent: f, x: 880, y: M + 8, w: SW - 880 - M, text: "Heading", size: "l", font: "serif" },
    { kind: "text", parent: f, x: 880, y: M + 90, w: SW - 880 - M, text: "Caption: what this shows and why it matters.", size: "s" },
  ] },
  twoUp: { label: "Two images", description: "Side-by-side comparison with captions.", body: f => {
    const w = (SW - M * 2 - 48) / 2;
    return [
      { kind: "text", parent: f, x: M, y: 48, w: SW - M * 2, text: "Heading", size: "l", font: "serif" },
      ...[0, 1].flatMap(i => [
        { kind: "placeholder", parent: f, x: M + i * (w + 48), y: 140, w, h: 420, label: i ? "Image B" : "Image A" } as TemplatePiece,
        { kind: "text", parent: f, x: M + i * (w + 48), y: 580, w, text: "Caption", size: "s" } as TemplatePiece,
      ]),
    ];
  } },
  fourUp: { label: "Four-image grid", description: "A 2 × 2 grid for process or variations.", body: f => {
    const w = (SW - M * 2 - 32) / 2, h = (SH - 150 - M - 32) / 2;
    return [
      { kind: "text", parent: f, x: M, y: 40, w: SW - M * 2, text: "Heading", size: "l", font: "serif" },
      ...[0, 1, 2, 3].map(i => ({ kind: "placeholder", parent: f, x: M + (i % 2) * (w + 32), y: 130 + Math.floor(i / 2) * (h + 32), w, h, label: `Image ${i + 1}` } as TemplatePiece)),
    ];
  } },
  fullBleed: { label: "Full-bleed image", description: "Image fills the slide with a title over it.", body: f => [
    { kind: "placeholder", parent: f, x: 0, y: 0, w: SW, h: SH, label: "Full-bleed image" },
    { kind: "text", parent: f, x: M, y: SH - 150, w: 700, text: "Title over image", size: "xl", font: "serif" },
  ] },
  quote: { label: "Quote", description: "A pull quote with attribution.", body: f => [
    { kind: "text", parent: f, x: 140, y: 220, w: SW - 280, text: "“A quote, finding or principle that frames the work.”", size: "xl", font: "serif", align: "middle" },
    { kind: "text", parent: f, x: 140, y: 470, w: SW - 280, text: "— Source", size: "m", align: "middle", color: "grey" },
  ] },
  bullets: { label: "Heading + points", description: "Heading with three short points.", body: f => [
    { kind: "text", parent: f, x: M, y: 64, w: SW - M * 2, text: "Heading", size: "l", font: "serif" },
    ...[0, 1, 2].map(i => ({ kind: "text", parent: f, x: M, y: 200 + i * 120, w: SW - M * 2, text: `•  Point ${i + 1}`, size: "m" } as TemplatePiece)),
  ] },
};

function slide(ref: string, name: string, x: number, body: SlideBody, notes?: string): TemplatePiece[] {
  return [{ kind: "frame", ref, x, y: 0, w: SW, h: SH, name, slide: true, notes }, ...body(ref)];
}

const slideLayouts: BoardTemplate[] = Object.entries(slideBodies).map(([id, s]) => ({
  id: `slide-${id}`, group: "Slide layouts", label: s.label, description: s.description, pieces: slide("s", s.label, 0, s.body),
}));

// ---------- Decks: several slides in a row ----------
function deck(id: string, label: string, description: string, slides: [string, keyof typeof slideBodies, string?][]): BoardTemplate {
  return { id, group: "Decks", label, description, pieces: slides.flatMap(([name, body, notes], i) => slide(`s${i}`, name, i * (SW + GAP), slideBodies[body].body, notes)) };
}
const decks: BoardTemplate[] = [
  deck("deck-portfolio", "Portfolio review", "Cover, overview, process, outcome and reflection.", [
    ["Cover", "title"], ["Project overview", "imageCaption", "Brief, context and your role."], ["Process", "fourUp", "Key turns in the process."],
    ["Outcome", "fullBleed"], ["Reflection", "bullets", "What worked, what you would change, what is next."],
  ]),
  deck("deck-crit", "Crit presentation", "Question, research, concepts, direction and asks.", [
    ["Project question", "title"], ["Research", "fourUp"], ["Concept A vs B", "twoUp"], ["Direction", "imageCaption"], ["Feedback I need", "bullets"],
  ]),
];

// ---------- Starter boards ----------
// Zones are frames kept off the slide deck; they group what is dropped into them.
const zone = (ref: string, x: number, y: number, w: number, h: number, name: string): TemplatePiece => ({ kind: "frame", ref, x, y, w, h, name });
const heading = (x: number, y: number, w: number, text: string): TemplatePiece => ({ kind: "text", x, y, w, text, size: "xl", font: "serif" });

function columns(names: string[], w: number, h: number, gap: number, top: number, note?: (i: number) => TemplatePiece[]) {
  return names.flatMap((name, i) => [zone(`z${i}`, i * (w + gap), top, w, h, name), ...(note ? note(i) : [])]);
}

const starters: BoardTemplate[] = [
  { id: "start-crit", group: "Starter boards", label: "Crit pin-up", description: "Work wall with strengths, questions and next steps.", pieces: [
    heading(0, -110, 1200, "Crit pin-up"),
    zone("wall", 0, 0, 1400, 900, "Work on the wall"),
    ...[0, 1, 2, 3, 4, 5].map(i => ({ kind: "placeholder", parent: "wall", x: 40 + (i % 3) * 450, y: 60 + Math.floor(i / 3) * 410, w: 420, h: 380, label: `Pin-up ${i + 1}` } as TemplatePiece)),
    ...(["Strengths", "Questions", "Next steps"] as const).flatMap((name, i) => [
      zone(`f${i}`, 1480 + i * 440, 0, 400, 900, name),
      { kind: "note", parent: `f${i}`, x: 100, y: 70, text: i === 0 ? "What is working" : i === 1 ? "What is unclear" : "Try next", color: (["light-green", "yellow", "light-blue"] as const)[i] } as TemplatePiece,
    ]),
  ] },
  { id: "start-mood", group: "Starter boards", label: "Mood board", description: "Image grid, palette swatches and keywords.", pieces: [
    { kind: "frame", ref: "m", x: 0, y: 0, w: SW, h: SH, name: "Mood board", slide: true },
    ...[[0, 0, 500, 380], [520, 0, 360, 250], [900, 0, 308, 380], [520, 270, 360, 380], [0, 400, 500, 250], [900, 400, 308, 250]].map(([x, y, w, h], i) => ({ kind: "placeholder", parent: "m", x: M / 2 + x, y: M / 2 + y, w, h, label: `Image ${i + 1}` } as TemplatePiece)),
    { kind: "text", x: 0, y: SH + 40, w: 400, text: "Palette", size: "m", font: "serif" },
    ...(["black", "grey", "orange", "light-red", "light-blue", "light-green"] as const).map((color, i) => ({ kind: "shape", x: i * 110, y: SH + 100, w: 90, h: 90, geo: "rectangle", color, fill: "solid" } as TemplatePiece)),
    { kind: "text", x: 720, y: SH + 40, w: 400, text: "Keywords", size: "m", font: "serif" },
    ...["Texture", "Light", "Material"].map((text, i) => ({ kind: "note", x: 720 + i * 220, y: SH + 100, text, color: "yellow" } as TemplatePiece)),
  ] },
  { id: "start-process", group: "Starter boards", label: "Process wall", description: "Research to final, one zone per stage.", pieces: [
    heading(0, -110, 1600, "Process wall"),
    ...columns(["Research", "Ideation", "Development", "Refinement", "Final"], 520, 900, 40, 0),
    ...[0, 1, 2, 3].map(i => ({ kind: "line", x: 520 + i * 560 + 2, y: -40, dx: 36, dy: 0, end: "arrow" } as TemplatePiece)),
  ] },
  { id: "start-timeline", group: "Starter boards", label: "Project timeline", description: "Milestones along a line, with tasks under each.", pieces: [
    heading(0, -150, 1600, "Project timeline"),
    { kind: "line", x: 0, y: 0, dx: 2200, dy: 0, end: "arrow" },
    ...["Brief", "Research", "Concepts", "Mid-review", "Develop", "Final crit"].flatMap((name, i) => [
      { kind: "shape", x: 100 + i * 380 - 18, y: -18, w: 36, h: 36, geo: "ellipse", color: i === 3 ? "orange" : "black", fill: "solid" } as TemplatePiece,
      { kind: "text", x: 100 + i * 380 - 150, y: -90, w: 300, text: name, size: "m", align: "middle" } as TemplatePiece,
      { kind: "text", x: 100 + i * 380 - 150, y: 40, w: 300, text: `Week ${i * 2 + 1}`, size: "s", align: "middle", color: "grey" } as TemplatePiece,
      { kind: "note", x: 100 + i * 380 - 100, y: 110, text: "Task", color: "light-blue" } as TemplatePiece,
    ]),
  ] },
  { id: "start-kanban", group: "Starter boards", label: "Task board", description: "To do, doing, review and done columns.", pieces: [
    heading(0, -110, 1200, "Task board"),
    ...columns(["To do", "Doing", "Review", "Done"], 420, 1000, 40, 0, i => i === 0 ? [{ kind: "note", parent: "z0", x: 110, y: 70, text: "First task", color: "yellow" }] : []),
  ] },
  { id: "start-matrix", group: "Starter boards", label: "Opportunity matrix", description: "Impact vs effort 2 × 2 for sorting ideas.", pieces: [
    heading(0, -130, 1200, "Opportunity matrix"),
    ...([["Quick wins", "light-green"], ["Big bets", "light-blue"], ["Fill-ins", "light-violet"], ["Not now", "light-red"]] as const).map(([label, color], i) => (
      { kind: "shape", x: (i % 2) * 620, y: Math.floor(i / 2) * 520, w: 600, h: 500, geo: "rectangle", color, fill: "semi", label } as TemplatePiece)),
    { kind: "text", x: 0, y: 1060, w: 1220, text: "Effort  →", size: "m", align: "middle", color: "grey" },
    { kind: "text", x: -200, y: 480, w: 180, text: "↑  Impact", size: "m", align: "end", color: "grey" },
  ] },
  { id: "start-journey", group: "Starter boards", label: "Journey map", description: "Stages across, doing, thinking and feeling down.", pieces: [
    heading(0, -130, 1600, "Journey map"),
    ...["Discover", "Arrive", "Use", "Leave", "Return"].map((name, i) => ({ kind: "shape", x: 220 + i * 340, y: 0, w: 320, h: 70, geo: "rectangle", color: "black", fill: "solid", label: name } as TemplatePiece)),
    ...["Doing", "Thinking", "Feeling", "Opportunities"].flatMap((row, r) => [
      { kind: "text", x: 0, y: 110 + r * 240 + 90, w: 200, text: row, size: "m", font: "serif" } as TemplatePiece,
      ...[0, 1, 2, 3, 4].map(i => ({ kind: "shape", x: 220 + i * 340, y: 100 + r * 240, w: 320, h: 220, geo: "rectangle", color: r === 3 ? "orange" : "grey", fill: "none", dash: "dashed" } as TemplatePiece)),
    ]),
  ] },
];

// ---------- Diagrams: headed boxes joined by connectors ----------
const diagrams: BoardTemplate[] = [
  { id: "diagram-flow", group: "Diagrams", label: "Flow", description: "Start, steps, a decision and two outcomes.", pieces: [
    { kind: "box", ref: "a", x: 0, y: 0, w: 200, h: 120, title: "Start", body: "Trigger or entry point", color: "green" },
    { kind: "box", ref: "b", x: 320, y: 0, w: 200, h: 120, title: "Step", body: "What happens", color: "black" },
    { kind: "box", ref: "c", x: 640, y: 0, w: 200, h: 120, title: "Decision?", body: "Yes or no", color: "yellow" },
    { kind: "box", ref: "d", x: 960, y: -110, w: 200, h: 120, title: "Outcome A", color: "blue" },
    { kind: "box", ref: "e", x: 960, y: 110, w: 200, h: 120, title: "Outcome B", color: "orange" },
    { kind: "connect", from: "a", to: "b" }, { kind: "connect", from: "b", to: "c" },
    { kind: "connect", from: "c", to: "d", label: "Yes" }, { kind: "connect", from: "c", to: "e", label: "No" },
  ] },
  { id: "diagram-system", group: "Diagrams", label: "System map", description: "A central idea linked to four parts.", pieces: [
    { kind: "box", ref: "hub", x: 0, y: 0, w: 240, h: 140, title: "Core idea", body: "The system or concept", color: "violet" },
    { kind: "box", ref: "n", x: 0, y: -280, w: 220, h: 120, title: "People", color: "light-blue" },
    { kind: "box", ref: "e", x: 400, y: 10, w: 220, h: 120, title: "Places", color: "light-green" },
    { kind: "box", ref: "s", x: 10, y: 300, w: 220, h: 120, title: "Objects", color: "yellow" },
    { kind: "box", ref: "w", x: -380, y: 10, w: 220, h: 120, title: "Processes", color: "light-red" },
    ...["n", "e", "s", "w"].map(to => ({ kind: "connect", from: "hub", to } as TemplatePiece)),
  ] },
  { id: "diagram-hierarchy", group: "Diagrams", label: "Hierarchy", description: "One parent, three children, two grandchildren each.", pieces: [
    { kind: "box", ref: "r", x: 760, y: 0, w: 220, h: 110, title: "Parent", color: "black" },
    ...[0, 1, 2].flatMap(i => [
      { kind: "box", ref: `c${i}`, x: 160 + i * 610, y: 240, w: 200, h: 110, title: `Child ${i + 1}`, color: "blue" } as TemplatePiece,
      { kind: "connect", from: "r", to: `c${i}` } as TemplatePiece,
      ...[0, 1].flatMap(j => [
        { kind: "box", ref: `g${i}${j}`, x: 40 + i * 610 + j * 240, y: 470, w: 200, h: 100, title: `Item ${i + 1}.${j + 1}`, color: "light-blue" } as TemplatePiece,
        { kind: "connect", from: `c${i}`, to: `g${i}${j}` } as TemplatePiece,
      ]),
    ]),
  ] },
];

// ---------- Studio: the studio's drawing conventions for communicating a project ----------
// Black (or light grey) boards, white, signal-green and red ink, mono uppercase captions, hatched
// cut-corner frames, corner brackets, crop and registration marks, n-of-5 ratings and big numerals.
// Every page is a slide.
const WHITE = "#f4f3ef", SIGNAL = "#d4f53c", GREY = "#9a9c95", BLACK = "#111111", RED = "#c2413a", PAPER = "#e9e9e7", NAVY = "#1f3a4d";
const fine = (color = WHITE, extra: Partial<LineSpec> = {}): Partial<LineSpec> => ({ weight: 0.35, pattern: "solid", color, radius: 0, start: "none", end: "none", ...extra });
const flow = (extra: Partial<LineSpec> = {}): Partial<LineSpec> => ({ weight: 0.75, pattern: "solid", color: WHITE, radius: 4, start: "none", end: "arrow", endSize: 6, ...extra });
const pill = (extra: Partial<BoxSpec> = {}): Partial<BoxSpec> => ({ weight: 0.75, pattern: "solid", color: WHITE, header: 0, corner: "chamfer", cut: 14, hatch: 6, fill: BLACK, ...extra });
const outline = (extra: Partial<BoxSpec> = {}): Partial<BoxSpec> => ({ weight: 0.5, pattern: "solid", color: WHITE, header: 0, corner: "square", cut: 24, hatch: 0, fill: BLACK, ...extra });
const cap = (f: string, x: number, y: number, w: number, text: string, size: "s" | "m" = "s", color: TemplateColor = "white", align?: "start" | "middle" | "end"): TemplatePiece =>
  ({ kind: "text", parent: f, x, y, w, text, size, font: "mono", color, align });
const words = (f: string, x: number, y: number, w: number, text: string, size: "s" | "m" | "l" | "xl" = "m", color: TemplateColor = "white", align?: "start" | "middle" | "end"): TemplatePiece =>
  ({ kind: "text", parent: f, x, y, w, text, size, font: "sans", color, align });
const title = (f: string, text: string, y = 40, color: TemplateColor = "white"): TemplatePiece => words(f, M, y, SW - M * 2, text, "l", color);
const fline = (f: string, x: number, y: number, dx: number, dy: number, line: Partial<LineSpec>): TemplatePiece => ({ kind: "line", parent: f, x, y, dx, dy, line });
const brackets = (f: string, x: number, y: number, w: number, h: number, ink = RED, dashed = true, arm = 14): TemplatePiece => ({ kind: "brackets", parent: f, x, y, w, h, ink, dashed, arm });
const cross = (f: string, x: number, y: number, k = 14, color = WHITE): TemplatePiece[] => [fline(f, x - k, y, k * 2, 0, fine(color, { weight: 0.75 })), fline(f, x, y - k, 0, k * 2, fine(color, { weight: 0.75 }))];
/** Crop marks in the four corners of the page, as on a printed board. */
function crops(f: string, inset = 28, k = 18): TemplatePiece[] {
  return [[inset, inset, 1, 1], [SW - inset, inset, -1, 1], [inset, SH - inset, 1, -1], [SW - inset, SH - inset, -1, -1]].flatMap(([x, y, sx, sy]) => [
    fline(f, x, y, sx * k, 0, fine(GREY)), fline(f, x, y, 0, sy * k, fine(GREY)),
  ]);
}
/** A page: a slide frame with a locked black (or light grey) board behind everything on it. */
function board(f: string, name: string, notes: string, body: TemplatePiece[], light = false): TemplatePiece[] {
  const fill = light ? PAPER : BLACK;
  return [
    { kind: "frame", ref: f, x: 0, y: 0, w: SW, h: SH, name, slide: true, notes },
    { kind: "box", ref: `${f}-board`, parent: f, x: 0, y: 0, w: SW, h: SH, title: "", box: outline({ weight: 0.25, color: fill, fill }), locked: true },
    ...crops(f),
    ...body,
  ];
}
const studio = (id: string, label: string, description: string, notes: string, body: (f: string) => TemplatePiece[], light = false): BoardTemplate =>
  ({ id: `studio-${id}`, group: "Studio", label, description, pieces: board("s", label, notes, body("s"), light) });

const TYPOLOGY_RATINGS = ["System legibility", "Graduated participation", "Multi-scale adaptation", "Interaction geometry", "Movement + gathering"];
const WORKSPACE_RATINGS = ["S *D*", "F+*E*", "W *C*", "R *S*", "S *G*"]; // asterisks mark the accent letter
const studioTemplates: BoardTemplate[] = [
  studio("divider", "Section divider", "Hatched numeral, title band, course line and crosshair rule.", "Open each section with its number and one line on what it covers.", f => [
    { kind: "numeral", parent: f, x: M, y: 210, w: 260, h: 200, text: "01", style: "hatch", ink: WHITE },
    { kind: "box", ref: "band", parent: f, x: 380, y: 250, w: SW - 380 - M, h: 96, title: "", box: outline({ weight: 0.25, color: WHITE, fill: WHITE }) },
    { kind: "text", parent: f, x: 404, y: 266, w: SW - 404 - M - 24, text: "SECTION TITLE", size: "xl", font: "sans", color: "black" },
    cap(f, 380, 370, SW - 380 - M, "COURSE · STUDIO · TERM — WHAT THIS SECTION SHOWS"),
    fline(f, M, 560, SW - M * 2, 0, fine(WHITE, { start: "xnode", end: "xnode", startSize: 10, endSize: 10 })),
    fline(f, SW / 2, 548, 0, 24, fine(WHITE)),
  ]),
  studio("analysis", "Analysis cards", "Two precedent cards: hatched cut-corner frame, [ANALYSIS] tag, name, data and crosshairs.", "One card per precedent: what it is, who made it, where, when and how big.", f => [0, 1].flatMap(i => {
    const x = M + i * 596, w = 540;
    return [
      // Corners and hatch runs differ side by side, like a worn card frame; change them in the line panel.
      { kind: "box", ref: `card${i}`, parent: f, x, y: 50, w, h: 420, title: "", box: outline({ corner: "chamfer", corners: ["cut", "cut", "round", "round"], sides: ["full", "full", "start", "ends"], cut: 44, hatch: 14, weight: 1, fill: "none" }) } as TemplatePiece,
      { kind: "placeholder", parent: f, x: x + 22, y: 72, w: w - 44, h: 376, label: `Precedent ${"AB"[i]} drawing` } as TemplatePiece,
      cap(f, x, 494, 200, "[ANALYSIS]", "s", "grey"),
      words(f, x, 520, 440, "PRECEDENT NAME", "l"),
      // A stack of bars as a mark beside the data, like a barcode.
      ...[44, 30, 52, 22, 40, 34].map((len, k) => fline(f, x, 586 + k * 13, len, 0, fine(WHITE, { weight: 4 }))),
      cap(f, x + 72, 580, 300, "ARCHITECT\nCITY\nYEAR\nAREA sqft"),
      ...cross(f, x + 330, 504), ...cross(f, x + 330, 680),
    ];
  })),
  studio("precedent", "Precedent spread", "Framed panels whose lines of analysis fan into a hero image, with a data block.", "Name the precedent, then say which move you are taking from it.", f => {
    const hero = { x: 640, y: 110, w: SW - 640 - M, h: 450 };
    return [
      title(f, "Precedent — name, architect, year"),
      ...[0, 1, 2].flatMap(i => [
        { kind: "box", ref: `p${i}`, parent: f, x: M, y: 120 + i * 150, w: 300, h: 130, title: "", box: outline() } as TemplatePiece,
        { kind: "placeholder", parent: f, x: M + 8, y: 128 + i * 150, w: 284, h: 114, label: ["Plan", "Section", "Detail"][i] } as TemplatePiece,
        // A bundle of fine lines carries each panel into the hero image.
        ...[-14, 0, 14].map(o => fline(f, M + 300, 185 + i * 150 + o, hero.x - (M + 300), hero.y + hero.h / 2 + o * 2 + (i - 1) * 40 - (185 + i * 150 + o), fine(WHITE, { weight: 0.25 }))),
      ]),
      { kind: "box", ref: "hero", parent: f, ...hero, title: "", box: outline({ corner: "chamfer", cut: 40, hatch: 10, weight: 0.75 }) },
      { kind: "placeholder", parent: f, x: hero.x + 16, y: hero.y + 16, w: hero.w - 32, h: hero.h - 32, label: "Hero image" },
      cap(f, M, 590, 300, "[ANALYSIS]", "s", "light-green"),
      cap(f, M, 618, 520, "PROJECT_\nARCHITECT_\nYEAR_  LOCATION_"),
      cap(f, hero.x, 590, hero.w, "WHAT I AM TAKING FROM IT —"),
    ];
  }),
  studio("cycle", "Process cycle", "Four numbered moves around a signal-green concept callout, on a light board.", "Name each move in one word; the callout says what the sequence adds up to.", f => {
    const iw = 380, ih = 230;
    const spots = [{ x: M, y: 90, label: "01 MASS", lx: M + 180, ly: 36 }, { x: SW - M - iw, y: 90, label: "02 CARVE", lx: SW - M - 200, ly: 36 },
      { x: SW - M - iw, y: 400, label: "03 LEFT OVER", lx: SW - M - 260, ly: 648 }, { x: M, y: 400, label: "04 FRAME", lx: M + 180, ly: 648 }];
    return [
      ...spots.flatMap((s, i) => [
        { kind: "placeholder", parent: f, x: s.x, y: s.y, w: iw, h: ih, label: `Move ${i + 1}` } as TemplatePiece,
        brackets(f, s.x - 10, s.y - 10, iw + 20, ih + 20),
        words(f, s.lx, s.ly, 260, s.label, "l", "red"),
      ]),
      fline(f, M + iw + 30, 205, SW - 2 * (M + iw + 30), 0, flow({ color: RED, start: "dot", startSize: 8, endSize: 8 })),
      fline(f, SW - M - iw / 2, 340, 0, 46, flow({ color: RED, start: "dot", startSize: 8, endSize: 8 })),
      fline(f, SW - M - iw - 30, 515, -(SW - 2 * (M + iw + 30)), 0, flow({ color: RED, start: "dot", startSize: 8, endSize: 8 })),
      { kind: "box", ref: "void", parent: f, x: 470, y: 250, w: 340, h: 230, title: "", box: { weight: 1, pattern: "dashed", color: BLACK, header: 0, corner: "chamfer4", cut: 44, hatch: 0, fill: SIGNAL, shadow: 12 } },
      words(f, 490, 280, 300, "[ CONCEPT ]", "l", "black", "middle"),
      fline(f, 520, 336, 240, 0, fine(BLACK, { weight: 1, pattern: "dashed" })),
      words(f, 500, 352, 280, "What the four moves add up to, in two or three sentences.", "s", "black"),
    ];
  }, true),
  studio("layers", "Exploded layers", "Layers pulled apart with dotted alignment lines and red leader callouts, on a light board.", "One layer per callout: what it is made of and what it does.", f => [
    { kind: "box", ref: "context", parent: f, x: 0, y: 0, w: 300, h: SH, title: "", box: { weight: 0.25, pattern: "solid", color: NAVY, header: 0, corner: "chamfer", cut: 60, hatch: 0, fill: NAVY, shadow: 0 } },
    { kind: "placeholder", parent: f, x: 28, y: 56, w: 244, h: 608, label: "Context image" },
    ...[0, 1, 2].flatMap(i => [
      { kind: "placeholder", parent: f, x: 380 + i * 40, y: 120 + i * 190, w: 320, h: 140, label: `Layer ${3 - i}` } as TemplatePiece,
      words(f, 860, 140 + i * 190, 350, `LAYER ${3 - i}`, "l", "red"),
      fline(f, 860, 190 + i * 190, 350, 0, fine(RED, { weight: 1 })),
      fline(f, 860, 190 + i * 190, -(860 - (710 + i * 40)), 0, flow({ color: RED, weight: 1, radius: 0 })),
      words(f, 860, 200 + i * 190, 350, "What it is made of and what it does.", "s", "black"),
    ]),
    ...[0, 1].flatMap(i => [400, 680].map(x => fline(f, x + i * 40 + 20, 266 + i * 190, 20, 40, fine(BLACK, { weight: 0.75, pattern: "dotted", end: "arrow", endSize: 6 })))),
    words(f, 700, 40, SW - M - 700, "A SYSTEM OF LAYERS", "l", "red", "end"),
    brackets(f, 686, 30, SW - M - 686 + 14, 70),
  ], true),
  studio("process", "Process 01 → 02 → 03", "Three numbered steps with images, captions and dotted-to-solid arrows.", "Walk through how the idea moved from first move to resolved form.", f => {
    const w = 320, xs = [M, (SW - w) / 2, SW - M - w];
    return [
      title(f, "Process"),
      ...xs.flatMap((x, i) => [
        { kind: "numeral", parent: f, x, y: 110, w: 110, h: 80, text: `0${i + 1}`, style: "outline", ink: WHITE } as TemplatePiece,
        { kind: "placeholder", parent: f, x, y: 210, w, h: 300, label: `Step ${i + 1}` } as TemplatePiece,
        cap(f, x, 530, w, ["FIRST MOVE — WHAT STARTED IT", "TESTING — WHAT CHANGED", "RESOLVED — WHAT IT BECAME"][i]),
      ]),
      // Early steps are tentative (dotted); the last step commits (solid).
      fline(f, xs[0] + w + 12, 360, xs[1] - xs[0] - w - 24, 0, flow({ pattern: "dotted" })),
      fline(f, xs[1] + w + 12, 360, xs[2] - xs[1] - w - 24, 0, flow()),
    ];
  }),
  studio("sequence", "Generative sequence", "Descriptors feed a field, then points and radii, then form, joined by signal-green arrows.", "Show how the descriptors generate the drawing, one operation per panel.", f => {
    const w = 300, xs = [M, (SW - w) / 2, SW - M - w];
    return [
      { kind: "box", ref: "src", parent: f, x: M + 20, y: 50, w: 260, h: 96, title: "", box: pill({ corner: "round", cut: 24, hatch: 10 }) },
      words(f, M + 40, 72, 220, "PRECEDENT\nDESCRIPTORS", "m", "white", "middle"),
      fline(f, M + 150, 166, 0, 70, flow({ color: SIGNAL, weight: 2, endSize: 14 })),
      ...xs.flatMap((x, i) => [
        { kind: "placeholder", parent: f, x, y: 260, w, h: w, label: ["Field", "Points + radii", "Form"][i] } as TemplatePiece,
        words(f, x, 580, w, ["WEAVE FIELD", "POINTS +\nRADII", "FORM"][i], "m", "white", "middle"),
      ]),
      ...[0, 1].map(i => fline(f, xs[i] + w + 24, 410, xs[i + 1] - xs[i] - w - 48, 0, flow({ color: SIGNAL, weight: 2, endSize: 14 }))),
    ];
  }),
  studio("workflow", "Workflow strip", "Seven steps in a row under a labelled pill.", "Show the whole method at a glance; point to where you are now.", f => {
    const steps = ["Brief", "Research", "Precedent", "Concept", "Iterate", "Develop", "Present"];
    const gap = 26, w = (SW - M * 2 - gap * 6) / 7;
    return [
      title(f, "How the project was made"),
      { kind: "box", ref: "wf", parent: f, x: (SW - 280) / 2, y: 170, w: 280, h: 56, title: "", body: "WORKFLOW", box: pill() },
      ...steps.flatMap((name, i) => [
        { kind: "box", ref: `w${i}`, parent: f, x: M + i * (w + gap), y: 300, w, h: 200, title: "", body: `${String(i + 1).padStart(2, "0")}\n${name.toUpperCase()}`, box: outline({ color: i === 4 ? SIGNAL : WHITE }) } as TemplatePiece,
        cap(f, M + i * (w + gap), 520, w, "NOTE"),
      ]),
      ...steps.slice(1).map((_, i) => ({ kind: "connect", from: `w${i}`, to: `w${i + 1}`, line: flow({ endSize: 4 }) } as TemplatePiece)),
    ];
  }),
  studio("descriptors", "Descriptor tree", "Hatched pills plug into circled-X nodes that open onto underlined qualities.", "Break the concept into words you can draw; each quality should be testable.", f => {
    const names = ["GEOMETRICAL\n+ FORMAL", "ORGANIZATIONAL\n+ SPATIAL", "ATMOSPHERIC\n+ EXPERIENTIAL"];
    return [
      words(f, M, 50, 300, "DESCRIPTORS", "l"),
      words(f, M, 104, 440, "Essential quality of a space or typology", "s", "grey"),
      brackets(f, M - 12, 40, 460, 100, GREY),
      ...[0, 1, 2].flatMap(i => {
        const c = 230 + i * 190, top = c - 78, bottom = c + 78;
        return [
          { kind: "box", ref: `d${i}`, parent: f, x: 140, y: c - 50, w: 270, h: 100, title: "", box: pill({ corner: "round", cut: 26, hatch: 10 }) } as TemplatePiece,
          words(f, 160, c - 36, 230, names[i], "m", "white", "middle"),
          // Plug and socket, then a run to the node.
          fline(f, 420, c, 34, 0, fine(WHITE, { weight: 0.75, start: "dot", startSize: 9, end: "socket", endSize: 22 })),
          fline(f, 470, c, 190, 0, fine(WHITE, { weight: 0.75, start: "socket", startSize: 12, end: "xnode", endSize: 34 })),
          // A bracket frame around the qualities, with dotted ends.
          fline(f, 677, top, 0, bottom - top, fine(WHITE, { weight: 0.75, start: "dot", end: "dot", startSize: 5, endSize: 5 })),
          fline(f, 677, top, SW - M - 677, 0, fine(WHITE, { weight: 0.75, end: "circle", endSize: 6 })),
          fline(f, 677, bottom, SW - M - 677, 0, fine(WHITE, { weight: 0.75, end: "circle", endSize: 6 })),
          ...[0, 1].flatMap(col => [0, 1, 2].flatMap(r => [
            words(f, 710 + col * 250, top + 18 + r * 40, 230, "Quality", "s"),
            fline(f, 710 + col * 250, top + 48 + r * 40, 190, 0, fine(SIGNAL, { weight: 1.4 })),
          ])),
        ];
      }),
    ];
  }),
  studio("matrix", "Iteration matrix", "A 3 × 9 study grid with registration marks; picks framed in signal green.", "Show the range you tested, then the picks and why they survived.", f => {
    const g = { x: 112, y: 120, w: SW - 112 - M, h: 480 }, cw = g.w / 9, ch = g.h / 3;
    return [
      title(f, "Iterations"),
      { kind: "grid", parent: f, ...g, rows: 3, cols: 9, ink: GREY },
      ...["A", "B", "C"].map((r, i) => cap(f, M, g.y + i * ch + ch / 2 - 12, 30, r, "m")),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => cap(f, g.x + (c - 1) * cw, g.y - 30, cw, String(c).padStart(2, "0"), "s", "grey", "middle")),
      ...[[2, 1], [6, 0], [7, 2]].map(([c, r], i) => ({ kind: "box", ref: `pick${i}`, parent: f, x: g.x + c * cw + 6, y: g.y + r * ch + 6, w: cw - 12, h: ch - 12, title: "", box: { weight: 1, pattern: "dotted", color: SIGNAL, header: 0, corner: "chamfer", cut: 16, hatch: 0, fill: "none" } } as TemplatePiece)),
      cap(f, g.x, g.y + g.h + 24, g.w, "27 ITERATIONS · PICKS FRAMED · WHY THEY SURVIVED —"),
    ];
  }),
  studio("scorecards", "Typology scorecards", "Five dotted signal-green cards, each with a [FORM] tab, a numeral and five ratings.", "Rate each typology against the same five criteria so the choice is visible.", f => {
    const gap = 16, x0 = 76, w = (SW - x0 * 2 - gap * 4) / 5;
    return [
      { kind: "box", ref: "field", parent: f, x: 44, y: 180, w: SW - 88, h: 510, title: "", box: { weight: 1, pattern: "dotted", color: SIGNAL, header: 0, corner: "round", cut: 40, hatch: 0, fill: "none" } },
      words(f, M, 46, 360, "GATHERING", "l", "light-green"),
      words(f, M, 88, 520, "SPACE TYPOLOGIES", "l"),
      words(f, M, 136, 520, "Diagrammatic spatial ideas", "s", "grey"),
      brackets(f, M - 14, 36, 540, 140, GREY),
      ...[0, 1, 2, 3].map(i => ({ kind: "shape", parent: f, x: 640 + i * 34, y: 140, w: 22, h: 22, geo: "ellipse", color: i ? "grey" : "light-green", fill: i ? "semi" : "solid" } as TemplatePiece)),
      words(f, SW - M - 140, 46, 140, "[1.1]", "l", "light-green", "end"),
      ...[0, 1, 2, 3, 4].flatMap(i => {
        const x = x0 + i * (w + gap);
        return [
          { kind: "box", ref: `card${i}`, parent: f, x, y: 220, w, h: 250, title: "", box: { weight: 1, pattern: "dotted", color: SIGNAL, header: 0, corner: "round", cut: 14, hatch: 0, fill: BLACK } } as TemplatePiece,
          cap(f, x + w - 130, 226, 120, "[ FORM ]", "s", "white", "end"),
          { kind: "placeholder", parent: f, x: x + 14, y: 256, w: w - 28, h: 200, label: `Form ${i + 1}` } as TemplatePiece,
          { kind: "box", ref: `score${i}`, parent: f, x, y: 480, w, h: 190, title: "", box: { weight: 0.75, pattern: "solid", color: SIGNAL, header: 0, corner: "round", cut: 12, hatch: 0, fill: BLACK } } as TemplatePiece,
          { kind: "numeral", parent: f, x: x + 10, y: 488, w: 46, h: 36, text: `0${i + 1}`, style: "solid", ink: WHITE } as TemplatePiece,
          ...TYPOLOGY_RATINGS.map((label, r) => ({ kind: "rating", parent: f, x: x + 10, y: 534 + r * 26, w: w - 20, h: 14, label, value: (i + r * 2) % 4 + 2, ink: WHITE } as TemplatePiece)),
        ];
      }),
    ];
  }),
  studio("selection", "Selected + alternatives", "The chosen option in a hatched frame with its ratings; four alternatives in dotted frames.", "Lead with the choice; the alternatives and their ratings show what it beat.", f => [
    { kind: "box", ref: "chosen", parent: f, x: M, y: 70, w: 560, h: 580, title: "", box: outline({ corner: "chamfer", cut: 48, hatch: 12, weight: 0.75, fill: "none" }) },
    { kind: "placeholder", parent: f, x: M + 30, y: 100, w: 500, h: 380, label: "Selected" },
    ...WORKSPACE_RATINGS.map((label, r) => ({ kind: "rating", parent: f, x: M + 30 + (r < 3 ? 0 : 260), y: 500 + (r % 3) * 30, w: 200, h: 16, label, value: [5, 3, 4, 2, 4][r], ink: WHITE } as TemplatePiece)),
    fline(f, M + 290, 600, 240, 0, fine(WHITE, { weight: 1.4 })),
    words(f, M + 290, 560, 240, "WORKSPACE", "m", "light-green", "end"),
    ...[0, 1, 2, 3].flatMap(i => {
      const x = 700 + (i % 2) * 270, y = 50 + Math.floor(i / 2) * 330;
      return [
        { kind: "box", ref: `alt${i}`, parent: f, x, y, w: 240, h: 170, title: "", box: { weight: 0.75, pattern: "dotted", color: WHITE, header: 0, corner: "chamfer4", cut: 28, hatch: 0, fill: "none" } } as TemplatePiece,
        { kind: "placeholder", parent: f, x: x + 24, y: y + 16, w: 192, h: 128, label: `Alt 0${i + 1}` } as TemplatePiece,
        { kind: "numeral", parent: f, x: x - 12, y: y + 140, w: 48, h: 40, text: `0${i + 1}`, style: "solid", ink: WHITE } as TemplatePiece,
        ...WORKSPACE_RATINGS.map((label, r) => ({ kind: "rating", parent: f, x: x + 50, y: y + 190 + r * 22, w: 190, h: 14, label, value: [1, 1, 4, 2, 3][r], ink: WHITE } as TemplatePiece)),
      ];
    }),
  ]),
  studio("compare", "Comparison pair", "Option A against option B, with the same ratings under each.", "Compare like with like: same view, same scale, same criteria.", f => {
    const w = (SW - M * 2 - 60) / 2;
    return [
      title(f, "A / B"),
      ...[0, 1].flatMap(i => {
        const x = M + i * (w + 60);
        return [
          { kind: "numeral", parent: f, x, y: 100, w: 60, h: 70, text: "AB"[i], style: "outline", ink: WHITE } as TemplatePiece,
          { kind: "placeholder", parent: f, x, y: 190, w, h: 340, label: `Option ${"AB"[i]}` } as TemplatePiece,
          ...TYPOLOGY_RATINGS.slice(0, 3).map((label, r) => ({ kind: "rating", parent: f, x, y: 552 + r * 30, w: Math.min(w, 360), h: 18, label, value: i ? 4 - r : 2 + r, ink: WHITE } as TemplatePiece)),
        ];
      }),
      fline(f, SW / 2, 190, 0, 340, fine(GREY, { pattern: "center" })),
    ];
  }),
  studio("concept", "Concept map", "Three linked ideas, from a source idea to a strategy to a building element.", "Read left to right: where the idea comes from, what it does, what it becomes.", f => {
    const w = 320, xs = [M, (SW - w) / 2, SW - M - w];
    const names = ["WEAVING", "FILTER / PERMEABILITY", "SCREENS / FACADE"];
    return [
      title(f, "Concept"),
      ...xs.flatMap((x, i) => [
        { kind: "box", ref: `c${i}`, parent: f, x, y: 120, w, h: 60, title: "", body: names[i], box: pill() } as TemplatePiece,
        { kind: "placeholder", parent: f, x, y: 220, w, h: 280, label: ["Source", "Strategy", "Element"][i] } as TemplatePiece,
        cap(f, x, 520, w, ["WHERE THE IDEA COMES FROM", "WHAT IT DOES", "WHAT IT BECOMES"][i]),
      ]),
      { kind: "connect", from: "c0", to: "c1", line: flow({ start: "dot", startSize: 6 }) },
      { kind: "connect", from: "c1", to: "c2", line: flow({ start: "dot", startSize: 6 }) },
    ];
  }),
  studio("brief", "Project brief", "Type, focus, site and question in mono over an image collage.", "State the brief in the studio's terms before showing any work.", f => [
    title(f, "Brief"),
    cap(f, M, 140, 460, "TYPE_\n\nFOCUS_\n\nSITE_\n\nPROGRAM_\n\nQUESTION_", "m"),
    ...[[600, 110, 380, 260], [880, 220, 330, 230], [640, 400, 300, 220], [930, 470, 280, 170]].map(([x, y, w, h], i) => ({ kind: "placeholder", parent: f, x, y, w, h, label: `Collage ${i + 1}` } as TemplatePiece)),
    fline(f, M, 600, 440, 0, fine(SIGNAL, { weight: 1 })),
  ]),
];

export const TEMPLATES: BoardTemplate[] = [...slideLayouts, ...decks, ...starters, ...diagrams, ...studioTemplates];
export const TEMPLATE_GROUPS = ["Slide layouts", "Decks", "Starter boards", "Diagrams", "Studio"] as const;
/** Templates that add slides: they join the end of the deck instead of landing in view. */
export const isSlideGroup = (group: TemplateGroup) => group === "Slide layouts" || group === "Decks" || group === "Studio";

/** Bounds of a template's top-level pieces (children sit inside their frames). */
export function templateBounds(pieces: TemplatePiece[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pieces) {
    if (p.kind === "connect" || ("parent" in p && p.parent)) continue;
    const w = p.kind === "line" ? p.dx : p.kind === "note" ? 200 : p.w;
    const h = p.kind === "line" ? p.dy : p.kind === "note" ? 200 : p.kind === "text" ? (p.size === "xl" ? 60 : 40) : p.h;
    minX = Math.min(minX, p.x, p.x + w); minY = Math.min(minY, p.y, p.y + h);
    maxX = Math.max(maxX, p.x, p.x + w); maxY = Math.max(maxY, p.y, p.y + h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Where to drop a template: centred on the view, or to the right of existing slides for slide templates. */
export function templateOrigin(bounds: { x: number; y: number; w: number; h: number }, view: { x: number; y: number }, slidesRight?: { x: number; y: number }) {
  if (slidesRight) return { x: Math.round(slidesRight.x - bounds.x), y: Math.round(slidesRight.y - bounds.y) };
  return { x: Math.round(view.x - bounds.w / 2 - bounds.x), y: Math.round(view.y - bounds.h / 2 - bounds.y) };
}

// ---------- Saved templates (the user's own, kept in this browser) ----------
export type SavedTemplate = { id: string; name: string; created: string; content: unknown; count: number };
export const SAVED_KEY = "dws-board-templates";
export const SAVED_LIMIT = 40;
export const SAVED_MAX_BYTES = 400_000;

export function parseSaved(raw: string | null): SavedTemplate[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((t): t is SavedTemplate => !!t && typeof t.id === "string" && typeof t.name === "string" && !!t.content && typeof t.content === "object") : [];
  } catch { return []; }
}

type ContentShape = { id: string; type: string; parentId: string; meta?: Record<string, unknown>; props?: Record<string, unknown> };
type ContentBinding = { fromId: string; toId: string };
/**
 * Keep a template to layout and drawing: research cards and Theme frames point at records that
 * belong to one board, and images are stored as cards, so those (and anything inside them) are left out.
 */
export function stripForTemplate<T extends { shapes: ContentShape[]; bindings?: ContentBinding[]; rootShapeIds: string[]; assets?: unknown[] }>(content: T) {
  const linked = (s: ContentShape) => s.type === "research-record" || s.type === "image" || s.type === "video" || typeof s.meta?.recordKey === "string";
  const dropped = new Set(content.shapes.filter(linked).map(s => s.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of content.shapes) if (!dropped.has(s.id) && dropped.has(s.parentId)) { dropped.add(s.id); grew = true; }
  }
  // Slide order belongs to the board a template came from; inserted frames join the end of the deck.
  const shapes = content.shapes.filter(s => !dropped.has(s.id)).map(s => {
    if (!s.meta || !("slideIndex" in s.meta)) return s;
    const meta = { ...s.meta };
    delete meta.slideIndex;
    return { ...s, meta };
  });
  return {
    content: { ...content, shapes, bindings: (content.bindings ?? []).filter(b => !dropped.has(b.fromId) && !dropped.has(b.toId)), rootShapeIds: content.rootShapeIds.filter(id => !dropped.has(id)), assets: [] },
    kept: shapes.length, left: dropped.size,
  };
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Keep a new template off existing work: if its spot is taken, start it below everything on the board. */
export function clearOrigin(bounds: Rect, origin: { x: number; y: number }, occupied: Rect[], gap = 240) {
  const spot = { x: origin.x + bounds.x, y: origin.y + bounds.y, w: bounds.w, h: bounds.h };
  if (!occupied.some(r => overlaps(spot, r))) return origin;
  const left = Math.min(...occupied.map(r => r.x)), bottom = Math.max(...occupied.map(r => r.y + r.h));
  return { x: Math.round(left - bounds.x), y: Math.round(bottom + gap - bounds.y) };
}

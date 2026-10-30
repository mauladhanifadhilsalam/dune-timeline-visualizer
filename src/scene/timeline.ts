import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Contradiction } from '../data/types';
import { CATEGORY_GLYPH, NOVEL_COLOR, formatRange } from '../timeline/format';
import type { Resolved, ResolvedEra, ResolvedEvent, ResolvedLifeline, ResolvedNovel } from '../timeline/model';
import type { Placement } from '../timeline/placement';
import { assignLanes } from '../timeline/lanes';
import { haloTexture } from './halo';
import { GoldenPath, makeFrame } from './path';
import { Ribbon } from './ribbon';

export interface Layers {
  novels: boolean;
  lifelines: boolean;
  conflicts: boolean;
}

interface Handlers {
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const RADIUS = { 1: 1.0, 2: 1.45, 3: 2.1 } as const;
const HEIGHT = { 1: 6.5, 2: 10, 3: 14.5 } as const;
const MARKER_LATERAL = 4.2;

/** How high over the path an event's light floats. */
export function eventLightHeight(importance: 1 | 2 | 3): number {
  return HEIGHT[importance];
}

/** How high over the path an event's label hangs from: the top of its light. */
export function eventLabelLift(importance: 1 | 2 | 3): number {
  return HEIGHT[importance] + RADIUS[importance] + 0.9;
}

/** How far off an event's name still shows, unless it is the one chosen or hovered. */
export function eventLabelRange(importance: number): number {
  return importance === 3 ? 620 : importance === 2 ? 300 : 165;
}
const NOVEL_LANE0 = 15;
const LANE_STEP = 3.4;
const LANE_LIFT = -7;
/**
 * Lifespans hang under the path as a staff of upright threads, one lane each. That band of the
 * frame is empty ground from either side, and the threads never cross the markers above.
 */
const LIFE_LIFT = -4;
const LIFE_STEP = -1.5;
/** Minimum path share a ribbon gets so one-year spans stay visible. */
const MIN_SPAN_T = 0.005;

type LabelKind = 'event' | 'era' | 'novel' | 'life' | 'conflict' | 'landmark';

interface LabelEntry {
  obj: CSS2DObject;
  el: HTMLElement;
  kind: LabelKind;
  importance: number;
  /** Only shown when hovered/selected or near; checked each frame. */
  enabled: () => boolean;
  eventId?: string;
  w: number;
  h: number;
  shown: boolean;
}

interface Marker {
  ev: ResolvedEvent;
  group: THREE.Group;
  core: THREE.Mesh;
  hit: THREE.Mesh;
  halo: THREE.Sprite;
  side: number;
  t: number;
  tEnd: number;
  span?: Ribbon;
  label: LabelEntry;
  dateEl: HTMLElement;
  visible: boolean;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class TimelineLayer {
  readonly group = new THREE.Group();
  private readonly markers: Marker[] = [];
  private readonly byId = new Map<string, Marker>();
  private readonly labels: LabelEntry[] = [];
  private readonly frame = makeFrame();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly stems: THREE.LineSegments;
  private readonly stemPos: Float32Array;
  private readonly eraGates: { era: ResolvedEra; ring: THREE.Mesh; label: LabelEntry; dateEl: HTMLElement }[] = [];
  private readonly novelRibbons: { novel: ResolvedNovel; ribbon: Ribbon; lane: number; label: LabelEntry }[] = [];
  private readonly lifeRibbons: {
    line: ResolvedLifeline;
    seg: number;
    ribbon: Ribbon;
    lead?: Ribbon;
    lane: number;
    label: LabelEntry;
    dateEl: HTMLElement;
    t0: number;
    t1: number;
    lift: number;
  }[] = [];
  private readonly conflictArcs: {
    c: Contradiction;
    line: THREE.Line;
    positions: Float32Array;
    label: LabelEntry;
  }[] = [];
  private readonly lifeIndex: [number, number][] = [];
  private readonly novelGroup = new THREE.Group();
  private readonly lifeGroup = new THREE.Group();
  private readonly conflictGroup = new THREE.Group();
  private readonly selectRing: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private layers: Layers = { novels: true, lifelines: false, conflicts: true };
  private hovered: string | null = null;
  private selected: string | null = null;
  private placement: Placement | null = null;
  private focusT = 0;
  /** focusT the lifespan labels were last placed for; NaN forces a re-place. */
  private lifeLabelsT = NaN;
  private readonly novelShort: Map<string, string>;
  private frameCount = 0;

  constructor(
    private readonly path: GoldenPath,
    data: Resolved,
    private readonly handlers: Handlers,
  ) {
    this.novelShort = new Map(data.novels.map((n) => [n.id, n.short]));
    this.group.add(this.novelGroup, this.lifeGroup, this.conflictGroup);
    const haloTex = haloTexture();

    // --- event markers -------------------------------------------------------------------
    const solidGeo = new THREE.IcosahedronGeometry(1, 2);
    const wireGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const hitGeo = new THREE.SphereGeometry(1, 8, 6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const sorted = [...data.events].sort((a, b) => a.s - b.s);
    sorted.forEach((ev, i) => {
      const color = new THREE.Color(NOVEL_COLOR[ev.novel]);
      const r = RADIUS[ev.importance];
      const g = new THREE.Group();
      g.name = `event:${ev.id}`;
      // Depicted events are solid; recalled history is a hollow cage around a dim ember.
      let core: THREE.Mesh;
      if (ev.mode === 'depicted') {
        core = new THREE.Mesh(solidGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2) }));
      } else {
        core = new THREE.Mesh(
          wireGeo,
          new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.4), wireframe: true }),
        );
        const ember = new THREE.Mesh(solidGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.9) }));
        ember.scale.setScalar(0.45);
        core.add(ember);
      }
      core.scale.setScalar(r);
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTex,
          color,
          transparent: true,
          opacity: ev.mode === 'depicted' ? 0.42 : 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.scale.setScalar(r * 5);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.scale.setScalar(Math.max(r * 2.4, 3));
      hit.userData.eventId = ev.id;
      g.add(core, halo, hit);
      this.group.add(g);

      const { entry: lbl, dateEl } = this.makeEventLabel(ev);
      const m: Marker = {
        ev,
        group: g,
        core,
        hit,
        halo,
        side: i % 2 === 0 ? 1 : -1,
        t: 0,
        tEnd: 0,
        label: lbl,
        dateEl,
        visible: true,
      };
      lbl.enabled = () => m.visible;
      if (ev.yEnd !== undefined && ev.yEnd > ev.y) {
        const mat = new THREE.MeshBasicMaterial({
          color: color.clone().multiplyScalar(1.1),
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        m.span = new Ribbon(mat, 0.7, 160);
        this.group.add(m.span.mesh);
      }
      this.markers.push(m);
      this.byId.set(ev.id, m);
    });

    // One draw call for every stem joining a marker to the path.
    this.stemPos = new Float32Array(this.markers.length * 6);
    const stemGeo = new THREE.BufferGeometry();
    stemGeo.setAttribute('position', new THREE.BufferAttribute(this.stemPos, 3));
    this.stems = new THREE.LineSegments(
      stemGeo,
      new THREE.LineBasicMaterial({ color: '#f3d9b0', transparent: true, opacity: 0.32, depthWrite: false }),
    );
    this.stems.frustumCulled = false;
    this.group.add(this.stems);

    // --- era gates -------------------------------------------------------------------------
    const ringGeo = new THREE.TorusGeometry(9, 0.13, 8, 72);
    for (const era of data.eras) {
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0.55, depthWrite: false }),
      );
      this.group.add(ring);
      const e = el('div', 'lbl lbl-era');
      const dateEl = el('span', 'lbl-era-date');
      e.append(el('span', 'lbl-era-num', era.numeral), el('span', 'lbl-era-name', era.name), dateEl);
      const label = this.addLabel(e, 'era', 3, () => true, new THREE.Vector2(0.5, 1));
      this.eraGates.push({ era, ring, label, dateEl });
    }

    // --- novels: where each book's narrative sits ----------------------------------------
    // Lanes are decided in story time; overlap is invariant under any monotone time scale.
    const novelLanes = assignLanes(data.novels.map((n) => ({ start: n.s0, end: n.s1 })));
    data.novels.forEach((novel, i) => {
      const color = new THREE.Color(NOVEL_COLOR[novel.id]);
      const ribbon = new Ribbon(
        new THREE.MeshBasicMaterial({
          color: color.multiplyScalar(1.25),
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        2.2,
      );
      this.novelGroup.add(ribbon.mesh);
      const e = el('div', 'lbl lbl-novel');
      e.style.setProperty('--c', NOVEL_COLOR[novel.id]);
      e.append(el('span', 'lbl-novel-title', novel.title), el('span', 'lbl-novel-year', String(novel.published)));
      const label = this.addLabel(e, 'novel', 2, () => this.layers.novels);
      this.novelRibbons.push({ novel, ribbon, lane: novelLanes[i], label });
    });

    // --- lifelines --------------------------------------------------------------------------
    const lifeSpans = data.lifelines.map((l) => ({
      start: Math.min(...l.spans.map((s) => s.s0)),
      end: Math.max(...l.spans.map((s) => s.s1)),
    }));
    const lifeLanes = assignLanes(lifeSpans, 0);
    const lifeMat = new THREE.MeshBasicMaterial({
      color: '#efe2cc',
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const leadMat = lifeMat.clone();
    leadMat.opacity = 0.12;
    data.lifelines.forEach((line, li) => {
      line.spans.forEach((seg, si) => {
        const ribbon = new Ribbon(lifeMat, 0.32, 200, 'upright');
        this.lifeGroup.add(ribbon.mesh);
        let lead: Ribbon | undefined;
        if (seg.openStart) {
          lead = new Ribbon(leadMat, 0.32, 8, 'upright');
          this.lifeGroup.add(lead.mesh);
        }
        const e = el('div', 'lbl lbl-life');
        e.append(el('span', 'lbl-life-name', si === 0 ? line.name : seg.label ?? line.name));
        if (si === 0 && seg.label) e.append(el('span', 'lbl-life-seg', seg.label));
        const dateEl = el('span', 'lbl-life-date');
        e.append(dateEl);
        const label = this.addLabel(e, 'life', 1, () => this.layers.lifelines, new THREE.Vector2(0, 1));
        this.lifeRibbons.push({ line, seg: si, ribbon, lead, lane: lifeLanes[li], label, dateEl, t0: 0, t1: 0, lift: 0 });
        this.lifeIndex.push([li, si]);
      });
    });
    this.lifeGroup.visible = this.layers.lifelines;

    // --- contradictions ----------------------------------------------------------------------
    for (const c of data.contradictions as Contradiction[]) {
      const N = 40;
      const positions = new Float32Array((N + 1) * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineDashedMaterial({ color: '#ff7b7b', dashSize: 1.4, gapSize: 1.0, transparent: true, opacity: 0.9 }),
      );
      line.frustumCulled = false;
      this.conflictGroup.add(line);
      const e = el('div', 'lbl lbl-conflict');
      e.append(el('span', 'lbl-conflict-icon', '⚠'), el('span', 'lbl-conflict-title', c.title));
      e.addEventListener('click', () => handlers.onSelect(c.a));
      const label = this.addLabel(e, 'conflict', 2, () => this.layers.conflicts && this.isVisible(c.a) && this.isVisible(c.b));
      this.conflictArcs.push({ c, line, positions, label });
    }

    // --- selection furniture ---------------------------------------------------------------
    this.selectRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 6, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(2), transparent: true, opacity: 0.9 }),
    );
    this.selectRing.visible = false;
    this.group.add(this.selectRing);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.32, 1, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffd9a0',
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.beam.visible = false;
    this.group.add(this.beam);
    this.setResolved(data);
  }

  /** Refresh everything that prints a year (the reckoning changes them). */
  setResolved(res: Resolved): void {
    for (const m of this.markers) {
      const r = res.byId.get(m.ev.id);
      if (!r) continue;
      m.ev = r;
      m.dateEl.textContent = formatRange(r.y, r.yEnd, r.approx);
    }
    res.eras.forEach((era, i) => {
      const g = this.eraGates[i];
      g.era = era;
      g.dateEl.textContent = formatRange(era.y0, era.y1, era.approx);
    });
    res.novels.forEach((n, i) => (this.novelRibbons[i].novel = n));
    for (const l of this.lifeRibbons) {
      l.line = res.lifelines.find((x) => x.id === l.line.id) ?? l.line;
      const seg = l.line.spans[l.seg];
      l.dateEl.textContent = formatRange(seg.y0, seg.y1, seg.approx);
    }
    // Widths change with the text.
    for (const lbl of this.labels) lbl.w = 0;
  }

  private makeEventLabel(ev: ResolvedEvent): { entry: LabelEntry; dateEl: HTMLElement } {
    const e = el('div', `lbl lbl-event imp-${ev.importance} mode-${ev.mode}`);
    e.style.setProperty('--c', NOVEL_COLOR[ev.novel]);
    const title = el('span', 'lbl-title');
    title.append(el('span', 'lbl-glyph', CATEGORY_GLYPH[ev.category]), document.createTextNode(ev.title));
    const meta = el('span', 'lbl-meta');
    const dateEl = el('span', 'lbl-date');
    // The novel's name rides with the colour, so identity never depends on hue alone.
    meta.append(el('span', 'lbl-novel-tag', this.novelShort.get(ev.novel) ?? ev.novel), dateEl);
    e.append(title, meta);
    e.dataset.eventId = ev.id;
    e.addEventListener('click', (evt) => {
      evt.stopPropagation();
      this.handlers.onSelect(ev.id);
    });
    e.addEventListener('pointerenter', () => this.handlers.onHover(ev.id));
    e.addEventListener('pointerleave', () => this.handlers.onHover(null));
    const entry = this.addLabel(e, 'event', ev.importance, () => true, new THREE.Vector2(0.5, 1));
    entry.eventId = ev.id;
    return { entry, dateEl };
  }

  /**
   * A name for a set piece in the world (the Keep, a heighliner…). It joins the same culling as
   * every other label, so it never piles onto an event's label; the caller positions the object.
   */
  addLandmark(title: string, sub: string | undefined, isOn: () => boolean): CSS2DObject {
    const e = el('div', 'lbl lbl-landmark');
    e.append(el('span', 'lbl-landmark-title', title));
    if (sub) e.append(el('span', 'lbl-landmark-sub', sub));
    return this.addLabel(e, 'landmark', 2, isOn, new THREE.Vector2(0.5, 1)).obj;
  }

  private addLabel(
    e: HTMLElement,
    kind: LabelKind,
    importance: number,
    enabled: () => boolean,
    center = new THREE.Vector2(0.5, 0.5),
  ): LabelEntry {
    const obj = new CSS2DObject(e);
    obj.center.copy(center);
    this.group.add(obj);
    const entry: LabelEntry = { obj, el: e, kind, importance, enabled, w: 0, h: 0, shown: false };
    this.labels.push(entry);
    return entry;
  }

  private isVisible(id: string): boolean {
    return this.byId.get(id)?.visible ?? false;
  }

  private static widen([t0, t1]: [number, number]): [number, number] {
    if (t1 - t0 < MIN_SPAN_T) {
      const mid = (t0 + t1) / 2;
      t0 = Math.max(0, mid - MIN_SPAN_T / 2);
      t1 = Math.min(1, mid + MIN_SPAN_T / 2);
    }
    return [t0, t1];
  }

  // ---------------------------------------------------------------------------------------------

  /** Re-place everything for a (possibly mid-morph) placement. */
  layout(p: Placement): void {
    this.placement = p;
    const f = this.frame;
    this.markers.forEach((m, i) => {
      const pt = p.events.get(m.ev.id)!;
      m.t = pt.t;
      m.tEnd = pt.tEnd;
      this.path.frameAt(m.t, f);
      const base = this.tmp.copy(f.pos).addScaledVector(f.side, MARKER_LATERAL * m.side * 0.35);
      const pos = this.tmp2
        .copy(f.pos)
        .addScaledVector(f.side, MARKER_LATERAL * m.side)
        .addScaledVector(UP, HEIGHT[m.ev.importance] + (i % 3) * 0.9);
      m.group.position.copy(pos);
      m.label.obj.position.copy(pos).addScaledVector(UP, RADIUS[m.ev.importance] + 0.9);
      const o = i * 6;
      if (m.visible) {
        base.toArray(this.stemPos, o);
        this.tmp.copy(pos).addScaledVector(UP, -RADIUS[m.ev.importance]).toArray(this.stemPos, o + 3);
      } else {
        this.stemPos.fill(0, o, o + 6);
      }
      if (m.span) {
        const [a, b] = [m.t, Math.max(m.tEnd, m.t + 0.0005)];
        m.span.update(this.path, a, b, MARKER_LATERAL * m.side * 0.55, 0.9);
      }
    });
    (this.stems.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    this.eraGates.forEach((g, i) => {
      this.path.frameAt(p.eras[i], f);
      g.ring.position.copy(f.pos);
      g.ring.lookAt(this.tmp.copy(f.pos).add(f.tangent));
      g.label.obj.position.copy(f.pos).addScaledVector(UP, 21);
    });

    this.novelRibbons.forEach((n, i) => {
      const [t0, t1] = TimelineLayer.widen(p.novels[i]);
      // Novel strips run on the far side of the path from the camera, so they never block it.
      const lateral = NOVEL_LANE0 + n.lane * LANE_STEP;
      n.ribbon.update(this.path, t0, t1, lateral, LANE_LIFT);
      n.ribbon.pointAt(this.path, t0, t1, 0.5, lateral, LANE_LIFT + 0.6, n.label.obj.position);
    });

    this.lifeRibbons.forEach((l, i) => {
      const li = this.lifeIndex[i];
      const [t0, t1] = TimelineLayer.widen(p.lives[li[0]][li[1]]);
      const lift = LIFE_LIFT + l.lane * LIFE_STEP;
      l.ribbon.update(this.path, t0, t1, 0, lift);
      if (l.lead) l.lead.update(this.path, Math.max(0, t0 - 0.012), t0, 0, lift);
      l.t0 = t0;
      l.t1 = t1;
      l.lift = lift;
      this.placeLifeLabel(l);
    });

    this.layoutConflicts();
    this.placeSelection();
  }

  /**
   * A lifespan can run for thousands of years of path, so its name rides along the ribbon to the
   * point nearest wherever the camera is looking, clamped to the span.
   */
  private placeLifeLabel(l: (typeof this.lifeRibbons)[number]): void {
    const span = l.t1 - l.t0;
    // Cascade lanes along the path so stacked names don't sit on top of each other.
    const t = this.focusT + (l.lane - 2) * 0.0035;
    const a = span > 0 ? Math.min(Math.max((t - l.t0) / span, 0), 1) : 0;
    l.ribbon.pointAt(this.path, l.t0, l.t1, a, 0, l.lift + 0.3, l.label.obj.position);
  }

  private layoutConflicts(): void {
    for (const arc of this.conflictArcs) {
      const a = this.byId.get(arc.c.a);
      const b = this.byId.get(arc.c.b);
      if (!a || !b) continue;
      const pa = a.group.position;
      const pb = b.group.position;
      const mid = this.tmp.copy(pa).add(pb).multiplyScalar(0.5);
      mid.y += 10 + pa.distanceTo(pb) * 0.35;
      const N = arc.positions.length / 3 - 1;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const u = 1 - s;
        arc.positions[i * 3] = u * u * pa.x + 2 * u * s * mid.x + s * s * pb.x;
        arc.positions[i * 3 + 1] = u * u * pa.y + 2 * u * s * mid.y + s * s * pb.y;
        arc.positions[i * 3 + 2] = u * u * pa.z + 2 * u * s * mid.z + s * s * pb.z;
      }
      (arc.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      arc.line.computeLineDistances();
      // Apex of the quadratic is at s = 0.5.
      arc.label.obj.position.set(
        0.25 * pa.x + 0.5 * mid.x + 0.25 * pb.x,
        0.25 * pa.y + 0.5 * mid.y + 0.25 * pb.y + 1,
        0.25 * pa.z + 0.5 * mid.z + 0.25 * pb.z,
      );
      arc.line.visible = this.layers.conflicts && a.visible && b.visible;
    }
  }

  setFilter(predicate: (e: ResolvedEvent) => boolean): void {
    for (const m of this.markers) {
      m.visible = predicate(m.ev);
      m.group.visible = m.visible;
      if (m.span) m.span.mesh.visible = m.visible;
    }
    if (this.placement) this.layout(this.placement);
  }

  setLayers(layers: Layers): void {
    this.layers = { ...layers };
    this.novelGroup.visible = layers.novels;
    this.lifeGroup.visible = layers.lifelines;
    this.conflictGroup.visible = layers.conflicts;
    this.lifeLabelsT = NaN;
    this.layoutConflicts();
  }

  setHovered(id: string | null): void {
    if (id === this.hovered) return;
    const prev = this.hovered ? this.byId.get(this.hovered) : undefined;
    if (prev) prev.label.el.classList.remove('is-hover');
    this.hovered = id;
    const next = id ? this.byId.get(id) : undefined;
    if (next) next.label.el.classList.add('is-hover');
  }

  setSelected(id: string | null): void {
    const prev = this.selected ? this.byId.get(this.selected) : undefined;
    if (prev) prev.label.el.classList.remove('is-selected');
    this.selected = id;
    const next = id ? this.byId.get(id) : undefined;
    if (next) next.label.el.classList.add('is-selected');
    this.placeSelection();
  }

  private placeSelection(): void {
    const m = this.selected ? this.byId.get(this.selected) : undefined;
    this.selectRing.visible = !!m && m.visible;
    this.beam.visible = !!m && m.visible;
    if (!m) return;
    const r = RADIUS[m.ev.importance];
    this.selectRing.position.copy(m.group.position);
    this.selectRing.scale.setScalar(r * 2.1);
    const top = m.group.position.y - r;
    const bottom = -4;
    this.beam.scale.set(1, top - bottom, 1);
    this.beam.position.set(m.group.position.x, (top + bottom) / 2, m.group.position.z);
  }

  pick(raycaster: THREE.Raycaster): string | null {
    const targets = this.markers.filter((m) => m.visible).map((m) => m.hit);
    const hits = raycaster.intersectObjects(targets, false);
    return hits.length ? (hits[0].object.userData.eventId as string) : null;
  }

  eventPosition(id: string, out: THREE.Vector3): THREE.Vector3 | null {
    const m = this.byId.get(id);
    return m ? out.copy(m.group.position) : null;
  }

  eventT(id: string): number | null {
    return this.byId.get(id)?.t ?? null;
  }

  /**
   * Per-frame: animation, plus screen-space label culling so labels never pile up or slide under
   * the UI. `blocked` are screen rects [x0, y0, x1, y1] already taken by panels and bars.
   */
  update(
    camera: THREE.PerspectiveCamera,
    time: number,
    width: number,
    height: number,
    blocked: number[] = [],
    focusT = this.focusT,
  ): void {
    this.focusT = focusT;
    // (NaN never compares greater, hence the negated test.)
    if (this.layers.lifelines && !(Math.abs(focusT - this.lifeLabelsT) <= 1e-5)) {
      this.lifeLabelsT = focusT;
      for (const l of this.lifeRibbons) this.placeLifeLabel(l);
    }
    for (const m of this.markers) {
      if (!m.visible) continue;
      const active = m.ev.id === this.hovered || m.ev.id === this.selected;
      const target = active ? 1.35 : 1;
      const s = m.core.scale.x / RADIUS[m.ev.importance];
      const next = s + (target - s) * 0.2;
      m.core.scale.setScalar(next * RADIUS[m.ev.importance]);
      if (m.ev.mode === 'recalled') m.core.rotation.y = time * 0.25 + m.t * 40;
      m.halo.material.opacity =
        (m.ev.mode === 'depicted' ? 0.4 : 0.26) + (active ? 0.14 : 0) + Math.sin(time * 1.6 + m.t * 300) * 0.05;
    }
    if (this.selectRing.visible) {
      this.selectRing.lookAt(camera.position);
      this.selectRing.rotateZ(time * 0.8);
    }
    for (const arc of this.conflictArcs) {
      (arc.line.material as THREE.LineDashedMaterial & { dashOffset?: number }).dashOffset = -time * 2;
    }
    // Culling is the expensive bit; every other frame is plenty.
    if (this.frameCount++ % 2 === 0) this.cullLabels(camera, width, height, blocked);
  }

  private cullLabels(camera: THREE.PerspectiveCamera, width: number, height: number, blocked: number[]): void {
    const placed: number[] = [...blocked];
    const edge = 6;
    const camPos = camera.position;
    const cands: { l: LabelEntry; pri: number; x: number; y: number }[] = [];
    const v = this.tmp;
    for (const l of this.labels) {
      let want = l.enabled();
      let pri = 0;
      if (want) {
        const d = l.obj.position.distanceTo(camPos);
        const isActive = l.eventId !== undefined && (l.eventId === this.hovered || l.eventId === this.selected);
        const maxD =
          l.kind === 'era'
            ? 2200
            : l.kind === 'event'
              ? eventLabelRange(l.importance)
              : l.kind === 'novel'
                ? 900
                : l.kind === 'conflict'
                  ? 420
                  : l.kind === 'landmark'
                    ? 1300
                    : 240;
        if (!isActive && d > maxD) want = false;
        // Landmarks rank between major and saga-defining events: they name the scene, but an
        // event's own label wins a collision with one.
        const base = l.kind === 'era' ? 4000 : l.kind === 'novel' ? 2500 : l.kind === 'landmark' ? 2200 : l.importance * 900;
        pri = isActive ? 1e6 : base - (l.kind === 'landmark' ? d * 0.6 : d);
      }
      if (!want) {
        this.setShown(l, false);
        continue;
      }
      v.copy(l.obj.position).project(camera);
      if (v.z < -1 || v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) {
        this.setShown(l, false);
        continue;
      }
      cands.push({ l, pri, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height });
    }
    cands.sort((a, b) => b.pri - a.pri);
    const pad = 3;
    for (const c of cands) {
      const l = c.l;
      if (l.w === 0 && l.el.isConnected && l.el.offsetWidth > 0) {
        // Measured once, after the CSS2D renderer has mounted the element.
        l.w = l.el.offsetWidth;
        l.h = l.el.offsetHeight;
      }
      const w = l.w || 130;
      const h = l.h || 30;
      const x0 = c.x - w * l.obj.center.x - pad;
      const y0 = c.y - h * l.obj.center.y - pad;
      const x1 = x0 + w + pad * 2;
      const y1 = y0 + h + pad * 2;
      // Fully on screen, or not at all: a label cut by the viewport edge reads as a glitch.
      let clash = x0 < edge || y0 < edge || x1 > width - edge || y1 > height - edge;
      if (!clash) {
        for (let i = 0; i < placed.length; i += 4) {
          if (x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1]) {
            clash = true;
            break;
          }
        }
      }
      if (clash) {
        this.setShown(l, false);
      } else {
        placed.push(x0, y0, x1, y1);
        this.setShown(l, true);
      }
    }
  }

  private setShown(l: LabelEntry, on: boolean): void {
    if (l.shown === on) return;
    l.shown = on;
    l.el.classList.toggle('on', on);
  }
}

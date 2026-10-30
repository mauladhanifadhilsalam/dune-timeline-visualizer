import * as THREE from 'three';
import { CONTRADICTIONS, ERAS, EVENTS, LIFELINES, NOVELS, UNDATED } from './data';
import type { Category, Certainty, Mode, NovelId, Reckoning } from './data/types';
import { createDesert } from './scene/desert';
import { defaultEye, eventDistance } from './scene/framing';
import { WorldProps } from './scene/props';
import { GoldenPath, createPathMesh, makeFrame, type PathFrame } from './scene/path';
import { TimelineLayer, type Layers } from './scene/timeline';
import { World } from './scene/world';
import { CATEGORY_GLYPH, CATEGORY_LABEL, CERTAINTY_LABEL, MODE_LABEL, NOVEL_COLOR, formatYear } from './timeline/format';
import { resolve, type Resolved, type ResolvedEvent } from './timeline/model';
import { blendPlacement, placementFrom, type Placement } from './timeline/placement';
import { invertScale, type Scale } from './timeline/scale';
import { $, h } from './ui/dom';
import { renderAbout, renderIndex } from './ui/dialogs';
import { PRIMER } from './data/primer';
import { primerSections } from './ui/primer';
import { Panel } from './ui/panel';
import { Scrubber } from './ui/scrubber';
import { Search } from './ui/search';

type ScaleMode = 'story' | 'true';

interface State {
  scale: ScaleMode;
  reckoning: Reckoning;
  layers: Layers;
  glow: boolean;
  novels: Set<NovelId>;
  modes: Set<Mode>;
  certainty: Set<Certainty>;
  categories: Set<Category>;
  selected: string | null;
  hovered: string | null;
  touring: boolean;
}

const INPUT = { eras: ERAS, events: EVENTS, novels: NOVELS, lifelines: LIFELINES, contradictions: CONTRADICTIONS };
const UP = new THREE.Vector3(0, 1, 0);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
/**
 * The camera always watches from the same side of the path (the sunward view, looking into the
 * dusk), so stepping between events tracks along the path instead of swinging across it.
 */
const CAMERA_SIDE = -1;
const coarsePointer = window.matchMedia('(pointer: coarse)');
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Alternating warm tones so era boundaries read on the path without spending a colour channel. */
const ERA_TONES = [new THREE.Color('#ffb04a'), new THREE.Color('#d9772e')];

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function createApp(): void {
  const intro = $('#intro');
  if (!webglAvailable()) {
    const err = $('#intro-error');
    err.textContent =
      'This browser cannot start WebGL, so the 3D path cannot be drawn. The Index below still lists every event.';
    err.hidden = false;
    $('#btn-enter').hidden = true;
  }

  const state: State = {
    scale: 'story',
    reckoning: 'battle',
    layers: { novels: true, lifelines: false, conflicts: true },
    glow: true,
    novels: new Set(NOVELS.map((n) => n.id)),
    modes: new Set<Mode>(['depicted', 'recalled']),
    certainty: new Set<Certainty>(['stated', 'derived', 'reckoned']),
    categories: new Set(Object.keys(CATEGORY_LABEL) as Category[]),
    selected: null,
    hovered: null,
    touring: false,
  };
  let res: Resolved = resolve(INPUT, state.reckoning);

  // ── Dialogs work even without WebGL ─────────────────────────────────────────────────────
  const aboutDlg = $('#about') as HTMLDialogElement;
  const indexDlg = $('#index') as HTMLDialogElement;
  const isVisible = (id: string) => {
    const e = res.byId.get(id);
    return (
      !!e &&
      state.novels.has(e.novel) &&
      state.modes.has(e.mode) &&
      state.certainty.has(e.certainty) &&
      state.categories.has(e.category)
    );
  };
  const openAbout = () => {
    renderAbout(aboutDlg, res, UNDATED, () => aboutDlg.close());
    aboutDlg.showModal();
  };
  // Until the scene exists (or if it never can), picking from the index just closes it.
  let pick: (id: string) => void = () => {};
  const openIndex = () => {
    renderIndex(indexDlg, res, isVisible, (id) => pick(id), () => indexDlg.close());
    indexDlg.showModal();
  };
  for (const dlg of [aboutDlg, indexDlg]) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close(); // backdrop click
    });
  }
  $('#btn-about').addEventListener('click', openAbout);
  $('#btn-index').addEventListener('click', openIndex);

  if (!webglAvailable()) return;

  // ── Scene ─────────────────────────────────────────────────────────────────────────────────
  const world = new World($('#stage'));
  const path = new GoldenPath();
  const pathMesh = createPathMesh(path);
  const desert = createDesert(path);
  // The props need the layer's labels, so they are built once the layer exists (below).
  world.scene.add(desert.group, pathMesh.mesh);
  const layer = new TimelineLayer(path, res, {
    onSelect: (id) => select(id),
    onHover: (id) => setHover(id),
  });
  world.scene.add(layer.group);
  const props = new WorldProps(path, desert, -CAMERA_SIDE, (title, sub, isOn) => layer.addLandmark(title, sub, isOn));
  world.scene.add(props.group);
  // The browser tests' window into the scene: `?e2e` only, nothing else reads it.
  if (new URLSearchParams(location.search).has('e2e')) Object.assign(window, { __goldenPath: { world, props, layer, res } });

  const scaleOf = (r: Resolved, mode: ScaleMode): Scale => (mode === 'story' ? r.narrative : r.linear);
  let current: Placement = placementFrom(res, scaleOf(res, state.scale));
  let morph: { from: Placement; to: Placement; k: number; duration: number; w0: number; w1: number } | null = null;
  /** 1 = story scale, 0 = true scale; set pieces sink away as it falls. */
  let storyWeight = 1;

  // ── UI ────────────────────────────────────────────────────────────────────────────────────
  const panel = new Panel($('#panel'), {
    onClose: () => select(null),
    onSelect: (id) => select(id),
    onResize: () => updateViewOffset(),
  });
  const scrubber = new Scrubber($('#scrubber'), res, {
    onScrub: (t, final) => scrubTo(t, final),
    onSelect: (id) => select(id),
  });
  new Search($('#search') as HTMLInputElement, () => res.events, (id) => select(id));

  function applyPlacement(p: Placement): void {
    current = p;
    layer.layout(p);
    props.layout(p, res);
    scrubber.layout(p, res);
    pathMesh.setBands(p.eras.map((t, i) => ({ t: i === 0 ? 0 : t, color: ERA_TONES[i % 2] })));
  }
  applyPlacement(current);

  function startMorph(): void {
    const to = placementFrom(res, scaleOf(res, state.scale));
    const w1 = state.scale === 'story' ? 1 : 0;
    if (reducedMotion.matches) {
      morph = null;
      storyWeight = w1;
      props.setStoryWeight(w1);
      applyPlacement(to);
      return;
    }
    morph = { from: current, to, k: 0, duration: 1.4, w0: storyWeight, w1 };
  }

  // ── Visible set & navigation ─────────────────────────────────────────────────────────────
  const visibleEvents = (): ResolvedEvent[] => res.events.filter((e) => isVisible(e.id));

  function neighbours(id: string | null): { prev: ResolvedEvent | null; next: ResolvedEvent | null } {
    const list = visibleEvents();
    if (!id) return { prev: null, next: list[0] ?? null };
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) {
      const s = res.byId.get(id)?.s ?? -Infinity;
      const next = list.find((e) => e.s > s) ?? null;
      const prev = [...list].reverse().find((e) => e.s < s) ?? null;
      return { prev, next };
    }
    return { prev: list[i - 1] ?? null, next: list[i + 1] ?? null };
  }

  function applyFilters(): void {
    layer.setFilter((e) => isVisible(e.id));
    scrubber.setVisible(isVisible);
    if (state.selected && !isVisible(state.selected)) select(null);
    renderControls();
  }

  // ── Camera framing ───────────────────────────────────────────────────────────────────────
  const frame = makeFrame();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const localFrame = makeFrame();

  /**
   * The viewer's angle (eye offset in the path's local frame) from before the camera turned round
   * to a scene on its own side of the path; the next event restores it.
   */
  let beforeTurn: Local | null = null;

  function eventPose(id: string): { eye: THREE.Vector3; target: THREE.Vector3 } | null {
    const pos = layer.eventPosition(id, new THREE.Vector3());
    const t = layer.eventT(id);
    const ev = res.byId.get(id);
    if (!pos || t === null || !ev) return null;
    path.frameAt(t, frame);
    const d = eventDistance(ev.importance, world.width / world.height);
    const target = pos.clone().addScaledVector(UP, -1);

    // A scene on the camera's own side of the path: turn round over the path and look back across
    // the event's light at it, low enough that it and the sky above it are in frame. The event
    // stays the focus, so the era and the scrubber do not change.
    const scene = props.turnTarget(id);
    if (scene) {
      if (!beforeTurn) {
        path.frameAt(path.nearestT(world.controls.target), localFrame);
        beforeTurn = toLocal(tmpA.copy(world.camera.position).sub(world.controls.target), localFrame);
      }
      const away = tmpB.copy(target).sub(scene).setY(0).normalize();
      const eye = target.clone().addScaledVector(away, d * 1.3).addScaledVector(UP, d * 0.28);
      return { eye, target };
    }
    // Leaving such a scene: back to the angle from before the turn. If that was from far off (the
    // scene was picked from the overview), the default framing instead: restoring it would lift
    // the camera straight back out, and keeping the turned angle would leave it facing backwards.
    let turned = false;
    if (beforeTurn) {
      const back = fromLocal(beforeTurn, frame, tmpA);
      beforeTurn = null;
      if (back.length() < d * 2.6) return { eye: target.clone().add(back), target };
      turned = true;
    }

    // Keep the viewer's own angle: express the current eye offset in the path's local frame
    // (across, up, along) and carry it to the new spot. Only fall back to the default framing
    // from far away (the overview) or from an extreme angle.
    const offset = tmpA.copy(world.camera.position).sub(world.controls.target);
    const dist = offset.length();
    if (!turned && dist > d * 0.45 && dist < d * 2.6) {
      path.frameAt(path.nearestT(world.controls.target), localFrame);
      const across = offset.dot(localFrame.side);
      const along = offset.dot(localFrame.tangent);
      const up = Math.max(offset.y, d * 0.12);
      const eye = target
        .clone()
        .addScaledVector(frame.side, across)
        .addScaledVector(UP, up)
        .addScaledVector(frame.tangent, along);
      return { eye, target };
    }
    const eye = defaultEye(target, tmpB.copy(frame.side).multiplyScalar(CAMERA_SIDE), frame.tangent, d);
    return { eye, target };
  }

  // ── Riding the thread ─────────────────────────────────────────────────────────────────
  // Positions relative to the path are kept as (across, up, along) in its local frame, so a
  // camera carried from one moment to another turns with every bend of the path.
  type Local = [number, number, number];
  const horizontal = (f: PathFrame) => new THREE.Vector3(f.tangent.x, 0, f.tangent.z).normalize();
  const toLocal = (v: THREE.Vector3, f: PathFrame): Local => [v.dot(f.side), v.y, v.dot(horizontal(f))];
  const fromLocal = (l: Local, f: PathFrame, out: THREE.Vector3) =>
    out
      .copy(f.side)
      .multiplyScalar(l[0])
      .addScaledVector(UP, l[1])
      .addScaledVector(horizontal(f), l[2]);
  const lerpLocal = (a: Local, b: Local, k: number): Local => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  /**
   * Blend two views (eye offsets from the target) as an orbit: bearing round the target, distance
   * and height each eased on their own. For two views at one bearing this is the same as a straight
   * blend; for a turn it swings round the target instead of cutting through it.
   */
  const lerpView = (a: Local, b: Local, k: number): Local => {
    const ra = Math.hypot(a[0], a[2]);
    const rb = Math.hypot(b[0], b[2]);
    const aa = Math.atan2(a[2], a[0]);
    let db = Math.atan2(b[2], b[0]) - aa;
    db = Math.atan2(Math.sin(db), Math.cos(db)); // the short way round
    const r = ra + (rb - ra) * k;
    const bearing = aa + db * k;
    return [Math.cos(bearing) * r, a[1] + (b[1] - a[1]) * k, Math.sin(bearing) * r];
  };

  /**
   * Travel along the golden path to moment t1, ending at the given target and eye. The camera
   * rides beside the thread at the same angle it had, through every bend in between, rather than
   * cutting across. Pace follows how much timeline lies between: a step to a neighbour takes
   * about two seconds, a jump across eras up to six, pulling back a little at speed so the ground
   * going by stays readable.
   */
  function rideTo(t1: number, endTarget: THREE.Vector3, endEye: THREE.Vector3, done?: () => void): void {
    if (reducedMotion.matches) {
      world.flyTo(endEye, endTarget, 0, done);
      return;
    }
    const eye0 = world.camera.position.clone();
    const target0 = world.controls.target.clone();
    // From high above (the overview) there is no thread to ride yet: glide straight down to it.
    if (eye0.distanceTo(target0) > 300) {
      world.flyTo(endEye, endTarget, 2.4, done);
      return;
    }
    const t0 = path.nearestT(target0);
    const f0 = path.frameAt(t0, makeFrame());
    const f1 = path.frameAt(t1, makeFrame());
    const aim0 = toLocal(target0.clone().sub(f0.pos), f0);
    const aim1 = toLocal(endTarget.clone().sub(f1.pos), f1);
    const view0 = toLocal(eye0.clone().sub(target0), f0);
    const view1 = toLocal(endEye.clone().sub(endTarget), f1);
    const distance = Math.abs(t1 - t0) * path.length;
    const duration = THREE.MathUtils.clamp(1.6 + distance / 320, 1.8, 6);
    const pullBack = Math.min(distance / 1400, 1) * 0.55;
    const f = makeFrame();
    const off = new THREE.Vector3();
    world.flyAlong(
      (k, eye, target) => {
        path.frameAt(t0 + (t1 - t0) * k, f);
        fromLocal(lerpLocal(aim0, aim1, k), f, target).add(f.pos);
        const view = lerpView(view0, view1, k);
        const s = 1 + pullBack * Math.sin(Math.PI * k);
        eye.copy(target).add(fromLocal([view[0] * s, view[1] * s, view[2] * s], f, off));
      },
      duration,
      done,
    );
  }

  function flyToEvent(id: string, done?: () => void): void {
    const pose = eventPose(id);
    const t = layer.eventT(id);
    if (!pose || t === null) return;
    rideTo(t, pose.target, pose.eye, done);
  }

  function overviewPose(): { eye: THREE.Vector3; target: THREE.Vector3 } {
    const portrait = world.width / world.height < 1;
    return portrait
      ? { eye: new THREE.Vector3(-2150, 1550, 300), target: new THREE.Vector3(80, 0, 0) }
      : { eye: new THREE.Vector3(0, 1250, 1600), target: new THREE.Vector3(0, 0, 40) };
  }

  function overview(): void {
    stopTour();
    const p = overviewPose();
    world.flyTo(p.eye, p.target, reducedMotion.matches ? 0 : 1.8);
  }

  function scrubTo(t: number, final: boolean): void {
    stopTour();
    path.frameAt(t, frame);
    const target = frame.pos;
    const offset = tmpA.copy(world.camera.position).sub(world.controls.target);
    // From far away, drop to a travelling height so scrubbing feels like walking the path.
    if (offset.length() > 260) {
      offset
        .copy(frame.side)
        .multiplyScalar(CAMERA_SIDE * 74)
        .addScaledVector(UP, 34)
        .addScaledVector(frame.tangent, -16);
      world.flyTo(tmpB.copy(target).add(offset), target, reducedMotion.matches ? 0 : 1.1);
      return;
    }
    if (final && !scrubber.isDragging && world.controls.target.distanceTo(target) > 40) {
      rideTo(t, target.clone(), target.clone().add(offset));
    } else {
      world.translate(tmpB.copy(target).sub(world.controls.target));
    }
  }

  // ── Selection & hover ────────────────────────────────────────────────────────────────────
  function select(id: string | null, opts: { fly?: boolean; done?: () => void } = {}): void {
    const { fly = true, done } = opts;
    if (id && !res.byId.has(id)) id = null;
    if (id && !isVisible(id)) {
      // Picked from search/index while filtered out: reveal rather than refuse.
      const e = res.byId.get(id)!;
      state.novels.add(e.novel);
      state.modes.add(e.mode);
      state.certainty.add(e.certainty);
      state.categories.add(e.category);
      applyFilters();
    }
    state.selected = id;
    layer.setSelected(id);
    scrubber.setSelected(id);
    if (id) {
      renderPanel();
      if (fly) flyToEvent(id, done);
      history.replaceState(null, '', `#${id}`);
    } else {
      panel.close();
      history.replaceState(null, '', location.pathname + location.search);
    }
    updateViewOffset();
  }

  function renderPanel(): void {
    if (!state.selected) return;
    const ev = res.byId.get(state.selected);
    if (!ev) return;
    const { prev, next } = neighbours(ev.id);
    panel.render(ev, res, prev, next);
  }

  function setHover(id: string | null): void {
    state.hovered = id;
    layer.setHovered(id);
    world.renderer.domElement.style.cursor = id ? 'pointer' : '';
  }

  /** Centre the focused object in the part of the screen the panel and top bar leave free. */
  function updateViewOffset(): void {
    const snap = reducedMotion.matches;
    if (!panel.isOpen) {
      world.setViewOffset(0, 0, snap);
      return;
    }
    const stage = world.renderer.domElement.getBoundingClientRect();
    const p = $('#panel').getBoundingClientRect();
    const top = $('.topbar').getBoundingClientRect().bottom - stage.top;
    if (p.top - stage.top > top + 40 && p.left - stage.left < 40) {
      // Bottom sheet: free band between the top bar and the sheet.
      const free = (top + (p.top - stage.top)) / 2;
      world.setViewOffset(0, world.height / 2 - free, snap);
    } else {
      const free = (p.left - stage.left) / 2;
      world.setViewOffset(world.width / 2 - free, 0, snap);
    }
  }
  new ResizeObserver(updateViewOffset).observe($('#panel'));
  window.addEventListener('resize', updateViewOffset);

  // ── Tour ────────────────────────────────────────────────────────────────────────────────
  /**
   * When the tour moves on, in the scene's own time (the frame loop's `elapsed`), not the wall
   * clock: on a slow device the scenes run slower too, and a timer would leave a battle halfway.
   */
  let tourAt: number | null = null;
  /** How long the tour stays at the current stop, which the Tour button's ring counts down. */
  let tourStay = 1;
  let tourShown = -1;
  /** Whether the hint is saying what the tour waits for, so moving on takes it away. */
  let holding = false;
  const tourBtn = $('#btn-tour');
  /** The era a tour begins in when no moment is chosen: The Coming of Muad'Dib, Dune's own. */
  const TOUR_FROM = 'muaddib';
  function startTour(): void {
    state.touring = true;
    tourBtn.setAttribute('aria-pressed', 'true');
    tourStep();
  }
  function stopTour(): void {
    if (!state.touring) return;
    state.touring = false;
    tourAt = null;
    tourBtn.setAttribute('aria-pressed', 'false');
    tourProgress(0);
    endHold();
  }
  function tourStep(): void {
    if (!state.touring) return;
    tourProgress(0);
    endHold();
    const list = visibleEvents().filter((e) => e.importance >= 2);
    const cur = state.selected ? res.byId.get(state.selected) : null;
    // From a chosen moment, on from there; from nothing, from the start of Dune: the history before
    // it is there to explore, but a tour that opens with ten thousand years of it loses newcomers.
    const next = cur
      ? list.find((e) => e.s > cur.s)
      : (list.find((e) => res.eras[e.eraIndex]?.id === TOUR_FROM) ?? list[0]);
    if (!next) {
      stopTour();
      return;
    }
    select(next.id, {
      done: () => {
        if (!state.touring) return;
        // Long enough to read the card, or for the event's scene to play through, whichever is
        // longer; a scene that holds the tour says so, or the wait looks like the tour has stalled.
        const hold = props.tourHold(next.id);
        tourStay = Math.max(reducedMotion.matches ? 9 : 6.5, hold?.seconds ?? 0);
        tourAt = elapsed + tourStay;
        if (hold) {
          showHint(`The tour stays here ${hold.what}.`);
          holding = true;
        }
      },
    });
  }
  /** Fill the ring round the Tour button, 0..1, as the stay at the current stop runs out. */
  function tourProgress(k: number): void {
    const q = Math.round(k * 200) / 200;
    if (q === tourShown) return;
    tourShown = q;
    tourBtn.style.setProperty('--tour-progress', String(q));
  }
  function endHold(): void {
    if (!holding) return;
    holding = false;
    hideHint();
  }
  tourBtn.addEventListener('click', () => (state.touring ? stopTour() : startTour()));
  world.onUserInteract = () => stopTour();

  // ── Controls: segmented toggles and the View popover ────────────────────────────────────
  const viewPop = $('#view-pop');
  const viewBtn = $('#btn-view');

  function setScale(mode: ScaleMode): void {
    if (state.scale === mode) return;
    state.scale = mode;
    startMorph();
    renderControls();
    if (mode === 'true') {
      const novels = res.novels.reduce((sum, n) => sum + (n.s1 - n.s0), 0) / (res.max - res.min);
      flashHint(
        `True scale: all six novels' stories together cover ${(novels * 100).toFixed(2)}% of this path. The rest is history Herbert summarises or skips.`,
        6000,
      );
    }
  }
  function setReckoning(r: Reckoning): void {
    if (state.reckoning === r) return;
    state.reckoning = r;
    res = resolve(INPUT, r);
    layer.setResolved(res);
    startMorph();
    renderPanel();
    renderControls();
    flashHint(
      r === 'almanak'
        ? 'Counting from the Almanak’s 10196 regency: every derived date after it moves three years later.'
        : 'Counting from the Battle of Arrakeen, 10193.',
    );
  }

  const chip = (label: string, on: boolean, toggle: () => void, color?: string, title?: string) =>
    h(
      'button',
      {
        type: 'button',
        class: `chip-toggle${color ? ' has-swatch' : ''}`,
        'aria-pressed': String(on),
        style: color ? `--c:${color}` : null,
        title: title ?? null,
        onclick: toggle,
      },
      color ? h('span', { class: 'swatch' }) : null,
      label,
    );

  function toggleIn<T>(set: Set<T>, v: T): void {
    if (set.has(v)) {
      if (set.size > 1) set.delete(v);
    } else set.add(v);
    applyFilters();
  }

  function renderViewPop(): void {
    const seg = (label: string, on: boolean, fn: () => void, title?: string) =>
      h('button', { type: 'button', 'aria-pressed': String(on), onclick: fn, title: title ?? null }, label);
    viewPop.replaceChildren(
      h(
        'section',
        null,
        h('h4', null, 'Time scale'),
        h(
          'div',
          { class: 'seg' },
          seg('Story scale', state.scale === 'story', () => setScale('story')),
          seg('True scale', state.scale === 'true', () => setScale('true')),
        ),
      ),
      h(
        'section',
        null,
        h('h4', null, "Count Paul's reign from"),
        h(
          'div',
          { class: 'seg' },
          seg('The battle · 10193', state.reckoning === 'battle', () => setReckoning('battle')),
          seg('The Almanak · 10196', state.reckoning === 'almanak', () => setReckoning('almanak')),
        ),
        h('p', { class: 'pop-hint' }, 'Herbert gives both. Every later derived date follows this choice.'),
      ),
      h(
        'section',
        null,
        h('h4', null, 'Layers'),
        h(
          'div',
          { class: 'chips' },
          chip('Novels', state.layers.novels, () => setLayer('novels')),
          chip('Lifespans', state.layers.lifelines, () => setLayer('lifelines')),
          chip('Contradictions', state.layers.conflicts, () => setLayer('conflicts')),
          chip('Glow', state.glow, () => {
            state.glow = !state.glow;
            world.setBloom(state.glow);
            renderControls();
          }),
        ),
      ),
      h(
        'section',
        null,
        h('h4', null, 'Novels'),
        h(
          'div',
          { class: 'chips' },
          ...NOVELS.map((n) =>
            chip(n.short, state.novels.has(n.id), () => toggleIn(state.novels, n.id), NOVEL_COLOR[n.id], `${n.title} (${n.published})`),
          ),
        ),
      ),
      h(
        'section',
        null,
        h('h4', null, 'Source'),
        h(
          'div',
          { class: 'chips' },
          ...(['depicted', 'recalled'] as Mode[]).map((m) => chip(MODE_LABEL[m], state.modes.has(m), () => toggleIn(state.modes, m))),
        ),
      ),
      h(
        'section',
        null,
        h('h4', null, 'How sure the date is'),
        h(
          'div',
          { class: 'chips' },
          ...(['stated', 'derived', 'reckoned'] as Certainty[]).map((c) =>
            chip(CERTAINTY_LABEL[c], state.certainty.has(c), () => toggleIn(state.certainty, c)),
          ),
        ),
      ),
      h(
        'section',
        null,
        h('h4', null, 'Kind'),
        h(
          'div',
          { class: 'chips' },
          ...(Object.keys(CATEGORY_LABEL) as Category[]).map((c) =>
            chip(`${CATEGORY_GLYPH[c]} ${CATEGORY_LABEL[c]}`, state.categories.has(c), () => toggleIn(state.categories, c)),
          ),
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          onclick: () => {
            NOVELS.forEach((n) => state.novels.add(n.id));
            state.modes = new Set<Mode>(['depicted', 'recalled']);
            state.certainty = new Set<Certainty>(['stated', 'derived', 'reckoned']);
            state.categories = new Set(Object.keys(CATEGORY_LABEL) as Category[]);
            applyFilters();
          },
        },
        'Show everything',
      ),
    );
  }

  function setLayer(k: keyof Layers): void {
    state.layers = { ...state.layers, [k]: !state.layers[k] };
    layer.setLayers(state.layers);
    renderControls();
  }

  function renderControls(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.scale === state.scale)),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-reckoning]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.reckoning === state.reckoning)),
    );
    if (!viewPop.hidden) renderViewPop();
  }
  document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) =>
    b.addEventListener('click', () => setScale(b.dataset.scale as ScaleMode)),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-reckoning]').forEach((b) =>
    b.addEventListener('click', () => setReckoning(b.dataset.reckoning as Reckoning)),
  );
  const setPop = (open: boolean) => {
    viewPop.hidden = !open;
    viewBtn.setAttribute('aria-expanded', String(open));
    if (open) renderViewPop();
  };
  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setPop(viewPop.hidden);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!viewPop.hidden && !viewPop.contains(e.target as Node) && e.target !== viewBtn) setPop(false);
  });
  $('#btn-overview').addEventListener('click', overview);
  renderControls();
  layer.setLayers(state.layers);

  // ── Hint toast ───────────────────────────────────────────────────────────────────────────
  const hint = $('#hint');
  let hintTimer = 0;
  // The hint is a status line screen readers follow, so it stays in the page and only fades; its
  // text is cleared once it has faded, so it is not read out again.
  function showHint(text: string): void {
    window.clearTimeout(hintTimer);
    hint.textContent = text;
    hint.classList.add('on');
  }
  function hideHint(): void {
    window.clearTimeout(hintTimer);
    hint.classList.remove('on');
    hintTimer = window.setTimeout(() => (hint.textContent = ''), 400);
  }
  function flashHint(text: string, ms = 4200): void {
    showHint(text);
    hintTimer = window.setTimeout(hideHint, ms);
  }

  // ── Pointer picking ──────────────────────────────────────────────────────────────────────
  const canvas = world.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointerDirty = false;
  let pointerInside = false;
  let down: { x: number; y: number; t: number } | null = null;
  const setNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const pickAt = (): string | null => {
    raycaster.setFromCamera(ndc, world.camera);
    return layer.pick(raycaster);
  };
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    setNdc(e);
    pointerInside = true;
    pointerDirty = true;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    if (state.hovered) setHover(null);
  });
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 6 || !quick) return;
    setNdc(e);
    const id = pickAt();
    if (id) select(id);
  });

  // ── Keyboard ────────────────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (aboutDlg.open || indexDlg.open) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Nothing to step through or tour until the desert is entered.
    if (!entered) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (t.closest('.scrub-track')) return;
        e.preventDefault();
        stopTour();
        const { prev, next } = neighbours(state.selected);
        const target = e.key === 'ArrowRight' ? next : prev;
        if (target) select(target.id);
        break;
      }
      case ' ':
        if (t.closest('button')) return;
        e.preventDefault();
        if (state.touring) stopTour();
        else startTour();
        break;
      case 'Escape':
        if (!viewPop.hidden) setPop(false);
        else if (state.selected) select(null);
        stopTour();
        break;
      case '/':
        e.preventDefault();
        ($('#search') as HTMLInputElement).focus();
        break;
      case 'o':
      case 'O':
        overview();
        break;
      case 't':
      case 'T':
        setScale(state.scale === 'story' ? 'true' : 'story');
        break;
      case 'r':
      case 'R':
        setReckoning(state.reckoning === 'battle' ? 'almanak' : 'battle');
        break;
    }
  });

  pick = (id) => select(id);

  // ── Intro ───────────────────────────────────────────────────────────────────────────────
  const initial = location.hash.slice(1);
  const start = overviewPose();
  world.camera.position.copy(start.eye);
  world.controls.target.copy(start.target);
  world.controls.autoRotate = !reducedMotion.matches;
  world.controls.autoRotateSpeed = 0.25;
  // The scene's names would show through the title card and over its text: they wait until the
  // desert is entered.
  const labels = world.labelRenderer.domElement;
  labels.classList.add('is-muted');

  /** Where the desert opens when no link names a moment: the birth of Paul Atreides. */
  const START = 'paul-born';
  let entered = false;

  // The intro's second step: the world in brief for a newcomer, then a choice of how to go in.
  const titleCard = $('#intro-title-card');
  const primerCard = $('#intro-primer');
  $('#primer-body').replaceChildren(
    h('p', { class: 'intro-kicker' }, PRIMER.kicker),
    h('h2', { class: 'primer-title', id: 'primer-title' }, PRIMER.title),
    ...primerSections(),
  );
  function showPrimer(): void {
    titleCard.hidden = true;
    primerCard.hidden = false;
    $('#btn-start-tour').focus();
  }

  /**
   * Into the desert: at the moment a link names, on the guided tour from the beginning, or (by
   * default) at Paul's birth to explore from there.
   */
  function enter(choice: { at?: string; tour?: boolean } = {}): void {
    if (entered) return;
    entered = true;
    // Focus would stay on the intro's button, now hidden, and the keyboard shortcuts ignore keys
    // aimed at buttons: Space would do nothing.
    if (intro.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    labels.classList.remove('is-muted');
    intro.classList.add('is-gone');
    window.setTimeout(() => (intro.hidden = true), 700);
    world.controls.autoRotate = false;
    const hint = () =>
      flashHint(
        coarsePointer.matches
          ? 'Tap any light, or ▶ for a guided tour.'
          : 'Click any light, press → to step through time, or Space for a guided tour.',
        6500,
      );
    if (choice.at && res.byId.has(choice.at)) select(choice.at);
    else if (choice.tour) {
      startTour();
      flashHint(coarsePointer.matches ? 'Tap anywhere to stop the tour.' : 'Click, drag or press Space to stop the tour.', 5000);
    } else if (res.byId.has(START)) select(START, { done: hint });
    else hint();
  }
  $('#btn-enter').addEventListener('click', showPrimer);
  $('#btn-start-tour').addEventListener('click', () => enter({ tour: true }));
  $('#btn-explore').addEventListener('click', () => enter());
  if (initial && res.byId.has(initial)) enter({ at: initial }); // deep links skip the intro
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== state.selected && res.byId.has(id)) {
      if (!entered) enter({ at: id });
      else select(id);
    }
  });

  // Screen areas labels must stay out of: anything opaque the user reads.
  const blockers = ['.topbar .brand', '.search', '.controls', '#panel', '#scrubber', '#view-pop', '#hint'].map((sel) =>
    $(sel),
  );
  const stageRect = () => world.renderer.domElement.getBoundingClientRect();
  function blockedRects(): number[] {
    const out: number[] = [];
    const o = stageRect();
    for (const el of blockers) {
      if (el.hidden || el.offsetParent === null || (el.id === 'hint' && !el.classList.contains('on'))) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) out.push(r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top);
    }
    return out;
  }

  // ── Loop ────────────────────────────────────────────────────────────────────────────────
  let last = performance.now();
  let elapsed = 0;
  const followPrev = new THREE.Vector3();
  const followNext = new THREE.Vector3();

  const syncMotion = () => {
    pathMesh.setFlow(!reducedMotion.matches);
    desert.setWind(!reducedMotion.matches);
  };
  syncMotion();
  reducedMotion.addEventListener('change', syncMotion);

  function frameLoop(): void {
    // performance.now() rather than the rAF timestamp: identical in browsers, and it lets a test
    // harness with a fake clock drive the animation deterministically.
    const now = performance.now();
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    elapsed += dt;
    if (state.touring && tourAt !== null && elapsed >= tourAt) {
      tourAt = null;
      tourStep();
    }
    if (state.touring && tourAt !== null) tourProgress(1 - Math.max(tourAt - elapsed, 0) / tourStay);

    if (morph) {
      // Keep the selected marker in frame while everything slides.
      const sel = state.selected;
      const had = sel ? layer.eventPosition(sel, followPrev) : null;
      morph.k = Math.min(morph.k + dt / morph.duration, 1);
      const e = easeInOut(morph.k);
      storyWeight = morph.w0 + (morph.w1 - morph.w0) * e;
      props.setStoryWeight(storyWeight);
      applyPlacement(blendPlacement(morph.from, morph.to, e));
      if (morph.k >= 1) morph = null;
      if (sel && had && layer.eventPosition(sel, followNext) && !world.isFlying()) {
        world.translate(followNext.sub(followPrev));
      }
    }

    world.update(dt);

    if (pointerDirty && pointerInside && !world.isFlying()) {
      pointerDirty = false;
      const id = pickAt();
      if (id !== state.hovered) setHover(id);
    }

    const t = path.nearestT(world.controls.target);
    layer.update(world.camera, elapsed, world.width, world.height, blockedRects(), t);
    props.update(elapsed, dt, t, world.height, world.pixelRatio, !world.isFlying());
    pathMesh.tick(elapsed);
    desert.tick(elapsed, world.controls.target, world.camera.position, world.pixelRatio);

    const scale = scaleOf(res, state.scale);
    const s = invertScale(scale, t, res.min, res.max);
    const era = res.eras.find((e) => s >= e.s0 && s < e.s1) ?? res.eras[res.eras.length - 1];
    scrubber.setHead(t, `≈ ${formatYear(Math.floor(s))} · ${era.numeral} · ${era.name}`);

    world.render();
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);
}

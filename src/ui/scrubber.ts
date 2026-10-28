import type { Resolved } from '../timeline/model';
import type { Placement } from '../timeline/placement';
import { NOVEL_COLOR } from '../timeline/format';
import { h } from './dom';

export interface ScrubberHandlers {
  /** t in [0, 1]; `final` on release. */
  onScrub: (t: number, final: boolean) => void;
  onSelect: (id: string) => void;
}

const pct = (t: number) => `${(t * 100).toFixed(3)}%`;

/** A flat minimap of the whole path: eras, novels, every event, and where the camera is. */
export class Scrubber {
  private readonly track: HTMLElement;
  private readonly head: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly eraEls: HTMLElement[] = [];
  private readonly novelEls: HTMLElement[] = [];
  private readonly ticks = new Map<string, HTMLElement>();
  private headT = 0;
  private dragging = false;

  constructor(
    root: HTMLElement,
    res: Resolved,
    handlers: ScrubberHandlers,
  ) {
    const eras = h('div', { class: 'scrub-eras' });
    res.eras.forEach((era, i) => {
      const e = h(
        'div',
        { class: `scrub-era ${i % 2 ? 'odd' : 'even'}`, title: era.name },
        h('span', { class: 'scrub-era-num' }, era.numeral),
        h('span', { class: 'scrub-era-name' }, era.name),
      );
      this.eraEls.push(e);
      eras.append(e);
    });
    const novels = h('div', { class: 'scrub-novels', 'aria-hidden': 'true' });
    for (const n of res.novels) {
      const e = h('div', { class: 'scrub-novel', style: `--c:${NOVEL_COLOR[n.id]}`, title: n.title });
      this.novelEls.push(e);
      novels.append(e);
    }
    const ticks = h('div', { class: 'scrub-ticks' });
    for (const ev of res.events) {
      const t = h('button', {
        class: `scrub-tick imp-${ev.importance}`,
        style: `--c:${NOVEL_COLOR[ev.novel]}`,
        title: ev.title,
        tabindex: -1,
        'aria-label': ev.title,
      });
      t.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        handlers.onSelect(ev.id);
      });
      this.ticks.set(ev.id, t);
      ticks.append(t);
    }
    this.head = h('div', { class: 'scrub-head', 'aria-hidden': 'true' });
    this.track = h(
      'div',
      {
        class: 'scrub-track',
        role: 'slider',
        tabindex: 0,
        'aria-label': 'Position on the timeline',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      },
      eras,
      novels,
      ticks,
      this.head,
    );
    this.readout = h('div', { class: 'scrub-readout', 'aria-live': 'off' });
    root.replaceChildren(this.track, this.readout);

    this.track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.track.setPointerCapture(e.pointerId);
      this.track.classList.add('is-dragging');
      handlers.onScrub(this.tFromEvent(e), false);
    });
    this.track.addEventListener('pointermove', (e) => {
      if (this.dragging) handlers.onScrub(this.tFromEvent(e), false);
    });
    const end = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.track.classList.remove('is-dragging');
      handlers.onScrub(this.tFromEvent(e), true);
    };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);
    this.track.addEventListener('keydown', (e) => {
      const step = e.key === 'PageUp' || e.key === 'PageDown' ? 0.08 : 0.01;
      let t: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') t = this.headT + step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') t = this.headT - step;
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = 1;
      if (t === null) return;
      e.preventDefault();
      e.stopPropagation();
      handlers.onScrub(Math.min(Math.max(t, 0), 1), true);
    });
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  private tFromEvent(e: PointerEvent): number {
    const r = this.track.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
  }

  layout(p: Placement, res: Resolved): void {
    this.eraEls.forEach((el, i) => {
      const a = p.eras[i];
      const b = i + 1 < p.eras.length ? p.eras[i + 1] : 1;
      el.style.left = pct(a);
      el.style.width = pct(b - a);
      el.classList.toggle('narrow', b - a < 0.06);
      el.classList.toggle('tiny', b - a < 0.016);
      el.title = `${res.eras[i].numeral} · ${res.eras[i].name}`;
    });
    this.novelEls.forEach((el, i) => {
      const [a, b] = p.novels[i];
      const w = Math.max(b - a, 0.004);
      el.style.left = pct(Math.min(a, 1 - w));
      el.style.width = pct(w);
    });
    for (const [id, el] of this.ticks) {
      const pt = p.events.get(id);
      if (pt) el.style.left = pct(pt.t);
    }
  }

  setVisible(isVisible: (id: string) => boolean): void {
    for (const [id, el] of this.ticks) el.classList.toggle('is-off', !isVisible(id));
  }

  setSelected(id: string | null): void {
    for (const [tid, el] of this.ticks) el.classList.toggle('is-selected', tid === id);
  }

  setHead(t: number, text: string): void {
    this.headT = t;
    this.head.style.left = pct(t);
    this.track.setAttribute('aria-valuenow', (t * 100).toFixed(1));
    this.track.setAttribute('aria-valuetext', text);
    if (this.readout.textContent !== text) this.readout.textContent = text;
  }
}

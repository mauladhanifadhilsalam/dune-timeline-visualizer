import type { Resolved, ResolvedEvent } from '../timeline/model';
import {
  CATEGORY_GLYPH,
  CATEGORY_LABEL,
  CERTAINTY_BLURB,
  CERTAINTY_LABEL,
  MODE_BLURB,
  MODE_LABEL,
  NOVEL_COLOR,
  formatRange,
} from '../timeline/format';
import { h } from './dom';

export interface PanelHandlers {
  onClose: () => void;
  onSelect: (id: string) => void;
  /** The card changed size (collapsed or expanded), so the view can re-centre in what it leaves. */
  onResize: () => void;
}

/**
 * The detail card for one event. Re-rendered on selection or reckoning change. On a phone it is a
 * short sheet along the bottom that collapses to a slim bar, so the scene above can be seen; the
 * styles only honour collapsing there, and the choice is kept from one event to the next.
 */
export class Panel {
  private collapsed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: PanelHandlers,
  ) {}

  /** Collapse or expand the sheet (on a phone; elsewhere the card is always whole). */
  setCollapsed(collapsed: boolean): void {
    if (collapsed === this.collapsed) return;
    this.collapsed = collapsed;
    this.root.classList.toggle('is-collapsed', collapsed);
    const handle = this.root.querySelector('.sheet-handle');
    handle?.setAttribute('aria-expanded', String(!collapsed));
    handle?.setAttribute('aria-label', collapsed ? 'Show the details' : 'Hide the details');
    this.root.scrollTop = 0;
    this.handlers.onResize();
  }

  /** The sheet's handle and its collapsed bar: title and year, with steps either side. */
  private sheetBar(ev: ResolvedEvent, prev: ResolvedEvent | null, next: ResolvedEvent | null): HTMLElement {
    // A swipe that ends on a button would also click it; a swipe is not a tap.
    let swiped = false;
    const tap = (fn: () => void) => () => {
      if (swiped) swiped = false;
      else fn();
    };
    const bar = h(
      'div',
      { class: 'sheet-bar' },
      h(
        'button',
        {
          class: 'sheet-handle',
          'aria-controls': 'panel-body',
          'aria-expanded': String(!this.collapsed),
          'aria-label': this.collapsed ? 'Show the details' : 'Hide the details',
          onclick: tap(() => this.setCollapsed(!this.collapsed)),
        },
        h('span', { class: 'sheet-grip', 'aria-hidden': 'true' }),
      ),
      h(
        'div',
        { class: 'sheet-peek' },
        h(
          'button',
          { class: 'peek-step', disabled: !prev, 'aria-label': 'Earlier event', onclick: tap(() => prev && this.handlers.onSelect(prev.id)) },
          '‹',
        ),
        h(
          'button',
          { class: 'peek-title', onclick: tap(() => this.setCollapsed(false)) },
          h('span', { class: 'peek-name' }, ev.title),
          h('span', { class: 'peek-year' }, formatRange(ev.y, ev.yEnd, ev.approx)),
        ),
        h(
          'button',
          { class: 'peek-step', disabled: !next, 'aria-label': 'Later event', onclick: tap(() => next && this.handlers.onSelect(next.id)) },
          '›',
        ),
      ),
    );
    // Swipe the bar down to collapse, up to expand. The release is heard on the window, so a finger
    // that slides off the bar still counts, without capturing the pointer (which would take taps
    // away from the buttons in it).
    bar.addEventListener('pointerdown', (e) => {
      const y0 = e.clientY;
      swiped = false;
      const up = (u: PointerEvent) => {
        const dy = u.clientY - y0;
        if (Math.abs(dy) > 24) {
          swiped = true;
          this.setCollapsed(dy > 0);
        }
      };
      window.addEventListener('pointerup', up, { once: true });
    });
    return bar;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  close(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  render(ev: ResolvedEvent, res: Resolved, prev: ResolvedEvent | null, next: ResolvedEvent | null): void {
    const era = res.eras[ev.eraIndex];
    const novel = res.novels.find((n) => n.id === ev.novel);
    const conflicts = res.contradictions.filter((c) => c.a === ev.id || c.b === ev.id);

    const closeBtn = h(
      'button',
      { class: 'icon-btn panel-close', 'aria-label': 'Close details', onclick: () => this.handlers.onClose() },
      '×',
    );

    const body = h(
      'div',
      { class: 'panel-body', id: 'panel-body' },
      h(
        'div',
        { class: 'panel-head' },
        era ? h('span', { class: 'panel-era' }, `${era.numeral} · ${era.name}`) : null,
        closeBtn,
      ),
      h('h2', { class: 'panel-title', id: 'panel-title' }, ev.title),
      h(
        'div',
        { class: 'panel-date' },
        h('span', { class: 'panel-year' }, formatRange(ev.y, ev.yEnd, ev.approx)),
        h(
          'span',
          { class: `badge cert cert-${ev.certainty}`, title: CERTAINTY_BLURB[ev.certainty] },
          CERTAINTY_LABEL[ev.certainty],
        ),
        ev.shift || ev.shiftEnd
          ? h(
              'span',
              {
                class: 'badge shift',
                title: "Counted from Paul's accession. Moves with the Reckoning switch.",
              },
              res.reckoning === 'battle' ? 'from 10193' : 'from 10196',
            )
          : null,
      ),
      ev.dateNote ? h('p', { class: 'panel-datenote' }, ev.dateNote) : null,
      h(
        'div',
        { class: 'panel-chips' },
        novel
          ? h(
              'span',
              { class: 'chip chip-novel', style: `--c:${NOVEL_COLOR[novel.id]}` },
              h('span', { class: 'swatch' }),
              `${novel.title} (${novel.published})`,
            )
          : null,
        h('span', { class: `chip chip-mode mode-${ev.mode}`, title: MODE_BLURB[ev.mode] }, MODE_LABEL[ev.mode]),
        h('span', { class: 'chip' }, `${CATEGORY_GLYPH[ev.category]} ${CATEGORY_LABEL[ev.category]}`),
      ),
      ev.via ? h('p', { class: 'panel-via' }, h('span', { class: 'muted' }, 'Told by: '), ev.via) : null,
      h('p', { class: 'panel-summary' }, ev.summary),
      ev.people?.length
        ? h(
            'div',
            { class: 'panel-section' },
            h('h3', null, 'People'),
            h('p', { class: 'panel-people' }, ev.people.join(' · ')),
          )
        : null,
      conflicts.length
        ? h(
            'div',
            { class: 'panel-section panel-conflicts' },
            h('h3', null, '⚠ Herbert contradicts himself'),
            ...conflicts.map((c) => {
              const otherId = c.a === ev.id ? c.b : c.a;
              const other = res.byId.get(otherId);
              return h(
                'div',
                { class: 'conflict' },
                h('p', { class: 'conflict-title' }, c.title),
                h('p', null, c.note),
                other
                  ? h(
                      'button',
                      { class: 'link-btn', onclick: () => this.handlers.onSelect(other.id) },
                      `Go to: ${other.title} (${formatRange(other.y, other.yEnd, other.approx)}) →`,
                    )
                  : null,
              );
            }),
          )
        : null,
    );

    const nav = h(
      'nav',
      { class: 'panel-nav', 'aria-label': 'Adjacent events' },
      h(
        'button',
        {
          class: 'nav-btn',
          disabled: !prev,
          onclick: () => prev && this.handlers.onSelect(prev.id),
          title: 'Previous event (←)',
        },
        h('span', { class: 'nav-dir' }, '← Earlier'),
        h('span', { class: 'nav-title' }, prev ? prev.title : '—'),
      ),
      h(
        'button',
        {
          class: 'nav-btn nav-next',
          disabled: !next,
          onclick: () => next && this.handlers.onSelect(next.id),
          title: 'Next event (→)',
        },
        h('span', { class: 'nav-dir' }, 'Later →'),
        h('span', { class: 'nav-title' }, next ? next.title : '—'),
      ),
    );

    this.root.style.setProperty('--c', NOVEL_COLOR[ev.novel]);
    this.root.classList.toggle('is-collapsed', this.collapsed);
    this.root.replaceChildren(this.sheetBar(ev, prev, next), body, nav);
    this.root.hidden = false;
    this.root.scrollTop = 0;
  }
}

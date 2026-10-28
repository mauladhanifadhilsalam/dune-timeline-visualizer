import type { ResolvedEvent } from '../timeline/model';
import { NOVEL_COLOR, formatRange } from '../timeline/format';
import { h } from './dom';

/** Rank: title prefix > title word > people > summary. Plain substring matching, no fuzz. */
export function searchEvents(events: ResolvedEvent[], query: string, limit = 8): ResolvedEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { e: ResolvedEvent; score: number }[] = [];
  for (const e of events) {
    const title = e.title.toLowerCase();
    let score = 0;
    if (title.startsWith(q)) score = 100;
    else if (title.includes(` ${q}`) || title.includes(`'${q}`)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (e.people?.some((p) => p.toLowerCase().includes(q))) score = 40;
    else if (e.summary.toLowerCase().includes(q) || e.via?.toLowerCase().includes(q)) score = 20;
    if (score) scored.push({ e, score: score + e.importance });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.e.s - b.e.s)
    .slice(0, limit)
    .map((x) => x.e);
}

export class Search {
  private results: ResolvedEvent[] = [];
  private active = -1;
  private readonly list: HTMLElement;

  constructor(
    private readonly input: HTMLInputElement,
    private readonly getEvents: () => ResolvedEvent[],
    private readonly onPick: (id: string) => void,
  ) {
    this.list = h('ul', { class: 'search-results', role: 'listbox', id: 'search-results', hidden: true });
    input.after(this.list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', 'search-results');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.addEventListener('input', () => this.update());
    input.addEventListener('focus', () => this.update());
    input.addEventListener('blur', () => setTimeout(() => this.hide(), 150));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.move(-1);
      } else if (e.key === 'Enter') {
        const pick = this.results[this.active >= 0 ? this.active : 0];
        if (pick) this.pick(pick.id);
      } else if (e.key === 'Escape') {
        input.value = '';
        this.hide();
        input.blur();
      }
      e.stopPropagation();
    });
  }

  private update(): void {
    this.results = searchEvents(this.getEvents(), this.input.value);
    this.active = -1;
    if (!this.results.length) {
      if (this.input.value.trim()) {
        this.list.replaceChildren(h('li', { class: 'search-empty' }, 'Nothing in the six novels matches.'));
        this.show();
      } else this.hide();
      return;
    }
    this.list.replaceChildren(
      ...this.results.map((e, i) =>
        h(
          'li',
          {
            role: 'option',
            id: `sr-${i}`,
            'aria-selected': 'false',
            class: 'search-item',
            onmousedown: (ev: Event) => {
              ev.preventDefault();
              this.pick(e.id);
            },
          },
          h('span', { class: 'swatch', style: `--c:${NOVEL_COLOR[e.novel]}` }),
          h('span', { class: 'search-title' }, e.title),
          h('span', { class: 'search-year' }, formatRange(e.y, e.yEnd, e.approx)),
        ),
      ),
    );
    this.show();
  }

  private move(d: number): void {
    if (!this.results.length) return;
    this.active = (this.active + d + this.results.length) % this.results.length;
    [...this.list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === this.active)));
    this.input.setAttribute('aria-activedescendant', `sr-${this.active}`);
  }

  private pick(id: string): void {
    this.onPick(id);
    this.input.value = '';
    this.hide();
    this.input.blur();
  }

  private show(): void {
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  private hide(): void {
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }
}

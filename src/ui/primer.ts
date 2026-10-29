import { PRIMER } from '../data/primer';
import { h } from './dom';

/** The primer's paragraphs, each with its heading at the given level, and the closing line. */
export function primerSections(level: 'h3' | 'h4' = 'h3'): HTMLElement[] {
  return [
    ...PRIMER.sections.map((s) => h('section', { class: 'primer-section' }, h(level, null, s.title), h('p', null, s.text))),
    h('p', { class: 'primer-close' }, PRIMER.close),
  ];
}

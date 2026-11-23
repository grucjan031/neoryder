export type MissionIconKind =
  'story' | 'run' | 'continue' | 'conquest' | 'assault' | 'heist';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Proste ikony typów kart tablicy misji (kontur 24×24, kolor z `currentColor`). */
const PATHS: Record<MissionIconKind, string> = {
  story: '<path d="M6 21V4"/><path d="M6 5h12l-3 4 3 4H6"/>',
  run: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  continue: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  conquest:
    '<circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><circle cx="12" cy="6" r="2.5"/><path d="M12 8.5v3M7.5 15l3-3.5M16.5 15l-3-3.5"/>',
  assault:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  heist: '<path d="M12 3l8 6-8 12L4 9z"/><path d="M4 9h16M12 3l-3 6 3 12 3-12z"/>',
};

export function missionIcon(kind: MissionIconKind): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'mission-icon');
  svg.innerHTML = PATHS[kind];
  return svg;
}

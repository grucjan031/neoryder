import { z } from 'zod';
import textData from '../data/ui/meta.pl.json';
import { hubMapFrame, hubMapModel, hubMapPlayer } from '../world/hubMap';
import type { HubMapFrame, HubMapPlayer } from '../world/hubMap';
import type { HubLayout } from '../world/hubSchema';
import './hubMap.css';

const text = z
  .object({
    hub: z.object({
      map: z.object({
        kicker: z.string(),
        title: z.string(),
        hint: z.string(),
        north: z.string(),
        legendLabel: z.string(),
        legendStation: z.string(),
        legendProp: z.string(),
        legendPlayer: z.string(),
      }),
    }),
  })
  .parse(textData).hub.map;

/** Podgląd planu stacji wstrzykiwany do `HubScene` (w testach atrapa). */
export interface HubMapView {
  readonly isOpen: boolean;
  toggle(): void;
  close(): void;
  /** Wywoływane co klatkę renderu; przesuwa tylko znacznik gracza i tylko przy otwartym planie. */
  update(pos: { x: number; z: number }, yaw: number): void;
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Wysokość viewBox; szerokość to VIEW × aspect, więc jednostka jest jednakowa w obu osiach. */
const VIEW = 100;
const STATION_FONT = 3.2;
const num = (value: number): string => String(Math.round(value * 1000) / 1000);

function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

/** Nakładka „Plan stacji” (M): SVG budowany raz, w klatce przesuwa się tylko znacznik gracza. */
export class HubMap implements HubMapView {
  private readonly root = document.createElement('section');
  private readonly player = svgEl('g', { class: 'hub-map__player' });
  private built = false;
  private lastKey = '';
  private readonly frame: HubMapFrame;
  private sx = VIEW;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.root.hidden || event.code !== 'Escape' || event.repeat) return;
    this.close();
  };

  constructor(
    private readonly layout: HubLayout,
    parent: Element = document.querySelector('#app') ?? document.body,
  ) {
    this.frame = hubMapFrame(layout);
    this.root.className = 'hub-map';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'false');
    this.root.setAttribute('aria-label', text.title);
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  close(): void {
    this.root.hidden = true;
  }

  update(pos: { x: number; z: number }, yaw: number): void {
    if (!this.isOpen) return;
    if (this.built) this.place(hubMapPlayer(this.frame, pos, yaw));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  private open(): void {
    if (!this.built) this.build();
    this.lastKey = '';
    this.root.hidden = false;
  }

  private place(player: HubMapPlayer): void {
    const x = player.point.x * this.sx;
    const y = player.point.y * VIEW;
    const deg = (player.headingRad * 180) / Math.PI;
    const key = `${num(x)}:${num(y)}:${num(deg)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.player.setAttribute(
      'transform',
      `translate(${num(x)} ${num(y)}) rotate(${num(deg)})`,
    );
  }

  private build(): void {
    this.built = true;
    const model = hubMapModel(this.layout, this.layout.playerSpawn, 0);
    this.sx = VIEW * model.aspect;
    const sx = this.sx;
    const kicker = document.createElement('p');
    kicker.className = 'hub-map__kicker';
    kicker.textContent = text.kicker;
    const title = document.createElement('h2');
    title.textContent = text.title;
    const svg = svgEl('svg', {
      viewBox: `0 0 ${num(sx)} ${VIEW}`,
      class: 'hub-map__svg',
      'aria-hidden': 'true',
    });
    for (const zone of model.zones) {
      const g = svgEl('g', {
        class: 'hub-map__zone',
        'data-zone': zone.id,
        'data-color': zone.color,
      });
      const rect = svgEl('rect', {
        x: num(zone.x * sx),
        y: num(zone.y * VIEW),
        width: num(zone.w * sx),
        height: num(zone.h * VIEW),
      });
      const tip = svgEl('title');
      tip.textContent = zone.label;
      g.append(tip, rect);
      if (zone.caption) {
        const label = svgEl('text', {
          x: num(zone.caption.x * sx),
          y: num(zone.caption.y * VIEW),
          class: 'hub-map__zone-label',
          'text-anchor': zone.caption.anchor,
        });
        label.textContent = zone.label;
        g.append(label);
      }
      svg.append(g);
    }
    for (const prop of model.props) {
      const dot = svgEl('circle', {
        cx: num(prop.point.x * sx),
        cy: num(prop.point.y * VIEW),
        r: '0.7',
        class: 'hub-map__prop',
        'data-prop': prop.id,
      });
      const tip = svgEl('title');
      tip.textContent = prop.label;
      dot.append(tip);
      svg.append(dot);
    }
    for (const station of model.stations) {
      const g = svgEl('g', {
        class: 'hub-map__station',
        'data-station': station.id,
        'data-color': station.color,
      });
      const cx = station.point.x * sx;
      const cy = station.point.y * VIEW;
      const mark = svgEl('circle', {
        cx: num(cx),
        cy: num(cy),
        r: '1.6',
      });
      const padW = station.label.length * STATION_FONT * 0.66 + 2.4;
      const pad = svgEl('rect', {
        x: num(cx - padW / 2),
        y: num(cy + 2.4),
        width: num(padW),
        height: num(STATION_FONT + 1.2),
        rx: '0.6',
        class: 'hub-map__station-pad',
      });
      const label = svgEl('text', {
        x: num(cx),
        y: num(cy + 3),
        class: 'hub-map__station-label',
      });
      label.textContent = station.label;
      g.append(mark, pad, label);
      svg.append(g);
    }
    this.player.append(
      svgEl('path', { d: 'M0 -2.2 L1.6 1.6 L0 0.7 L-1.6 1.6 Z' }),
    );
    svg.append(this.player);
    this.place(model.player);
    const north = document.createElement('span');
    north.className = 'hub-map__north';
    north.textContent = `↑ ${text.north}`;
    const frame = document.createElement('div');
    frame.className = 'hub-map__frame';
    frame.style.setProperty('--map-aspect', String(model.aspect));
    frame.append(svg, north);
    const legend = document.createElement('ul');
    legend.className = 'hub-map__legend';
    legend.setAttribute('aria-label', text.legendLabel);
    for (const [kind, label] of [
      ['station', text.legendStation],
      ['prop', text.legendProp],
      ['player', text.legendPlayer],
    ] as const) {
      const item = document.createElement('li');
      const mark = document.createElement('i');
      mark.className = `hub-map__legend-mark hub-map__legend-mark--${kind}`;
      mark.setAttribute('aria-hidden', 'true');
      item.append(mark, label);
      legend.append(item);
    }
    const hint = document.createElement('p');
    hint.className = 'hub-map__hint';
    hint.textContent = text.hint;
    this.root.append(kicker, title, frame, legend, hint);
  }
}

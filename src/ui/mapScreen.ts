import { z } from 'zod';
import { NODE_TYPES } from '../core/runTypes';
import type { RunState } from '../core/runTypes';
import data from '../data/ui/run.pl.json';
import './mapScreen.css';

const text = z
  .object({
    types: z.record(z.enum(NODE_TYPES), z.string()),
    map: z.object({
      legend: z.string(),
      current: z.string(),
      visited: z.string(),
      available: z.string(),
      locked: z.string(),
      seed: z.string(),
      symbols: z.record(z.enum(NODE_TYPES), z.string()),
    }),
    keys: z.string(),
    layer: z.string(),
  })
  .parse(data);

export class MapScreen {
  readonly root = document.createElement('div');
  private buttons: HTMLButtonElement[] = [];
  private readonly onKey = (event: KeyboardEvent): void => {
    if (
      this.root.hidden ||
      !this.root.isConnected ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    )
      return;
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    const button =
      index >= 0
        ? this.buttons[index]
        : event.code === 'Enter'
          ? (this.buttons.find((node) => node === document.activeElement) ??
            this.buttons[0])
          : undefined;
    if (!button) return;
    event.preventDefault();
    button.click();
  };

  constructor(parent: HTMLElement) {
    this.root.className = 'sector-map';
    this.root.hidden = true;
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  show(state: RunState, onSelect: (id: string) => void): void {
    this.root.hidden = false;
    this.root.replaceChildren();
    const nodes = state.map.layers.flat();
    const current = nodes.find((node) => node.id === state.currentNodeId);
    const available =
      current?.next ??
      (state.currentNodeId === null
        ? (state.map.layers[0] ?? []).map((node) => node.id)
        : []);
    this.buttons = [];
    const info = document.createElement('p');
    info.textContent = `${state.sectorId} · ${text.map.seed}: ${state.seed}`;
    const graph = document.createElement('div');
    graph.className = 'sector-map__graph';
    const positions = new Map<string, { x: number; y: number }>();
    state.map.layers.forEach((layer, i) =>
      layer.forEach((node, j) => {
        positions.set(node.id, {
          x: ((j + 0.5) / layer.length) * 100,
          y:
            ((state.map.layers.length - i - 0.5) / state.map.layers.length) *
            100,
        });
      }),
    );
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (const node of nodes) {
      const from = positions.get(node.id)!;
      for (const id of node.next) {
        const to = positions.get(id);
        if (!to) continue;
        const edge = document.createElementNS(svg.namespaceURI, 'line');
        edge.setAttribute('x1', String(from.x));
        edge.setAttribute('y1', String(from.y));
        edge.setAttribute('x2', String(to.x));
        edge.setAttribute('y2', String(to.y));
        edge.setAttribute('vector-effect', 'non-scaling-stroke');
        if (node.id === state.currentNodeId) edge.classList.add('is-available');
        if (state.visited.includes(node.id) && state.visited.includes(id))
          edge.classList.add('is-visited');
        svg.append(edge);
      }
    }
    graph.append(svg);
    const buttons = new Map<string, HTMLButtonElement>();
    for (const node of nodes) {
      const position = positions.get(node.id)!;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sector-map__node';
      button.dataset.nodeId = node.id;
      button.dataset.type = node.type;
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}%`;
      const index = available.indexOf(node.id);
      button.disabled = index < 0;
      button.classList.toggle('is-available', index >= 0);
      button.classList.toggle('is-visited', state.visited.includes(node.id));
      button.classList.toggle('is-current', node.id === state.currentNodeId);
      if (node.id === state.currentNodeId)
        button.setAttribute('aria-current', 'step');
      const status =
        node.id === state.currentNodeId
          ? text.map.current
          : state.visited.includes(node.id)
            ? text.map.visited
            : index >= 0
              ? text.map.available
              : text.map.locked;
      button.setAttribute(
        'aria-label',
        `${text.types[node.type]} · ${text.layer} ${node.layer} · ${status}`,
      );
      button.title = `${node.id} · ${text.types[node.type]} · ${status}`;
      const symbol = document.createElement('span');
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = text.map.symbols[node.type];
      const label = document.createElement('small');
      label.textContent = `${index >= 0 ? `${index + 1}. ` : ''}${text.types[node.type]}`;
      button.append(symbol, label);
      button.addEventListener('click', () => {
        if (!button.disabled) onSelect(node.id);
      });
      graph.append(button);
      buttons.set(node.id, button);
    }
    this.buttons = available.flatMap((id) => buttons.get(id) ?? []);
    const legend = document.createElement('p');
    legend.className = 'sector-map__legend';
    legend.setAttribute('aria-label', text.map.legend);
    legend.textContent = NODE_TYPES.map(
      (type) => `${text.map.symbols[type]} ${text.types[type]}`,
    ).join(' · ');
    const keys = document.createElement('p');
    keys.textContent = text.keys;
    this.root.append(info, graph, legend, keys);
  }

  hide(): void {
    this.root.hidden = true;
    this.buttons = [];
  }

  dispose(): void {
    this.hide();
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}

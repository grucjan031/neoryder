import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import type { EventBus } from '../core/events';
import type { Conquest, PointOwner } from '../world/conquest';
import text from '../data/ui/modes.pl.json';
import './conquestUi.css';

const colors: Record<PointOwner, string> = {
  neutral: '#56627a',
  player: '#ffae1a',
  enemy: '#e0262b',
};

/** Prezentacja punktów w świecie i w HUD; nie zmienia symulacji. */
export class ConquestView {
  readonly root = new Group();
  private readonly hud = document.createElement('section');
  private readonly tickets = document.createElement('strong');
  private readonly bar = document.createElement('progress');
  private readonly notice = document.createElement('p');
  private readonly entries;
  private readonly off: () => void;
  constructor(
    private readonly model: Conquest,
    bus: EventBus,
  ) {
    this.hud.className = 'conquest-hud';
    this.hud.setAttribute('aria-label', text.conquest);
    this.entries = model.points.map((point) => {
      const node = document.createElement('div');
      node.className = 'conquest-hud__point';
      node.dataset.point = point.id;
      const letter = document.createElement('b');
      letter.textContent = point.id;
      const state = document.createElement('span');
      const fill = document.createElement('i');
      node.append(fill, letter, state);
      this.hud.append(node);
      const material = new MeshBasicMaterial({
        color: colors.neutral,
        side: 2,
        toneMapped: false,
      });
      const ring = new Mesh(
        new RingGeometry(point.radiusM - 0.1, point.radiusM, 64),
        material,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(
        point.position.x,
        point.position.y + 0.04,
        point.position.z,
      );
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#101827';
      ctx.fillRect(8, 8, 112, 112);
      ctx.strokeStyle = '#fff1d6';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 112, 112);
      ctx.fillStyle = '#fff1d6';
      ctx.font = 'bold 88px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(point.id, 64, 69);
      const texture = new CanvasTexture(canvas);
      const label = new Sprite(
        new SpriteMaterial({ map: texture, toneMapped: false }),
      );
      label.position.set(
        point.position.x,
        point.position.y + 2.8,
        point.position.z,
      );
      label.scale.set(1.2, 1.2, 1);
      this.root.add(ring, label);
      return { point, node, state, fill, ring, label, texture };
    });
    const reserve = document.createElement('div');
    reserve.className = 'conquest-hud__reserve';
    const title = document.createElement('span');
    title.textContent = text.tickets;
    this.bar.max = model.definition.enemyTickets;
    this.bar.setAttribute('aria-label', text.tickets);
    reserve.append(title, this.tickets, this.bar);
    this.notice.className = 'conquest-hud__notice';
    this.notice.setAttribute('role', 'status');
    this.hud.append(reserve, this.notice);
    document.body.append(this.hud);
    this.off = bus.on('conquest_captured', ({ id, owner }) => {
      this.notice.textContent = `${text.captured} ${id} · ${text[owner]}`;
    });
    this.update();
  }
  update(): void {
    for (const { point, node, state, fill, ring, label } of this.entries) {
      const color = colors[point.owner];
      node.dataset.owner = point.owner;
      node.dataset.contested = String(point.contested);
      node.style.setProperty('--point-color', color);
      state.textContent = point.contested ? text.contested : text[point.owner];
      node.setAttribute(
        'aria-label',
        `${point.id}: ${state.textContent}, ${Math.round(Math.abs(point.progress) * 100)}%`,
      );
      fill.style.transform = `scaleX(${Math.abs(point.progress)})`;
      fill.style.background = colors[point.progress < 0 ? 'enemy' : 'player'];
      ring.material.color.set(color);
      label.material.color.set(point.contested ? '#fff1d6' : color);
      ring.scale.setScalar(point.contested ? 1.05 : 1);
    }
    this.tickets.textContent = String(Math.ceil(this.model.tickets));
    this.bar.value = this.model.tickets;
  }
  dispose(): void {
    this.off();
    this.hud.remove();
    this.root.removeFromParent();
    for (const { ring, label, texture } of this.entries) {
      ring.geometry.dispose();
      ring.material.dispose();
      label.material.dispose();
      texture.dispose();
    }
  }
}

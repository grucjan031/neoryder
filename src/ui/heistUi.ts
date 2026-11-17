import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
} from 'three';
import type { Vec3 } from '../core/math';
import type { Heist } from '../world/heist';
import text from '../data/ui/modes.pl.json';
import './heistUi.css';

export class HeistView {
  readonly root = new Group();
  private readonly hud = document.createElement('section');
  private readonly state = document.createElement('strong');
  private readonly lives = document.createElement('span');
  private readonly direction = document.createElement('div');
  private readonly arrow = document.createElement('b');
  private readonly target = document.createElement('span');
  private readonly hint = document.createElement('p');
  private readonly progress = document.createElement('progress');
  private readonly core = new Group();
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly metal = new MeshStandardMaterial({
    color: '#283448',
    metalness: 0.7,
    roughness: 0.35,
  });
  private readonly amber = new MeshStandardMaterial({
    color: '#ffae1a',
    emissive: '#ffae1a',
    emissiveIntensity: 3,
    toneMapped: false,
  });
  private readonly ringMaterial = new MeshBasicMaterial({
    color: '#ffae1a',
    side: 2,
    toneMapped: false,
  });
  private readonly ringGeometry: RingGeometry;
  private readonly light = new PointLight('#ffae1a', 12, 6, 2);

  constructor(private readonly model: Heist) {
    this.amber.userData.bloom = true;
    const shell = new Mesh(this.box, this.metal);
    shell.scale.set(0.5, 0.7, 0.4);
    this.core.add(shell);
    for (const x of [-0.26, 0.26]) {
      const strip = new Mesh(this.box, this.amber);
      strip.position.x = x;
      strip.scale.set(0.07, 0.55, 0.44);
      this.core.add(strip);
    }
    const cap = new Mesh(this.box, this.amber);
    cap.scale.set(0.36, 0.12, 0.44);
    this.core.add(cap, this.light);
    const radius = model.definition.extractRadiusM;
    this.ringGeometry = new RingGeometry(radius - 0.08, radius, 64);
    const ring = new Mesh(this.ringGeometry, this.ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    const exit = model.definition.extraction;
    ring.position.set(exit.x, exit.y + 0.025, exit.z);
    this.root.add(this.core, ring);
    this.hud.className = 'heist-hud';
    this.hud.setAttribute('aria-label', text.heist.title);
    this.state.setAttribute('role', 'status');
    const header = document.createElement('header');
    header.append(this.state, this.lives);
    this.arrow.textContent = '↑';
    this.arrow.setAttribute('aria-hidden', 'true');
    this.direction.append(this.arrow, this.target);
    this.progress.max = 1;
    this.progress.setAttribute('aria-label', text.heist.progress);
    this.hud.append(header, this.direction, this.progress, this.hint);
    document.body.append(this.hud);
  }

  update(player: Vec3, yaw: number): void {
    const s = this.model.snapshot();
    const carrying = s.state === 'player';
    const target = carrying ? this.model.definition.extraction : s.position;
    const dx = target.x - player.x,
      dz = target.z - player.z;
    const angle = Math.atan2(-dx, -dz) - yaw;
    this.arrow.style.transform = `rotate(${-angle}rad)`;
    this.target.textContent = `${carrying ? text.heist.extraction : text.heist.core} · ${Math.round(Math.hypot(dx, dz))} m`;
    this.state.textContent = text.heist[s.state];
    this.lives.textContent = `${text.heist.lives}: ${s.lives}`;
    this.hud.dataset.state = s.state;
    this.progress.value = s.extractProgress;
    this.progress.hidden = !carrying;
    this.hint.textContent =
      s.respawnRemainingS > 0
        ? `${text.heist.respawn} ${Math.ceil(s.respawnRemainingS)} s`
        : carrying
          ? text.heist.carry
          : '';
    const pos = carrying ? player : s.position;
    this.core.position.set(
      pos.x,
      pos.y + (carrying || s.state === 'enemy' ? 1.3 : 0.8),
      pos.z,
    );
    this.core.rotation.y = carrying ? yaw : 0;
    this.light.position.set(0, carrying ? -0.8 : 0, carrying ? -1.5 : 0);
    this.core.visible = s.outcome !== 'victory';
  }

  dispose(): void {
    this.hud.remove();
    this.root.removeFromParent();
    this.box.dispose();
    this.ringGeometry.dispose();
    this.metal.dispose();
    this.amber.dispose();
    this.ringMaterial.dispose();
    this.light.dispose();
  }
}

import { z } from 'zod';
import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';
import type { HubGuideTarget } from '../world/hubGuide';
import textData from '../data/ui/meta.pl.json';
import './hubGuide.css';

const text = z
  .object({
    missions: z.string(),
    talents: z.string(),
    firstRun: z.string(),
  })
  .parse(textData.hub.guide);

export class HubGuide {
  private readonly root = document.createElement('div');
  private readonly arrow = document.createElement('span');
  private readonly label = document.createElement('span');
  private readonly hint = document.createElement('p');

  constructor(parent: Element = document.body) {
    this.root.className = 'hub-guide';
    this.root.dataset.hubGuide = '';
    this.root.hidden = true;
    this.arrow.textContent = '↑';
    this.arrow.setAttribute('aria-hidden', 'true');
    this.root.append(this.arrow, this.label, this.hint);
    parent.append(this.root);
  }

  update(
    target: HubGuideTarget | null,
    position: Pick<Vec3, 'x' | 'z'> | null,
    player: { position: Vec3; yaw: number },
    blocked = false,
  ): void {
    if (target) this.root.dataset.target = target;
    else delete this.root.dataset.target;
    const dx = (position?.x ?? player.position.x) - player.position.x;
    const dz = (position?.z ?? player.position.z) - player.position.z;
    const distance = Math.hypot(dx, dz);
    this.root.hidden =
      blocked || !target || !position || distance < tuning.hub.guideHideRadiusM;
    if (this.root.hidden || !target) return;
    const angle = Math.atan2(-dx, -dz) - player.yaw;
    this.arrow.style.transform = `rotate(${-angle}rad)`;
    this.label.textContent = text[target]
      .replace('{label}', textData.hub.stations[target].title)
      .replace('{distance}', String(Math.round(distance)));
    this.hint.textContent = target === 'missions' ? text.firstRun : '';
  }

  dispose(): void {
    this.root.remove();
  }
}

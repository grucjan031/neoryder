import { Group } from 'three';
import { MissionView } from '../render/missionView';
import type { Assault } from '../world/assault';
import text from '../data/ui/modes.pl.json';
import './assaultUi.css';

/** HUD i istniejący widok sabotażu; wymiana pary przy przesunięciu frontu. */
export class AssaultView {
  readonly root = new Group();
  private readonly hud = document.createElement('section');
  private readonly heading = document.createElement('strong');
  private readonly lives = document.createElement('span');
  private readonly notice = document.createElement('p');
  private readonly entries = ['A', 'B'].map((id) => {
    const node = document.createElement('div');
    node.dataset.station = id;
    const label = document.createElement('b');
    label.textContent = id;
    const state = document.createElement('span');
    const progress = document.createElement('progress');
    progress.max = 1;
    progress.setAttribute('aria-label', `${text.assault.station} ${id}`);
    node.append(label, state, progress);
    return { node, state, progress };
  });
  private view: MissionView;
  private sectorIndex: number;

  constructor(private readonly model: Assault) {
    this.sectorIndex = model.sectorIndex;
    this.view = new MissionView(model.stations, model.definition.radiusM);
    this.root.add(this.view.root);
    this.hud.className = 'assault-hud';
    this.hud.setAttribute('aria-label', text.assault.title);
    const header = document.createElement('header');
    header.append(this.heading, this.lives);
    this.notice.setAttribute('role', 'status');
    this.hud.append(header, ...this.entries.map((e) => e.node), this.notice);
    document.body.append(this.hud);
    this.update();
  }

  update(): void {
    if (this.sectorIndex !== this.model.sectorIndex) {
      this.view.dispose();
      this.sectorIndex = this.model.sectorIndex;
      this.view = new MissionView(
        this.model.stations,
        this.model.definition.radiusM,
      );
      this.root.add(this.view.root);
    }
    this.view.update();
    const snapshot = this.model.snapshot();
    this.heading.textContent = `${text.assault.sector} ${snapshot.sector}/${snapshot.sectors}`;
    this.lives.textContent = `${text.assault.lives}: ${snapshot.lives}`;
    snapshot.stations.forEach((station, index) => {
      const entry = this.entries[index]!;
      entry.node.dataset.state = station.state;
      entry.state.textContent =
        text.assault[station.state] +
        (station.fuseS === null ? '' : ` ${Math.ceil(station.fuseS)} s`);
      entry.progress.value = station.progress;
    });
    this.notice.textContent =
      snapshot.respawnRemainingS > 0
        ? `${text.assault.respawn} ${Math.ceil(snapshot.respawnRemainingS)} s`
        : this.model.noticeRemainingS > 0
          ? text.assault.front
          : '';
  }

  dispose(): void {
    this.view.dispose();
    this.hud.remove();
    this.root.removeFromParent();
  }
}

import type { MissionHint } from '../world/missionSchema';
import { setInputHint } from './inputGlyphs';
import './tutorialPanel.css';
import './missionHints.css';

export class MissionHintPanel {
  private readonly root = document.createElement('section');

  constructor() {
    this.root.className = 'tutorial-panel mission-hint';
    this.root.setAttribute('role', 'status');
    (document.querySelector('#app') ?? document.body).append(this.root);
  }

  show(hint: MissionHint | null): void {
    if (hint) {
      setInputHint(
        this.root,
        hint.text,
        hint.text.replace(
          '{moveForward}{moveLeft}{moveBack}{moveRight}',
          '{move}',
        ),
      );
      this.root.dataset.missionHint = hint.id;
    } else delete this.root.dataset.missionHint;
  }

  dispose(): void {
    this.root.remove();
  }
}

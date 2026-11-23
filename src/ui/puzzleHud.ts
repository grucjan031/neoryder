import type { PuzzleOutcome } from '../world/grabPuzzle';
import type { GrabPuzzleDefinition } from '../world/roomSchema';
import { puzzleText as text } from './puzzleText';
import { setInputHint } from './inputGlyphs';
import './puzzleHud.css';

export class PuzzleHud {
  private readonly root = document.createElement('aside');
  private readonly status = document.createElement('strong');
  private readonly instructions = document.createElement('div');
  private readonly skip = document.createElement('span');
  private outcome: PuzzleOutcome | null = null;

  constructor(
    private readonly kind: GrabPuzzleDefinition['kind'],
    withGrab: boolean,
    skippable = true,
  ) {
    this.root.className = 'puzzle-hud';
    const panel = document.createElement('div');
    panel.className = 'puzzle-hud__panel';
    this.status.textContent = text[kind];
    this.status.setAttribute('aria-live', 'polite');
    const movement = document.createElement('span');
    movement.textContent = withGrab ? text.grab : text.push;
    this.instructions.append(movement, this.skip);
    panel.append(this.status, this.instructions);
    this.root.append(panel);
    document.body.append(this.root);
    if (skippable) setInputHint(this.skip, text.skip.replace('{key}', '{map}'));
  }

  update(outcome: PuzzleOutcome | null): void {
    if (this.outcome === outcome) return;
    this.outcome = outcome;
    this.status.textContent = outcome ? text[outcome] : text[this.kind];
    this.instructions.hidden = outcome !== null;
  }

  dispose(): void {
    this.root.remove();
  }
}

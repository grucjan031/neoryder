import './hubWarmth.css';

/** Kosmetyczne ciepło miski; zegar pochodzi z symulacji, DOM zmienia render. */
export class HubWarmth {
  private readonly root = document.createElement('div');
  constructor(
    parent: Element = document.querySelector('#app') ?? document.body,
  ) {
    this.root.className = 'hub-warmth';
    this.root.setAttribute('aria-hidden', 'true');
    parent.append(this.root);
  }
  update(left: number, duration: number): void {
    this.root.style.opacity = String(Math.max(0, Math.min(1, left / duration)));
  }
  dispose(): void {
    this.root.remove();
  }
}

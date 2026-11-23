import { el } from './components/dom';

/**
 * Panel ekranu runu: ramka `ui-panel` (ścięty róg) z przewijaną treścią w środku.
 * Przewija się tylko `body`, nigdy strona; ramka nie jest kontenerem przewijania, bo
 * clip-path i obwódka rysowana tłem nie mogą się przesuwać razem z treścią.
 */
export function createRunPanel(className = ''): {
  frame: HTMLElement;
  body: HTMLElement;
} {
  const frame = el(
    'div',
    `run-screen__panel ui-panel ui-scope ${className}`.trim(),
  );
  const body = el('div', 'run-screen__scroll ui-scroll');
  frame.append(body);
  return { frame, body };
}

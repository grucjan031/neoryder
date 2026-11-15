export function createDebugConsole(
  command: (line: string) => string,
): () => void {
  const panel = document.createElement('dialog');
  panel.className = 'debug-console';
  // Dialog trafia nad pozostałe modalne okna do warstwy top layer.
  panel.style.cssText =
    'margin: 0; width: 100%; max-width: none; box-sizing: border-box; border: 0;';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Konsola debug');
  const output = document.createElement('pre');
  output.setAttribute('aria-live', 'polite');
  const input = document.createElement('input');
  input.setAttribute('aria-label', 'Komenda debug');
  input.placeholder = 'help — lista komend';
  input.autocomplete = 'off';
  panel.append(output, input);
  document.body.append(panel);
  const history: string[] = [];
  let historyIndex = 0;
  const toggle = (event: KeyboardEvent): void => {
    if (event.code !== 'Backquote') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      panel.showModal();
      input.focus();
    } else panel.close();
  };
  const execute = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && input.value.trim()) {
      const line = input.value.trim();
      history.push(line);
      historyIndex = history.length;
      output.textContent += `> ${line}\n${command(line)}\n`;
      output.scrollTop = output.scrollHeight;
      input.value = '';
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      historyIndex = Math.max(
        0,
        Math.min(
          history.length,
          historyIndex + (event.key === 'ArrowUp' ? -1 : 1),
        ),
      );
      input.value = history[historyIndex] ?? '';
    }
  };
  window.addEventListener('keydown', toggle, true);
  panel.addEventListener('keydown', (event) => event.stopPropagation());
  panel.addEventListener('cancel', (event) => {
    event.preventDefault();
    panel.hidden = true;
    panel.close();
  });
  input.addEventListener('keydown', execute);
  return () => {
    window.removeEventListener('keydown', toggle, true);
    input.removeEventListener('keydown', execute);
    panel.remove();
  };
}

import type { EventBus, InputDevice } from '../core/events';
import {
  actionSchema,
  mouseBindings,
  resolveBindings,
  resolveGamepadBindings,
} from '../core/input';
import type { Action } from '../core/input';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import text from '../data/ui/settings.pl.json';
import inputText from '../data/ui/input.pl.json';
import './inputGlyphs.css';

const xbox = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'View',
  'Menu',
  'LS',
  'RS',
  'D-pad ↑',
  'D-pad ↓',
  'D-pad ←',
  'D-pad →',
  'Guide',
];
const playstation = [
  '✕',
  '○',
  '□',
  '△',
  'L1',
  'R1',
  'L2',
  'R2',
  'Create',
  'Options',
  'L3',
  'R3',
  'D-pad ↑',
  'D-pad ↓',
  'D-pad ←',
  'D-pad →',
  'PS',
];
const movement: readonly Action[] = [
  'moveForward',
  'moveBack',
  'moveLeft',
  'moveRight',
];
const fixedKeys = {
  back: 'Esc',
  confirm: 'Enter',
  advance: 'Spacja',
  mouse: 'mysz',
  console: '`',
  tab: 'Tab',
  choice1: '1',
  choice2: '2',
  choice3: '3',
  navigate: '↑ ↓',
  tabs: 'Q / E',
  reset: 'R',
};

let activeDevice: InputDevice = { device: 'keyboardMouse', layout: 'generic' };

export function getInputDevice(): InputDevice {
  return activeDevice;
}

export function keyLabel(code: string): string {
  return (
    (text.keys as Record<string, string>)[code] ??
    code.replace(/^(Key|Digit)/, '')
  );
}

export function padButtonLabel(
  index: number,
  layout: InputDevice['layout'],
): string {
  return (
    (layout === 'playstation' ? playstation : xbox)[index] ?? text.padUnbound
  );
}

export function inputGlyphLabel(
  name: string,
  device = activeDevice,
  settings: Pick<Settings, 'bindings' | 'gamepad'> = loadSettings(),
): string | undefined {
  const action = actionSchema.safeParse(name);
  if (device.device === 'gamepad') {
    if (['confirm', 'advance'].includes(name))
      return padButtonLabel(0, device.layout);
    if (name === 'back') return padButtonLabel(1, device.layout);
    if (name === 'move' || name === 'navigate')
      return name === 'move'
        ? inputText.leftStick
        : `D-pad / ${inputText.leftStick}`;
    if (name === 'look') return inputText.rightStick;
    if (name === 'tabs')
      return `${padButtonLabel(4, device.layout)} / ${padButtonLabel(5, device.layout)}`;
    if (name === 'reset') return padButtonLabel(3, device.layout);
    if (!action.success) return undefined;
    const pad = resolveGamepadBindings(settings.gamepad.bindings);
    const wanted = action.data;
    const entry = Object.entries(pad).find(
      ([, { press, hold }]) => press === wanted || hold === wanted,
    );
    if (entry) {
      const [index, binding] = entry;
      const label = padButtonLabel(Number(index), device.layout);
      return binding.hold === wanted ? `${label} (${inputText.hold})` : label;
    }
    if (wanted === 'aim') return inputGlyphLabel('block', device, settings);
    return movement.includes(wanted) ? inputText.leftStick : text.padUnbound;
  }
  if (name === 'pause') return fixedKeys.back;
  if (name === 'look') return fixedKeys.mouse;
  if (name === 'move')
    return movement
      .map((axis) => inputGlyphLabel(axis, device, settings))
      .join(' ');
  if (Object.hasOwn(fixedKeys, name))
    return fixedKeys[name as keyof typeof fixedKeys];
  if (!action.success) return undefined;
  const wanted = action.data;
  const code = Object.entries(resolveBindings(settings.bindings)).find(
    ([, owner]) => owner === wanted,
  )?.[0];
  const mouse = Object.entries(mouseBindings).find(
    ([, owner]) => owner === wanted,
  )?.[0];
  if (code) return keyLabel(code);
  if (mouse) return keyLabel(`mouse${mouse}`);
  if (wanted === 'aim') return inputGlyphLabel('block', device, settings);
  return text.unbound;
}

interface Hint {
  keyboard: string;
  pad: string;
  asGlyph: boolean;
}

const hints = new WeakMap<HTMLElement, Hint>();

function renderHint(node: HTMLElement, hint: Hint): void {
  const pad = activeDevice.device === 'gamepad';
  const doc = node.ownerDocument;
  if (hint.asGlyph) {
    node.textContent = inputGlyphLabel(hint.keyboard) ?? '';
    node.classList.toggle('input-glyph', pad);
    return;
  }
  const template = pad ? hint.pad : hint.keyboard;
  const parts = template
    .split(/(\{\w+\})/g)
    .filter(Boolean)
    .map((part) => {
      const name = part.startsWith('{') ? part.slice(1, -1) : '';
      const label = name && inputGlyphLabel(name);
      if (!label) return doc.createTextNode(part);
      const glyph = doc.createElement('kbd');
      if (pad) glyph.className = 'input-glyph';
      glyph.textContent = label;
      return glyph;
    });
  const signature = `${pad}|${parts
    .map((part) => `${part.nodeName}:${part.textContent ?? ''}`)
    .join('|')}`;
  if (node.dataset.inputRendered === signature) return;
  node.dataset.inputRendered = signature;
  node.replaceChildren(...parts);
  if (node.hasAttribute('data-text'))
    node.dataset.text = node.textContent ?? '';
}

export function setInputGlyph(node: HTMLElement, action: string): HTMLElement {
  const hint = { keyboard: action, pad: action, asGlyph: true };
  hints.set(node, hint);
  node.dataset.inputHint = '';
  renderHint(node, hint);
  return node;
}

export function setInputHint(
  node: HTMLElement,
  keyboard: string,
  pad = keyboard,
): HTMLElement {
  const old = hints.get(node);
  const hint = { keyboard, pad, asGlyph: false };
  hints.set(node, hint);
  if (old?.keyboard === keyboard && old.pad === pad && !old.asGlyph) {
    renderHint(node, hint);
    return node;
  }
  node.dataset.inputHint = '';
  renderHint(node, hint);
  return node;
}

export function refreshInputGlyphs(doc: Document = document): void {
  for (const node of doc.querySelectorAll<HTMLElement>('[data-input-hint]')) {
    const hint = hints.get(node);
    if (hint) renderHint(node, hint);
  }
}

export function bindInputGlyphs(
  bus: EventBus,
  doc: Document = document,
): () => void {
  const update = (device: InputDevice): void => {
    activeDevice = device;
    doc.documentElement.dataset.inputDevice = device.device;
    refreshInputGlyphs(doc);
  };
  update({ device: 'keyboardMouse', layout: 'generic' });
  return bus.on('input:deviceChanged', update);
}

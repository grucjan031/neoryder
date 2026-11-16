import { actionSchema, resolveBindings } from '../../core/input';
import type { BindingOverrides } from '../../core/input';
import input from '../inputBindings.json';
import text from '../ui/tutorial.pl.json';

export interface TutorialTextPart {
  text: string;
  key: boolean;
}
export function tutorialTextParts(
  template: string,
  bindings: BindingOverrides,
): TutorialTextPart[] {
  const keyboard = resolveBindings(bindings);
  return template
    .split(/(\{\w+\})/g)
    .filter(Boolean)
    .map((part) => {
      if (!part.startsWith('{')) return { text: part, key: false };
      const action = actionSchema.parse(part.slice(1, -1));
      const code = Object.keys(keyboard).find(
        (code) => keyboard[code] === action,
      );
      const mouse = Object.entries(input.mouse).find(
        ([, owner]) => owner === action,
      )?.[0];
      const label = code
        ? (text.keys[code as keyof typeof text.keys] ??
          code.replace(/^(Key|Digit)/, ''))
        : mouse
          ? text.mouse[mouse as keyof typeof text.mouse]
          : text.unbound;
      return { text: label, key: true };
    });
}

import type { RunState } from '../core/runTypes';
import { implantDefinitions, nextRarity } from './implants';

export function upgradeOptions(
  state: Readonly<RunState>,
  definitions = implantDefinitions,
): string[] {
  return state.implants.filter((id) => {
    const from = definitions.get(id);
    const to = from?.upgradesTo ? definitions.get(from.upgradesTo) : undefined;
    return (
      from &&
      to &&
      to.rarity === nextRarity(from.rarity) &&
      !state.implants.includes(to.id)
    );
  });
}

import { loadWaves } from './waves';
import { loadLevel } from './levelSchema';
import { missionDefinitions } from './missions';

const waveModules = import.meta.glob('../data/waves/*.json', {
  eager: true,
  import: 'default',
});
export const levelWaves = new Map(
  Object.values(waveModules).map((raw) => {
    const wave = loadWaves(raw);
    return [wave.id, wave] as const;
  }),
);
const modules = import.meta.glob('../data/levels/*.json', {
  eager: true,
  import: 'default',
});
export const levelDefinitions = new Map(
  [...missionDefinitions.values()]
    .filter((mission) => mission.level)
    .map((mission) => {
      const level = loadLevel(
        modules[`../data/levels/${mission.level}.json`],
        mission,
        levelWaves,
      );
      return [level.id, level] as const;
    }),
);

import { loadHubLayout } from '../../src/world/hubSchema';
import { loadNpcTexts } from '../../src/world/hubNpcs';

export const lifeLayout = () =>
  loadHubLayout({
    id: 'hub-life-test',
    name: 'Test życia kryjówki',
    playerSpawn: { x: 0, y: 0, z: 4 },
    blocks: [
      { size: { x: 20, y: 1, z: 20 }, position: { x: 0, y: -0.5, z: 0 } },
    ],
    stations: [
      {
        id: 'missions',
        position: { x: -6, z: -6 },
        radius: 1,
        label: 'MISJE',
        focus: { position: { x: -6, y: 1, z: -6 }, size: { x: 1, y: 2, z: 1 } },
      },
    ],
    npcs: [
      {
        id: 'kid',
        position: { x: 0, z: 0 },
        rotationDeg: 90,
        scale: 0.68,
        accent: 'amber',
        route: {
          points: [
            { x: 0, z: 0 },
            { x: 4, z: 0 },
          ],
          speedMS: 1,
        },
      },
      {
        id: 'friend',
        position: { x: 0, z: 3 },
        rotationDeg: 0,
        accent: 'green',
        animation: 'Idle_Loop',
      },
    ],
  });

export const lifeTexts = () =>
  loadNpcTexts(
    {
      talkPrompt: 'Porozmawiaj',
      npcs: [
        {
          id: 'kid',
          name: 'Ada',
          role: 'Mieszkanka',
          lines: ['Cześć!', 'Do zobaczenia!'],
        },
        { id: 'friend', name: 'Jan', role: 'Mieszkaniec', lines: ['Witaj.'] },
      ],
      conversations: [
        {
          id: 'hello',
          npcs: ['kid', 'friend'],
          radiusM: 5,
          lines: [
            { npc: 'kid', text: 'Gotowe?' },
            { npc: 'friend', text: 'Tak.' },
          ],
        },
      ],
    },
    lifeLayout().npcs,
  );

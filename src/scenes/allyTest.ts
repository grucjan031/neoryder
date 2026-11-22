import type { Scene as ThreeScene } from 'three';
import { z } from 'zod';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { allyDefinitions } from '../allies/allySchema';
import { levelAllySchema } from '../world/levelSchema';
import { roomDefinitions } from '../world/rooms';
import type { RoomDefinition } from '../world/roomSchema';
import { WaveDirector, wavesSchema } from '../world/waves';
import data from '../data/scenes/allyTest.json';
import { protoBaseWaves, protoParams } from './prototypeScene';
import { roomTestRun } from './roomTest';
import { RoomScene } from './roomScene';

export const allyTestSchema = z
  .object({
    id: z.string().min(1),
    roomId: z.string().min(1),
    allies: z.array(levelAllySchema).min(1),
    waves: wavesSchema,
  })
  .superRefine((scene, ctx) => {
    for (const ally of scene.allies)
      if (!allyDefinitions.has(ally.id))
        ctx.addIssue({
          code: 'custom',
          message: `Nieznany sojusznik: ${ally.id}`,
        });
  });
export type AllyTestDefinition = z.infer<typeof allyTestSchema>;
export const allyTest = allyTestSchema.parse(data);

export function createAllyTest(loadModels = true): AllyTest {
  const roomId = protoParams().get('room') ?? allyTest.roomId;
  const room = roomDefinitions.get(roomId);
  if (!room) throw new Error(`Nieznany pokój: ${roomId}`);
  return new AllyTest(room, allyTest, loadModels);
}

/**
 * `?scene=ally-test`: pokój z dwoma sojusznikami i falami wrogów w pętli. Komendy `ally …`
 * (spawn, down, revive, hold, follow, status) rejestruje `RoomScene`; stan: `query('allies')`.
 */
export class AllyTest extends RoomScene {
  override readonly id = 'ally-test';
  private waveDirector?: WaveDirector;
  private offWaves?: () => void;
  private offCommand?: () => void;

  constructor(
    room: RoomDefinition,
    private readonly def: AllyTestDefinition,
    loadModels: boolean,
  ) {
    super(room, roomTestRun(room, protoParams()), protoBaseWaves(room), {
      loadModels,
      manualEncounter: true,
      allies: def.allies,
    });
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await super.init(ctx, three);
    if (this.disposed) return;
    const director = new WaveDirector(
      this.def.waves,
      {
        spawn: (enemy, position) => this.spawnEnemy(enemy, position),
        playerPosition: () => this.playerSnapshot().position,
      },
      ctx.bus,
      ctx.rng.fork('ally-test'),
    );
    this.waveDirector = director;
    // Fale w pętli: scena ma być sprawdzalna tak długo, jak trzeba.
    this.offWaves = ctx.bus.on('wave_cleared', ({ wave }) => {
      if (wave === director.totalWaves) director.start();
    });
    director.start();
    const off = ctx.commands?.register(
      'ally waves',
      'ally waves <on|off> — fale wrogów sceny',
      (args) => {
        if (args[0] === 'off') {
          director.stop();
          return 'Fale zatrzymane.';
        }
        if (args[0] !== 'on') return 'Użycie: ally waves <on|off>';
        director.start();
        return 'Fale uruchomione.';
      },
    );
    this.offCommand = off ?? undefined;
  }

  override step(dt: number, input: InputSnapshot): void {
    super.step(dt, input);
    this.waveDirector?.step(dt);
  }

  override query(name: string): unknown {
    if (name === 'allyWave') return this.waveDirector?.wave ?? 0;
    return super.query(name);
  }

  override dispose(): void {
    this.offWaves?.();
    this.offCommand?.();
    this.waveDirector?.dispose();
    super.dispose();
  }
}

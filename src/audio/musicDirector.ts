import type { EntityId, EventBus } from '../core/events';
import { JUKEBOX_LOOPS } from './musicSchema';
import type { MusicState } from './musicSchema';

export interface MusicDirectorOptions {
  /** Zegar w sekundach (monotoniczny); w testach atrapa. */
  now: () => number;
  /** Wywoływane tylko przy zmianie stanu (także na starcie: calm; „off” tylko przez override). */
  onState: (state: MusicState) => void;
  /** Ile sekund walka trwa po ostatniej aktywności (histereza). */
  combatHoldS?: number;
}

/**
 * Czysta logika „zdarzenia szyny → stan muzyki” (S7-02). Walka trwa, dopóki trwa fala
 * (`wave_started` … `wave_cleared`) albo przez `combatHoldS` po ostatnim obrażeniu z udziałem
 * gracza lub zabiciu wroga. Boss ma priorytet (`boss_spawned` … zniknięcie/zabicie bossa).
 * Śmierć gracza i koniec runu wyciszają do calm; `scene_loaded` zeruje wszystko.
 * Czas płynie przez `poll()` (wołane okresowo przez MusicSystem).
 */
export class MusicDirector {
  private readonly hold: number;
  private playerId: EntityId | null = null;
  private bossId: EntityId | null = null;
  private waveActive = false;
  private combatUntil = -Infinity;
  /** Po śmierci gracza/końcu runu: ignoruj walkę do następnej sceny lub nowego gracza. */
  private silenced = false;
  /** Numer utworu szafy grającej (0 = domyślny calm); kryjówka startuje od 0. */
  private jukebox = 0;
  private override: MusicState | null = null;
  private current: MusicState | null = null;
  private readonly off: (() => void)[] = [];

  constructor(
    bus: EventBus,
    private readonly opts: MusicDirectorOptions,
  ) {
    this.hold = opts.combatHoldS ?? 4;
    this.off.push(
      bus.on('entity_spawned', ({ id, kind }) => {
        if (kind !== 'player') return;
        this.playerId = id;
        this.silenced = false;
        this.poll();
      }),
      bus.on('entity_despawned', ({ id }) => {
        if (id === this.playerId) this.playerId = null;
        if (id === this.bossId) this.bossEnded();
        this.poll();
      }),
      bus.on('hub_prop_used', ({ kind }) => {
        if (kind !== 'jukebox') return;
        this.jukebox = (this.jukebox + 1) % JUKEBOX_LOOPS.length;
        this.poll();
      }),
      bus.on('scene_loaded', () => {
        this.jukebox = 0;
        this.bossId = null;
        this.waveActive = false;
        this.combatUntil = -Infinity;
        this.silenced = false;
        this.poll();
      }),
      bus.on('wave_started', () => {
        if (this.silenced) return;
        this.waveActive = true;
        this.poll();
      }),
      bus.on('wave_cleared', () => {
        this.waveActive = false;
        this.touchCombat();
        this.poll();
      }),
      bus.on('boss_spawned', ({ id }) => {
        if (this.silenced) return;
        this.bossId = id;
        this.poll();
      }),
      bus.on('damage_dealt', ({ source, target }) => {
        const p = this.playerId;
        if (p !== null && (source === p || target === p)) this.touchCombat();
        this.poll();
      }),
      bus.on('enemy_killed', ({ id }) => {
        this.touchCombat();
        if (id === this.bossId) this.bossEnded();
        this.poll();
      }),
      bus.on('player_died', () => this.silence()),
      bus.on('run_ended', () => this.silence()),
    );
    this.poll();
  }

  /** Aktualny stan docelowy muzyki. */
  get state(): MusicState {
    return this.current ?? 'calm';
  }

  /** Numer utworu szafy (0..2). */
  get jukeboxTrack(): number {
    return this.jukebox;
  }

  /** Ręczne wymuszenie stanu (komenda debug); null = tryb automatyczny. */
  setOverride(state: MusicState | null): void {
    this.override = state;
    this.poll();
  }

  /** Przelicza stan względem zegara; zgłasza zmianę. */
  poll(): void {
    const next = this.compute();
    if (next === this.current) return;
    this.current = next;
    this.opts.onState(next);
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }

  private compute(): MusicState {
    if (this.override) return this.override;
    if (this.silenced) return 'calm';
    if (this.bossId !== null) return 'boss';
    if (this.waveActive || this.opts.now() < this.combatUntil) return 'combat';
    return JUKEBOX_LOOPS[this.jukebox] ?? 'calm';
  }

  private touchCombat(): void {
    if (this.silenced) return;
    this.combatUntil = this.opts.now() + this.hold;
  }

  private bossEnded(): void {
    this.bossId = null;
    this.touchCombat();
  }

  private silence(): void {
    this.silenced = true;
    this.bossId = null;
    this.waveActive = false;
    this.combatUntil = -Infinity;
    this.poll();
  }
}

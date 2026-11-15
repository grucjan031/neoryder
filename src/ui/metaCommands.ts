import type { SaveStore } from '../core/save';
import type { MetaManager } from '../progression/meta';
import { saveMetaManager } from '../progression/metaSave';

export interface CommandHost {
  register(
    name: string,
    help: string,
    run: (args: string[]) => string,
  ): () => void;
}

export interface MetaCommandsHandle {
  /** Wyrejestrowuje komendy. */
  dispose(): void;
  /** Rozwiązuje się, gdy zapisy zleconych komend dobiegną końca (testy, e2e). */
  settled(): Promise<void>;
}

const amount = (args: readonly string[]): number | null => {
  const value = Number(args[0]);
  return args.length === 1 && Number.isInteger(value) && value >= 0
    ? value
    : null;
};

/**
 * Komendy debug meta-progresu (ADR 0007 pkt 11): `meta state`, `meta xp <n>`, `meta data <n>`,
 * `meta cores <n>`, `meta threat <n>`, `meta unlock all`, `meta reset`. Każda zmiana zapisuje meta przez `SaveStore`.
 * `host` to `ctx.commands` sceny (może być `undefined` poza trybem debug).
 */
export function registerMetaCommands(
  host: CommandHost | undefined,
  manager: MetaManager,
  store: SaveStore,
): MetaCommandsHandle {
  const offs: (() => void)[] = [];
  let pending: Promise<void> = Promise.resolve();
  const persist = (): void => {
    pending = saveMetaManager(store, manager).catch((error: unknown) => {
      console.warn('Nie można zapisać meta-progresu.', error);
    });
  };
  const summary = (): string => {
    const s = manager.state;
    return `Poziom ${manager.level} · XP ${s.xp} · Dane ${s.data} · Rdzenie ${s.cores}`;
  };
  const register = (
    name: string,
    help: string,
    run: (args: string[]) => string,
  ): void => {
    if (host) offs.push(host.register(name, help, run));
  };
  register('meta state', 'meta state — stan meta-progresu (JSON)', () =>
    JSON.stringify(manager.state),
  );
  for (const [name, label, apply] of [
    ['xp', 'Doświadczenie', (n: number) => manager.debugAddXp(n)],
    ['data', 'Dane', (n: number) => manager.debugAddData(n)],
    ['cores', 'Rdzenie', (n: number) => manager.debugAddCores(n)],
  ] as const)
    register(`meta ${name}`, `meta ${name} <n> — dodaj ${label}`, (args) => {
      const n = amount(args);
      if (n === null) return `Użycie: meta ${name} <liczba całkowita ≥ 0>`;
      apply(n);
      persist();
      return summary();
    });
  register('meta unlock', 'meta unlock all — odblokuj wszystko', (args) => {
    if (args.length !== 1 || args[0] !== 'all')
      return 'Użycie: meta unlock all';
    manager.debugUnlockAll();
    persist();
    return `Odblokowania: ${manager.state.unlocks.length}`;
  });
  register(
    'meta threat',
    'meta threat <n> — ustaw najwyższy dostępny Poziom zagrożenia',
    (args) => {
      const n = amount(args);
      if (n === null) return 'Użycie: meta threat <liczba całkowita ≥ 0>';
      manager.debugSetThreatMax(n);
      persist();
      const { max, selected } = manager.state.threat;
      return `Poziom zagrożenia: max ${max}, wybrany ${selected}`;
    },
  );
  register('meta reset', 'meta reset — stan startowy meta', () => {
    manager.debugReset();
    persist();
    return `Meta zresetowane. ${summary()}`;
  });
  return {
    dispose: () => {
      for (const off of offs.splice(0)) off();
    },
    settled: () => pending,
  };
}

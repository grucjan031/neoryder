export type DebugCommand =
  | { type: 'help' | 'reset' | 'spawnCube' | 'seed' }
  | { type: 'timescale' | 'hitstop'; value: number }
  | { type: 'teleport'; position: { x: number; y: number; z: number } }
  | { type: 'error'; message: string };

export function parseCommand(line: string): DebugCommand {
  const parts = line.trim().toLowerCase().split(/\s+/);
  const [name, argument] = parts;
  if (name === 'tp' && parts.length === 4) {
    const [x, y, z] = parts.slice(1).map(Number);
    if (
      x !== undefined &&
      y !== undefined &&
      z !== undefined &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z)
    )
      return { type: 'teleport', position: { x, y, z } };
    return { type: 'error', message: 'Podaj trzy skończone współrzędne.' };
  }
  if (
    parts.length === 1 &&
    (name === 'help' || name === 'reset' || name === 'seed')
  )
    return { type: name };
  if (parts.length === 2 && name === 'spawn' && argument === 'cube')
    return { type: 'spawnCube' };
  if (parts.length === 2 && (name === 'timescale' || name === 'hitstop')) {
    const value = Number(argument);
    if (Number.isFinite(value) && value >= 0) return { type: name, value };
    return { type: 'error', message: 'Podaj skończoną liczbę nieujemną.' };
  }
  return { type: 'error', message: 'Nieznana komenda. Wpisz help.' };
}

interface CommandActions {
  reset(): void;
  spawnCube(): boolean;
  seed: string;
  timescale(value: number): void;
  hitstop(ms: number): void;
  teleport?(position: { x: number; y: number; z: number }): void;
}

export function createCommandExecutor(
  actions: CommandActions,
): (line: string) => string {
  return (line) => {
    const command = parseCommand(line);
    switch (command.type) {
      case 'help':
        return (
          'help · reset · spawn cube · seed · timescale <n> · hitstop <ms>' +
          (actions.teleport ? ' · tp <x> <y> <z>' : '')
        );
      case 'teleport':
        if (!actions.teleport) return 'Teleport niedostępny w tej scenie.';
        actions.teleport(command.position);
        return 'Gracz teleportowany.';
      case 'reset':
        actions.reset();
        return 'Scena zresetowana.';
      case 'spawnCube':
        return actions.spawnCube()
          ? 'Dodano kostkę.'
          : 'Osiągnięto limit ciał dynamicznych.';
      case 'seed':
        return actions.seed;
      case 'timescale':
        actions.timescale(command.value);
        return `Skala czasu: ${command.value}`;
      case 'hitstop':
        actions.hitstop(command.value);
        return `Hitstop: ${command.value} ms`;
      case 'error':
        return command.message;
    }
  };
}

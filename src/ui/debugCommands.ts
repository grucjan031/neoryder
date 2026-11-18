import { selectedDifficulty, setDifficultyOverride } from '../world/difficulty';

interface Command {
  help: string;
  run: (args: string[]) => string;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(
    name: string,
    help: string,
    run: (args: string[]) => string,
  ): () => void {
    name = name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!name || name.split(' ').length > 2)
      throw new Error('Nazwa komendy musi mieć jedno lub dwa słowa.');
    if (this.commands.has(name)) console.warn(`Nadpisano komendę: ${name}`);
    const command = { help, run };
    this.commands.set(name, command);
    return () => {
      if (this.commands.get(name) === command) this.commands.delete(name);
    };
  }

  execute(line: string): string {
    const parts = line.trim().split(/\s+/);
    // Wbudowana (poza help() sceny): działa od następnego runu lub sceny walki.
    if (parts[0]?.toLowerCase() === 'difficulty') {
      if (parts.length !== 2 || !setDifficultyOverride(parts[1]))
        return 'Użycie: difficulty <easy|normal|hard|nightmare>';
      return `Trudność następnego runu: ${selectedDifficulty()}`;
    }
    for (const length of [2, 1]) {
      if (parts.length < length) continue;
      const command = this.commands.get(
        parts.slice(0, length).join(' ').toLowerCase(),
      );
      if (!command) continue;
      try {
        return command.run(parts.slice(length));
      } catch (error: unknown) {
        return `Błąd komendy: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    return 'Nieznana komenda. Wpisz help.';
  }

  help(): string {
    return [...this.commands.values()]
      .map((command) => command.help)
      .join(' · ');
  }
}

export const defaultCommands = new CommandRegistry();

export function registerCommand(
  name: string,
  help: string,
  run: (args: string[]) => string,
): () => void {
  return defaultCommands.register(name, help, run);
}

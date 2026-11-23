import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { levelDefinitions } from '../../src/world/levels';
import { missionDefinitions } from '../../src/world/missions';

const MAX_BRIEFING = 3;
const MAX_DEBRIEF = 6;

const missions = [
  ['m01-maszty', 'misja-01-maszty.md', 'W trakcie misji (radio)'],
  [
    'm02-punkt-kontrolny',
    'misja-02-punkt-kontrolny.md',
    'W trakcie misji (radio)',
  ],
  [
    'm03-list-przewozowy',
    'misja-03-list-przewozowy.md',
    'W trakcie misji (radio)',
  ],
  [
    'm06-odlewnia',
    'misja-06-odlewnia.md',
    'W trakcie misji (radio i hala bossa)',
  ],
  ['m07-nocny-dyzur', 'misja-07-nocny-dyzur.md', 'W trakcie misji (radio)'],
  ['m08-kwarantanna', 'misja-08-kwarantanna.md', 'W trakcie misji (radio)'],
] as const;

type Line = { speaker: string; text: string };

/** Kwestie jednej sekcji „## Dialogi” scenariusza, w kolejności źródła. */
function scenario(file: string, heading: string): Line[] {
  const source = readFileSync(
    new URL(`../../docs/fabula/misje/${file}`, import.meta.url),
    'utf8',
  );
  const section = source
    .split(/^## Dialogi\r?$/m)[1]!
    .split(/^## /m)[0]!
    .split(/^### /m)
    .find((part) => part.split(/\r?\n/)[0] === heading)!;
  const lines = section.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\*\*(\p{L}+)(?: \*\([^\n]+?\)\*)?:\*\* (.+)$/u);
    return match ? [{ speaker: match[1]!.toLowerCase(), text: match[2]! }] : [];
  });
  expect(lines.length).toBeGreaterThan(0);
  return lines;
}

const key = ({ speaker, text }: Line) => `${speaker}: ${text}`;

/** Czy `part` jest podciągiem `whole` (ta sama kolejność, dozwolone pominięcia). */
function isSubsequence(part: string[], whole: string[]): boolean {
  let index = 0;
  for (const entry of whole) if (entry === part[index]) index++;
  return index === part.length;
}

describe.each(missions)('Dialogi %s', (id, file, radioHeading) => {
  const mission = missionDefinitions.get(id)!;
  const briefing = scenario(file, 'Odprawa (kryjówka)').map(key);
  const radio = scenario(file, radioHeading).map(key);
  const debrief = scenario(file, 'Po misji (kryjówka)').map(key);
  const played = mission.radio.flatMap((event) => event.lines).map(key);

  it('odprawa ma najwyżej trzy kwestie, dosłownie ze scenariusza i w jego kolejności', () => {
    expect(mission.briefing.length).toBeGreaterThan(0);
    expect(mission.briefing.length).toBeLessThanOrEqual(MAX_BRIEFING);
    expect(isSubsequence(mission.briefing.map(key), briefing)).toBe(true);
  });

  it('każda kwestia odprawy i radia ze scenariusza pada dokładnie raz: w odprawie albo w radiu', () => {
    expect([...mission.briefing.map(key), ...played].sort()).toEqual(
      [...briefing, ...radio].sort(),
    );
  });

  it('kwestie radia ze scenariusza zachowują jego kolejność', () => {
    const moved = new Set(briefing);
    expect(played.filter((line) => !moved.has(line))).toEqual(radio);
  });

  it('debrief ma najwyżej sześć kwestii, dosłownie ze scenariusza i w jego kolejności', () => {
    expect(mission.debrief.length).toBeGreaterThan(0);
    expect(mission.debrief.length).toBeLessThanOrEqual(MAX_DEBRIEF);
    expect(isSubsequence(mission.debrief.map(key), debrief)).toBe(true);
  });

  it('skrót radia mieści się na dwóch kartach i jest krótszy od pełnej kwestii', () => {
    for (const { text, shortText } of mission.radio.flatMap((e) => e.lines)) {
      if (shortText === undefined) continue;
      expect(Array.from(shortText).length).toBeLessThanOrEqual(
        2 * tuning.mission.radioPageChars,
      );
      expect(shortText.length).toBeLessThan(text.length);
    }
  });

  it('wyzwalacze poziomu wskazują istniejące sekcje, spotkania i punkty kontrolne', () => {
    const level = levelDefinitions.get(mission.level!)!;
    const known: Record<string, string[]> = {
      enterSection: level.sections.map((entry) => entry.id),
      encounter: level.encounters.map((entry) => entry.id),
      checkpoint: level.checkpoints.map((entry) => entry.id),
    };
    const used = new Set<string>();
    for (const { trigger } of mission.radio) {
      const [kind, target] = trigger.split(':');
      if (!known[kind!]) continue;
      used.add(kind!);
      expect(known[kind!], trigger).toContain(target);
    }
    // Treść zdjęta z odprawy trafia na wyzwalacze poziomu, nie na start misji.
    expect(used.size).toBeGreaterThan(0);
  });

  it('przeniesiona treść odprawy nie zalewa startu: najwyżej dwie takie kwestie na runStart', () => {
    const moved = new Set(briefing);
    const atStart = mission.radio
      .filter((event) => event.trigger === 'runStart')
      .flatMap((event) => event.lines)
      .map(key)
      .filter((line) => moved.has(line));
    expect(atStart.length).toBeLessThanOrEqual(2);
  });
});

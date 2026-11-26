import { Rng } from '../core/rng';

/**
 * Wybór pokoi dla kolejnych węzłów ścieżki runu bez powtórki pod rząd.
 * `candidatesFor` zwraca posortowaną po id listę kandydatów węzła (dla węzła
 * `fixed` jednoelementową). Pokój poprzedniego węzła jest wykluczany tylko
 * wtedy, gdy zostaje co najmniej jeden kandydat. Losowanie: ten sam fork
 * `room-layout:<nodeId>` co bez reguły. Wynik zależy wyłącznie od seeda i ścieżki.
 */
export function pickRoomChain(
  seed: string | number,
  nodeIds: readonly string[],
  candidatesFor: (nodeId: string) => readonly string[],
): string[] {
  const rng = new Rng(seed);
  const picked: string[] = [];
  for (const [index, nodeId] of nodeIds.entries()) {
    const previous = index > 0 ? picked[index - 1] : undefined;
    const all = candidatesFor(nodeId);
    const rest = all.filter((id) => id !== previous);
    const room = rng
      .fork(`room-layout:${nodeId}`)
      .pick(rest.length ? rest : all);
    picked.push(room);
  }
  return picked;
}

/** Ścieżka do bieżącego węzła: `visited` do niego włącznie (bieżący dopisany, gdy go brak). */
export function pathToNode(
  visited: readonly string[],
  currentNodeId: string,
): string[] {
  const index = visited.indexOf(currentNodeId);
  return index >= 0 ? visited.slice(0, index + 1) : [...visited, currentNodeId];
}

import type { HubLayout, HubNpcDef } from './hubSchema';
import type { NpcConversation, NpcText, NpcTexts } from './hubNpcs';

/** Czy element z warunkiem kampanii jest widoczny przy danym postępie (`after` ukończone, `until` jeszcze nie). */
export function campaignVisible(
  gate: { after?: string; until?: string },
  completed: ReadonlySet<string>,
): boolean {
  if (gate.after !== undefined && !completed.has(gate.after)) return false;
  if (gate.until !== undefined && completed.has(gate.until)) return false;
  return true;
}

/** Pozycja NPC wg postępu: ostatni pasujący wariant `campaignPositions` wygrywa. */
export function campaignNpc(
  npc: HubNpcDef,
  completed: ReadonlySet<string>,
): HubNpcDef {
  const variants = (npc.campaignPositions ?? []).filter(({ after }) =>
    completed.has(after),
  );
  const last = variants[variants.length - 1];
  if (!last) return npc;
  const next: HubNpcDef = { ...npc, position: last.position };
  if (last.rotationDeg !== undefined) next.rotationDeg = last.rotationDeg;
  return next;
}

/** Układ po filtrze kampanii: widoczne panele, napisy i dekoracje oraz pozycje NPC. */
export function applyHubCampaign(
  layout: HubLayout,
  completed: ReadonlySet<string>,
): HubLayout {
  const visible = <T extends { after?: string; until?: string }>(
    list: T[] | undefined,
  ): T[] | undefined =>
    list?.filter((item) => campaignVisible(item, completed));
  const result: HubLayout = { ...layout };
  if (layout.panels) result.panels = visible(layout.panels);
  if (layout.neonTexts) result.neonTexts = visible(layout.neonTexts);
  if (layout.decor) result.decor = visible(layout.decor);
  if (layout.npcs)
    result.npcs = layout.npcs.map((npc) => campaignNpc(npc, completed));
  return result;
}

/** Teksty po filtrze kampanii: rozmowy `after`/`until` oraz stałe `campaignLines` dopisane do `lines`. */
export function applyCampaignTexts(
  texts: NpcTexts,
  completed: ReadonlySet<string>,
): NpcTexts {
  const npcs: NpcText[] = texts.npcs.map((npc) => {
    const extra = (npc.campaignLines ?? [])
      .filter(({ after }) => completed.has(after))
      .flatMap(({ lines }) => lines);
    return extra.length > 0 ? { ...npc, lines: [...npc.lines, ...extra] } : npc;
  });
  const result: NpcTexts = { ...texts, npcs };
  if (texts.conversations)
    result.conversations = texts.conversations.filter(
      (conversation: NpcConversation) =>
        campaignVisible(conversation, completed),
    );
  return result;
}

/** Wszystkie id misji użyte w polach kampanii układu i tekstów. */
export function collectCampaignMissionIds(
  layout: HubLayout,
  texts: NpcTexts,
): string[] {
  const ids: string[] = [];
  const gate = (item: { after?: string; until?: string }): void => {
    if (item.after !== undefined) ids.push(item.after);
    if (item.until !== undefined) ids.push(item.until);
  };
  layout.panels?.forEach(gate);
  layout.neonTexts?.forEach(gate);
  layout.decor?.forEach(gate);
  for (const npc of layout.npcs ?? [])
    for (const { after } of npc.campaignPositions ?? []) ids.push(after);
  texts.conversations?.forEach(gate);
  for (const npc of texts.npcs) {
    for (const { after } of npc.campaignLines ?? []) ids.push(after);
    ids.push(...Object.keys(npc.reactions?.afterMission ?? {}));
  }
  return ids;
}

/** Rzuca błąd dla id misji, której nie ma w danych (`known`). */
export function assertCampaignMissions(
  layout: HubLayout,
  texts: NpcTexts,
  known: ReadonlySet<string>,
): void {
  for (const id of collectCampaignMissionIds(layout, texts))
    if (!known.has(id))
      throw new Error(`Nieznana misja w kampanii kryjówki: ${id}.`);
}

/** Opisy scen w menu startowym. Sceny bez wpisu trafiają na koniec listy jako „inne”. */
const DESCRIPTIONS: Record<
  string,
  { title: string; text: string; order: number }
> = {
  arena: {
    title: 'Arena — fale wrogów',
    text: '12 fal Szturmowców i Strzelców: ostrze, blok, parowanie, Pchnięcie, blaster.',
    order: 0,
  },
  'ai-test': {
    title: 'Walka z wrogami',
    text: 'Arena z Szturmowcami i Strzelcem — najbliżej docelowej gry.',
    order: 1,
  },
  'melee-test': {
    title: 'Ostrze plazmowe',
    text: 'Combo, ciężki atak, blok i Pchnięcie na manekinach.',
    order: 2,
  },
  'parry-test': {
    title: 'Parowanie',
    text: 'Manekin strzela — wciśnij PPM tuż przed trafieniem.',
    order: 3,
  },
  'push-test': {
    title: 'Pchnięcie Rezonansu',
    text: 'F wbija manekiny w ścianę (dodatkowe obrażenia).',
    order: 4,
  },
  'blaster-test': {
    title: 'Blaster',
    text: 'Strzelanie z przegrzewaniem zamiast amunicji (R).',
    order: 5,
  },
  'player-test': {
    title: 'Ruch',
    text: 'Sprint, podwójny skok, dash, ślizg pod niskim tunelem.',
    order: 6,
  },
  'damage-test': {
    title: 'Model obrażeń',
    text: 'Manekin, strefy trafień, komendy hit / block.',
    order: 7,
  },
  'style-test': {
    title: 'Styl wizualny',
    text: 'Paleta, obrys krawędzi i modele z Blendera.',
    order: 8,
  },
  sandbox: {
    title: 'Sandbox fizyki',
    text: 'Spadające kostki Rapier (scena techniczna F0).',
    order: 9,
  },
};

const CONTROLS =
  'Kliknij scenę, by przechwycić mysz · WASD ruch · Shift sprint · Spacja skok (×2) · Q dash · Ctrl ślizg · LPM cios (przytrzymaj = ciężki) · PPM blok · F Pchnięcie · R strzał · ` konsola';

/** Menu startowe: lista scen jako linki (zachowuje parametry debug i seed). */
export function createSceneMenu(
  root: HTMLElement,
  sceneIds: readonly string[],
  params: URLSearchParams,
): void {
  const menu = document.createElement('main');
  menu.className = 'scene-menu';
  const logo = document.createElement('img');
  logo.src = '/brand/logo.png';
  logo.alt = '';
  logo.className = 'scene-menu__logo';
  const heading = document.createElement('h1');
  heading.textContent = 'NEORYDER';
  const sub = document.createElement('p');
  sub.className = 'scene-menu__sub';
  sub.textContent = 'Prototyp walki (faza F1) — wybierz scenę';
  const list = document.createElement('ul');
  const sorted = [...sceneIds].sort(
    (a, b) => (DESCRIPTIONS[a]?.order ?? 99) - (DESCRIPTIONS[b]?.order ?? 99),
  );
  for (const id of sorted) {
    const info = DESCRIPTIONS[id];
    const query = new URLSearchParams(params);
    query.set('scene', id);
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `?${query.toString()}`;
    const title = document.createElement('strong');
    title.textContent = info?.title ?? id;
    const text = document.createElement('span');
    text.textContent = info?.text ?? `Scena ${id}`;
    const code = document.createElement('code');
    code.textContent = id;
    link.append(title, text, code);
    item.append(link);
    list.append(item);
  }
  const controls = document.createElement('p');
  controls.className = 'scene-menu__controls';
  controls.textContent = CONTROLS;
  menu.append(logo, heading, sub, list, controls);
  root.append(menu);
}

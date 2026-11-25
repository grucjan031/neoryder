// 15 sklepów galerii „Atrium Nova” (run2): wnęki 6,5 m za kratami, towar na trzech planach.
// Układ lokalny sklepu: `u` = głębokość od linii pasażu, `v` = położenie wzdłuż fasady, `h` = wysokość nad posadzką.
// Gracz i wrogowie nie wchodzą do sklepów (kraty mają kolizję), więc towar to głównie dekoracje i bryły.
import {
  COLOR,
  Q,
  box,
  deco,
  dims,
  makeFrame,
  solid,
  storyH,
  vec,
} from './_run2Kit.mjs';

const BACK = 6.5; // wewnętrzne lico tylnej ściany (u)
const WALL = 0.9; // lico ściany frontowej od strony wnętrza (u)
const C = COLOR;

/** Rozmieszczenie dekoracji w jednym sklepie z kontrolą nakładania się obwiedni. */
function shopKit(k, def) {
  const f = makeFrame(def.side, def.level, def.c);
  const y0 = f.y0;
  const placed = [];
  const S = {
    k,
    f,
    y0,
    def,
    /** Blok w lokalnym prostopadłościanie (niegrywalny). */
    B(u0, u1, v0, v1, h0, h1, material, opts = {}) {
      return solid(k, f.rect(u0, u1, v0, v1), y0 + h0, y0 + h1, material, {
        walkable: false,
        ...opts,
      });
    },
    /** Dekoracja: `face` 0 = przodem do pasażu, 2 = od pasażu, ±1 = bokiem. */
    M(model, u, v, face = 0, h = 0) {
      const p = f.at(u, v);
      const yaw = f.front + face * Q;
      const d = dims(model);
      const odd = Math.abs(Math.round(yaw / Q)) % 2 === 1;
      const o = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const cx = p.x + o.z * d.cx + o.x * d.cz,
        cz = p.z + o.z * d.cz - o.x * d.cx;
      const rect = {
        minX: cx - (odd ? d.d : d.w) / 2,
        maxX: cx + (odd ? d.d : d.w) / 2,
        minZ: cz - (odd ? d.w : d.d) / 2,
        maxZ: cz + (odd ? d.w : d.d) / 2,
        lo: y0 + h + d.y0,
        hi: y0 + h + d.y0 + d.h,
      };
      for (const other of placed)
        if (
          rect.minX < other.maxX - 0.05 &&
          rect.maxX > other.minX + 0.05 &&
          rect.minZ < other.maxZ - 0.05 &&
          rect.maxZ > other.minZ + 0.05 &&
          rect.lo < other.hi &&
          rect.hi > other.lo
        )
          throw new Error(
            `${def.id}: ${model} (u=${u}, v=${v}) nachodzi na ${other.model}.`,
          );
      placed.push({ ...rect, model });
      return deco(k, model, p.x, y0 + h, p.z, yaw);
    },
    /** Neon: `u` = odległość od linii pasażu (0 = lico fasady), `face` jak w M. */
    neon(texture, u, v, h, w, hh, face, tint, flicker = 0) {
      const p = f.at(u, v);
      k.neon(
        texture,
        p.x,
        y0 + h,
        p.z,
        w,
        hh,
        f.front + face * Q,
        tint,
        flicker,
      );
    },
    holo(texture, u, v, h, w, hh, tint) {
      const p = f.at(u, v);
      k.holo(texture, p.x, y0 + h, p.z, w, hh, f.front, tint);
    },
    /** Plakat na ścianie (naklejka z kolorem). */
    poster(texture, u, v, h, w, hh, face, tint, opacity = 0.8) {
      const p = f.at(u, v);
      k.decals.push({
        texture,
        surface: 'wall',
        position: vec(p.x, y0 + h, p.z),
        yaw: f.front + face * Q,
        size: { w, h: hh },
        tint,
        opacity,
      });
    },
    light(u, v, h, color, intensity, range) {
      const p = f.at(u, v);
      k.light(p.x, y0 + h, p.z, color, intensity, range, {
        floorY: y0,
        groundGlow: false,
      });
    },
  };

  /** Regał ścienny: deski z paskami LED pod spodem i towarem w rzędach. */
  S.wallShelf = (
    v0,
    v1,
    {
      rows = 4,
      base = 0.3,
      pitch = 0.52,
      goods,
      boards = 'wood',
      led = 'light_panel',
      depth = 0.45,
    },
  ) => {
    const u0 = BACK - depth;
    const top = base + rows * pitch;
    const n = Math.max(2, Math.round((v1 - v0) / 2.4));
    for (let i = 0; i <= n; i++) {
      const v = v0 + ((v1 - v0) * i) / n;
      S.B(u0, BACK, v - 0.04, v + 0.04, 0, top, 'metal');
    }
    for (let r = 0; r < rows; r++) {
      const hb = base + r * pitch;
      S.B(u0, BACK, v0, v1, hb, hb + 0.04, boards);
      S.B(u0 + 0.05, u0 + 0.1, v0 + 0.1, v1 - 0.1, hb - 0.03, hb, led);
      const seg = (v1 - v0) / 4;
      for (let i = 0; i < 4; i++) {
        const gap = (r + i) % 3 === 2 ? 0.45 : 0.1;
        S.B(
          u0 + 0.06,
          BACK - 0.08,
          v0 + seg * i + 0.08,
          v0 + seg * (i + 1) - gap,
          hb + 0.04,
          hb + 0.3 + ((r * 3 + i) % 3) * 0.05,
          goods[(r + i) % goods.length],
        );
      }
    }
  };
  /** Niski stół ekspozycyjny z towarem na blacie (opcjonalnie pod kloszem). */
  S.table = (
    u,
    v,
    w,
    d,
    h,
    { base = 'lacquer', top = 'wood', goods = [], items = 3, dome = false },
  ) => {
    S.B(
      u - d / 2 + 0.1,
      u + d / 2 - 0.1,
      v - w / 2 + 0.1,
      v + w / 2 - 0.1,
      0,
      h - 0.06,
      base,
    );
    S.B(u - d / 2, u + d / 2, v - w / 2, v + w / 2, h - 0.06, h, top);
    for (let i = 0; i < items && goods.length; i++) {
      const c = v - w / 2 + (w * (i + 0.5)) / items;
      S.B(
        u - d / 2 + 0.12,
        u + d / 2 - 0.12,
        c - w / items / 2 + 0.1,
        c + w / items / 2 - 0.1,
        h,
        h + 0.12 + (i % 2) * 0.1,
        goods[i % goods.length],
      );
    }
    if (dome)
      S.B(
        u - d / 2 + 0.05,
        u + d / 2 - 0.05,
        v - w / 2 + 0.05,
        v + w / 2 - 0.05,
        h,
        h + 0.4,
        'glass_clear',
      );
  };
  /** Gondola: niski regał z towarem i paskiem LED na krawędzi. */
  S.gondola = (
    u,
    v,
    len,
    { height = 1.1, depth = 0.7, base = 'lacquer', goods, led = 'light_panel' },
  ) => {
    S.B(
      u - depth / 2,
      u + depth / 2,
      v - len / 2,
      v + len / 2,
      0,
      height,
      base,
    );
    S.B(
      u - depth / 2 + 0.04,
      u - depth / 2 + 0.08,
      v - len / 2 + 0.05,
      v + len / 2 - 0.05,
      height - 0.1,
      height + 0.02,
      led,
    );
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 0; i < n; i++) {
      const c = v - len / 2 + (len * (i + 0.5)) / n;
      S.B(
        u - depth / 2 + 0.1,
        u + depth / 2 - 0.1,
        c - len / n / 2 + 0.06,
        c + len / n / 2 - 0.06,
        height,
        height + 0.18 + (i % 2) * 0.08,
        goods[i % goods.length],
      );
    }
  };
  /** Ekrany na tylnej ścianie: matryca emisyjnych płytek. */
  S.screens = (v0, v1, h0, rows, mats) => {
    const cols = Math.max(1, Math.round((v1 - v0) / 0.9));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const a = v0 + ((v1 - v0) * c) / cols;
        S.B(
          BACK - 0.08,
          BACK,
          a + 0.05,
          a + (v1 - v0) / cols - 0.05,
          h0 + r * 0.62,
          h0 + r * 0.62 + 0.54,
          mats[(r + c) % mats.length],
        );
      }
  };
  /** Duże sylwetki na pierwszym planie, niezależne od puli prawdziwych świateł. */
  S.showcase = () => {
    const fashion = ['S-01', 'S-06'].includes(def.id);
    const display = (u0, u1, ...rest) => S.B(u0 - 0.65, u1 - 0.65, ...rest);
    if (!fashion)
      for (const v of [-3, 3]) {
        display(1.8, 2.3, v - 0.5, v + 0.5, 0, 0.65, 'trim');
        display(1.79, 1.84, v - 0.46, v + 0.46, 0.65, 0.72, 'light_panel');
        // Otwarta gablota: ciemny tył, szklane boki, pełne jasne bryły towaru.
        display(2.28, 2.34, v - 0.5, v + 0.5, 0.72, 2.35, 'lacquer');
        for (const s of [-1, 1]) {
          display(
            1.85,
            2.28,
            v + s * 0.47 - 0.02,
            v + s * 0.47 + 0.02,
            0.72,
            2.35,
            'glass_clear',
          );
          display(
            2.24,
            2.28,
            v + s * 0.43 - 0.02,
            v + s * 0.43 + 0.02,
            0.75,
            2.3,
            'light_panel',
          );
        }
        if (['S-02', 'S-11'].includes(def.id)) {
          // Dwie duże pary butów: rozpoznawalna podeszwa i cholewka.
          for (const h of [0.82, 1.5]) {
            display(1.87, 2.2, v - 0.36, v + 0.36, h, h + 0.09, 'light_panel');
            display(
              1.96,
              2.2,
              v - 0.23,
              v + 0.34,
              h + 0.09,
              h + 0.4,
              'light_panel',
            );
          }
        } else if (['S-04', 'S-08', 'S-13', 'S-15'].includes(def.id)) {
          // Flakony / opakowania / naczynia o trzech wysokościach.
          for (const [dv, h] of [
            [-0.27, 0.65],
            [0, 1.05],
            [0.27, 0.8],
          ]) {
            display(
              1.9,
              2.18,
              v + dv - 0.1,
              v + dv + 0.1,
              0.8,
              0.8 + h,
              'light_panel',
            );
            display(
              1.98,
              2.1,
              v + dv - 0.06,
              v + dv + 0.06,
              0.8 + h,
              0.94 + h,
              'hivis',
            );
          }
        } else if (['S-05', 'S-10'].includes(def.id)) {
          // Tors pancerza lub stojak biżuterii: barki, korpus i szyja.
          display(1.9, 2.15, v - 0.28, v + 0.28, 1.05, 1.8, 'light_panel');
          display(1.9, 2.15, v - 0.4, v + 0.4, 1.65, 1.86, 'light_panel');
          display(1.97, 2.1, v - 0.12, v + 0.12, 1.86, 2.08, 'light_panel');
        } else {
          // Pionowy produkt z ekranem i podstawą (AV, optyka, książki, drony).
          display(1.9, 2.15, v - 0.34, v + 0.34, 0.95, 1.95, 'light_panel');
          display(1.88, 1.9, v - 0.24, v + 0.24, 1.16, 1.78, 'neon_blue');
          display(1.86, 2.2, v - 0.4, v + 0.4, 0.76, 0.86, 'light_panel');
        }
      }
    // Ekran z treścią, zamiast kolejnej pustej poziomej listwy.
    S.B(1.86, 2.02, -4.98, -4.02, 0.1, 2.6, 'trim');
    S.neon(def.sign, 1.83, -4.5, 1.65, 0.84, 1.55, 0, '#c1b8a6', 0);
    // Szeroki panel za logo rozjaśnia tylną ścianę nawet poza pulą PointLight.
    S.B(BACK - 0.04, BACK, -5.7, 5.7, 2.75, 4.45, 'light_panel');
    if (fashion)
      for (const v of [-3.2, 3.2]) {
        S.B(2.65, 2.69, v - 0.6, v + 0.6, 0.15, 2.7, 'light_panel');
        S.B(1.7, 2.45, v - 0.6, v + 0.6, 0, 0.14, 'trim');
      }
  };
  /** Elementy wspólne: kasa, bramki, panele sufitowe, listwy akcentu, szyld i logo na tylnej ścianie. */
  S.common = ({ checkout, accent }) => {
    for (const v of [-3, 3]) {
      S.M('mall_security_gates', 1.35, v, 0);
      S.M('mall_ceiling_panel', 3.4, v, 1, storyH(def.level) - 0.45);
      // Pełny dyfuzor widoczny także wtedy, gdy sklep nie mieści się w puli PointLight.
      S.B(
        2.25,
        4.55,
        v - 0.48,
        v + 0.48,
        storyH(def.level) - 0.47,
        storyH(def.level) - 0.44,
        'light_panel',
      );
      S.B(
        3.35,
        3.45,
        v - 0.05,
        v + 0.05,
        storyH(def.level) - 0.44,
        storyH(def.level),
        'metal',
      );
      S.B(0.89, 0.95, v - 2.03, v + 2.03, 2.85, 2.91, 'light_panel');
    }
    S.M('mall_checkout_counter', checkout[0], checkout[1], 0);
    S.B(BACK - 0.06, BACK, -5.8, 5.8, 3.3, 3.36, accent);
    S.B(BACK - 0.06, BACK, -5.8, 5.8, 0.1, 0.16, accent);
    S.neon(def.sign, BACK - 0.08, 0, 3.65, 4.4, 1.5, 0, C.warm, 0);
    for (const v of [-3, 3])
      S.neon(def.sign, -0.1, v, 4.1, 3.8, 0.95, 0, C.warm, 0);
    if (['S-01', 'S-02', 'S-04', 'S-05'].includes(def.id))
      S.light(3.4, 3, storyH(def.level) - 0.48, C.warm, 85, 10);
    S.neon('mall_opening', 0.22, 0, 2.2, 0.65, 0.98, 0, C.warm, 0);
    if (!def.noPoster) {
      S.neon(
        'mall_new_collection',
        BACK - 0.08,
        -4.3,
        3.65,
        0.9,
        1.35,
        0,
        C.warm,
        0,
      );
      S.neon('mall_sale', BACK - 0.08, 4.3, 3.65, 0.9, 1.35, 0, C.warm, 0);
    }
  };
  return S;
}

/** Fasada sklepu: portal, ściana, krata z kolizją (dwa moduły po 6 m). */
function front(k, def) {
  const f = makeFrame(def.side, def.level, def.c);
  const y0 = f.y0;
  for (const m of [-3, 3]) {
    const o = f.at(0.5, m);
    deco(k, 'mall_storefront', o.x, y0, o.z, f.front);
    const g = f.at(0.4, m);
    deco(k, 'mall_shutter_grille', g.x, y0, g.z, f.front);
    solid(k, f.rect(0.32, 0.48, m - 2, m + 2), y0, y0 + 3.6, 'metal', {
      visible: false,
      walkable: false,
    });
    for (const [a, b] of [
      [m - 3, m - 2],
      [m + 2, m + 3],
    ])
      solid(k, f.rect(0.5, WALL, a, b), y0, y0 + storyH(def.level), 'lacquer', {
        walkable: false,
      });
    solid(
      k,
      f.rect(0.5, WALL, m - 2, m + 2),
      y0 + 3.6,
      y0 + storyH(def.level),
      'lacquer',
      {
        walkable: false,
      },
    );
    solid(
      k,
      f.rect(0, 0.5, m - 3, m + 3),
      y0 + 4.6,
      y0 + storyH(def.level),
      'trim',
      {
        walkable: false,
      },
    );
  }
}

const G = (list) => list;

export const SHOPS = [
  {
    id: 'S-01',
    name: 'VERVE // ATELIER',
    side: 'W',
    level: 0,
    c: 12,
    sign: 'mall_fashion',
    tint: C.amber,
    fill(S) {
      S.common({ checkout: [5.0, -4.5], accent: 'neon_amber' });
      S.M('mall_mannequin', 2.15, -3.2, 0, 0.14);
      S.M('mall_mannequin', 2.15, 3.2, 0, 0.14);
      S.M('mall_promo_stand', 2.4, 0, 0);
      S.M('mall_clothes_rack', 3.9, -3.6, 0);
      S.M('mall_clothes_rack', 3.9, 3.6, 0);
      S.M('mall_display_table', 3.6, 0, 0);
      S.wallShelf(-5.6, -1.6, { goods: G(['fabric', 'lacquer', 'hivis']) });
      S.wallShelf(1.6, 5.6, { goods: G(['lacquer', 'fabric', 'paint']) });
      S.B(5.3, BACK, -1.1, 1.1, 0, 2.3, 'wood');
      S.B(5.2, 5.3, -1.0, 1.0, 0.1, 2.1, 'fabric');
      S.B(5.3, 5.38, -1.1, 1.1, 2.3, 2.4, 'neon_amber');
      S.neon(
        'mall_new_collection',
        BACK - 0.08,
        -3.6,
        2.8,
        1.0,
        1.5,
        0,
        C.warm,
        0,
      );
      S.neon('mall_sale', BACK - 0.08, 3.6, 2.8, 1.0, 1.5, 0, C.warm, 0);
    },
  },
  {
    id: 'S-02',
    name: 'STRIDE // FOOTWEAR',
    side: 'W',
    level: 0,
    c: 0,
    sign: 'mall_footwear',
    tint: C.green,
    fill(S) {
      S.common({ checkout: [4.9, 4.5], accent: 'neon_green' });
      S.M('mall_shoe_wall', BACK - 0.05, -1.8, 0);
      S.M('mall_shoe_wall', BACK - 0.05, 1.8, 0);
      for (const v of [-0.9, 0.9]) {
        S.B(2.2, 2.6, v - 0.3, v + 0.3, 0, 0.1, 'trim');
        S.B(2.3, 2.5, v - 0.25, v + 0.25, 0.1, 1.3, 'hivis');
        S.B(2.3, 2.5, v - 0.2, v + 0.2, 1.3, 1.34, 'neon_green');
      }
      S.wallShelf(-5.8, -3.7, {
        rows: 5,
        base: 0.25,
        goods: G(['plastic', 'hivis', 'neon_green']),
      });
      S.wallShelf(3.7, 5.8, {
        rows: 5,
        base: 0.25,
        pitch: 0.46,
        goods: G(['hivis', 'plastic', 'neon_blue']),
      });
      S.table(3.4, -2.6, 1.6, 0.9, 0.75, {
        goods: G(['hivis', 'plastic']),
        items: 3,
        dome: true,
      });
      S.table(3.4, 2.6, 1.6, 0.9, 0.75, {
        goods: G(['plastic', 'neon_green']),
        items: 3,
        dome: true,
      });
      for (const v of [-1.5, -0.5, 0.5, 1.5])
        S.B(4.2, 4.7, v - 0.25, v + 0.25, 0, 0.45, 'fabric');
    },
  },
  {
    id: 'S-03',
    name: 'VOLT-X // CYBER-AV',
    side: 'W',
    level: 0,
    c: -12,
    sign: 'mall_electronics',
    tint: C.blue,
    noPoster: true,
    fill(S) {
      S.common({ checkout: [2.9, -4.5], accent: 'neon_blue' });
      S.M('mall_electronics_shelf', BACK - 0.45, -3.6, 0);
      S.M('mall_electronics_shelf', BACK - 0.45, 3.6, 0);
      S.M('wh_server_rack', BACK - 0.55, -0.7, 0);
      S.M('wh_server_rack', BACK - 0.55, 0.7, 0);
      S.B(2.5, 3.1, -0.6, 0.6, 0, 0.9, 'machine');
      S.M('city_holo_projector', 2.8, 0, 0, 0.9);
      S.holo('holo_android', 2.8, 0, 1.9, 1.5, 1.5, C.blue);
      S.screens(
        -5.4,
        5.4,
        2.55,
        2,
        G(['neon_blue', 'neon_violet', 'neon_blue']),
      );
      S.table(3.9, -2.6, 2.0, 0.9, 0.85, {
        base: 'machine',
        top: 'lacquer',
        goods: G(['neon_blue', 'neon_violet']),
        items: 4,
      });
      S.table(3.9, 2.6, 2.0, 0.9, 0.85, {
        base: 'machine',
        top: 'lacquer',
        goods: G(['neon_violet', 'neon_blue']),
        items: 4,
      });
      S.gondola(2.9, 4.1, 2.0, { goods: G(['machine', 'hivis', 'plastic']) });
    },
  },
  {
    id: 'S-04',
    name: 'NOVA ROAST // CAFE',
    side: 'E',
    level: 0,
    c: -12,
    sign: 'cat_cafe',
    tint: C.amber,
    fill(S) {
      S.common({ checkout: [4.5, 0], accent: 'neon_amber' });
      S.M('mall_cafe_set', 2.9, -3.4, 0);
      S.M('mall_cafe_set', 2.9, 3.4, 0);
      S.B(5.4, 6.0, -5.2, 5.2, 0, 1.1, 'wood');
      S.B(5.35, 6.05, -5.2, 5.2, 1.1, 1.16, 'lacquer');
      S.B(5.6, 5.9, -3.5, -2.4, 1.16, 1.6, 'metal');
      S.B(5.6, 5.9, 2.4, 3.5, 1.16, 1.6, 'machine');
      S.B(5.5, 5.9, -1.0, 1.0, 1.16, 1.7, 'glass_clear');
      S.B(5.55, 5.85, -0.9, 0.9, 1.16, 1.3, 'neon_amber');
      S.wallShelf(-5.6, -1.6, {
        rows: 3,
        base: 1.5,
        goods: G(['paint', 'hivis', 'lacquer']),
      });
      S.wallShelf(1.6, 5.6, {
        rows: 3,
        base: 1.5,
        goods: G(['hivis', 'paint']),
      });
      S.screens(-1.4, 1.4, 2.5, 2, G(['neon_amber']));
    },
  },
  {
    id: 'S-05',
    name: 'KUROGANE // URBAN GEAR',
    side: 'E',
    level: 0,
    c: 12,
    sign: 'mall_kurogane',
    tint: C.amber,
    fill(S) {
      S.common({ checkout: [2.6, 4.5], accent: 'neon_amber' });
      S.M('mall_kurogane_display', BACK - 0.5, -3.6, 0);
      S.M('mall_kurogane_display', BACK - 0.5, 3.6, 0);
      S.M('wh_workbench_weapons', 5.0, 0, 0);
      S.M('wh_weapon_case_stack', 3.8, -3.6, 0);
      S.M('wh_weapon_case_stack', 3.8, 3.6, 0);
      for (const v of [-1.6, 1.6]) {
        S.B(2.3, 2.9, v - 0.3, v + 0.3, 0, 0.45, 'machine');
        S.B(2.4, 2.8, v - 0.25, v + 0.25, 0.45, 1.2, 'container_graphite');
        S.B(2.45, 2.75, v - 0.2, v + 0.2, 1.2, 1.5, 'hivis');
      }
      S.B(3.2, 3.6, -0.4, 0.4, 0, 1.1, 'machine');
      S.B(3.25, 3.55, -0.3, 0.3, 1.1, 1.14, 'neon_amber');
      S.holo('holo_kurogane', 3.4, 0, 1.9, 1.6, 1.6, C.amber);
      S.screens(-1.8, 1.8, 2.5, 2, G(['neon_blue']));
    },
  },
  {
    id: 'S-06',
    name: 'NEO-TAILOR // BESPOKE',
    side: 'W',
    level: 1,
    c: 12,
    sign: 'mall_fashion',
    tint: C.violet,
    fill(S) {
      S.common({ checkout: [5.0, -4.5], accent: 'neon_violet' });
      S.M('mall_mannequin', 2.15, -3.2, 0, 0.14);
      S.M('mall_mannequin', 2.15, 3.2, 0, 0.14);
      S.M('mall_clothes_rack', 3.9, -3.6, 0);
      S.M('mall_clothes_rack_amber', 3.9, 3.6, 0);
      S.table(3.4, 0, 2.2, 1.2, 0.9, {
        base: 'wood',
        top: 'lacquer',
        goods: G(['fabric', 'paint', 'fabric']),
        items: 4,
      });
      S.wallShelf(-5.6, -2.0, {
        rows: 4,
        goods: G(['fabric', 'paint', 'lacquer']),
      });
      S.wallShelf(2.0, 5.6, { rows: 4, goods: G(['paint', 'fabric']) });
      S.B(5.6, BACK, -1.5, 1.5, 0.6, 2.4, 'glass_clear');
      S.B(5.55, 5.6, -1.5, 1.5, 0.5, 2.5, 'light_panel');
      S.B(5.0, 5.4, -1.2, 1.2, 0, 0.45, 'fabric');
    },
  },
  {
    id: 'S-07',
    name: 'IRIS // OPTICS & AUG',
    side: 'W',
    level: 1,
    c: -12,
    sign: 'mall_optics',
    tint: C.blue,
    fill(S) {
      S.common({ checkout: [4.4, 4.5], accent: 'neon_blue' });
      S.M('wh_server_rack', BACK - 0.55, -5.0, 0);
      S.wallShelf(-4.2, -1.4, {
        rows: 5,
        base: 0.5,
        pitch: 0.46,
        boards: 'glass_clear',
        goods: G(['neon_blue', 'plastic', 'light_panel']),
      });
      S.wallShelf(1.4, 5.6, {
        rows: 5,
        base: 0.5,
        pitch: 0.46,
        boards: 'glass_clear',
        goods: G(['plastic', 'neon_blue', 'light_panel']),
      });
      S.B(3.4, 4.0, -0.5, 0.5, 0, 0.55, 'lacquer');
      S.B(3.5, 3.9, -0.4, 0.4, 0.55, 1.0, 'fabric');
      S.B(3.6, 4.4, -0.1, 0.1, 1.0, 2.1, 'machine');
      S.B(3.2, 3.5, -0.15, 0.15, 1.6, 1.9, 'neon_blue');
      S.B(BACK - 0.06, BACK, -0.9, 0.9, 2.3, 3.2, 'light_panel');
      S.B(2.8, 3.2, 3.1, 3.7, 0, 1.0, 'machine');
      S.holo('holo_implant', 3.0, 3.4, 1.8, 1.4, 1.4, C.blue);
      for (const v of [-3.4, -2.2]) {
        S.B(2.6, 3.0, v - 0.2, v + 0.2, 0, 1.4, 'machine');
        S.B(2.6, 3.0, v - 0.2, v + 0.2, 1.4, 1.46, 'glass_clear');
        S.B(2.65, 2.95, v - 0.15, v + 0.15, 1.46, 1.58, 'neon_blue');
      }
      S.B(3.3, 3.5, 4.9, 5.1, 1.0, 1.1, 'neon_blue');
      S.B(3.2, 3.6, 4.7, 5.3, 0, 1.0, 'machine');
    },
  },
  {
    id: 'S-08',
    name: 'HELIX-MED // APTEKA 24H',
    side: 'N',
    level: 1,
    c: -6,
    sign: 'pharmacy',
    tint: C.green,
    fill(S) {
      S.common({ checkout: [2.6, 0], accent: 'neon_green' });
      S.M('mall_pharmacy_counter', 4.5, -3.4, 0);
      S.M('mall_pharmacy_counter', 4.5, 3.4, 0);
      S.M('city_vending', 5.6, 0, 2);
      S.wallShelf(-5.6, -1.2, {
        rows: 5,
        base: 0.3,
        pitch: 0.5,
        goods: G(['neon_green', 'plastic', 'neon_blue']),
      });
      S.wallShelf(1.2, 5.6, {
        rows: 5,
        base: 0.3,
        pitch: 0.5,
        goods: G(['plastic', 'neon_green', 'neon_blue']),
      });
      S.B(BACK - 0.06, BACK, -0.2, 0.2, 2.6, 3.6, 'neon_green');
      S.B(BACK - 0.06, BACK, -0.7, 0.7, 3.0, 3.2, 'neon_green');
    },
  },
  {
    id: 'S-09',
    name: 'ECHO // SYNTH & AUDIO',
    side: 'E',
    level: 1,
    c: -12,
    sign: 'karaoke',
    tint: C.violet,
    fill(S) {
      S.common({ checkout: [4.2, 4.5], accent: 'neon_violet' });
      S.M('mall_electronics_shelf', BACK - 0.45, -3.6, 0);
      S.M('city_ad_screen', BACK - 0.1, 3.6, 0, 0.4);
      S.M('mall_promo_stand', 2.4, 0, 0);
      for (const v of [-5.2, -4.0, 4.0, 5.2]) {
        S.B(2.6, 3.1, v - 0.25, v + 0.25, 0, 1.8, 'machine');
        S.B(2.65, 2.7, v - 0.2, v + 0.2, 1.2, 1.4, 'neon_violet');
      }
      for (const [u, v] of [
        [3.4, -2],
        [3.4, 2],
        [4.6, 0],
      ]) {
        S.B(u - 0.3, u + 0.3, v - 0.7, v + 0.7, 0, 0.85, 'lacquer');
        S.B(u - 0.25, u + 0.25, v - 0.65, v + 0.65, 0.85, 0.95, 'neon_violet');
        S.B(u - 0.2, u + 0.2, v - 0.6, v + 0.6, 0.95, 1.0, 'wood');
      }
      S.screens(-1.2, 1.2, 2.6, 2, G(['neon_amber', 'neon_violet']));
    },
  },
  {
    id: 'S-10',
    name: 'AUREA // HOROLOGY',
    side: 'E',
    level: 1,
    c: 12,
    sign: 'mall_jewelry',
    tint: C.warm,
    fill(S) {
      S.common({ checkout: [4.2, 0], accent: 'neon_amber' });
      S.M('mall_kurogane_display', BACK - 0.5, -3.6, 0);
      S.M('mall_kurogane_display', BACK - 0.5, 3.6, 0);
      S.B(BACK - 0.3, BACK, -1.0, 1.0, 0.6, 2.6, 'metal');
      S.B(BACK - 0.4, BACK - 0.3, -0.8, 0.8, 0.8, 2.4, 'trim');
      S.B(BACK - 0.45, BACK - 0.4, -0.1, 0.1, 1.5, 1.7, 'neon_green');
      for (const v of [-3.2, 3.2]) {
        S.B(2.6, 3.6, v - 1.0, v + 1.0, 0, 0.9, 'lacquer');
        S.B(2.6, 3.6, v - 1.0, v + 1.0, 0.9, 0.96, 'fabric');
        S.B(2.7, 3.5, v - 0.9, v + 0.9, 0.96, 1.4, 'glass_clear');
        S.B(2.9, 3.3, v - 0.5, v + 0.5, 0.96, 1.1, 'neon_amber');
      }
      S.B(3.4, 3.8, -0.2, 0.2, 3.3, storyH(1), 'light_panel');
      S.B(3.0, 4.2, -0.2, 0.2, 3.2, 3.3, 'light_panel');
    },
  },
  {
    id: 'S-11',
    name: 'APEX // OUTDOOR & SPORT',
    side: 'W',
    level: 2,
    c: 12,
    sign: 'warsztat',
    tint: C.green,
    fill(S) {
      S.common({ checkout: [4.9, -4.5], accent: 'neon_green' });
      S.M('mall_shoe_wall', BACK - 0.05, -3.4, 0);
      S.M('hw_camp_tent_dome', 4.0, 3.2, 0);
      S.M('mall_clothes_rack_amber', 3.6, -3.7, 0);
      S.M('mall_display_table', 2.4, 0, 0);
      S.B(BACK - 0.25, BACK, 0.4, 5.6, 0.3, 3.0, 'concrete');
      for (let i = 0; i < 6; i++)
        S.B(
          BACK - 0.35,
          BACK - 0.25,
          0.7 + i * 0.8,
          0.9 + i * 0.8,
          0.8 + (i % 3) * 0.7,
          1.0 + (i % 3) * 0.7,
          i % 2 ? 'hivis' : 'neon_green',
        );
      S.B(2.4, 2.8, -4.6, -4.2, 0, 1.0, 'machine');
      S.B(2.3, 2.9, -4.7, -4.1, 1.0, 1.8, 'hivis');
      S.B(2.3, 2.9, -4.7, -4.1, 1.8, 2.0, 'fabric');
    },
  },
  {
    id: 'S-12',
    name: 'KODEKS // BOOKS & HOLO',
    side: 'W',
    level: 2,
    c: -12,
    sign: 'mall_books',
    tint: C.warm,
    fill(S) {
      S.common({ checkout: [2.2, 4.5], accent: 'neon_amber' });
      S.wallShelf(-5.8, 5.8, {
        rows: 5,
        base: 0.2,
        pitch: 0.5,
        goods: G(['paint', 'lacquer', 'hivis', 'fabric']),
      });
      for (const u of [3.5, 4.9]) {
        S.B(u - 0.2, u + 0.2, -4.6, 3.2, 0, 2.2, 'wood');
        for (let i = 0; i < 8; i++)
          S.B(
            u - 0.24,
            u + 0.24,
            -4.5 + i * 0.97,
            -3.7 + i * 0.97,
            0.3 + (i % 3) * 0.55,
            0.75 + (i % 3) * 0.55,
            ['paint', 'lacquer', 'fabric', 'hivis'][i % 4],
          );
      }
      for (const [r, w] of [
        [0, 1.8],
        [1, 1.2],
        [2, 0.6],
      ])
        S.B(
          2.3,
          2.9,
          -w / 2 + 0.2,
          w / 2 + 0.2,
          r * 0.3,
          r * 0.3 + 0.3,
          ['paint', 'lacquer', 'hivis'][r],
        );
      S.B(2.0, 2.8, -3.2, -2.4, 0, 0.45, 'fabric');
      S.B(1.7, 1.75, -3.0, -2.6, 0, 1.6, 'metal');
      S.B(1.6, 1.9, -3.1, -2.5, 1.6, 1.8, 'light_panel');
      S.screens(4.0, 5.6, 2.6, 1, G(['neon_blue']));
    },
  },
  {
    id: 'S-13',
    name: 'AURA // SYNTH-PERFUME',
    side: 'N',
    level: 2,
    c: 6,
    sign: 'cocktail',
    tint: C.violet,
    fill(S) {
      S.common({ checkout: [2.6, 0], accent: 'neon_violet' });
      S.M('mall_pharmacy_counter', 4.5, -3.4, 0);
      S.M('mall_pharmacy_counter', 4.5, 3.4, 0);
      S.wallShelf(-5.6, -1.2, {
        rows: 5,
        base: 0.3,
        pitch: 0.5,
        boards: 'glass_clear',
        goods: G(['neon_violet', 'neon_amber', 'plastic']),
      });
      S.wallShelf(1.2, 5.6, {
        rows: 5,
        base: 0.3,
        pitch: 0.5,
        boards: 'glass_clear',
        goods: G(['neon_amber', 'neon_violet', 'plastic']),
      });
      S.B(3.6, 4.0, -0.5, 0.5, 0, 0.9, 'lacquer');
      S.B(3.65, 3.95, -0.4, 0.4, 0.9, 1.5, 'glass_clear');
      S.B(3.7, 3.9, -0.3, 0.3, 0.9, 1.1, 'neon_violet');
      S.neon('mall_opening', BACK - 0.08, 0, 3.0, 1.0, 1.5, 0, C.warm, 0);
    },
  },
  {
    id: 'S-14',
    name: 'AERO-TOY // DRONY & RC',
    side: 'E',
    level: 2,
    c: -12,
    sign: 'repair',
    tint: C.blue,
    fill(S) {
      S.common({ checkout: [2.6, 4.5], accent: 'neon_green' });
      S.M('wh_workbench_weapons', 5.2, 0, 0);
      S.M('city_holo_projector', 2.9, 0, 0, 0.9);
      S.B(2.6, 3.2, -0.6, 0.6, 0, 0.9, 'machine');
      S.holo('holo_android', 2.9, 0, 1.9, 1.4, 1.4, C.blue);
      for (const [u, v] of [
        [2.6, -3.6],
        [4.2, 3.4],
        [3.4, 0.2],
      ]) {
        const p = S.f.at(u, v);
        const y = S.y0;
        box(S.k, p.x, y + 3.1, p.z, 0.5, 0.12, 0.5, 'machine');
        box(S.k, p.x, y + 3.16, p.z, 0.9, 0.04, 0.06, 'metal');
        box(S.k, p.x, y + 3.16, p.z, 0.06, 0.04, 0.9, 'metal');
        box(S.k, p.x, y + 3.04, p.z, 0.2, 0.05, 0.2, 'neon_green');
        box(S.k, p.x, y + 3.95, p.z, 0.03, 1.7, 0.03, 'metal');
      }
      S.gondola(3.4, -3.6, 2.4, { goods: G(['plastic', 'hivis', 'machine']) });
      S.gondola(5.0, 3.6, 2.4, { goods: G(['hivis', 'plastic', 'neon_blue']) });
      S.wallShelf(-5.6, -2.0, {
        rows: 4,
        goods: G(['plastic', 'machine', 'neon_blue']),
      });
      S.wallShelf(2.0, 5.6, {
        rows: 4,
        goods: G(['machine', 'plastic', 'hivis']),
      });
    },
  },
  {
    id: 'S-15',
    name: 'MIDORI // MATCHA & RAMEN',
    side: 'E',
    level: 2,
    c: 12,
    sign: 'ramen',
    tint: C.green,
    fill(S) {
      S.common({ checkout: [4.4, 0], accent: 'neon_green' });
      S.M('mall_cafe_set', 2.9, -3.4, 0);
      S.M('mall_cafe_set', 2.9, 3.4, 0);
      S.B(5.4, 6.0, -5.2, 5.2, 0, 1.1, 'wood');
      S.B(5.35, 6.05, -5.2, 5.2, 1.1, 1.16, 'lacquer');
      S.B(5.6, 5.9, -4.0, -2.6, 1.16, 1.6, 'metal');
      S.B(5.6, 5.9, 2.6, 4.0, 1.16, 1.5, 'machine');
      for (const v of [-5, 5])
        S.B(3.0, 3.1, v - 0.05, v + 0.05, 0, storyH(2), 'metal');
      // Własne klosze nie uruchamiają automatycznych LampCones dekoracji city_lantern_string.
      for (const v of [-4, -2, 0, 2, 4]) {
        S.B(3.0, 3.1, v - 0.3, v + 0.3, 3.35, 3.9, 'light_panel');
        S.B(2.98, 3.12, v - 0.33, v + 0.33, 3.9, 3.96, 'wood');
      }
      for (let i = 0; i < 9; i++)
        S.B(
          6.3,
          6.5,
          -4.6 + i * 1.15,
          -4.4 + i * 1.15,
          1.8,
          3.4,
          i % 2 ? 'wood' : 'lacquer',
        );
      S.holo('holo_noodles', 4.2, 0, 2.2, 1.4, 1.4, C.green);
    },
  },
];

/** Zaplecza: drzwi serwisowe i automaty vendingowe w pasażach przy polach fasady bez sklepu. */
function bays(k, placer) {
  const list = [
    ['W', 1, 0],
    ['W', 2, 0],
    ['E', 0, 0],
    ['E', 1, 0],
    ['E', 2, 0],
    ['N', 1, 6],
    ['N', 2, -6],
  ];
  for (const [side, level, c] of list) {
    const f = makeFrame(side, level, c);
    const door = f.at(-0.12, 0);
    deco(k, 'city_door', door.x, f.y0, door.z, f.front);
    for (const v of [-2.6, 2.6]) {
      const p = f.at(-0.5, v);
      placer.prop(
        'city_vending',
        p.x,
        p.z,
        f.y0,
        side === 'W' ? 1 : side === 'E' ? -1 : 0,
      );
    }
    const fix = f.at(0, 4.2);
    deco(k, 'mall_security_fixture', fix.x, f.y0 + 1.1, fix.z, f.front);
  }
}

export function buildShops(k, placer) {
  for (const def of SHOPS) {
    front(k, def);
    const shop = shopKit(k, def);
    def.fill(shop);
    shop.showcase();
  }
  bays(k, placer);
}

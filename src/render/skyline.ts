import { tuning } from '../core/tuning';
import { Rng } from '../core/rng';

/**
 * Deterministyczny układ panoramy miasta (bez Three.js, testowalny).
 * Warstwy wieżowców na pierścieniach wokół pokoju, punkty orientacyjne
 * (wieże z masztem i bursztynowym światłem ostrzegawczym), reklamy-hologramy
 * na fasadach i tory przelatujących pojazdów. Kolory są indeksami palety
 * otoczenia z ADR 0006 (bez czerwieni, cyanu i magenty).
 */

/** Indeksy palety: 0 bursztyn, 1 ciepła biel, 2 błękit, 3 fiolet, 4 zieleń. */
export const SKY_PALETTE = [
  '#ffae1a',
  '#fff1d6',
  '#3d7bff',
  '#8a5cff',
  '#6dff4a',
] as const;

export interface SkylineBuilding {
  x: number;
  z: number;
  /** Obrót wokół Y (rad): lokalne +Z patrzy na środek pokoju. */
  yaw: number;
  width: number;
  depth: number;
  height: number;
  /** Wysokość podstawy (świat). */
  baseY: number;
  /** Ziarno okien 0..1. */
  seed: number;
  /** 0 = budynek z oknami, 1 = maszt / konstrukcja bez okien. */
  kind: 0 | 1;
  /** Indeks palety światła okien. */
  windowColor: number;
  /** Udział oświetlonych okien 0..1. */
  lit: number;
  /** Indeks palety neonowego wieńca i krawędzi albo -1 (brak). */
  accent: number;
  /** Jasność ściany 0..1 (mnoży kolor fasady). */
  tone: number;
  /** Numer warstwy 0 (najbliższa) .. 3; punkty orientacyjne = 4. */
  layer: number;
}

export interface SkylineBeacon {
  x: number;
  y: number;
  z: number;
  /** Średnica rdzenia [m]. */
  size: number;
  /** Okres migania [s]; 0 = światło stałe. */
  period: number;
  phase: number;
  /** Indeks palety. */
  color: number;
}

export interface SkylineAd {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  color: number;
  /** 0 pionowy pas znaków, 1 szeroki baner, 2 znak/logo. */
  style: number;
}

export interface SkylineLane {
  radius: number;
  height: number;
  /** rad/s, znak = kierunek. */
  speed: number;
  phase: number;
  /** Poziom ruchu w trybie wysoko położonych map. */
  tier?: 'canyon' | 'window';
}

export interface SkylineFlyby {
  /** Punkt startowy odcinka przelotu względem środka panoramy [m]. */
  startX: number;
  startZ: number;
  /** Znormalizowany kierunek lotu w płaszczyźnie XZ. */
  dirX: number;
  dirZ: number;
  /** Długość odcinka przelotu [m]. */
  spanM: number;
  /** Wysokość toru [m] (świat). */
  height: number;
  /** Faza w cyklu (0..1). */
  phaseFrac: number;
  /** Elewacja, wzdłuż której przelatuje pojazd. */
  side: 'north' | 'west';
}

export interface SkylineBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SkylineLayout {
  buildings: SkylineBuilding[];
  beacons: SkylineBeacon[];
  ads: SkylineAd[];
  lanes: SkylineLane[];
  flybys: SkylineFlyby[];
}

export interface SkylineOptions {
  floorY: number;
  /** Obniżenie bazy miasta poniżej poziomu podłogi mapy [m]. */
  dropM?: number;
  /** Lokalny obrys fasad budynku względem środka panoramy [m]. */
  facadeBounds?: SkylineBounds;
  ringOffsetM?: number;
  ringsM?: readonly number[];
  /** 0..1, gęstość zabudowy. */
  density: number;
  /** Typowa wysokość bliskiej warstwy [m]. */
  height: number;
  /** 0..1, ruch pojazdów. */
  traffic: number;
}

const LAYERS = [
  { jitter: 4, w: [7, 13], h: [0.55, 0.95], tone: 0.62 },
  { jitter: 6, w: [9, 16], h: [0.85, 1.35], tone: 0.5 },
  { jitter: 7, w: [10, 19], h: [1.15, 1.8], tone: 0.4 },
  { jitter: 8, w: [12, 24], h: [1.4, 2.2], tone: 0.32 },
] as const;

/** Kąty punktów orientacyjnych (rad, 0 = +Z, π = −Z — typowy kierunek widoku ze spawnu). */
const LANDMARKS = [
  { angle: Math.PI + 0.3, radius: 'firstLandmarkM', height: 3.3, width: 15 },
  { angle: 0.55, radius: 'secondLandmarkM', height: 2.7, width: 13 },
  {
    angle: Math.PI * 0.5 + 0.2,
    radius: 'thirdLandmarkM',
    height: 2.4,
    width: 12,
  },
] as const;

function windowColor(rng: Rng): number {
  const r = rng.float(0, 1);
  if (r < 0.62) return 1;
  if (r < 0.88) return 0;
  if (r < 0.95) return 2;
  return 3;
}

function angularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

function facadeSupport(dx: number, dz: number, b: SkylineBounds): number {
  return Math.max(
    0,
    Math.max(b.minX * dx, b.maxX * dx) + Math.max(b.minZ * dz, b.maxZ * dz),
  );
}

export function buildSkyline(seed: string, o: SkylineOptions): SkylineLayout {
  const t = tuning.horizon;
  const e = t.elevated;
  const dropM = Math.max(0, o.dropM ?? 0);
  const elevated = dropM >= e.minDropM;
  const roomFloorY = o.floorY + dropM;
  const offset = o.ringOffsetM ?? 0;
  const rings = o.ringsM ?? [
    t.firstRingM,
    t.secondRingM,
    t.thirdRingM,
    t.fourthRingM,
  ];
  const landmarks = LANDMARKS.map((landmark) => ({
    ...landmark,
    radius: t[landmark.radius] + offset,
  }));
  const rng = new Rng(seed).fork('skyline');
  const density = Math.min(1, Math.max(0, o.density));
  const baseHeight = Math.max(1, o.height);
  const buildings: SkylineBuilding[] = [];
  const beacons: SkylineBeacon[] = [];
  const ads: SkylineAd[] = [];
  const lanes: SkylineLane[] = [];
  const flybys: SkylineFlyby[] = [];
  // Podstawy poniżej ulicy: zza krawędzi dachów i murków widać pełne bryły, nie pustkę.
  const baseY = o.floorY - 24;
  const top = (height: number): number => o.floorY + height;

  const landmarkClear = (angle: number, radius: number): boolean =>
    landmarks.every(
      (l) =>
        angularGap(angle, l.angle) * radius > l.width * 1.4 + 6 ||
        Math.abs(radius - l.radius) > 22,
    );

  LAYERS.forEach((layer, index) => {
    let angle = rng.float(0, Math.PI * 2);
    const end = angle + Math.PI * 2;
    // Rzadziej zabudowane = większe przerwy między budynkami.
    const gap = 0.25 + (1 - density) * 1.6;
    while (angle < end - 0.02) {
      const width = rng.float(layer.w[0], layer.w[1]);
      const radius = rings[index]! + rng.float(-layer.jitter, layer.jitter);
      const step = width / radius;
      const a = angle + step / 2;
      angle += step * (1 + rng.float(0, gap));
      if (rng.float(0, 1) < 0.07) angle += step * rng.float(1, 2.5);
      if (!landmarkClear(a, radius)) continue;
      const tower = rng.float(0, 1) < 0.13;
      const height =
        baseHeight *
        rng.float(layer.h[0], layer.h[1]) *
        rng.float(0.55, 1.1) *
        (tower ? rng.float(1.35, 1.7) : 1);
      const yaw = a + Math.PI;
      const x = Math.sin(a) * radius;
      const z = Math.cos(a) * radius;
      const depth = rng.float(0.7, 1.1) * width;
      const accent =
        rng.float(0, 1) < (tower ? 0.35 : 0.06)
          ? rng.pick([0, 2, 3, 4, 0, 1])
          : -1;
      const tone = layer.tone * rng.float(0.85, 1.15);
      const h = top(height) - baseY;
      buildings.push({
        x,
        z,
        yaw,
        width,
        depth,
        height: h,
        baseY,
        seed: rng.float(0, 1),
        kind: 0,
        windowColor: windowColor(rng),
        lit: rng.float(0.18, 0.45),
        accent,
        tone,
        layer: index,
      });
      // Uskok: węższa nadbudowa (sylwetka „schodkowa” zamiast samych pudełek).
      if (rng.float(0, 1) < 0.42) {
        const k = rng.float(0.5, 0.78);
        const extra = height * rng.float(0.1, 0.28);
        buildings.push({
          x,
          z,
          yaw,
          width: width * k,
          depth: depth * k,
          height: extra,
          baseY: top(height),
          seed: rng.float(0, 1),
          kind: 0,
          windowColor: windowColor(rng),
          lit: rng.float(0.2, 0.5),
          accent: accent >= 0 ? accent : -1,
          tone: tone * 0.95,
          layer: index,
        });
        if (index <= 2 && rng.float(0, 1) < 0.5)
          beacons.push({
            x,
            y: top(height + extra) + 0.6,
            z,
            size: 0.9,
            period: rng.float(1.6, 2.6),
            phase: rng.float(0, 10),
            color: 0,
          });
      } else if (index <= 2 && rng.float(0, 1) < 0.22) {
        beacons.push({
          x,
          y: top(height) + 0.5,
          z,
          size: 0.8,
          period: rng.float(1.8, 3),
          phase: rng.float(0, 10),
          color: 0,
        });
      }
    }
  });

  // Punkty orientacyjne: smukła wieża z uskokami, maszt i bursztynowe światła ostrzegawcze.
  landmarks.forEach((l, i) => {
    const x = Math.sin(l.angle) * l.radius;
    const z = Math.cos(l.angle) * l.radius;
    const yaw = l.angle + Math.PI;
    const height = baseHeight * l.height;
    const tiers = [
      { k: 1, h: height * 0.72 },
      { k: 0.72, h: height * 0.18 },
      { k: 0.45, h: height * 0.1 },
    ];
    let y = baseY;
    tiers.forEach((tier, t) => {
      const h = t === 0 ? top(tier.h) - baseY : tier.h;
      buildings.push({
        x,
        z,
        yaw,
        width: l.width * tier.k,
        depth: l.width * tier.k,
        height: h,
        baseY: y,
        seed: rng.float(0, 1),
        kind: 0,
        windowColor: i === 0 ? 1 : 0,
        lit: rng.float(0.45, 0.65),
        accent: i === 0 ? 0 : i === 1 ? 3 : 2,
        tone: 0.55,
        layer: 4,
      });
      y += h;
      // Światła na narożnikach uskoków.
      const half = (l.width * tier.k) / 2;
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const lx = sx * half * Math.cos(yaw) + sz * half * Math.sin(yaw);
        const lz = -sx * half * Math.sin(yaw) + sz * half * Math.cos(yaw);
        beacons.push({
          x: x + lx,
          y: y + 0.4,
          z: z + lz,
          size: 0.9,
          period: 2.2,
          phase: t * 0.35 + i,
          color: 0,
        });
      }
    });
    const mast = height * (i === 0 ? 0.42 : 0.3);
    buildings.push({
      x,
      z,
      yaw,
      width: 0.9,
      depth: 0.9,
      height: mast,
      baseY: y,
      seed: 0,
      kind: 1,
      windowColor: 0,
      lit: 0,
      accent: -1,
      tone: 0.5,
      layer: 4,
    });
    // Dwa poziomy świateł na maszcie i duże światło na szczycie.
    beacons.push({
      x,
      y: y + mast * 0.5,
      z,
      size: 1.1,
      period: 1.4,
      phase: i * 0.7 + 0.25,
      color: 0,
    });
    beacons.push({
      x,
      y: y + mast + 0.5,
      z,
      size: i === 0 ? 2.2 : 1.6,
      period: 1.4,
      phase: i * 0.7,
      color: 0,
    });
  });

  // Reklamy-hologramy w górnej części fasad warstw 1–2: w każdym sektorze budynek
  // o największej wysokości kątowej (widoczny ponad bliższą zabudową).
  if (!elevated) {
    const sectors = [Math.PI - 0.45, Math.PI + 0.75, Math.PI * 0.5 - 0.2];
    const styles = [0, 1, 2];
    const colors = [3, 0, 4];
    const streetTop = (b: SkylineBuilding): number =>
      b.baseY + b.height - o.floorY;
    sectors.forEach((center, i) => {
      let best: SkylineBuilding | undefined;
      let bestScore = 0;
      for (const b of buildings) {
        if (b.layer < 1 || b.layer > 2 || b.kind !== 0 || b.baseY !== baseY)
          continue;
        const a = Math.atan2(b.x, b.z);
        if (angularGap(a, center) > 0.5) continue;
        const score = streetTop(b) / Math.hypot(b.x, b.z);
        if (score > bestScore) {
          best = b;
          bestScore = score;
        }
      }
      const style = styles[i]!;
      if (!best) {
        // Brak budynku w sektorze (rzadka zabudowa): wolny hologram nad dachami.
        ads.push({
          x: Math.sin(center) * (t.freestandingAdM + offset),
          y: o.floorY + baseHeight * 0.9,
          z: Math.cos(center) * (t.freestandingAdM + offset),
          yaw: center + Math.PI,
          width: 10,
          height: style === 1 ? 4.5 : 12,
          color: colors[i]!,
          style,
        });
        return;
      }
      const r = Math.hypot(best.x, best.z);
      const inward = best.depth / 2 + 0.6;
      const topY = streetTop(best);
      const width = style === 1 ? best.width * 0.9 : best.width * 0.6;
      const height =
        style === 0
          ? Math.min(topY * 0.45, width * 2.4)
          : style === 1
            ? width * 0.4
            : width * 0.85;
      ads.push({
        x: (best.x / r) * (r - inward),
        y: o.floorY + topY - 3 - height / 2,
        z: (best.z / r) * (r - inward),
        yaw: best.yaw,
        width,
        height,
        color: colors[i]!,
        style,
      });
    });
  }

  // Tory pojazdów między warstwami; liczba zależy od `traffic`.
  const clampedTraffic = Math.min(1, Math.max(0, o.traffic));
  const vehicles = Math.round(clampedTraffic * 16);
  for (let i = 0; i < vehicles; i++) {
    lanes.push({
      radius: rng.float(t.trafficMinM, t.trafficMaxM) + offset,
      height:
        o.floorY +
        (elevated
          ? rng.float(e.canyonTrafficMinY, e.canyonTrafficMaxY)
          : rng.float(22, 58)),
      speed: (rng.float(0, 1) < 0.5 ? -1 : 1) * rng.float(0.12, 0.26),
      phase: rng.float(0, Math.PI * 2),
      ...(elevated && { tier: 'canyon' as const }),
    });
  }

  if (elevated) {
    const elevatedRng = new Rng(seed).fork('skyline-elevated');
    const towerCount = Math.max(0, Math.round(e.towerCount));
    const nearbyTowers: {
      x: number;
      z: number;
      yaw: number;
      width: number;
      depth: number;
      crownY: number;
    }[] = [];
    const towerAccents = [0, 2, 3, 4, 1] as const;

    // 6–8 bliskich cyber-wieżowców sąsiednich na wysokości wzroku (uskoki, neonowe wieńce, maszty).
    for (let i = 0; i < towerCount; i++) {
      const a =
        (i / Math.max(towerCount, 1)) * Math.PI * 2 +
        elevatedRng.float(-0.14, 0.14);
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const width = elevatedRng.float(e.towerMinWidthM, e.towerMaxWidthM);
      const depth = width * elevatedRng.float(0.84, 1.06);
      const halfSpan = Math.hypot(width, depth) / 2;
      const minRadius = o.facadeBounds
        ? Math.max(
            e.towerNearM + offset,
            facadeSupport(dx, dz, o.facadeBounds) +
              halfSpan +
              e.towerClearanceM,
          )
        : e.towerNearM + offset;
      const maxRadius = Math.max(minRadius, e.towerFarM + offset);
      const radius =
        maxRadius > minRadius
          ? elevatedRng.float(minRadius, maxRadius)
          : minRadius;
      const x = dx * radius;
      const z = dz * radius;
      const yaw = a + Math.PI;
      const crownY = roomFloorY + elevatedRng.float(e.crownMinY, e.crownMaxY);
      const accent = towerAccents[i % towerAccents.length]!;
      const winCol = windowColor(elevatedRng);
      const tone = elevatedRng.float(0.56, 0.68);
      const mainH = Math.max(10, crownY - baseY);

      buildings.push({
        x,
        z,
        yaw,
        width,
        depth,
        height: mainH,
        baseY,
        seed: elevatedRng.float(0, 1),
        kind: 0,
        windowColor: winCol,
        lit: elevatedRng.float(0.32, 0.56),
        accent,
        tone,
        layer: 4,
      });

      // Uskok korony i (dla co drugiej wieży) wyższa nadbudowa.
      const tier1H = e.setbackHeightM * elevatedRng.float(0.85, 1.3);
      const tier1W = width * e.setbackScale;
      const tier1D = depth * e.setbackScale;
      buildings.push({
        x,
        z,
        yaw,
        width: tier1W,
        depth: tier1D,
        height: tier1H,
        baseY: crownY,
        seed: elevatedRng.float(0, 1),
        kind: 0,
        windowColor: winCol,
        lit: elevatedRng.float(0.35, 0.58),
        accent,
        tone: tone * 0.94,
        layer: 4,
      });
      let topY = crownY + tier1H;
      if (i % 2 === 0) {
        const tier2H = e.setbackHeightM * 0.55;
        buildings.push({
          x,
          z,
          yaw,
          width: tier1W * 0.68,
          depth: tier1D * 0.68,
          height: tier2H,
          baseY: topY,
          seed: elevatedRng.float(0, 1),
          kind: 0,
          windowColor: winCol,
          lit: elevatedRng.float(0.35, 0.55),
          accent,
          tone: tone * 0.9,
          layer: 4,
        });
        topY += tier2H;
      }

      // Maszt i migające światła ostrzegawcze (wyłącznie bursztyn 0 i ciepła biel 1, ZERO czerwieni).
      const mastH = e.mastHeightM * elevatedRng.float(0.9, 1.4);
      buildings.push({
        x,
        z,
        yaw,
        width: e.mastWidthM,
        depth: e.mastWidthM,
        height: mastH,
        baseY: topY,
        seed: 0,
        kind: 1,
        windowColor: 0,
        lit: 0,
        accent: -1,
        tone: 0.55,
        layer: 4,
      });
      const halfW = width / 2;
      const halfD = depth / 2;
      const corners = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const;
      corners.forEach(([sx, sz], cornerIdx) => {
        const lx = sx * halfW * Math.cos(yaw) + sz * halfD * Math.sin(yaw);
        const lz = -sx * halfW * Math.sin(yaw) + sz * halfD * Math.cos(yaw);
        beacons.push({
          x: x + lx,
          y: crownY + 0.4,
          z: z + lz,
          size: e.beaconSizeM * 0.85,
          period: e.beaconPeriodS,
          phase: i * 0.45 + cornerIdx * 0.25,
          color: (i + cornerIdx) % 2 === 0 ? 0 : 1,
        });
      });
      beacons.push({
        x,
        y: topY + mastH * 0.55,
        z,
        size: e.beaconSizeM,
        period: e.beaconPeriodS * 0.8,
        phase: i * 0.55 + 0.3,
        color: 1,
      });
      beacons.push({
        x,
        y: topY + mastH + 0.5,
        z,
        size: e.beaconSizeM * 1.45,
        period: e.beaconPeriodS * 0.7,
        phase: i * 0.55,
        color: i % 2 === 0 ? 0 : 1,
      });

      nearbyTowers.push({ x, z, yaw, width, depth, crownY });
    }

    // 6 animowanych billboardów na fasadach sąsiednich wieżowców na wysokości pięter gry.
    const adTarget = Math.min(
      Math.max(0, Math.round(e.adCount)),
      nearbyTowers.length,
    );
    const towerOrder =
      nearbyTowers.length === 8
        ? [4, 0, 2, 6, 5, 3, 1, 7]
        : nearbyTowers.map((_, idx) => idx);
    const adColors = [0, 2, 3, 4, 1, 3] as const;
    for (let idx = 0; idx < adTarget; idx++) {
      const tower = nearbyTowers[towerOrder[idx]!]!;
      const style = idx % 3;
      const width =
        style === 1
          ? tower.width * 0.82
          : style === 0
            ? tower.width * 0.44
            : tower.width * 0.64;
      const height =
        style === 0
          ? Math.min(22, width * 2.1)
          : style === 1
            ? width * 0.42
            : width * 0.84;
      const minAdY = roomFloorY + e.adMinY;
      const maxAdY = Math.min(
        roomFloorY + e.adMaxY,
        tower.crownY - 3 - height / 2,
      );
      const adY = maxAdY > minAdY ? elevatedRng.float(minAdY, maxAdY) : minAdY;
      const r = Math.hypot(tower.x, tower.z);
      const inward = tower.depth / 2 + e.adOffsetM;
      ads.push({
        x: (tower.x / r) * (r - inward),
        y: adY,
        z: (tower.z / r) * (r - inward),
        yaw: tower.yaw,
        width,
        height,
        color: adColors[idx % adColors.length]!,
        style,
      });
    }

    // Pułap 2 (wysokość pięter gry) oraz pułap 3 (2 tory bliskiego przelotu za szybą).
    if (clampedTraffic > 0) {
      const facadeMaxR = o.facadeBounds
        ? Math.max(
            Math.abs(o.facadeBounds.minX),
            Math.abs(o.facadeBounds.maxX),
            Math.abs(o.facadeBounds.minZ),
            Math.abs(o.facadeBounds.maxZ),
          )
        : 0;
      const minWindowR = Math.max(
        e.windowTrafficNearM + offset,
        facadeMaxR + 10,
      );
      const maxWindowR = Math.max(
        minWindowR + 16,
        e.windowTrafficFarM + offset,
      );
      const windowVehicles = Math.max(
        4,
        Math.round(clampedTraffic * e.windowTrafficMax),
      );
      for (let i = 0; i < windowVehicles; i++) {
        lanes.push({
          radius: elevatedRng.float(minWindowR, maxWindowR),
          height:
            roomFloorY +
            elevatedRng.float(e.windowTrafficMinY, e.windowTrafficMaxY),
          speed:
            (elevatedRng.float(0, 1) < 0.5 ? -1 : 1) *
            elevatedRng.float(0.1, 0.24),
          phase: elevatedRng.float(0, Math.PI * 2),
          tier: 'window',
        });
      }

      const bounds: SkylineBounds = o.facadeBounds ?? {
        minX: -30,
        maxX: 30,
        minZ: -42,
        maxZ: 30,
      };
      const clearance = e.flybyClearanceM;
      const northSpan = bounds.maxX - bounds.minX + 180;
      const westSpan = bounds.maxZ - bounds.minZ + 180;
      flybys.push(
        {
          startX: (bounds.minX + bounds.maxX) / 2 - northSpan / 2,
          startZ: bounds.minZ - clearance,
          dirX: 1,
          dirZ: 0,
          spanM: northSpan,
          height: roomFloorY + e.flybyNorthY,
          phaseFrac: 0.22,
          side: 'north',
        },
        {
          startX: bounds.minX - clearance,
          startZ: (bounds.minZ + bounds.maxZ) / 2 - westSpan / 2,
          dirX: 0,
          dirZ: 1,
          spanM: westSpan,
          height: roomFloorY + e.flybyWestY,
          phaseFrac: 0.72,
          side: 'west',
        },
      );
    }
  }

  return { buildings, beacons, ads, lanes, flybys };
}

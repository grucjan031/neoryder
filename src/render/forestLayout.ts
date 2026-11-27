import { Rng } from '../core/rng';
import { tuning } from '../core/tuning';

export interface ForestExclusion {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface ForestPoint {
  x: number;
  y: number;
  z: number;
}
export interface ForestTree extends ForestPoint {
  height: number;
  width: number;
  phase: number;
  layer: number;
}
export interface ForestHill extends ForestPoint {
  radius: number;
  height: number;
}
export interface ForestRoute {
  start: ForestPoint;
  end: ForestPoint;
  phase: number;
}

/** World-space data only. Each footprint, including its animation, stays outside the house. */
export function buildForestLayout(
  seed: string,
  options: {
    floorY: number;
    exclusion?: ForestExclusion;
  },
) {
  const t = tuning.forest;
  const rng = new Rng(seed).fork('forest');
  const b = options.exclusion ?? { minX: -16, maxX: 16, minZ: -18, maxZ: 16 };
  const cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2;
  const halfX = (b.maxX - b.minX) / 2,
    halfZ = (b.maxZ - b.minZ) / 2;
  const floor = options.floorY;
  function point(
    angle: number,
    radius: number,
    footprint: number,
  ): ForestPoint {
    const dx = Math.sin(angle),
      dz = Math.cos(angle);
    const margin = footprint + t.clearanceM;
    const boundary = Math.min(
      (halfX + margin) / Math.max(Math.abs(dx), Number.EPSILON),
      (halfZ + margin) / Math.max(Math.abs(dz), Number.EPSILON),
    );
    const r = Math.max(radius, boundary + t.clearanceM);
    return { x: cx + dx * r, y: floor, z: cz + dz * r };
  }
  function landmark(x: number, z: number, radius: number): ForestPoint {
    return point(Math.atan2(x, z), Math.hypot(x, z), radius);
  }
  const helipad = {
    ...landmark(t.padX, t.padZ, t.padRadiusM),
    radius: t.padRadiusM,
  };
  helipad.y += t.padYM;
  const watchtower = {
    ...landmark(t.towerX, t.towerZ, t.droneSizeM),
    height: t.towerHeightM,
  };
  const hills: ForestHill[] = Array.from(
    { length: Math.floor(t.hillsMax) },
    (_, i) => {
      const radius = rng.float(t.hillMinRadiusM, t.hillMaxRadiusM);
      return {
        ...point(
          (i / t.hillsMax) * Math.PI * 2,
          rng.float(t.middleM, t.edgeM),
          radius,
        ),
        y: floor + t.hillBaseM,
        radius,
        height: rng.float(t.hillMinHeightM, t.hillMaxHeightM),
      };
    },
  );
  function terrain(p: ForestPoint): number {
    return hills.reduce((height, h) => {
      const d = Math.hypot(p.x - h.x, p.z - h.z) / h.radius;
      return d < 1
        ? Math.max(height, h.y + h.height * Math.sqrt(1 - d * d))
        : height;
    }, floor);
  }
  function trees(count: number, leafy = false, shrub = false): ForestTree[] {
    return Array.from({ length: Math.floor(count) }, (_, i) => {
      const layer = leafy || shrub ? 0 : i % 3;
      const ranges = [
        [t.nearM, t.middleM, t.nearHeightMinM, t.nearHeightMaxM],
        [t.middleM, t.farM, t.middleHeightMinM, t.middleHeightMaxM],
        [t.farM, t.edgeM, t.farHeightMinM, t.farHeightMaxM],
      ][layer]!;
      const width = shrub
        ? rng.float(t.shrubMinHeightM, t.shrubMaxHeightM)
        : rng.float(t.crownMinM, t.crownMaxM);
      let p = point(
        rng.float(0, Math.PI * 2),
        rng.float(ranges[0]!, ranges[1]!),
        width + t.swayM,
      );
      // Keep the lit landing pad readable through the trees.
      if (
        Math.hypot(p.x - helipad.x, p.z - helipad.z) <
        helipad.radius + width
      ) {
        p = { ...p, x: p.x - helipad.radius * 2 - width * 2 };
      }
      return {
        ...p,
        y: terrain(p),
        width,
        height: shrub
          ? width
          : leafy
            ? rng.float(t.leafMinHeightM, t.leafMaxHeightM)
            : rng.float(ranges[2]!, ranges[3]!),
        phase: rng.float(0, Math.PI * 2),
        layer,
      };
    });
  }
  const conifers = trees(t.conifersMax);
  const deciduous = trees(t.deciduousMax, true);
  const undergrowth = trees(t.undergrowthMax, false, true);
  const perimeterPosts = Array.from(
    { length: Math.floor(t.postsMax) },
    (_, i) => {
      const p = point((i / t.postsMax) * Math.PI * 2, 0, t.fenceOffsetM);
      return { ...p, y: floor };
    },
  );
  const beacons: (ForestPoint & {
    color: number;
    blink?: number;
    phase?: number;
  })[] = perimeterPosts.map((p) => ({
    ...p,
    y: p.y + t.fenceHeightM,
    color: 0,
  }));
  for (let i = 0; i < t.padLightsMax; i++) {
    const a = (i / t.padLightsMax) * Math.PI * 2;
    beacons.push({
      x: helipad.x + Math.sin(a) * helipad.radius,
      y: helipad.y + t.lightSizeM,
      z: helipad.z + Math.cos(a) * helipad.radius,
      color: i % 2 === 0 ? 0 : 2,
    });
  }
  for (let i = 0; i < t.pathLightsMax; i++) {
    const p = point(
      Math.PI / 4 + i / t.pathLightsMax,
      t.middleM + i,
      t.lightSizeM,
    );
    beacons.push({ ...p, y: p.y + t.eyeMaxYM, color: 1 });
  }
  beacons.push({
    ...watchtower,
    y: watchtower.y + watchtower.height,
    color: 0,
    blink: 1,
    phase: rng.next(),
  });
  const mist = Array.from({ length: Math.floor(t.mistMax) }, () => {
    const p = point(
      rng.float(0, Math.PI * 2),
      rng.float(t.nearM, t.farM),
      t.mistWidthM,
    );
    return {
      ...p,
      y: terrain(p) + t.mistHeightM / 2,
      phase: rng.float(0, Math.PI * 2),
    };
  });
  const faunaEyes = Array.from({ length: Math.floor(t.faunaMax) }, () => {
    const p = point(
      rng.float(0, Math.PI * 2),
      rng.float(t.nearM, t.middleM),
      t.eyeSeparationM,
    );
    return {
      ...p,
      y: terrain(p) + rng.float(t.eyeMinYM, t.eyeMaxYM),
      phase: rng.float(0, Math.PI * 2),
    };
  });
  const drones: ForestRoute[] = Array.from(
    { length: Math.floor(t.dronesMax) },
    () => {
      const a = rng.float(0, Math.PI * 2);
      const p = point(a, t.farM, t.droneSizeM);
      const height =
        floor + t.farHeightMaxM + rng.float(t.droneMinYM, t.droneMaxYM);
      // Tangential legs stay outside the expanded house along their entire length.
      const outsideX = Math.abs(p.x - cx) > halfX + t.clearanceM + t.droneSizeM;
      const tangent = {
        x: outsideX ? 0 : t.middleM / 2,
        z: outsideX ? t.middleM / 2 : 0,
      };
      return {
        start: { x: p.x - tangent.x, y: height, z: p.z - tangent.z },
        end: { x: p.x + tangent.x, y: height, z: p.z + tangent.z },
        phase: rng.next(),
      };
    },
  );
  const flybys: ForestRoute[] = [
    {
      start: {
        x: b.minX,
        y: floor + t.flybyNorthYM,
        z: b.minZ - t.flybyOffsetM,
      },
      end: { x: b.maxX, y: floor + t.flybyNorthYM, z: b.minZ - t.flybyOffsetM },
      phase: rng.next(),
    },
    {
      start: {
        x: b.maxX + t.flybyOffsetM,
        y: floor + t.flybyEastYM,
        z: b.minZ,
      },
      end: { x: b.maxX + t.flybyOffsetM, y: floor + t.flybyEastYM, z: b.maxZ },
      phase: rng.next(),
    },
  ];
  return {
    conifers,
    deciduous,
    undergrowth,
    hills,
    perimeterPosts,
    beacons,
    helipad,
    watchtower,
    mist,
    faunaEyes,
    drones,
    flybys,
  };
}

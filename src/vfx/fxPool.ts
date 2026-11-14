/** Instancja do narysowania: pozycja, skala osi, kierunek osi Y, obrót wokół niej i kolor. */
export interface FxInstance {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  dx: number;
  dy: number;
  dz: number;
  roll: number;
  color: number;
}

export interface Particle {
  age: number;
  /** 0 oznacza wolne miejsce w puli. */
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: number;
}

/** Stała pula cząsteczek (kosmetyka): po wyczerpaniu nowa zastępuje najstarszą. */
export class ParticlePool {
  readonly particles: Particle[];
  private cursor = 0;
  private active = 0;

  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('capacity must be a positive integer');
    this.particles = Array.from({ length: capacity }, () => ({
      age: 0,
      life: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 0,
      color: 0,
    }));
  }

  get count(): number {
    return this.active;
  }

  spawn(life: number): Particle {
    let slot = this.particles[this.cursor]!;
    for (let i = 0; i < this.capacity; i++) {
      const candidate = this.particles[(this.cursor + i) % this.capacity]!;
      if (candidate.life === 0) {
        slot = candidate;
        this.cursor = (this.cursor + i + 1) % this.capacity;
        this.active++;
        return this.reset(slot, life);
      }
    }
    this.cursor = (this.cursor + 1) % this.capacity;
    return this.reset(slot, life);
  }

  step(dt: number, gravity = 0): void {
    if (!(dt > 0)) return;
    for (const p of this.particles) {
      if (p.life === 0) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.life = 0;
        this.active--;
        continue;
      }
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }

  clear(): void {
    for (const p of this.particles) p.life = 0;
    this.active = 0;
    this.cursor = 0;
  }

  private reset(p: Particle, life: number): Particle {
    p.age = 0;
    p.life = Math.max(life, 1e-3);
    p.vx = p.vy = p.vz = 0;
    return p;
  }
}

export function makeInstance(): FxInstance {
  return {
    x: 0,
    y: 0,
    z: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    dx: 0,
    dy: 1,
    dz: 0,
    roll: 0,
    color: 0xffffff,
  };
}

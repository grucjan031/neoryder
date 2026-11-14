import type { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { Stats } from '../core/stats';
import playerData from '../data/scenes/roomPlayer.json';
import type { RunManager } from '../world/run';
import type { SectorDefinition } from '../world/sectorSchema';
import {
  ImplantSystem,
  implantDefinitions,
  type ImplantDefinition,
} from './implants';
import { offerReward } from './rewards';
import { stockShop, type ShopItem } from './shop';
import { upgradeOptions } from './rest';

/** Operacje ekonomii poza pokojem, bez DOM i stanu renderu. */
export class RunEconomy {
  private rewardNode: string | null = null;
  private shopNode: string | null = null;
  private rewards: string[] = [];
  private stock: ShopItem[] = [];
  constructor(
    private readonly run: RunManager,
    private readonly bus: EventBus,
    private readonly sector: SectorDefinition,
    private readonly definitions: ReadonlyMap<
      string,
      ImplantDefinition
    > = implantDefinitions,
  ) {}

  private implants(): ImplantSystem {
    const run = this.run;
    const stats = new Stats({ maxHealth: playerData.maxHealth });
    const system = new ImplantSystem({
      stats,
      definitions: this.definitions,
      health: {
        get current() {
          return run.state.hp;
        },
        set: (hp) => run.setHp(hp),
      },
    });
    system.set(run.state.implants, { adjustHealth: false });
    return system;
  }
  maxHealth(): number {
    const stats = new Stats({ maxHealth: playerData.maxHealth });
    const implants = new ImplantSystem({
      stats,
      definitions: this.definitions,
    });
    implants.set(this.run.state.implants, { adjustHealth: false });
    return stats.get('maxHealth');
  }
  offerReward(): readonly string[] {
    if (this.run.screen !== 'reward') return [];
    if (this.rewardNode !== this.run.state.currentNodeId) {
      this.rewardNode = this.run.state.currentNodeId;
      this.rewards = offerReward(
        this.run.state,
        this.run.currentNode!.type,
        new Rng(this.run.state.seed),
        this.sector,
        this.definitions,
        this.bus,
      );
    }
    return [...this.rewards];
  }
  stockShop(): readonly ShopItem[] {
    if (this.run.screen !== 'shop') return [];
    if (this.shopNode !== this.run.state.currentNodeId) {
      this.shopNode = this.run.state.currentNodeId;
      this.stock = stockShop(
        this.run.state,
        new Rng(this.run.state.seed),
        this.sector,
        this.definitions,
      );
    }
    return this.stock.map((item) => ({ ...item }));
  }
  private acquire(id: string, source: 'reward' | 'shop'): boolean {
    const implants = this.implants();
    if (!implants.add(id, source)) return false;
    this.run.addImplant(id);
    this.bus.emit('implant_acquired', {
      id,
      rarity: this.definitions.get(id)!.rarity,
      source,
    });
    return true;
  }
  addDebugImplant(id: string): boolean {
    return (
      this.run.active && this.definitions.has(id) && this.acquire(id, 'reward')
    );
  }
  chooseReward(id?: string): boolean {
    if (this.run.screen !== 'reward') return false;
    const options = this.offerReward();
    if (!options.length)
      this.run.addCredits(this.sector.economy?.puzzleCredits ?? 0);
    else if (!id || !options.includes(id) || !this.acquire(id, 'reward'))
      return false;
    return this.run.completeReward();
  }
  buy(id: string): boolean {
    if (this.run.screen !== 'shop' || !this.sector.economy) return false;
    const economy = this.sector.economy;
    const item = this.stockShop().find((item) => item.id === id);
    const heal = id === 'heal';
    if (!heal && (!item || this.run.state.implants.includes(id))) return false;
    if (heal && this.run.state.hp >= this.maxHealth()) return false;
    const price = heal ? economy.shopHealPrice : item!.price;
    if (price > 0 && !this.run.spendCredits(price)) return false;
    if (heal)
      this.run.heal(
        this.maxHealth() * economy.shopHealFraction,
        this.maxHealth(),
      );
    else {
      this.acquire(id, 'shop');
      this.stock = this.stock.filter((entry) => entry.id !== id);
    }
    this.bus.emit('shop_purchase', {
      item: id,
      kind: heal ? 'heal' : 'implant',
      price,
    });
    return true;
  }
  upgradeOptions(): string[] {
    return upgradeOptions(this.run.state, this.definitions);
  }
  rest(choice: 'heal' | 'upgrade', id?: string): boolean {
    if (this.run.screen !== 'rest' || !this.sector.economy) return false;
    if (choice === 'heal')
      this.run.heal(
        this.maxHealth() * this.sector.economy.restHealFraction,
        this.maxHealth(),
      );
    else {
      if (!id || !this.upgradeOptions().includes(id)) return false;
      const implants = this.implants();
      if (!implants.upgrade(id)) return false;
      const target = this.definitions.get(id)!.upgradesTo!;
      this.run.upgradeImplant(id, target);
      this.bus.emit('implant_acquired', {
        id: target,
        rarity: this.definitions.get(target)!.rarity,
        source: 'upgrade',
      });
    }
    this.bus.emit('rest_used', {
      choice,
      implant: choice === 'upgrade' ? id! : null,
    });
    return this.run.leaveRest();
  }
}

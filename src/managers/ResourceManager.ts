import { Scene } from 'phaser';
import { GridManager } from '../scenes/GridManager';
import { BuildingManager } from './BuildingManager';
import { BuildingType, DefenseType } from '../types/grid';
import { Debug } from '../utils/Debug';

export interface Resources {
  troops: number;
  maxTroops: number;
  ammo: number;
  maxAmmo: number;
  money: number;
  maxMoney: number;
}

export class ResourceManager {
  private scene: Scene;
  private gridManager: GridManager;
  private buildingManager: BuildingManager | null;
  public resources: Resources = {
    troops: 0,
    maxTroops: 0,
    ammo: 0,
    maxAmmo: 0,
    money: 5000,  // Starting money
    maxMoney: 5000
  };
  private resourceGenerationRates = {
    troopsPerSecond: 1,   // Each barracks generates 1 troop per second
    ammoPerSecond: 1      // Each ammo depot generates 1 ammo per second
  };

  constructor(scene: Scene, gridManager: GridManager, buildingManager: BuildingManager | null) {
    this.scene = scene;
    this.gridManager = gridManager;
    this.buildingManager = buildingManager;
  }

  public updateResources() {
    if (!this.buildingManager) return;

    const grid = this.gridManager['grid'];
    // Count resource buildings
    let barracksCount = 0;
    let ammoCount = 0;
    let defenseCount = 0;
    let commandCount = 0;

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const building = grid[y][x];
        if (building) {
          if (building === 'barracks') barracksCount++;
          else if (building === 'ammo') ammoCount++;
          else if (this.buildingManager.isDefense(building)) defenseCount++;
          else if (building === 'command') commandCount++;
        }
      }
    }

    // Update max capacities (10 per barracks, 25 per ammo depot)
    this.resources.maxTroops = barracksCount * 10;
    this.resources.maxAmmo = ammoCount * 25;

    // Update money from command centers if there are any
    if (commandCount > 0) {
      this.resources.money = commandCount * 100;
      this.resources.maxMoney = commandCount * 100;
    }
    
    // Increment resources based on generation rates (1 per second per building)
    if (barracksCount > 0) {
      this.resources.troops = Math.min(
        this.resources.maxTroops,
        this.resources.troops + (this.resourceGenerationRates.troopsPerSecond * barracksCount)
      );
    }
    
    if (ammoCount > 0) {
      this.resources.ammo = Math.min(
        this.resources.maxAmmo,
        this.resources.ammo + (this.resourceGenerationRates.ammoPerSecond * ammoCount)
      );
    }

    // Distribute troops to defenses after updating resources
    if (this.buildingManager) {
      this.buildingManager.distributeTroops();
    }

    // Emit event to update UI
    Debug.log('Updating resources', {
      category: 'system',
      data: this.resources
    });
    this.scene.events.emit('updateResources', this.resources);
  }

  public getResources(): Resources {
    return this.resources;
  }

  public addMoney(amount: number) {
    this.resources.money += amount;
    this.scene.events.emit('updateResources', this.resources);
  }

  public spendMoney(amount: number): boolean {
    if (this.resources.money >= amount) {
      this.resources.money -= amount;
      this.scene.events.emit('updateResources', this.resources);
      return true;
    }
    return false;
  }

  public addTroops(amount: number) {
    this.resources.troops = Math.min(
      this.resources.maxTroops,
      this.resources.troops + amount
    );
    this.scene.events.emit('updateResources', this.resources);
  }

  public addAmmo(amount: number) {
    this.resources.ammo = Math.min(
      this.resources.maxAmmo,
      this.resources.ammo + amount
    );
    this.scene.events.emit('updateResources', this.resources);
  }

  public useAmmo(amount: number): boolean {
    if (this.resources.ammo >= amount) {
      this.resources.ammo -= amount;
      this.scene.events.emit('updateResources', this.resources);
      return true;
    }
    return false;
  }

  public useTroops(amount: number): boolean {
    if (this.resources.troops >= amount) {
      this.resources.troops -= amount;
      this.scene.events.emit('updateResources', this.resources);
      return true;
    }
    return false;
  }

  public consumeResources(resourceCost: Partial<Resources>) {
    if (resourceCost.money) {
      this.resources.money = Math.max(0, this.resources.money - resourceCost.money);
    }
    if (resourceCost.troops) {
      this.resources.troops = Math.max(0, this.resources.troops - resourceCost.troops);
    }
    if (resourceCost.ammo) {
      this.resources.ammo = Math.max(0, this.resources.ammo - resourceCost.ammo);
    }
    this.scene.events.emit('updateResources', this.resources);
  }
} 
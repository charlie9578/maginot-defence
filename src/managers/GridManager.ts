import { Scene } from 'phaser';
import { BuildingType, DefenseType, BUILDINGS, UndergroundType } from '../types/grid';
import { Debug } from '../utils/Debug';

export class GridManager {
  private scene: Scene;
  private cellSize: number;
  private grid: (BuildingType | DefenseType | null)[][];
  private buildingHealth: (any | null)[][]; // Temporarily use any until the correct type is identified
  private graphics: Phaser.GameObjects.Graphics;
  private selectedBuilding: BuildingType | DefenseType;
  private colors: Record<BuildingType | DefenseType, number>;
  private buildingCosts: Record<BuildingType | DefenseType, number>;

  constructor(scene: Scene, cellSize: number, colors: Record<BuildingType | DefenseType, number>, buildingCosts: Record<BuildingType | DefenseType, number>) {
    this.scene = scene;
    this.cellSize = cellSize;
    this.grid = [];
    this.buildingHealth = [];
    this.graphics = this.scene.add.graphics();
    this.selectedBuilding = 'tunnel';
    this.colors = colors;
    this.buildingCosts = buildingCosts;
  }

  public initializeGrid() {
    const width = Math.floor(this.scene.scale.width / this.cellSize);
    const height = Math.floor(this.scene.scale.height / this.cellSize);
    
    this.grid = Array(height).fill(null).map(() => Array(width).fill(null));
    this.buildingHealth = Array(height).fill(null).map(() => Array(width).fill(null));
    
    Debug.log('Grid initialized', {
      category: 'system',
      data: {
        width,
        height,
        cellSize: this.cellSize
      }
    });
  }

  public drawGrid() {
    this.graphics.clear();
    this.graphics.lineStyle(1, 0x444444);

    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const cellX = x * this.cellSize;
        const cellY = y * this.cellSize;
        
        this.graphics.strokeRect(cellX, cellY, this.cellSize, this.cellSize);
      }
    }
  }

  public getGrid(): (BuildingType | DefenseType | null)[][] {
    return this.grid;
  }

  public getBuildingHealth(): (any | null)[][] {
    return this.buildingHealth;
  }

  public setBuilding(x: number, y: number, type: BuildingType | DefenseType | null) {
    if (this.isValidPosition(x, y)) {
      this.grid[y][x] = type;
      Debug.log('Building set', {
        category: 'grid',
        data: { x, y, type }
      });
    }
  }

  public getBuilding(x: number, y: number): BuildingType | DefenseType | null {
    if (this.isValidPosition(x, y)) {
      return this.grid[y][x];
    }
    return null;
  }

  public setBuildingHealth(x: number, y: number, health: any) {
    if (this.isValidPosition(x, y)) {
      this.buildingHealth[y][x] = health;
    }
  }

  public getBuildingHealthAt(x: number, y: number): any | null {
    if (this.isValidPosition(x, y)) {
      return this.buildingHealth[y][x];
    }
    return null;
  }

  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.grid[0].length && y >= 0 && y < this.grid.length;
  }

  public setSelectedBuilding(type: BuildingType | DefenseType) {
    this.selectedBuilding = type;
    Debug.log('Selected building changed', {
      category: 'grid',
      data: { type }
    });
  }

  public getSelectedBuilding(): BuildingType | DefenseType {
    return this.selectedBuilding;
  }

  public getBuildingInfo(type: BuildingType | DefenseType) {
    if (this.isUndergroundBuilding(type)) {
      const info = BUILDINGS[type];
      return {
        ...info,
        cost: this.buildingCosts[type]
      };
    }
    return {
      type: type,
      name: this.getDefenseName(type as DefenseType),
      color: this.colors[type] ? this.colors[type].toString(16) : 'unknown',
      description: this.getDefenseDescription(type as DefenseType),
      cost: this.buildingCosts[type]
    };
  }

  private isUndergroundBuilding(type: BuildingType | DefenseType): type is UndergroundType {
    return ['foundation', 'ammo', 'barracks', 'command', 'elevator', 'tunnel'].includes(type);
  }

  private getDefenseName(type: DefenseType): string {
    const names: Record<DefenseType, string> = {
      bunker: 'Bunker',
      artillery: 'Artillery',
      machinegun: 'Machine Gun',
      observation: 'Observation Post'
    };
    return names[type] || 'Unknown Defense';
  }

  private getDefenseDescription(type: DefenseType): string {
    const descriptions: Record<DefenseType, string> = {
      bunker: 'A fortified position for troops',
      artillery: 'Long-range heavy weaponry',
      machinegun: 'Rapid-fire defensive weapon',
      observation: 'Provides vision of the battlefield'
    };
    return descriptions[type] || 'Unknown defense type';
  }

  public getBuildingCounts(): Record<BuildingType | DefenseType, number> {
    const counts: Record<BuildingType | DefenseType, number> = {
      ammo: 0,
      barracks: 0,
      command: 0,
      elevator: 0,
      tunnel: 0,
      bunker: 0,
      artillery: 0,
      machinegun: 0,
      observation: 0
    };
    
    // Count buildings in the grid
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const building = this.grid[y][x];
        if (building) {
          counts[building]++;
        }
      }
    }
    
    return counts;
  }
} 
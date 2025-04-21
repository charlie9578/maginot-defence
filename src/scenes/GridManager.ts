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

  initializeGrid() {
    const cols = Math.floor(this.scene.scale.width / this.cellSize);
    const rows = Math.floor((this.scene.scale.height - 100) / this.cellSize);
    const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));
    const newBuildingHealth = Array(rows).fill(null).map(() => Array(cols).fill(null));
    if (this.grid.length > 0) {
      for (let y = 0; y < Math.min(rows, this.grid.length); y++) {
        for (let x = 0; x < Math.min(cols, this.grid[0].length); x++) {
          newGrid[y][x] = this.grid[y][x];
          newBuildingHealth[y][x] = this.buildingHealth[y][x];
        }
      }
    }
    this.grid = newGrid;
    this.buildingHealth = newBuildingHealth;
    const groundLevel = Math.floor(rows / 2);
    this.grid[groundLevel][cols - 1] = 'tunnel';

    Debug.log('Grid initialized', {
      category: 'grid',
      data: {
        cols,
        rows,
        gridSize: `${cols}x${rows}`,
        groundLevel,
        gridInitialized: this.grid.length > 0 && this.grid[0].length > 0,
        buildingHealthInitialized: this.buildingHealth.length > 0 && this.buildingHealth[0].length > 0
      }
    });
  }

  drawGrid() {
    this.graphics.clear();
    const cols = this.grid[0].length;
    const rows = this.grid.length;
    const totalWidth = cols * this.cellSize;
    const totalHeight = rows * this.cellSize;
    const groundLevel = Math.floor(rows / 2);
    const offsetX = (this.scene.scale.width / this.scene.cameras.main.zoom - totalWidth) / 2;
    
    Debug.log('Drawing grid', {
      category: 'grid',
      data: {
        cols,
        rows,
        totalWidth,
        totalHeight,
        offsetX,
        zoom: this.scene.cameras.main.zoom
      }
    });

    this.graphics.fillStyle(0x87CEEB);
    this.graphics.fillRect(offsetX, 0, totalWidth, groundLevel * this.cellSize);
    this.graphics.fillStyle(0x355E3B);
    this.graphics.fillRect(offsetX, groundLevel * this.cellSize, totalWidth, this.cellSize);
    this.graphics.fillStyle(0x8B4513);
    this.graphics.fillRect(offsetX, (groundLevel + 1) * this.cellSize, totalWidth, (rows - groundLevel - 1) * this.cellSize);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const building = this.grid[y][x];
        if (building) {
          this.graphics.fillStyle(this.colors[building]);
          this.graphics.fillRect(
            offsetX + x * this.cellSize + 1,
            y * this.cellSize + 1,
            this.cellSize - 2,
            this.cellSize - 2
          );
        }
      }
    }
    const lineThickness = 1 / this.scene.cameras.main.zoom;
    this.graphics.lineStyle(lineThickness, 0x333333);
    for (let x = 0; x <= cols; x++) {
      this.graphics.moveTo(offsetX + x * this.cellSize, 0);
      this.graphics.lineTo(offsetX + x * this.cellSize, totalHeight);
    }
    for (let y = 0; y <= rows; y++) {
      this.graphics.moveTo(offsetX, y * this.cellSize);
      this.graphics.lineTo(offsetX + totalWidth, y * this.cellSize);
    }
    this.graphics.strokePath();
    if (this.selectedBuilding) {
      Debug.log('Grid updated', {
        category: 'grid',
        data: {
          totalBuildings: this.grid.flat().filter(cell => cell !== null).length,
          buildingTypes: this.getBuildingCounts(),
          groundLevel: Math.floor(this.grid.length / 2),
          selectedBuilding: this.getBuildingInfo(this.selectedBuilding)
        }
      });
    }
  }

  private getBuildingCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.grid.forEach(row => {
      row.forEach(cell => {
        if (cell) {
          counts[cell] = (counts[cell] || 0) + 1;
        }
      });
    });
    return counts;
  }

  private getBuildingInfo(type: BuildingType | DefenseType) {
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
    const names = {
      bunker: 'Bunker',
      artillery: 'Artillery',
      machinegun: 'Machine Gun',
      observation: 'Observation Post'
    };
    return names[type];
  }

  private getDefenseDescription(type: DefenseType): string {
    const descriptions = {
      bunker: 'Fortified defensive position',
      artillery: 'Long-range heavy weapon',
      machinegun: 'Rapid-fire defensive weapon',
      observation: 'Increases range of nearby defenses'
    };
    return descriptions[type];
  }
} 
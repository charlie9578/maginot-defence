import { GridCell, CellType, SurfaceType, BUILDINGS } from '../types/grid';

export class GridManager {
  private grid: GridCell[][];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = this.initializeGrid();
  }

  private initializeGrid(): GridCell[][] {
    // Create empty grid
    const grid = Array(this.height).fill(null).map((_, y) =>
      Array(this.width).fill(null).map((_, x) => ({
        x,
        y,
        underground: {
          type: 'empty',
          level: 0,
          connections: []
        },
        surface: {
          type: 'empty',
          level: 0,
          health: 100
        }
      }))
    );

    // Add foundation at the bottom row
    for (let x = 0; x < this.width; x++) {
      grid[this.height - 1][x].underground.type = 'foundation';
      grid[this.height - 1][x].underground.level = 1;
    }

    // Add tunnel entrance at bottom right
    grid[this.height - 2][this.width - 1].underground.type = 'tunnel';
    grid[this.height - 2][this.width - 1].underground.level = 1;

    return grid;
  }

  public canBuildUnderground(x: number, y: number, type: CellType): boolean {
    // Check bounds
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    const cell = this.grid[y][x];
    
    // Check if cell is empty
    if (cell.underground.type !== 'empty') {
      return false;
    }

    // Must have an adjacent structure (tunnel, elevator, or any other building)
    if (!this.hasAdjacentUndergroundStructure(x, y)) {
      return false;
    }

    // Additional special rules for specific building types
    switch (type) {
      case 'elevator':
        return cell.surface.type === 'empty';
      default:
        return true;
    }
  }

  public canBuildSurface(x: number, y: number, type: SurfaceType): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    const cell = this.grid[y][x];
    
    // Check if surface is empty
    if (cell.surface.type !== 'empty') {
      return false;
    }

    // Check for required underground support
    switch (type) {
      case 'bunker':
        return this.hasUndergroundSupport(x, y, ['foundation', 'elevator']);
      case 'artillery':
        return this.hasUndergroundSupport(x, y, ['ammo', 'elevator']);
      case 'machinegun':
        return this.hasUndergroundSupport(x, y, ['foundation', 'ammo']);
      case 'observation':
        return this.hasUndergroundSupport(x, y, ['command']);
      default:
        return true;
    }
  }

  private hasUndergroundSupport(x: number, y: number, requiredTypes: CellType[]): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;

    // Check cell below
    const cellBelow = this.getCell(x, y + 1);
    if (cellBelow && requiredTypes.includes(cellBelow.underground.type)) {
      return true;
    }

    // Check adjacent cells
    return this.getAdjacentCells(x, y).some(adjacentCell => 
      adjacentCell && requiredTypes.includes(adjacentCell.underground.type)
    );
  }

  private hasAdjacentUndergroundStructure(x: number, y: number): boolean {
    const adjacentPositions = [
      [x, y - 1], // above
      [x, y + 1], // below
      [x - 1, y], // left
      [x + 1, y]  // right
    ];

    return adjacentPositions.some(([px, py]) => {
      if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
        const adjacentType = this.grid[py][px].underground.type;
        return adjacentType !== 'empty';
      }
      return false;
    });
  }

  private getAdjacentCells(x: number, y: number): (GridCell | null)[] {
    const positions = [
      [x, y-1], // north
      [x, y+1], // south
      [x-1, y], // west
      [x+1, y]  // east
    ];

    return positions.map(([px, py]) => 
      px >= 0 && px < this.width && py >= 0 && py < this.height 
        ? this.grid[py][px] 
        : null
    );
  }

  public buildUnderground(x: number, y: number, type: CellType): boolean {
    if (!this.canBuildUnderground(x, y, type)) {
      return false;
    }

    this.grid[y][x].underground.type = type;
    this.grid[y][x].underground.level = 1;
    return true;
  }

  public buildSurface(x: number, y: number, type: SurfaceType): boolean {
    if (!this.canBuildSurface(x, y, type)) {
      return false;
    }

    this.grid[y][x].surface.type = type;
    this.grid[y][x].surface.level = 1;
    return true;
  }

  public getCell(x: number, y: number): GridCell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.grid[y][x];
  }

  public canPlaceBuilding(x: number, y: number, type: CellType): boolean {
    const building = BUILDINGS[type];
    
    // Check bounds
    if (x < 0 || y < 0 || 
        x + building.width > this.width ||
        y + building.height > this.height) {
      return false;
    }

    // Check if area is empty
    for (let dy = 0; dy < building.height; dy++) {
      for (let dx = 0; dx < building.width; dx++) {
        if (this.grid[y + dy][x + dx] !== null) {
          return false;
        }
      }
    }

    return true;
  }

  public placeBuilding(x: number, y: number, type: CellType): boolean {
    if (!this.canPlaceBuilding(x, y, type)) {
      return false;
    }

    const building = BUILDINGS[type];
    
    // Place the building
    for (let dy = 0; dy < building.height; dy++) {
      for (let dx = 0; dx < building.width; dx++) {
        this.grid[y + dy][x + dx] = {
          x: x + dx,
          y: y + dy,
          underground: {
            type: 'empty',
            level: 0,
            connections: []
          },
          surface: {
            type: 'empty',
            level: 0,
            health: 100
          }
        };
      }
    }

    return true;
  }
} 
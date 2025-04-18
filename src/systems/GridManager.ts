import { GridCell, CellType, SurfaceType } from '../types/grid';

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
    return Array(this.height).fill(null).map((_, y) =>
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
  }

  public canBuildUnderground(x: number, y: number, type: CellType): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    const cell = this.grid[y][x];
    
    if (cell.underground.type !== 'empty') {
      return false;
    }

    switch (type) {
      case 'elevator':
        return cell.surface.type === 'empty';
      case 'tunnel':
        return this.hasAdjacentUndergroundStructure(x, y);
      default:
        return true;
    }
  }

  public canBuildSurface(x: number, y: number, type: SurfaceType): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    const cell = this.grid[y][x];
    
    if (cell.surface.type !== 'empty') {
      return false;
    }

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
    const adjacentCells = this.getAdjacentCells(x, y);
    return adjacentCells.some(cell => 
      cell && requiredTypes.includes(cell.underground.type)
    );
  }

  private hasAdjacentUndergroundStructure(x: number, y: number): boolean {
    const adjacentCells = this.getAdjacentCells(x, y);
    return adjacentCells.some(cell => 
      cell && cell.underground.type !== 'empty'
    );
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
} 
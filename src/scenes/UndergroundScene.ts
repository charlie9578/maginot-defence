import { Scene } from 'phaser';
import { BuildingType, BUILDING_COLORS, isSurfaceDefense } from '../types/grid';

type DefenseType = 'bunker' | 'artillery' | 'machinegun' | 'observation';
type CellContent = BuildingType | DefenseType | null;

export class UndergroundScene extends Scene {
  private cellSize: number = 48;
  private grid: CellContent[][] = [];
  private selectedBuilding: BuildingType | DefenseType = 'foundation';
  private graphics!: Phaser.GameObjects.Graphics;

  private colors: Record<BuildingType | DefenseType, number> = {
    // Underground buildings
    foundation: 0x555555,
    ammo: 0xff0000,
    barracks: 0x00ff00,
    command: 0x0000ff,
    elevator: 0xffff00,
    tunnel: 0x888888,
    // Surface defenses
    bunker: 0x808080,      // Gray
    artillery: 0x8B4513,   // Brown
    machinegun: 0x696969,  // Dark Gray
    observation: 0xA0522D  // Brown
  };

  constructor() {
    super({ key: 'UndergroundScene' });
  }

  preload() {
    // Add any assets to load here
  }

  create() {
    this.graphics = this.add.graphics();
    this.initializeGrid();
    this.drawGrid();
    this.setupInteraction();

    // Add window resize handler
    this.scale.on('resize', this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.initializeGrid();
    this.drawGrid();
  }

  private initializeGrid() {
    const cols = Math.floor(this.scale.width / this.cellSize);
    const rows = Math.floor((this.scale.height - 100) / this.cellSize); // Account for UI space
    
    // Create new grid or resize existing
    const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));
    
    // Copy existing grid data if it exists
    if (this.grid.length > 0) {
      for (let y = 0; y < Math.min(rows, this.grid.length); y++) {
        for (let x = 0; x < Math.min(cols, this.grid[0].length); x++) {
          newGrid[y][x] = this.grid[y][x];
        }
      }
    }
    
    this.grid = newGrid;

    // Add tunnel entrance at the right side of ground level
    const groundLevel = Math.floor(rows / 2);
    this.grid[groundLevel][cols - 1] = 'tunnel';
  }

  public setSelectedBuilding(type: BuildingType | DefenseType) {
    this.selectedBuilding = type;
  }

  private drawGrid() {
    this.graphics.clear();
    
    const cols = this.grid[0].length;
    const rows = this.grid.length;
    const totalWidth = cols * this.cellSize;
    const totalHeight = rows * this.cellSize;
    const groundLevel = Math.floor(rows / 2);
    
    // Center the grid horizontally
    const offsetX = (this.scale.width - totalWidth) / 2;

    // Draw sky (top half)
    this.graphics.fillStyle(0x87CEEB); // Light blue
    this.graphics.fillRect(offsetX, 0, totalWidth, groundLevel * this.cellSize);

    // Draw ground level (green strip)
    this.graphics.fillStyle(0x355E3B); // Forest green
    this.graphics.fillRect(offsetX, groundLevel * this.cellSize, totalWidth, this.cellSize);

    // Draw underground (bottom half)
    this.graphics.fillStyle(0x8B4513); // Saddle brown
    this.graphics.fillRect(offsetX, (groundLevel + 1) * this.cellSize, totalWidth, (rows - groundLevel - 1) * this.cellSize);

    // Draw cells
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

    // Draw grid lines
    this.graphics.lineStyle(1, 0x333333);
    
    // Vertical lines
    for (let x = 0; x <= cols; x++) {
      this.graphics.moveTo(offsetX + x * this.cellSize, 0);
      this.graphics.lineTo(offsetX + x * this.cellSize, totalHeight);
    }

    // Horizontal lines
    for (let y = 0; y <= rows; y++) {
      this.graphics.moveTo(offsetX, y * this.cellSize);
      this.graphics.lineTo(offsetX + totalWidth, y * this.cellSize);
    }

    this.graphics.strokePath();
  }

  private setupInteraction() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const offsetX = (this.scale.width - this.grid[0].length * this.cellSize) / 2;
      const x = Math.floor((pointer.x - offsetX) / this.cellSize);
      const y = Math.floor(pointer.y / this.cellSize);
      
      if (this.canBuildAt(x, y)) {
        this.grid[y][x] = this.selectedBuilding;
        this.drawGrid();
      }
    });
  }

  private canBuildAt(x: number, y: number): boolean {
    // Check bounds
    if (y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[0].length) {
      return false;
    }

    const groundLevel = Math.floor(this.grid.length / 2);

    // Check if cell is empty
    if (this.grid[y][x] !== null) {
      return false;
    }

    const isDefense = ['bunker', 'artillery', 'machinegun', 'observation'].includes(this.selectedBuilding);
    
    if (isDefense) {
      return this.canBuildDefense(x, y, this.selectedBuilding as DefenseType);
    } else {
      // Underground building rules
      if (y < groundLevel) {
        return false;
      }

      if (this.selectedBuilding === 'elevator') {
        // Check for vertical elevator connections
        const cellAbove = y > 0 ? this.grid[y - 1][x] : null;
        const cellBelow = y < this.grid.length - 1 ? this.grid[y + 1][x] : null;
        const hasVerticalConnection = cellAbove === 'elevator' || cellBelow === 'elevator';

        // If at or below ground level, also allow horizontal connections
        if (y >= groundLevel) {
          return hasVerticalConnection || this.hasHorizontalConnection(x, y);
        }
        
        // Above ground, only allow vertical connections
        return hasVerticalConnection;
      }

      return this.hasHorizontalConnection(x, y);
    }
  }

  private canBuildDefense(x: number, y: number, defenseType: DefenseType): boolean {
    const groundLevel = Math.floor(this.grid.length / 2);

    // Check if we're at surface level or above
    if (y > groundLevel) {
      return false;
    }

    switch (defenseType) {
      case 'bunker':
        // Bunkers can be built:
        // 1. On ground level next to other bunkers
        // 2. One level up from ground if above elevator
        if (y === groundLevel) {
          return this.hasAdjacentBunker(x, y);
        } else if (y === groundLevel - 1) {
          return this.grid[y + 1][x] === 'elevator';
        }
        return false;

      case 'observation':
        // Observation post can stack up to 3 high
        if (y < groundLevel - 2) {
          return false;
        }
        // Must be above elevator or another observation post
        const below = this.grid[y + 1][x];
        return below === 'elevator' || below === 'observation';

      case 'artillery':
      case 'machinegun':
        // Can be built on top of bunkers or above elevators
        const cellBelow = this.grid[y + 1][x];
        return cellBelow === 'bunker' || cellBelow === 'elevator';
    }
  }

  private hasAdjacentBunker(x: number, y: number): boolean {
    const horizontalDirections = [[-1, 0], [1, 0]];
    
    // Check for horizontal bunker connections or elevator below
    return horizontalDirections.some(([dx, dy]) => {
      const newX = x + dx;
      if (newX >= 0 && newX < this.grid[0].length) {
        return this.grid[y][newX] === 'bunker';
      }
      return false;
    }) || this.grid[y + 1][x] === 'elevator';
  }

  private hasHorizontalConnection(x: number, y: number): boolean {
    // Check left and right only
    const horizontalDirections = [
      [-1, 0], // left
      [1, 0],  // right
    ];

    return horizontalDirections.some(([dx, dy]) => {
      const newX = x + dx;
      const newY = y;
      
      if (newY >= 0 && newY < this.grid.length && 
          newX >= 0 && newX < this.grid[0].length) {
        return this.grid[newY][newX] !== null;
      }
      return false;
    });
  }
} 
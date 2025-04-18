import { Scene } from 'phaser';

type BuildingType = 'foundation' | 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';

export class UndergroundScene extends Scene {
  private cellSize: number = 48;
  private grid: (BuildingType | null)[][] = [];
  private selectedBuilding: BuildingType = 'foundation';
  private graphics!: Phaser.GameObjects.Graphics;

  private colors: Record<BuildingType, number> = {
    foundation: 0x555555,  // Gray
    ammo: 0xff0000,       // Red
    barracks: 0x00ff00,   // Green
    command: 0x0000ff,    // Blue
    elevator: 0xffff00,   // Yellow
    tunnel: 0x888888      // Dark Gray
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

  public setSelectedBuilding(type: BuildingType) {
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

    // Can't build in sky (above ground level)
    if (y < groundLevel) {
      return false;
    }

    // Check if cell is empty
    if (this.grid[y][x] !== null) {
      return false;
    }

    // Special rules for elevator
    if (this.selectedBuilding === 'elevator') {
      // Check for elevators above or below
      const cellAbove = y > 0 ? this.grid[y - 1][x] : null;
      const cellBelow = y < this.grid.length - 1 ? this.grid[y + 1][x] : null;
      
      // Can build if there's an elevator above OR below
      if (cellAbove === 'elevator' || cellBelow === 'elevator') {
        return true;
      }
    }

    // For all other buildings (and elevators not connecting vertically)
    // Must have horizontal connection only
    return this.hasHorizontalConnection(x, y);
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
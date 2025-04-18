import { Scene } from 'phaser';
import { GridManager } from '../systems/GridManager';
import { SurfaceType } from '../types/grid';

export class SurfaceScene extends Scene {
  private gridManager!: GridManager;
  private cellSize: number = 64;
  private selectedDefense: SurfaceType = 'empty';
  private colors: Record<SurfaceType, number> = {
    empty: 0x336633, // Green for grass
    bunker: 0x808080,
    artillery: 0x8B4513,
    machinegun: 0x696969,
    observation: 0xA0522D
  };
  private graphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'SurfaceScene' });
  }

  create() {
    this.gridManager = this.scene.get('UndergroundScene').getGridManager();
    this.graphics = this.add.graphics();
    this.drawGrid();
    this.setupInteraction();
  }

  public setSelectedDefense(type: SurfaceType) {
    this.selectedDefense = type;
  }

  private drawGrid() {
    this.graphics.clear();
    
    // Draw grass background
    this.graphics.fillStyle(0x336633);
    this.graphics.fillRect(0, 0, this.cellSize * 12, this.cellSize * 8);

    // Draw grid lines
    this.graphics.lineStyle(1, 0x2A4F2A);
    
    for (let x = 0; x <= 12; x++) {
      this.graphics.moveTo(x * this.cellSize, 0);
      this.graphics.lineTo(x * this.cellSize, 8 * this.cellSize);
    }
    
    for (let y = 0; y <= 8; y++) {
      this.graphics.moveTo(0, y * this.cellSize);
      this.graphics.lineTo(12 * this.cellSize, y * this.cellSize);
    }
    
    this.graphics.strokePath();

    // Draw existing defenses
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 12; x++) {
        const cell = this.gridManager.getCell(x, y);
        if (cell && cell.surface.type !== 'empty') {
          this.updateCellVisual(x, y);
        }
      }
    }
  }

  private setupInteraction() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = Math.floor(pointer.x / this.cellSize);
      const y = Math.floor(pointer.y / this.cellSize);
      
      if (this.gridManager.buildSurface(x, y, this.selectedDefense)) {
        this.updateCellVisual(x, y);
      }
    });
  }

  private updateCellVisual(x: number, y: number) {
    const cell = this.gridManager.getCell(x, y);
    if (!cell) return;

    this.graphics.fillStyle(this.colors[cell.surface.type]);
    this.graphics.fillRect(
      x * this.cellSize + 1,
      y * this.cellSize + 1,
      this.cellSize - 2,
      this.cellSize - 2
    );
  }
} 
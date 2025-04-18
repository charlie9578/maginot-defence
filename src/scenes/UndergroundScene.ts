import { Scene } from 'phaser';
import { GridManager } from '../systems/GridManager';
import { CellType } from '../types/grid';

export class UndergroundScene extends Scene {
  private gridManager!: GridManager;
  private cellSize: number = 64;
  private selectedBuilding: CellType = 'foundation';
  private colors: Record<CellType, number> = {
    empty: 0x222222,
    foundation: 0x555555,
    ammo: 0xff0000,
    barracks: 0x00ff00,
    command: 0x0000ff,
    elevator: 0xffff00,
    tunnel: 0x888888
  };
  private graphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'UndergroundScene' });
  }

  create() {
    this.gridManager = new GridManager(12, 8);
    this.graphics = this.add.graphics();
    this.drawGrid();
    this.setupInteraction();
    this.events.emit('ready');
  }

  public setSelectedBuilding(type: CellType) {
    this.selectedBuilding = type;
  }

  private drawGrid() {
    this.graphics.clear();
    
    // Draw background
    this.graphics.fillStyle(0x111111);
    this.graphics.fillRect(0, 0, this.cellSize * 12, this.cellSize * 8);

    // Draw grid lines
    this.graphics.lineStyle(1, 0x333333);
    
    for (let x = 0; x <= 12; x++) {
      this.graphics.moveTo(x * this.cellSize, 0);
      this.graphics.lineTo(x * this.cellSize, 8 * this.cellSize);
    }
    
    for (let y = 0; y <= 8; y++) {
      this.graphics.moveTo(0, y * this.cellSize);
      this.graphics.lineTo(12 * this.cellSize, y * this.cellSize);
    }
    
    this.graphics.strokePath();

    // Draw existing cells
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 12; x++) {
        const cell = this.gridManager.getCell(x, y);
        if (cell && cell.underground.type !== 'empty') {
          this.updateCellVisual(x, y);
        }
      }
    }
  }

  private setupInteraction() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = Math.floor(pointer.x / this.cellSize);
      const y = Math.floor(pointer.y / this.cellSize);
      
      if (this.gridManager.buildUnderground(x, y, this.selectedBuilding)) {
        this.updateCellVisual(x, y);
      }
    });
  }

  private updateCellVisual(x: number, y: number) {
    const cell = this.gridManager.getCell(x, y);
    if (!cell) return;

    this.graphics.fillStyle(this.colors[cell.underground.type]);
    this.graphics.fillRect(
      x * this.cellSize + 1,
      y * this.cellSize + 1,
      this.cellSize - 2,
      this.cellSize - 2
    );
  }
} 
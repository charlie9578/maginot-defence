import { Scene } from 'phaser';
import { Debug } from '../utils/Debug';
import { BuildingManager } from './BuildingManager';

export class UIManager {
  private scene: Scene;
  private buildingManager: BuildingManager;
  private graphics: Phaser.GameObjects.Graphics;
  private attackGraphics: Phaser.GameObjects.Graphics;
  private killCount: number = 0;

  constructor(scene: Scene, buildingManager: BuildingManager) {
    this.scene = scene;
    this.buildingManager = buildingManager;
    this.graphics = this.scene.add.graphics();
    this.attackGraphics = this.scene.add.graphics();
  }

  public initialize() {
    Debug.log('UI Manager initialized', { 
      category: 'system',
      data: {
        width: this.scene.scale.width,
        height: this.scene.scale.height
      }
    });
  }

  public updateKillCount(newKillCount: number) {
    this.killCount = newKillCount;
    this.scene.events.emit('updateKillCount', this.killCount);
  }

  public getKillCount(): number {
    return this.killCount;
  }

  public updateBuildingHealthPositions() {
    this.buildingManager.updateAllBuildingHealthPositions();
  }

  public updateEnemyHealthBars(enemies: any[]) {
    enemies.forEach(enemy => {
      if (enemy.healthBar) {
        enemy.healthBar.background.x = enemy.x;
        enemy.healthBar.bar.x = enemy.x;
      }
    });
  }

  public clearAttackGraphics() {
    this.attackGraphics.clear();
  }

  public drawAttackLine(x1: number, y1: number, x2: number, y2: number, color: number = 0xff0000) {
    this.attackGraphics.clear();
    this.attackGraphics.lineStyle(2, color);
    this.attackGraphics.lineBetween(x1, y1, x2, y2);
  }

  public handleResize() {
    this.updateBuildingHealthPositions();
  }

  public update() {
    // Update any UI elements that need per-frame updates
  }

  public getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  public getAttackGraphics(): Phaser.GameObjects.Graphics {
    return this.attackGraphics;
  }
} 
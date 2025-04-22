import { Scene } from 'phaser';
import { GridManager } from './GridManager';
import { BuildingManager } from '../managers/BuildingManager';
import { DefenseType } from '../types/grid';
import { Debug } from '../utils/Debug';

// Define Enemy and Resources interfaces
interface Enemy {
  sprite: Phaser.GameObjects.Rectangle;
  health: number;
  maxHealth: number;
  speed: number;
  gridX: number;
  x: number;
  y: number;
  healthBar: {
    background: Phaser.GameObjects.Rectangle;
    bar: Phaser.GameObjects.Rectangle;
  };
  damage: number;
  attackRange: number;
  lastAttackTime: number;
  attackCooldown: number;
}

interface Resources {
  troops: number;
  maxTroops: number;
  ammo: number;
  maxAmmo: number;
  money: number;
  maxMoney: number;
}

export class EnemyManager {
  private scene: Scene;
  private gridManager: GridManager;
  private buildingManager: BuildingManager;
  private resources: Resources;
  private enemies: Enemy[] = [];
  private isWaveActive: boolean = false;
  private waveNumber: number = 1;
  private enemiesPerWave: number = 10;
  private enemySpawnTimer: number = 0;
  private enemySpawnDelay: number = 2000; // 2 seconds between spawns
  private spawnedEnemiesCount: number = 0;

  constructor(
    scene: Scene, 
    gridManager: GridManager, 
    buildingManager: BuildingManager,
    resources: Resources
  ) {
    this.scene = scene;
    this.gridManager = gridManager;
    this.buildingManager = buildingManager;
    this.resources = resources;
  }

  public update(time: number, delta: number) {
    if (!this.isWaveActive) return;

    // Handle enemy spawning
    if (this.spawnedEnemiesCount < this.enemiesPerWave) {
      this.enemySpawnTimer += delta;
      if (this.enemySpawnTimer >= this.enemySpawnDelay) {
        this.spawnEnemy();
        this.enemySpawnTimer = 0;
      }
    }

    // Handle enemy movement and attacks
    this.enemies.forEach((enemy, index) => {
      // Move enemy to the right
      enemy.x += enemy.speed * (delta / 1000);
      enemy.gridX = enemy.x / this.gridManager['cellSize'];
      enemy.sprite.x = enemy.x;
      enemy.healthBar.background.x = enemy.x;
      enemy.healthBar.bar.x = enemy.x;

      // Check if enemy reached the right edge
      const grid = this.gridManager['grid'];
      if (enemy.x >= grid[0].length * this.gridManager['cellSize']) {
        this.destroyEnemy(index);
        return;
      }

      // Check for collisions with buildings
      const gridX = Math.floor(enemy.gridX);
      const gridY = Math.floor(grid.length / 2);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const targetX = gridX + dx;
          const targetY = gridY + dy;

          if (targetX >= 0 && targetX < grid[0].length &&
              targetY >= 0 && targetY < grid.length &&
              grid[targetY][targetX]) {
            enemy.x = targetX * this.gridManager['cellSize'];
            enemy.gridX = targetX;
            enemy.sprite.x = enemy.x;
            enemy.healthBar.background.x = enemy.x;
            enemy.healthBar.bar.x = enemy.x;
          }
        }
      }
    });

    // Handle enemy attacks
    this.handleEnemyAttacks(time);
  }

  public spawnEnemy() {
    const grid = this.gridManager['grid'];
    const spawnX = 0; // Spawn on the left side
    const spawnY = Math.floor(grid.length / 2) * this.gridManager['cellSize'];

    const enemy: Enemy = {
      sprite: this.scene.add.rectangle(spawnX, spawnY, 30, 30, 0xff0000),
      health: 100,
      maxHealth: 100,
      speed: 50,
      gridX: 0, // Start at the left edge
      x: spawnX,
      y: spawnY,
      healthBar: {
        background: this.scene.add.rectangle(spawnX, spawnY - 20, 30, 5, 0x000000),
        bar: this.scene.add.rectangle(spawnX, spawnY - 20, 30, 5, 0x00ff00)
      },
      damage: 10,
      attackRange: 1,
      lastAttackTime: 0,
      attackCooldown: 1000
    };

    this.enemies.push(enemy);
    this.spawnedEnemiesCount++;
  }

  public destroyEnemy(index: number) {
    const enemy = this.enemies[index];
    enemy.sprite.destroy();
    enemy.healthBar.background.destroy();
    enemy.healthBar.bar.destroy();
    this.enemies.splice(index, 1);
    (this.scene as any).killCount++;
    this.scene.events.emit('updateKillCount', (this.scene as any).killCount);
    this.scene.events.emit('updateResources', this.resources);
  }

  private handleEnemyAttacks(time: number) {
    const grid = this.gridManager['grid'];
    this.enemies.forEach(enemy => {
      const gridX = Math.floor(enemy.gridX);
      const gridY = Math.floor(grid.length / 2);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const targetX = gridX + dx;
          const targetY = gridY + dy;

          if (targetX >= 0 && targetX < grid[0].length &&
              targetY >= 0 && targetY < grid.length &&
              grid[targetY][targetX]) {

            const building = grid[targetY][targetX];

            if (time - enemy.lastAttackTime >= enemy.attackCooldown) {
              if (this.buildingManager.isDefense(building)) {
                const defenseType = building as DefenseType;
                const troopsRequired = this.buildingManager.getDefenseProperties(defenseType).troopsRequired;

                if (this.resources.troops >= troopsRequired) {
                  this.resources.troops -= troopsRequired;
                  this.scene.events.emit('updateResources', this.resources);
                } else {
                  this.buildingManager.damageBuilding(targetX, targetY, enemy.damage);
                }
              } else {
                this.buildingManager.damageBuilding(targetX, targetY, enemy.damage);
              }

              enemy.lastAttackTime = time;
            }
          }
        }
      }
    });
  }

  private handleDefenseAttacks(time: number) {
    const grid = this.gridManager['grid'];
    const groundLevel = Math.floor(grid.length / 2);
    (this.scene as any).attackGraphics.clear();

    for (let y = 0; y <= groundLevel; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        const cell = grid[y][x];
        if (cell && this.buildingManager.isDefense(cell)) {
          const defenseType = cell as DefenseType;
          const props = this.buildingManager.getDefenseProperties(defenseType);
          const building = this.buildingManager.getBuildingHealth(y, x);

          if (building && building.mannedTroops && building.mannedTroops > 0) {
            this.enemies.forEach(enemy => {
              const distance = Math.abs(enemy.gridX - x);
              if (distance <= props.range && time - props.lastAttackTime >= props.fireRate) {
                this.attackEnemy(defenseType, x, y, enemy, time);
              }
            });
          }
        }
      }
    }
  }

  private attackEnemy(defenseType: DefenseType, defenseX: number, defenseY: number, enemy: Enemy, time: number) {
    const props = this.buildingManager.getDefenseProperties(defenseType);
    const building = this.buildingManager.getBuildingHealth(defenseY, defenseX);

    if (!building || !building.mannedTroops || building.mannedTroops <= 0) return;

    if (this.resources.ammo >= props.ammoPerShot) {
      this.resources.ammo -= props.ammoPerShot;
      this.scene.events.emit('updateResources', this.resources);

      // Draw attack line
      const startX = defenseX * this.gridManager['cellSize'] + this.gridManager['cellSize'] / 2;
      const startY = defenseY * this.gridManager['cellSize'] + this.gridManager['cellSize'] / 2;
      const endX = enemy.x + this.gridManager['cellSize'] / 2;
      const endY = enemy.y + this.gridManager['cellSize'] / 2;

      (this.scene as any).attackGraphics.lineStyle(2, 0xff0000);
      (this.scene as any).attackGraphics.lineBetween(startX, startY, endX, endY);

      // Apply damage
      enemy.health -= props.damage;
      const healthPercent = enemy.health / enemy.maxHealth;
      enemy.healthBar.bar.width = 30 * healthPercent;
      enemy.healthBar.bar.x = enemy.x + (30 * (1 - healthPercent)) / 2;

      if (enemy.health <= 0) {
        const index = this.enemies.indexOf(enemy);
        if (index !== -1) {
          this.destroyEnemy(index);
        }
      }

      props.lastAttackTime = time;
    }
  }

  public startWave() {
    if (!this.isWaveActive) {
      this.isWaveActive = true;
      this.spawnedEnemiesCount = 0;
      this.enemySpawnTimer = 0;
      this.waveNumber++;
      this.enemiesPerWave = 10 + (this.waveNumber - 1) * 2;
      Debug.log('Starting wave', {
        category: 'combat',
        data: { waveNumber: this.waveNumber, enemiesPerWave: this.enemiesPerWave }
      });
    }
  }

  public getEnemies(): Enemy[] {
    return this.enemies;
  }
} 
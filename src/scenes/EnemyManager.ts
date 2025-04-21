import { Scene } from 'phaser';
import { GridManager } from './GridManager';
import { DefenseType } from '../types/grid';

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
  private resources: Resources;
  private enemies: Enemy[] = [];
  private isWaveActive: boolean = false;
  private waveNumber: number = 1;
  private enemiesPerWave: number = 10;
  private enemySpawnTimer: number = 0;
  private enemySpawnDelay: number = 2000; // 2 seconds between spawns
  private spawnedEnemiesCount: number = 0;

  constructor(scene: Scene, gridManager: GridManager, resources: Resources) {
    this.scene = scene;
    this.gridManager = gridManager;
    this.resources = resources;
  }

  public update(time: number, delta: number) {
    if (this.isWaveActive) {
      this.enemySpawnTimer += delta;
      if (this.enemySpawnTimer >= this.enemySpawnDelay && 
          this.spawnedEnemiesCount < this.enemiesPerWave) {
        this.spawnEnemy();
        this.enemySpawnTimer = 0;
      }

      this.enemies.forEach((enemy, index) => {
        enemy.gridX += (enemy.speed * delta) / (1000 * (this.scene as any).cellSize);
        enemy.x = (this.scene as any).gridToWorldX(Math.floor(enemy.gridX));
        enemy.sprite.x = enemy.x;
        enemy.healthBar.background.x = enemy.x;
        enemy.healthBar.bar.x = enemy.x;

        if (enemy.gridX >= this.gridManager['grid'][0].length) {
          this.destroyEnemy(index);
        }
      });

      this.handleEnemyAttacks(time);
      this.handleDefenseAttacks(time);
    }
  }

  private spawnEnemy() {
    const grid = this.gridManager['grid'];
    const groundLevel = Math.floor(grid.length / 2);
    const worldX = (this.scene as any).gridToWorldX(0);
    const worldY = groundLevel * (this.scene as any).cellSize + (this.scene as any).cellSize / 2;
    const health = 50 * this.waveNumber;

    const enemySprite = this.scene.add.rectangle(
      worldX,
      worldY,
      30,
      30,
      0xff0000
    )
    .setDepth(50)
    .setScrollFactor(1)
    .setStrokeStyle(2, 0x000000);

    const healthBarBg = this.scene.add.rectangle(
      worldX,
      worldY - 20,
      32,
      5,
      0x000000
    )
    .setDepth(50)
    .setScrollFactor(1);

    const healthBar = this.scene.add.rectangle(
      worldX,
      worldY - 20,
      32,
      5,
      0x00ff00
    )
    .setDepth(51)
    .setScrollFactor(1);

    const enemy: Enemy = {
      sprite: enemySprite,
      healthBar: {
        background: healthBarBg,
        bar: healthBar
      },
      health: health,
      maxHealth: health,
      speed: 50,
      gridX: 0,
      x: worldX,
      y: worldY,
      damage: 10,
      attackRange: 1,
      lastAttackTime: 0,
      attackCooldown: 1000
    };

    this.enemies.push(enemy);
    this.spawnedEnemiesCount++;
  }

  private destroyEnemy(index: number) {
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
              if ((this.scene as any).isDefense(building)) {
                const defenseType = building as DefenseType;
                const troopsRequired = (this.scene as any).defenseProperties[defenseType].troopsRequired;

                if (this.resources.troops >= troopsRequired) {
                  this.resources.troops -= troopsRequired;
                  this.scene.events.emit('updateResources', this.resources);
                } else {
                  (this.scene as any).damageBuilding(targetX, targetY, enemy.damage);
                }
              } else {
                (this.scene as any).damageBuilding(targetX, targetY, enemy.damage);
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
        if (cell && (this.scene as any).isDefense(cell)) {
          const defenseType = cell as DefenseType;
          const props = (this.scene as any).defenseProperties[defenseType];
          const building = (this.scene as any).buildingHealth[y][x];

          if (!building || !building.mannedTroops || building.mannedTroops < props.troopsRequired) {
            continue;
          }

          if (defenseType === 'observation') continue;

          if (this.resources.ammo < props.ammoPerShot) {
            continue;
          }

          if (time - props.lastAttackTime >= props.fireRate) {
            let closestEnemy: Enemy | null = null;
            let closestDistance = props.range;

            this.enemies.forEach(enemy => {
              const distance = Math.abs(enemy.gridX - x);
              if (distance <= props.range && (!closestEnemy || distance < closestDistance)) {
                closestEnemy = enemy;
                closestDistance = distance;
              }
            });

            if (closestEnemy) {
              this.attackEnemy(defenseType, x, y, closestEnemy, time);
              this.resources.ammo -= props.ammoPerShot;
              this.scene.events.emit('updateResources', this.resources);
            }
          }
        }
      }
    }
  }

  private attackEnemy(defenseType: DefenseType, defenseX: number, defenseY: number, enemy: Enemy, time: number) {
    const props = (this.scene as any).defenseProperties[defenseType];
    const defenseWorldX = (this.scene as any).gridToWorldX(defenseX);
    const defenseWorldY = defenseY * (this.scene as any).cellSize + (this.scene as any).cellSize / 2;

    const projectile = this.scene.add.graphics();
    projectile.lineStyle(4, 0xff0000, 1);

    const startX = defenseWorldX;
    const startY = defenseWorldY;
    const endX = enemy.x;
    const endY = enemy.y;

    projectile.lineBetween(startX, startY, endX, endY);

    const glow = this.scene.add.graphics();
    glow.lineStyle(8, 0xff0000, 0.3);
    glow.lineBetween(startX, startY, endX, endY);

    const duration = 500;
    this.scene.tweens.add({
      targets: [projectile, glow],
      alpha: 0,
      duration: duration,
      onComplete: () => {
        projectile.destroy();
        glow.destroy();
        enemy.health -= props.damage;

        const healthPercent = enemy.health / enemy.maxHealth;
        enemy.healthBar.bar.width = 32 * healthPercent;
        enemy.healthBar.bar.setFillStyle(healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000);

        if (enemy.health <= 0) {
          const index = this.enemies.indexOf(enemy);
          if (index !== -1) {
            this.destroyEnemy(index);
          }
        }
      }
    });

    props.lastAttackTime = time;
  }

  public startWave() {
    console.log('Starting wave', {
      category: 'enemy',
      data: {
        waveNumber: this.waveNumber,
        enemiesPerWave: this.enemiesPerWave
      }
    });

    this.isWaveActive = true;
    this.enemySpawnTimer = 0;
    this.spawnedEnemiesCount = 0;

    // Emit event for wave state change
    this.scene.events.emit('waveStateChanged', this.isWaveActive);

    // Clear any remaining enemies
    this.enemies.forEach(enemy => {
      enemy.sprite.destroy();
      enemy.healthBar.background.destroy();
      enemy.healthBar.bar.destroy();
    });
    this.enemies = [];
  }
} 
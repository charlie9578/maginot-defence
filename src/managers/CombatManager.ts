import { Scene } from 'phaser';
import { Debug } from '../utils/Debug';
import { EnemyManager } from '../scenes/EnemyManager';
import { BuildingManager } from './BuildingManager';
import { DefenseType } from '../types/grid';

export class CombatManager {
  private scene: Scene;
  private enemyManager: EnemyManager;
  private buildingManager: BuildingManager;
  private uiManager: any; // We'll type this properly once UIManager is created

  constructor(
    scene: Scene,
    enemyManager: EnemyManager,
    buildingManager: BuildingManager,
    uiManager: any
  ) {
    this.scene = scene;
    this.enemyManager = enemyManager;
    this.buildingManager = buildingManager;
    this.uiManager = uiManager;
  }

  public update(time: number, delta: number) {
    this.handleEnemyAttacks(time);
    this.handleDefenseAttacks(time);
  }

  private handleEnemyAttacks(time: number) {
    const grid = this.enemyManager['gridManager']['grid'];
    const enemies = this.enemyManager.getEnemies();

    enemies.forEach(enemy => {
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

                if (this.buildingManager.getResources().troops >= troopsRequired) {
                  this.buildingManager.consumeResources({ troops: troopsRequired });
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
    const grid = this.enemyManager['gridManager']['grid'];
    const groundLevel = Math.floor(grid.length / 2);
    this.uiManager.clearAttackGraphics();

    for (let y = 0; y <= groundLevel; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        const cell = grid[y][x];
        if (cell && this.buildingManager.isDefense(cell)) {
          const defenseType = cell as DefenseType;
          const props = this.buildingManager.getDefenseProperties(defenseType);
          const building = this.buildingManager.getBuildingHealth(y, x);

          if (building && building.mannedTroops && building.mannedTroops > 0) {
            this.enemyManager.getEnemies().forEach(enemy => {
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

  private attackEnemy(defenseType: DefenseType, defenseX: number, defenseY: number, enemy: any, time: number) {
    const props = this.buildingManager.getDefenseProperties(defenseType);
    const building = this.buildingManager.getBuildingHealth(defenseY, defenseX);

    if (!building || !building.mannedTroops || building.mannedTroops <= 0) return;

    if (this.buildingManager.getResources().ammo >= props.ammoPerShot) {
      this.buildingManager.consumeResources({ ammo: props.ammoPerShot });

      // Draw attack line
      const startX = defenseX * this.enemyManager['gridManager']['cellSize'] + 
                    this.enemyManager['gridManager']['cellSize'] / 2;
      const startY = defenseY * this.enemyManager['gridManager']['cellSize'] + 
                    this.enemyManager['gridManager']['cellSize'] / 2;
      const endX = enemy.x + this.enemyManager['gridManager']['cellSize'] / 2;
      const endY = enemy.y + this.enemyManager['gridManager']['cellSize'] / 2;

      this.uiManager.drawAttackLine(startX, startY, endX, endY);

      // Apply damage
      enemy.health -= props.damage;
      const healthPercent = enemy.health / enemy.maxHealth;
      enemy.healthBar.bar.width = 30 * healthPercent;
      enemy.healthBar.bar.x = enemy.x + (30 * (1 - healthPercent)) / 2;

      if (enemy.health <= 0) {
        this.enemyManager.destroyEnemy(this.enemyManager.getEnemies().indexOf(enemy));
      }

      props.lastAttackTime = time;
    }
  }
} 
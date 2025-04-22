import { Scene } from 'phaser';
import { GridManager } from './GridManager';
import { BuildingManager } from './BuildingManager';
import { Debug } from '../utils/Debug';
import { Resources } from './ResourceManager';

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

export class EnemyManager {
    private scene: Scene;
    private gridManager: GridManager;
    private buildingManager: BuildingManager;
    private resources: Resources;
    private enemies: Enemy[] = [];
    private waveActive: boolean = false;
    private waveNumber: number = 0;
    private enemiesSpawned: number = 0;
    private enemiesToSpawn: number = 0;
    private lastSpawnTime: number = 0;
    private spawnInterval: number = 1000; // Time between enemy spawns in milliseconds

    constructor(scene: Scene, gridManager: GridManager, buildingManager: BuildingManager, resources: Resources) {
        this.scene = scene;
        this.gridManager = gridManager;
        this.buildingManager = buildingManager;
        this.resources = resources;
    }

    public startWave() {
        this.waveNumber++;
        this.waveActive = true;
        this.enemiesSpawned = 0;
        this.enemiesToSpawn = 5 + this.waveNumber * 2; // Increase enemies per wave
        this.lastSpawnTime = this.scene.time.now;

        Debug.log('Wave started', {
            category: 'enemy',
            data: {
                waveNumber: this.waveNumber,
                enemiesToSpawn: this.enemiesToSpawn
            }
        });
    }

    public update(time: number, delta: number) {
        if (this.waveActive) {
            this.spawnEnemies();
        }
        this.updateEnemies(time, delta);
        this.checkWaveCompletion();
    }

    private spawnEnemies() {
        const now = this.scene.time.now;
        if (now - this.lastSpawnTime >= this.spawnInterval && this.enemiesSpawned < this.enemiesToSpawn) {
            this.createEnemy();
            this.enemiesSpawned++;
            this.lastSpawnTime = now;
        }
    }

    private createEnemy() {
        const grid = this.gridManager.getGrid();
        const startX = grid[0].length - 1;
        const startY = Math.floor(grid.length / 2);
        
        const enemy: Enemy = {
            sprite: this.scene.add.rectangle(0, 0, 32, 32, 0xff0000),
            health: 100,
            maxHealth: 100,
            speed: 0.5,
            gridX: startX,
            x: 0,
            y: 0,
            healthBar: {
                background: this.scene.add.rectangle(0, 0, 40, 6, 0x000000),
                bar: this.scene.add.rectangle(0, 0, 40, 6, 0xff0000)
            },
            damage: 10,
            attackRange: 1,
            lastAttackTime: 0,
            attackCooldown: 1000
        };

        this.updateEnemyPosition(enemy);
        this.enemies.push(enemy);
    }

    private updateEnemyPosition(enemy: Enemy) {
        const grid = this.gridManager.getGrid();
        const cellSize = this.gridManager['cellSize'];
        const offsetX = (this.scene.scale.width - grid[0].length * cellSize) / 2;
        
        enemy.x = offsetX + (enemy.gridX * cellSize) + (cellSize / 2);
        enemy.y = this.scene.scale.height / 2;
        
        enemy.sprite.x = enemy.x;
        enemy.sprite.y = enemy.y;
        
        enemy.healthBar.background.x = enemy.x;
        enemy.healthBar.background.y = enemy.y - 20;
        enemy.healthBar.bar.x = enemy.x;
        enemy.healthBar.bar.y = enemy.y - 20;
    }

    private updateEnemies(time: number, delta: number) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Move enemy
            enemy.gridX -= enemy.speed * (delta / 1000);
            this.updateEnemyPosition(enemy);
            
            // Update health bar
            const healthPercent = enemy.health / enemy.maxHealth;
            enemy.healthBar.bar.width = 40 * healthPercent;
            
            // Check for building collisions
            this.checkBuildingCollisions(enemy, time);
            
            // Remove if dead or out of bounds
            if (enemy.health <= 0 || enemy.gridX < 0) {
                if (enemy.health <= 0) {
                    this.scene.events.emit('updateKillCount', this.scene['killCount'] + 1);
                }
                enemy.sprite.destroy();
                enemy.healthBar.background.destroy();
                enemy.healthBar.bar.destroy();
                this.enemies.splice(i, 1);
            }
        }
    }

    private checkBuildingCollisions(enemy: Enemy, time: number) {
        const gridX = Math.floor(enemy.gridX);
        const gridY = Math.floor(this.gridManager.getGrid().length / 2);
        
        const building = this.gridManager.getBuilding(gridX, gridY);
        if (building && time - enemy.lastAttackTime >= enemy.attackCooldown) {
            const buildingHealth = this.gridManager.getBuildingHealthAt(gridX, gridY);
            if (buildingHealth) {
                buildingHealth.health -= enemy.damage;
                enemy.lastAttackTime = time;
                
                if (buildingHealth.health <= 0) {
                    this.gridManager.setBuilding(gridX, gridY, null);
                    this.gridManager.setBuildingHealth(gridX, gridY, null);
                }
            }
        }
    }

    private checkWaveCompletion() {
        if (this.waveActive && this.enemiesSpawned >= this.enemiesToSpawn && this.enemies.length === 0) {
            this.waveActive = false;
            Debug.log('Wave completed', {
                category: 'enemy',
                data: { waveNumber: this.waveNumber }
            });
        }
    }

    public getEnemies(): Enemy[] {
        return this.enemies;
    }

    public isWaveActive(): boolean {
        return this.waveActive;
    }

    public spawnEnemy() {
        this.createEnemy();
        this.enemiesSpawned++;
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
} 
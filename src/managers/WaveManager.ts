import { Scene } from 'phaser';
import { Debug } from '../utils/Debug';
import { EnemyManager } from './EnemyManager';

export class WaveManager {
  private scene: Scene;
  private enemyManager: EnemyManager;
  private isWaveActive: boolean = false;
  private waveNumber: number = 1;
  private enemiesPerWave: number = 10;
  private enemySpawnTimer: number = 0;
  private enemySpawnDelay: number = 2000; // 2 seconds between spawns
  private spawnedEnemiesCount: number = 0;

  constructor(scene: Scene, enemyManager: EnemyManager) {
    this.scene = scene;
    this.enemyManager = enemyManager;
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
        data: { 
          waveNumber: this.waveNumber, 
          enemiesPerWave: this.enemiesPerWave 
        }
      });

      this.scene.events.emit('waveStateChanged', true);
    }
  }

  public update(time: number, delta: number) {
    if (!this.isWaveActive) return;

    // Handle enemy spawning
    if (this.spawnedEnemiesCount < this.enemiesPerWave) {
      this.enemySpawnTimer += delta;
      if (this.enemySpawnTimer >= this.enemySpawnDelay) {
        this.enemyManager.spawnEnemy();
        this.spawnedEnemiesCount++;
        this.enemySpawnTimer = 0;
      }
    }

    // Check if wave is complete
    if (this.spawnedEnemiesCount >= this.enemiesPerWave && 
        this.enemyManager.getEnemies().length === 0) {
      this.endWave();
    }
  }

  private endWave() {
    this.isWaveActive = false;
    this.scene.events.emit('waveStateChanged', false);
    
    Debug.log('Wave completed', {
      category: 'combat',
      data: { 
        waveNumber: this.waveNumber,
        totalEnemies: this.spawnedEnemiesCount
      }
    });
  }

  public isWaveInProgress(): boolean {
    return this.isWaveActive;
  }

  public getWaveNumber(): number {
    return this.waveNumber;
  }

  public getEnemiesRemaining(): number {
    return this.enemiesPerWave - this.spawnedEnemiesCount;
  }
} 
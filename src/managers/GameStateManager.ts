import { Scene } from 'phaser';
import { Debug } from '../utils/Debug';

export class GameStateManager {
  private scene: Scene;
  private killCount: number = 0;
  private frameCount: number = 0;
  private waveActive: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.scene.events.on('updateKillCount', (newKillCount: number) => {
      this.killCount = newKillCount;
      Debug.log('Kill count updated', {
        category: 'system',
        data: { newKillCount }
      });
    });

    this.scene.events.on('waveStateChanged', (active: boolean) => {
      this.waveActive = active;
      Debug.log('Wave state changed', {
        category: 'system',
        data: { isWaveActive: active }
      });
    });
  }

  public incrementKillCount() {
    this.killCount++;
    this.scene.events.emit('updateKillCount', this.killCount);
  }

  public getKillCount(): number {
    return this.killCount;
  }

  public incrementFrameCount() {
    this.frameCount++;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }

  public setWaveActive(active: boolean) {
    this.waveActive = active;
    this.scene.events.emit('waveStateChanged', active);
  }

  public getWaveActive(): boolean {
    return this.waveActive;
  }

  public update() {
    this.incrementFrameCount();
  }
} 
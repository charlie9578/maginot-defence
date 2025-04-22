import { Scene } from 'phaser';
import { Debug } from '../utils/Debug';

export class CameraManager {
  private scene: Scene;
  private minZoom: number = 0.5;
  private maxZoom: number = 2;
  private currentZoom: number = 1;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public setupControls() {
    // Add mouse wheel zoom
    this.scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      try {
        const zoomChange = -deltaY * 0.001;
        this.zoom(zoomChange);
      } catch (error) {
        console.error('Error during zoom operation:', error);
      }
    });

    // Add keyboard zoom controls
    this.scene.input.keyboard?.on('keydown-PLUS', () => {
      try {
        this.zoom(0.1);
      } catch (error) {
        console.error('Error during keyboard zoom operation:', error);
      }
    });

    this.scene.input.keyboard?.on('keydown-MINUS', () => {
      try {
        this.zoom(-0.1);
      } catch (error) {
        console.error('Error during keyboard zoom operation:', error);
      }
    });

    // Add touch pinch-to-zoom
    this.scene.input.on('pinch', (pinch: any) => {
      try {
        const zoomChange = (pinch.scaleFactor - 1) * 0.1;
        this.zoom(zoomChange);
      } catch (error) {
        console.error('Error during pinch-to-zoom operation:', error);
      }
    });

    // Add middle mouse button drag to pan
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      try {
        if (pointer.isDown && pointer.button === 1) {
          this.cameras.main.scrollX -= pointer.velocity.x / this.currentZoom;
          this.cameras.main.scrollY -= pointer.velocity.y / this.currentZoom;
        }
      } catch (error) {
        console.error('Error during pan operation:', error);
      }
    });
  }

  private zoom(change: number) {
    const newZoom = Phaser.Math.Clamp(
      this.currentZoom + change,
      this.minZoom,
      this.maxZoom
    );
    
    if (newZoom !== this.currentZoom) {
      const pointer = this.scene.input.activePointer;
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      this.currentZoom = newZoom;
      this.scene.cameras.main.setZoom(this.currentZoom);

      const newWorldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.scene.cameras.main.scrollX += worldPoint.x - newWorldPoint.x;
      this.scene.cameras.main.scrollY += worldPoint.y - newWorldPoint.y;

      Debug.log('Zoom updated', {
        category: 'system',
        data: {
          newZoom,
          cameraPosition: {
            x: this.scene.cameras.main.scrollX,
            y: this.scene.cameras.main.scrollY
          }
        }
      });
    }
  }

  public getCurrentZoom(): number {
    return this.currentZoom;
  }

  public getLastCameraPosition(): { x: number; y: number } {
    return { x: this.lastCameraX, y: this.lastCameraY };
  }

  public updateLastCameraPosition(x: number, y: number) {
    this.lastCameraX = x;
    this.lastCameraY = y;
  }

  public handleResize() {
    // Handle any camera-related resize operations
    this.scene.cameras.main.setSize(this.scene.scale.width, this.scene.scale.height);
  }

  private get cameras() {
    return this.scene.cameras;
  }
} 
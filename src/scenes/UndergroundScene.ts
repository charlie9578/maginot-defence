import { Scene } from 'phaser';
import { BuildingType, BUILDING_COLORS, isSurfaceDefense } from '../types/grid';
import { Debug } from '../utils/Debug';
import { BUILDINGS, UndergroundType } from '../types/grid';
import { GridManager } from '../managers/GridManager';
import { EnemyManager } from '../managers/EnemyManager';
import { ResourceManager } from '../managers/ResourceManager';
import { BuildingManager } from '../managers/BuildingManager';
import { CameraManager } from '../managers/CameraManager';
import { GameStateManager } from '../managers/GameStateManager';
import { UIManager } from '../managers/UIManager';

type DefenseType = 'bunker' | 'artillery' | 'machinegun' | 'observation';
type CellContent = BuildingType | DefenseType | null;

interface Enemy {
    sprite: Phaser.GameObjects.Rectangle;
    health: number;
    maxHealth: number;
    speed: number;
    gridX: number; // Track position in grid coordinates
    x: number;
    y: number;
    healthBar: {
        background: Phaser.GameObjects.Rectangle;
        bar: Phaser.GameObjects.Rectangle;
    };
    damage: number;     // Damage dealt to buildings
    attackRange: number; // Range at which enemy can attack buildings
    lastAttackTime: number;
    attackCooldown: number;
}

interface DefenseProperties {
    range: number;      // Attack range in grid cells
    damage: number;     // Damage per hit
    fireRate: number;   // Time between attacks in milliseconds
    lastAttackTime: number;
    troopsRequired: number;  // Number of troops needed to operate
    ammoPerShot: number;    // Amount of ammo consumed per shot
}

export class UndergroundScene extends Scene {
  private cellSize: number = 48;
  private graphics!: Phaser.GameObjects.Graphics;
  private minZoom: number = 0.5;
  private maxZoom: number = 2;
  private currentZoom: number = 1;
  private attackGraphics: Phaser.GameObjects.Graphics;
  public killCount: number = 0;
  private frameCount: number = 0;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  
  // Manager instances
  private gridManager!: GridManager;
  private enemyManager!: EnemyManager;
  private resourceManager!: ResourceManager;
  private buildingManager!: BuildingManager;
  private cameraManager!: CameraManager;
  private gameStateManager!: GameStateManager;
  private uiManager!: UIManager;

  // Building properties
  private colors: Record<BuildingType | DefenseType, number> = {
    // Underground buildings
    ammo: 0xff0000,
    barracks: 0x00ff00,
    command: 0x0000ff,
    elevator: 0xffff00,
    tunnel: 0x888888,
    // Surface defenses
    bunker: 0x808080,      // Gray
    artillery: 0x8B4513,   // Brown
    machinegun: 0x696969,  // Dark Gray
    observation: 0xA0522D  // Brown
  };

  private buildingCosts: Record<BuildingType | DefenseType, number> = {
    // Underground buildings
    ammo: 200,
    barracks: 300,
    command: 500,
    elevator: 150,
    tunnel: 20,
    // Surface defenses
    bunker: 250,
    artillery: 400,
    machinegun: 200,
    observation: 150
  };

  private defenseProperties: Record<DefenseType, DefenseProperties> = {
    bunker: { range: 3, damage: 10, fireRate: 1000, lastAttackTime: 0, troopsRequired: 2, ammoPerShot: 1 },
    artillery: { range: 5, damage: 30, fireRate: 2000, lastAttackTime: 0, troopsRequired: 4, ammoPerShot: 3 },
    machinegun: { range: 4, damage: 5, fireRate: 500, lastAttackTime: 0, troopsRequired: 1, ammoPerShot: 1 },
    observation: { range: 0, damage: 0, fireRate: 0, lastAttackTime: 0, troopsRequired: 1, ammoPerShot: 0 }
  };

  constructor() {
    super({ key: 'UndergroundScene' });
  }

  preload() {
    // Add any assets to load here
  }

  create() {
    Debug.log('Scene creation started', { 
      category: 'system',
      data: {
        width: this.scale.width,
        height: this.scale.height,
        cellSize: this.cellSize
      }
    });

    this.graphics = this.add.graphics();
    this.attackGraphics = this.add.graphics();
    
    // Initialize GridManager
    this.gridManager = new GridManager(this, this.cellSize, this.colors, this.buildingCosts);
    this.gridManager.initializeGrid();
    this.gridManager.drawGrid();

    // Ensure grid is initialized before accessing
    const grid = this.gridManager['grid'];
    if (grid.length === 0 || grid[0].length === 0) {
      console.error('Grid is not initialized properly.');
      return;
    }

    // Initialize managers in the correct order to avoid circular dependencies
    this.resourceManager = new ResourceManager(this, this.gridManager, null);
    this.buildingManager = new BuildingManager(
      this, 
      this.gridManager, 
      this.resourceManager,
      this.cellSize,
      this.colors,
      this.buildingCosts,
      this.defenseProperties
    );
    this.buildingManager.initialize();
    
    // Now that both managers exist, set up their references to each other
    this.resourceManager['buildingManager'] = this.buildingManager;

    // Initialize EnemyManager after both managers are set up
    this.enemyManager = new EnemyManager(
      this, 
      this.gridManager, 
      this.buildingManager,
      this.resourceManager.resources
    );

    // Initialize UI Manager
    this.uiManager = new UIManager(this, this.buildingManager);

    // Initialize Camera Manager
    this.cameraManager = new CameraManager(this);
    this.cameraManager.setupControls();

    // Initialize Game State Manager
    this.gameStateManager = new GameStateManager(this);

    // Setup building interaction
    this.buildingManager.setupInteraction();

    // Start resource generation with a timer
    this.time.addEvent({
        delay: 1000, // Update every second
        callback: () => this.resourceManager.updateResources(),
        callbackScope: this,
        loop: true
    });

    Debug.log('Scene creation completed', { 
      category: 'system',
      data: {
        gridSize: `${grid[0].length}x${grid.length}`,
        groundLevel: Math.floor(grid.length / 2)
      }
    });

    // Add window resize handler
    this.scale.on('resize', this.handleResize, this);

    // Initial resource update
    this.resourceManager.updateResources();
    this.frameCount = 0;

    // Add event listener for kill count update
    this.events.on('updateKillCount', (newKillCount: number) => {
      this.killCount = newKillCount;
    });

    this.setupZoomControls();
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.gridManager.initializeGrid();
    this.gridManager.drawGrid();
    this.uiManager.handleResize();
    this.cameraManager.handleResize();
    this.buildingManager.updateAllBuildingHealthPositions();
  }

  public setSelectedBuilding(type: BuildingType | DefenseType) {
    this.buildingManager.setSelectedBuilding(type);
  }

  private setupZoomControls() {
    // Add mouse wheel zoom
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      try {
        // deltaY is positive when scrolling down/away, negative when scrolling up/toward
        const zoomChange = -deltaY * 0.001; // Adjust this value to change zoom sensitivity
        this.zoom(zoomChange);
      } catch (error) {
        console.error('Error during zoom operation:', error);
      }
    });

    // Add keyboard zoom controls
    this.input.keyboard?.on('keydown-PLUS', () => {
      try {
        this.zoom(0.1);
      } catch (error) {
        console.error('Error during keyboard zoom operation:', error);
      }
    });

    this.input.keyboard?.on('keydown-MINUS', () => {
      try {
        this.zoom(-0.1);
      } catch (error) {
        console.error('Error during keyboard zoom operation:', error);
      }
    });

    // Add touch pinch-to-zoom
    this.input.on('pinch', (pinch: any) => {
      try {
        const zoomChange = (pinch.scaleFactor - 1) * 0.1;
        this.zoom(zoomChange);
      } catch (error) {
        console.error('Error during pinch-to-zoom operation:', error);
      }
    });

    // Add middle mouse button drag to pan
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      try {
        if (pointer.isDown && pointer.button === 1) { // Middle mouse button (button 1)
          this.cameras.main.scrollX -= pointer.velocity.x / this.currentZoom;
          this.cameras.main.scrollY -= pointer.velocity.y / this.currentZoom;
        }
      } catch (error) {
        console.error('Error during pan operation:', error);
      }
    });
  }

  private zoom(change: number) {
    const grid = this.gridManager['grid'];
    if (!grid || grid.length === 0 || grid[0].length === 0) {
      console.error('Grid is not properly initialized during zoom operation.');
      return;
    }

    const newZoom = Phaser.Math.Clamp(
      this.currentZoom + change,
      this.minZoom,
      this.maxZoom
    );
    
    if (newZoom !== this.currentZoom) {
      // Store current grid positions of enemies
      const enemyGridPositions = this.enemyManager.getEnemies().map(enemy => ({
        enemy,
        gridX: enemy.gridX
      }));
      
      // Update zoom
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      this.currentZoom = newZoom;
      this.cameras.main.setZoom(this.currentZoom);

      const newWorldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.cameras.main.scrollX += worldPoint.x - newWorldPoint.x;
      this.cameras.main.scrollY += worldPoint.y - newWorldPoint.y;

      // Update enemy positions based on grid positions
      enemyGridPositions.forEach(({ enemy, gridX }) => {
        enemy.gridX = gridX;
        enemy.x = this.gridToWorldX(Math.floor(gridX));
        enemy.sprite.x = enemy.x;
        
        // Update health bar position
        enemy.healthBar.background.x = enemy.x;
        enemy.healthBar.bar.x = enemy.x;
      });

      // Update building health bar positions
      this.buildingManager.updateAllBuildingHealthPositions();

      // Redraw the grid
      this.gridManager.drawGrid();

      Debug.log('Zoom updated', {
        category: 'system',
        data: {
          newZoom,
          cameraPosition: {
            x: this.cameras.main.scrollX,
            y: this.cameras.main.scrollY
          }
        }
      });
    }
  }

  private worldToGridX(worldX: number): number {
    const grid = this.gridManager['grid'];
    const offsetX = (this.scale.width / this.cameraManager.getCurrentZoom() - grid[0].length * this.cellSize) / 2;
    return Math.floor((worldX - offsetX) / this.cellSize);
  }

  private gridToWorldX(gridX: number): number {
    const grid = this.gridManager['grid'];
    const offsetX = (this.scale.width / this.cameraManager.getCurrentZoom() - grid[0].length * this.cellSize) / 2;
    return offsetX + (gridX * this.cellSize) + (this.cellSize / 2);
  }

  update(time: number, delta: number) {
    this.enemyManager.update(time, delta);
    this.buildingManager.update(time, delta);
    this.gameStateManager.update();
    this.uiManager.update();
    this.frameCount++;
    
    // Update building health positions when camera moves
    const lastPos = this.cameraManager.getLastCameraPosition();
    if (this.cameras.main.scrollX !== lastPos.x || this.cameras.main.scrollY !== lastPos.y) {
      this.buildingManager.updateAllBuildingHealthPositions();
      this.cameraManager.updateLastCameraPosition(
        this.cameras.main.scrollX,
        this.cameras.main.scrollY
      );
    }
  }

  // Add a method to start a wave using EnemyManager
  public startWave() {
    this.enemyManager.startWave();
    this.gameStateManager.setWaveActive(true);
  }
}
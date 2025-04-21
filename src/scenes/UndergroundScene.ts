import { Scene } from 'phaser';
import { BuildingType, BUILDING_COLORS, isSurfaceDefense } from '../types/grid';
import { Debug } from '../utils/Debug';
import { BUILDINGS, UndergroundType } from '../types/grid';
import { GridManager } from './GridManager';

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

interface Resources {
    troops: number;
    maxTroops: number;
    ammo: number;
    maxAmmo: number;
    money: number;
    maxMoney: number;
}

interface BuildingHealth {
    health: number;
    maxHealth: number;
    healthBar: {
        background: Phaser.GameObjects.Rectangle;
        bar: Phaser.GameObjects.Rectangle;
    };
    troopText?: Phaser.GameObjects.Text;
    healthText?: Phaser.GameObjects.Text;
    mannedTroops?: number;  // Track how many troops are assigned to this defense
}

export class UndergroundScene extends Scene {
  private cellSize: number = 48;
  private grid: CellContent[][] = [];
  private buildingHealth: (BuildingHealth | null)[][] = [];
  private selectedBuilding: BuildingType | DefenseType = 'tunnel';
  private graphics!: Phaser.GameObjects.Graphics;
  private minZoom: number = 0.5;
  private maxZoom: number = 2;
  private currentZoom: number = 1;
  private enemies: Enemy[] = [];
  private isWaveActive: boolean = false;
  private waveNumber: number = 1;
  private enemiesPerWave: number = 10;
  private enemySpawnTimer: number = 0;
  private enemySpawnDelay: number = 2000; // 2 seconds between spawns
  private spawnedEnemiesCount: number = 0;
  public resources: Resources = {
    troops: 0,
    maxTroops: 0,
    ammo: 0,
    maxAmmo: 0,
    money: 5000,  // Starting money
    maxMoney: 5000
  };
  private defenseProperties: Record<DefenseType, DefenseProperties> = {
    bunker: { range: 3, damage: 10, fireRate: 1000, lastAttackTime: 0, troopsRequired: 2, ammoPerShot: 1 },
    artillery: { range: 5, damage: 30, fireRate: 2000, lastAttackTime: 0, troopsRequired: 4, ammoPerShot: 3 },
    machinegun: { range: 4, damage: 5, fireRate: 500, lastAttackTime: 0, troopsRequired: 1, ammoPerShot: 1 },
    observation: { range: 0, damage: 0, fireRate: 0, lastAttackTime: 0, troopsRequired: 1, ammoPerShot: 0 }
  };
  private attackGraphics: Phaser.GameObjects.Graphics;
  public killCount: number = 0;
  private frameCount: number = 0;
  private resourceGenerationRates = {
    troopsPerSecond: 1,   // Each barracks generates 1 troop per second
    ammoPerSecond: 1      // Each ammo depot generates 1 ammo per second
  };

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

  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  private gridManager!: GridManager;

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

    // Initialize buildingHealth with the same dimensions as the grid
    const cols = Math.floor(this.scale.width / this.cellSize);
    const rows = Math.floor((this.scale.height - 100) / this.cellSize);
    this.buildingHealth = Array(rows).fill(null).map(() => Array(cols).fill(null));

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

    this.setupInteraction();
    this.setupZoomControls();

    // Start resource generation with a timer
    this.time.addEvent({
        delay: 1000, // Update every second
        callback: this.updateResources,
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
    this.updateResources();
    this.frameCount = 0;
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.gridManager.initializeGrid();
    this.gridManager.drawGrid();
  }

  public setSelectedBuilding(type: BuildingType | DefenseType) {
    Debug.log('Building type selected', {
      category: 'building',
      data: {
        previousType: this.selectedBuilding,
        newType: type,
        buildingInfo: this.getBuildingInfo(type)
      }
    });
    
    this.selectedBuilding = type;
  }

  private getBuildingInfo(type: BuildingType | DefenseType) {
    // Check if it's an underground building
    if (this.isUndergroundBuilding(type)) {
      const info = BUILDINGS[type];
      return {
        ...info,
        cost: this.buildingCosts[type]
      };
    }
    
    // If it's a defense, return defense info
    return {
      type: type,
      name: this.getDefenseName(type as DefenseType),
      color: this.colors[type].toString(16),
      description: this.getDefenseDescription(type as DefenseType),
      cost: this.buildingCosts[type]
    };
  }

  private isUndergroundBuilding(type: BuildingType | DefenseType): type is UndergroundType {
    return ['foundation', 'ammo', 'barracks', 'command', 'elevator', 'tunnel'].includes(type);
  }

  private getDefenseName(type: DefenseType): string {
    const names = {
      bunker: 'Bunker',
      artillery: 'Artillery',
      machinegun: 'Machine Gun',
      observation: 'Observation Post'
    };
    return names[type];
  }

  private getDefenseDescription(type: DefenseType): string {
    const descriptions = {
      bunker: 'Fortified defensive position',
      artillery: 'Long-range heavy weapon',
      machinegun: 'Rapid-fire defensive weapon',
      observation: 'Increases range of nearby defenses'
    };
    return descriptions[type];
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
      const enemyGridPositions = this.enemies.map(enemy => ({
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
      this.updateAllBuildingHealthPositions();

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
    const offsetX = (this.scale.width / this.currentZoom - grid[0].length * this.cellSize) / 2;
    return Math.floor((worldX - offsetX) / this.cellSize);
  }

  private gridToWorldX(gridX: number): number {
    const grid = this.gridManager['grid'];
    const offsetX = (this.scale.width / this.currentZoom - grid[0].length * this.cellSize) / 2;
    return offsetX + (gridX * this.cellSize) + (this.cellSize / 2);
  }

  private drawGrid() {
    
    this.graphics.clear();
    
    const grid = this.gridManager['grid'];
    const cols = grid[0].length;
    const rows = grid.length;
    const totalWidth = cols * this.cellSize;
    const totalHeight = rows * this.cellSize;
    const groundLevel = Math.floor(rows / 2);
    
    // Center the grid horizontally
    const offsetX = (this.scale.width / this.currentZoom - totalWidth) / 2;

    // Draw sky (top half)
    this.graphics.fillStyle(0x87CEEB);
    this.graphics.fillRect(offsetX, 0, totalWidth, groundLevel * this.cellSize);

    // Draw ground level (green strip)
    this.graphics.fillStyle(0x355E3B);
    this.graphics.fillRect(offsetX, groundLevel * this.cellSize, totalWidth, this.cellSize);

    // Draw underground (bottom half)
    this.graphics.fillStyle(0x8B4513);
    this.graphics.fillRect(offsetX, (groundLevel + 1) * this.cellSize, totalWidth, (rows - groundLevel - 1) * this.cellSize);

    // Draw cells
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const building = grid[y][x];
        if (building) {
          this.graphics.fillStyle(this.colors[building]);
          this.graphics.fillRect(
            offsetX + x * this.cellSize + 1,
            y * this.cellSize + 1,
            this.cellSize - 2,
            this.cellSize - 2
          );
        }
      }
    }

    // Draw grid lines with adjusted thickness based on zoom
    const lineThickness = 1 / this.currentZoom;
    this.graphics.lineStyle(lineThickness, 0x333333);
    
    // Vertical lines
    for (let x = 0; x <= cols; x++) {
      this.graphics.moveTo(offsetX + x * this.cellSize, 0);
      this.graphics.lineTo(offsetX + x * this.cellSize, totalHeight);
    }

    // Horizontal lines
    for (let y = 0; y <= rows; y++) {
      this.graphics.moveTo(offsetX, y * this.cellSize);
      this.graphics.lineTo(offsetX + totalWidth, y * this.cellSize);
    }

    this.graphics.strokePath();

    // Add debug visualization for building placement
    if (this.selectedBuilding) {
      Debug.log('Grid updated', {
        category: 'grid',
        data: {
          totalBuildings: grid.flat().filter(cell => cell !== null).length,
          buildingTypes: this.getBuildingCounts(),
          groundLevel: Math.floor(grid.length / 2),
          selectedBuilding: this.getBuildingInfo(this.selectedBuilding)
        }
      });
    }
  }

  private setupInteraction() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const x = Math.floor((worldPoint.x - (this.scale.width / this.currentZoom - this.gridManager['grid'][0].length * this.cellSize) / 2) / this.cellSize);
      const y = Math.floor(worldPoint.y / this.cellSize);
      const grid = this.gridManager['grid'];
      
      if (this.canBuildAt(x, y)) {
        const previousContent = grid[y][x];
        grid[y][x] = this.selectedBuilding;
        
        this.resources.money -= this.buildingCosts[this.selectedBuilding];
        this.createBuildingHealth(x, y, this.selectedBuilding);
        this.events.emit('updateResources', this.resources);
        
        Debug.log('Building placed successfully', {
          category: 'building',
          data: {
            type: this.selectedBuilding,
            position: { x, y },
            cost: this.buildingCosts[this.selectedBuilding],
            remainingMoney: this.resources.money
          }
        });

        this.gridManager.drawGrid();
      }
    });
  }

  private canBuildAt(x: number, y: number): boolean {
    const grid = this.gridManager['grid'];
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) {
      return false;
    }

    const groundLevel = Math.floor(grid.length / 2);
    if (grid[y][x] !== null) {
      return false;
    }

    if (this.resources.money < this.buildingCosts[this.selectedBuilding]) {
      Debug.log('Not enough money to build', {
        category: 'building',
        level: 'warn',
        data: {
          building: this.selectedBuilding,
          cost: this.buildingCosts[this.selectedBuilding],
          available: this.resources.money
        }
      });
      return false;
    }

    const isDefense = ['bunker', 'artillery', 'machinegun', 'observation'].includes(this.selectedBuilding);
    if (isDefense) {
      return this.canBuildDefense(x, y, this.selectedBuilding as DefenseType);
    } else {
      if (y < groundLevel) {
        return false;
      }

      if (this.selectedBuilding === 'elevator') {
        const cellAbove = y > 0 ? grid[y - 1][x] : null;
        const cellBelow = y < grid.length - 1 ? grid[y + 1][x] : null;
        const hasVerticalConnection = cellAbove === 'elevator' || cellBelow === 'elevator';

        if (y >= groundLevel) {
          return hasVerticalConnection || this.hasHorizontalConnection(x, y);
        }
        return hasVerticalConnection;
      }

      return this.hasHorizontalConnection(x, y);
    }
  }

  private hasHorizontalConnection(x: number, y: number): boolean {
    const grid = this.gridManager['grid'];
    const horizontalDirections = [
      [-1, 0],
      [1, 0],
    ];

    return horizontalDirections.some(([dx, dy]) => {
      const newX = x + dx;
      const newY = y;
      if (newY >= 0 && newY < grid.length && newX >= 0 && newX < grid[0].length) {
        return grid[newY][newX] !== null;
      }
      return false;
    });
  }

  private hasVerticalConnection(x: number, y: number): boolean {
    const grid = this.gridManager['grid'];
    const above = y > 0 ? grid[y - 1][x] : null;
    const below = y < grid.length - 1 ? grid[y + 1][x] : null;
    return above === 'elevator' || below === 'elevator';
  }

  private canBuildDefense(x: number, y: number, defenseType: DefenseType): boolean {
    const grid = this.gridManager['grid'];
    const groundLevel = Math.floor(grid.length / 2);

    if (y > groundLevel) {
      return false;
    }

    switch (defenseType) {
      case 'bunker':
        if (y === groundLevel) {
          return this.hasAdjacentBunker(x, y) || grid[y + 1][x] === 'elevator';
        } else if (y === groundLevel - 1) {
          return grid[y + 1][x] === 'elevator' || this.hasAdjacentBunker(x, y);
        }
        return false;

      case 'observation':
        if (y < groundLevel - 3) {
          return false;
        }
        const below = grid[y + 1][x];
        return below === 'elevator' || below === 'observation';

      case 'artillery':
      case 'machinegun':
        const cellBelow = grid[y + 1][x];
        return cellBelow === 'bunker' || cellBelow === 'elevator';
    }
  }

  private hasAdjacentBunker(x: number, y: number): boolean {
    const grid = this.gridManager['grid'];
    const horizontalDirections = [[-1, 0], [1, 0]];
    return horizontalDirections.some(([dx, dy]) => {
      const newX = x + dx;
      if (newX >= 0 && newX < grid[0].length) {
        return grid[y][newX] === 'bunker';
      }
      return false;
    });
  }

  private getBuildingCounts(): Record<string, number> {
    const grid = this.gridManager['grid'];
    const counts: Record<string, number> = {};
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell) {
          counts[cell] = (counts[cell] || 0) + 1;
        }
      });
    });
    return counts;
  }

  private endWave() {
    Debug.log('Wave completed', {
        category: 'enemy',
        data: {
            waveNumber: this.waveNumber,
            nextWave: this.waveNumber + 1
        }
    });

    this.isWaveActive = false;
    this.waveNumber++;
    
    // Emit event for wave state change
    this.events.emit('waveStateChanged', this.isWaveActive);
  }

  // Make startWave public
  public startWave() {
    Debug.log('Starting wave', {
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
    this.events.emit('waveStateChanged', this.isWaveActive);
    
    // Clear any remaining enemies
    this.enemies.forEach(enemy => {
        enemy.sprite.destroy();
        enemy.healthBar.background.destroy();
        enemy.healthBar.bar.destroy();
    });
    this.enemies = [];
  }

  private spawnEnemy() {
    const grid = this.gridManager['grid'];
    const groundLevel = Math.floor(grid.length / 2);
    const worldX = this.gridToWorldX(0);
    const worldY = groundLevel * this.cellSize + this.cellSize / 2;
    const health = 50 * this.waveNumber;
    
    Debug.log('Spawning enemy', {
        category: 'enemy',
        data: {
            gridPosition: { x: 0, y: groundLevel },
            worldPosition: { x: worldX, y: worldY },
            health: health,
            wave: this.waveNumber
        }
    });

    // Create enemy sprite
    const enemySprite = this.add.rectangle(
        worldX,
        worldY,
        30,
        30,
        0xff0000
    )
    .setDepth(50)
    .setScrollFactor(1)
    .setStrokeStyle(2, 0x000000);

    // Create health bar background
    const healthBarBg = this.add.rectangle(
        worldX,
        worldY - 20,
        32,
        5,
        0x000000
    )
    .setDepth(50)
    .setScrollFactor(1);

    // Create health bar
    const healthBar = this.add.rectangle(
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
    
    Debug.log('Destroying enemy', {
        category: 'enemy',
        data: {
            position: { x: enemy.x, y: enemy.y },
            remainingHealth: enemy.health,
            remainingEnemies: this.enemies.length - 1
        }
    });

    enemy.sprite.destroy();
    enemy.healthBar.background.destroy();
    enemy.healthBar.bar.destroy();
    this.enemies.splice(index, 1);
    
    // Increment kill count
    this.killCount++;
    
    // Emit events for both kill count and resources
    this.events.emit('updateKillCount', this.killCount);
    this.events.emit('updateResources', this.resources);
  }

  private createBuildingHealth(x: number, y: number, type: BuildingType | DefenseType) {
    const grid = this.gridManager['grid'];
    const worldX = this.gridToWorldX(x);
    const worldY = y * this.cellSize + this.cellSize / 2;
    
    // Create health bar background
    const healthBarBg = this.add.rectangle(
        worldX,
        worldY - 30,
        32,
        5,
        0x000000
    )
    .setDepth(50)
    .setScrollFactor(1);

    // Create health bar
    const healthBar = this.add.rectangle(
        worldX,
        worldY - 30,
        32,
        5,
        0x00ff00
    )
    .setDepth(51)
    .setScrollFactor(1);

    // Create health text
    const healthText = this.add.text(
        worldX,
        worldY - 40,
        '',
        {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 2, y: 1 }
        }
    )
    .setOrigin(0.5)
    .setDepth(52)
    .setScrollFactor(1);

    // Create troop text if it's a defense
    let troopText: Phaser.GameObjects.Text | undefined;
    if (this.isDefense(type)) {
        const defenseType = type as DefenseType;
        const troopsRequired = this.defenseProperties[defenseType].troopsRequired;
        
        troopText = this.add.text(
            worldX,
            worldY - 50,
            `👥 ${troopsRequired}`,
            {
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 2, y: 1 }
            }
        )
        .setOrigin(0.5)
        .setDepth(52)
        .setScrollFactor(1);
    }

    // Set building health based on type
    let maxHealth = 100;
    if (this.isDefense(type)) {
        maxHealth = 150;
    } else if (type === 'barracks') {
        maxHealth = 200;
    } else if (type === 'ammo') {
        maxHealth = 250;
    }

    this.buildingHealth[y][x] = {
        health: maxHealth,
        maxHealth: maxHealth,
        healthBar: {
            background: healthBarBg,
            bar: healthBar
        },
        healthText: healthText,
        troopText: troopText
    };

    // Update initial text
    this.updateBuildingText(x, y);
  }

  private updateBuildingText(x: number, y: number) {
    const building = this.buildingHealth[y][x];
    if (!building) return;

    const healthPercent = Math.floor((building.health / building.maxHealth) * 100);
    building.healthText?.setText(`${healthPercent}%`);

    const grid = this.gridManager['grid'];
    const cell = grid[y][x];
    if (building.troopText && cell && this.isDefense(cell)) {
        const defenseType = cell as DefenseType;
        const troopsRequired = this.defenseProperties[defenseType].troopsRequired;
        const mannedTroops = building.mannedTroops || 0;
        const isFullyManned = mannedTroops >= troopsRequired;
        building.troopText.setText(`👥 ${mannedTroops}/${troopsRequired}${isFullyManned ? '✓' : '✗'}`);
        building.troopText.setColor(isFullyManned ? '#00ff00' : '#ff0000');
    }
  }

  private damageBuilding(x: number, y: number, damage: number) {
    const building = this.buildingHealth[y][x];
    if (building) {
        building.health -= damage;
        
        // Update health bar
        const healthPercent = building.health / building.maxHealth;
        building.healthBar.bar.width = 32 * healthPercent;
        building.healthBar.bar.setFillStyle(
            healthPercent > 0.5 ? 0x00ff00 :
            healthPercent > 0.25 ? 0xffff00 : 0xff0000
        );

        // Update health text
        this.updateBuildingText(x, y);

        // Check if building is destroyed
        if (building.health <= 0) {
            this.destroyBuilding(x, y);
        }

        Debug.log('Building damaged', {
            category: 'combat',
            data: {
                position: { x, y },
                damage,
                remainingHealth: building.health
            }
        });
    }
  }

  private destroyBuilding(x: number, y: number) {
    const grid = this.gridManager['grid'];
    const building = grid[y][x];
    if (building) {
        // Remove health bars and text
        if (this.buildingHealth[y][x]) {
            this.buildingHealth[y][x].healthBar.background.destroy();
            this.buildingHealth[y][x].healthBar.bar.destroy();
            this.buildingHealth[y][x].healthText?.destroy();
            this.buildingHealth[y][x].troopText?.destroy();
            this.buildingHealth[y][x] = null;
        }

        // If it's a defense, remove troops
        if (this.isDefense(building)) {
            const defenseType = building as DefenseType;
            this.resources.troops -= this.defenseProperties[defenseType].troopsRequired;
        }

        // Remove building
        grid[y][x] = null;
        this.gridManager.drawGrid();
        
        // Update resources to recalculate max values
        this.updateResources();

        Debug.log('Building destroyed', {
            category: 'combat',
            data: {
                type: building,
                position: { x, y }
            }
        });
    }
  }

  private handleEnemyAttacks(time: number) {
    const grid = this.gridManager['grid'];
    this.enemies.forEach(enemy => {
        // Check for buildings in attack range
        const gridX = Math.floor(enemy.gridX);
        const gridY = Math.floor(grid.length / 2); // Ground level

        // Check adjacent cells for buildings
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const targetX = gridX + dx;
                const targetY = gridY + dy;

                // Check if position is valid and contains a building
                if (targetX >= 0 && targetX < grid[0].length &&
                    targetY >= 0 && targetY < grid.length &&
                    grid[targetY][targetX]) {
                    
                    const building = grid[targetY][targetX];
                    
                    // Check if enough time has passed since last attack
                    if (time - enemy.lastAttackTime >= enemy.attackCooldown) {
                        // If building has troops, kill them first
                        if (this.isDefense(building)) {
                            const defenseType = building as DefenseType;
                            const troopsRequired = this.defenseProperties[defenseType].troopsRequired;
                            
                            if (this.resources.troops >= troopsRequired) {
                                // Kill troops
                                this.resources.troops -= troopsRequired;
                                // Emit resource update after troops are killed
                                this.events.emit('updateResources', this.resources);
                                Debug.log('Troops killed', {
                                    category: 'combat',
                                    data: {
                                        defenseType,
                                        troopsKilled: troopsRequired,
                                        remainingTroops: this.resources.troops
                                    }
                                });
                            } else {
                                // Attack building
                                this.damageBuilding(targetX, targetY, enemy.damage);
                            }
                        } else {
                            // Attack building directly
                            this.damageBuilding(targetX, targetY, enemy.damage);
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
    
    // Clear previous attack graphics
    this.attackGraphics.clear();

    // Check each defense in the grid
    for (let y = 0; y <= groundLevel; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            const cell = grid[y][x];
            if (cell && this.isDefense(cell)) {
                const defenseType = cell as DefenseType;
                const props = this.defenseProperties[defenseType];
                const building = this.buildingHealth[y][x];
                
                // Skip if not fully manned
                if (!building || !building.mannedTroops || building.mannedTroops < props.troopsRequired) {
                    continue;
                }
                
                // Skip observation posts as they don't attack
                if (defenseType === 'observation') continue;

                // Check if we have enough ammo
                if (this.resources.ammo < props.ammoPerShot) {
                    continue;
                }

                // Check if enough time has passed since last attack
                if (time - props.lastAttackTime >= props.fireRate) {
                    // Find closest enemy in range
                    let closestEnemy: Enemy | null = null;
                    let closestDistance = props.range;

                    this.enemies.forEach(enemy => {
                        const distance = Math.abs(enemy.gridX - x);
                        if (distance <= props.range && (!closestEnemy || distance < closestDistance)) {
                            closestEnemy = enemy;
                            closestDistance = distance;
                        }
                    });

                    // Attack if enemy found
                    if (closestEnemy) {
                        this.attackEnemy(defenseType, x, y, closestEnemy, time);
                        // Consume ammo
                        this.resources.ammo -= props.ammoPerShot;
                        // Emit resource update after ammo is consumed
                        this.events.emit('updateResources', this.resources);
                    }
                }
            }
        }
    }
  }

  private attackEnemy(defenseType: DefenseType, defenseX: number, defenseY: number, enemy: Enemy, time: number) {
    const grid = this.gridManager['grid'];
    const props = this.defenseProperties[defenseType];
    const defenseWorldX = this.gridToWorldX(defenseX);
    const defenseWorldY = defenseY * this.cellSize + this.cellSize / 2;

    // Create projectile with improved visibility
    const projectile = this.add.graphics();
    projectile.lineStyle(4, 0xff0000, 1); // Thicker, fully opaque line
    
    // Calculate projectile path
    const startX = defenseWorldX;
    const startY = defenseWorldY;
    const endX = enemy.x;
    const endY = enemy.y;
    
    // Draw initial projectile line
    projectile.lineBetween(startX, startY, endX, endY);
    
    // Add glow effect
    const glow = this.add.graphics();
    glow.lineStyle(8, 0xff0000, 0.3);
    glow.lineBetween(startX, startY, endX, endY);
    
    // Animate projectile
    const duration = 500; // Slower projectile speed (500ms instead of instant)
    const tween = this.tweens.add({
      targets: [projectile, glow],
      alpha: 0,
      duration: duration,
      onComplete: () => {
        projectile.destroy();
        glow.destroy();
        // Apply damage after projectile hits
        enemy.health -= props.damage;
        
        // Update health bar
        const healthPercent = enemy.health / enemy.maxHealth;
        enemy.healthBar.bar.width = 32 * healthPercent;
        enemy.healthBar.bar.setFillStyle(healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000);

        // Check if enemy is destroyed
        if (enemy.health <= 0) {
            const index = this.enemies.indexOf(enemy);
            if (index !== -1) {
                this.destroyEnemy(index);
            }
        }
      }
    });

    // Update last attack time
    props.lastAttackTime = time;

    Debug.log('Defense attack', {
        category: 'combat',
        data: {
            defenseType,
            position: { x: defenseX, y: defenseY },
            enemyHealth: enemy.health,
            damage: props.damage
        }
    });
  }

  private isDefense(type: BuildingType | DefenseType): type is DefenseType {
    return ['bunker', 'artillery', 'machinegun', 'observation'].includes(type);
  }

  update(time: number, delta: number) {
    const grid = this.gridManager['grid'];
    this.frameCount++;
    if (this.isWaveActive) {
        // Spawn enemies
        this.enemySpawnTimer += delta;
        if (this.enemySpawnTimer >= this.enemySpawnDelay && 
            this.spawnedEnemiesCount < this.enemiesPerWave) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }

        // Update enemies and handle defense attacks
        this.enemies.forEach((enemy, index) => {
            // Move enemy in grid coordinates
            enemy.gridX += (enemy.speed * delta) / (1000 * this.cellSize);
            
            // Convert to world coordinates
            enemy.x = this.gridToWorldX(Math.floor(enemy.gridX));
            enemy.sprite.x = enemy.x;
            
            // Update health bar position
            enemy.healthBar.background.x = enemy.x;
            enemy.healthBar.bar.x = enemy.x;

            // Remove enemies that reach the right side
            if (enemy.gridX >= grid[0].length) {
                this.destroyEnemy(index);
            }
        });

        // Handle enemy attacks
        this.handleEnemyAttacks(time);

        // Handle defense attacks
        this.handleDefenseAttacks(time);

        // Log wave status periodically
        if (time % 1000 < 16) {
            Debug.log('Wave status', {
                category: 'enemy',
                data: {
                    waveNumber: this.waveNumber,
                    activeEnemies: this.enemies.length,
                    spawned: this.spawnedEnemiesCount,
                    total: this.enemiesPerWave
                }
            });
        }
    }
    
    // Update building health positions when camera moves
    if (this.cameras.main.scrollX !== this.lastCameraX || this.cameras.main.scrollY !== this.lastCameraY) {
      this.updateAllBuildingHealthPositions();
      this.lastCameraX = this.cameras.main.scrollX;
      this.lastCameraY = this.cameras.main.scrollY;
    }
  }

  private updateResources() {
    const grid = this.gridManager['grid'];
    // Count resource buildings
    let barracksCount = 0;
    let ammoCount = 0;
    let defenseCount = 0;
    let commandCount = 0;

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const building = grid[y][x];
        if (building) {
          if (building === 'barracks') barracksCount++;
          else if (building === 'ammo') ammoCount++;
          else if (this.isDefense(building)) defenseCount++;
          else if (building === 'command') commandCount++;
        }
      }
    }

    // Update max capacities (10 per barracks, 25 per ammo depot)
    this.resources.maxTroops = barracksCount * 10;
    this.resources.maxAmmo = ammoCount * 25;

    // Update money from command centers if there are any
    if (commandCount > 0) {
      this.resources.money = commandCount * 100;
      this.resources.maxMoney = commandCount * 100;
    }
    
    // Increment resources based on generation rates (1 per second per building)
    if (barracksCount > 0) {
      this.resources.troops = Math.min(
        this.resources.maxTroops,
        this.resources.troops + (this.resourceGenerationRates.troopsPerSecond * barracksCount)
      );
    }
    
    if (ammoCount > 0) {
      this.resources.ammo = Math.min(
        this.resources.maxAmmo,
        this.resources.ammo + (this.resourceGenerationRates.ammoPerSecond * ammoCount)
      );
    }

    // Distribute troops to defenses after updating resources
    this.distributeTroops();

    // Emit event to update UI
    console.log('Updating resources:', this.resources);
    this.events.emit('updateResources', this.resources);

  }

  // Add a new method to update all building health positions
  private updateAllBuildingHealthPositions() {
    const grid = this.gridManager['grid'];
    Debug.log('Updating building health positions', {
      category: 'building',
      data: {
        gridRows: grid.length,
        gridCols: grid[0].length,
        buildingHealthRows: this.buildingHealth.length,
        buildingHealthCols: this.buildingHealth[0]?.length || 0
      }
    });
    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && this.buildingHealth[y][x]) {
          const building = this.buildingHealth[y][x];
          if (building) {
            const worldX = this.gridToWorldX(x);
            const worldY = y * this.cellSize + this.cellSize / 2;
            
            // Update health bar positions
            building.healthBar.background.x = worldX;
            building.healthBar.bar.x = worldX;
            
            // Update text positions
            if (building.healthText) {
              building.healthText.x = worldX;
            }
            
            if (building.troopText) {
              building.troopText.x = worldX;
            }
          }
        }
      });
    });
  }

  private distributeTroops() {
    const grid = this.gridManager['grid'];
    // Reset all manned troops
    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell && this.isDefense(cell) && this.buildingHealth[y][x]) {
                this.buildingHealth[y][x]!.mannedTroops = 0;
            }
        });
    });

    // Get all defenses and sort by priority (you can adjust the priority logic)
    const defenses: {x: number, y: number, type: DefenseType, required: number}[] = [];
    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell && this.isDefense(cell)) {
                const defenseType = cell as DefenseType;
                defenses.push({
                    x, y,
                    type: defenseType,
                    required: this.defenseProperties[defenseType].troopsRequired
                });
            }
        });
    });

    // Sort defenses by required troops (highest first)
    defenses.sort((a, b) => b.required - a.required);

    // Distribute troops
    let remainingTroops = this.resources.troops;
    for (const defense of defenses) {
        const building = this.buildingHealth[defense.y][defense.x];
        if (building) {
            const troopsToAssign = Math.min(remainingTroops, defense.required);
            building.mannedTroops = troopsToAssign;
            remainingTroops -= troopsToAssign;
            this.updateBuildingText(defense.x, defense.y);
        }
    }
  }
}
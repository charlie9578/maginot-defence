import { Scene } from 'phaser';
import { BuildingType, BUILDING_COLORS, isSurfaceDefense } from '../types/grid';
import { Debug } from '../utils/Debug';
import { BUILDINGS, UndergroundType } from '../types/grid';

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
}

interface DefenseProperties {
    range: number;      // Attack range in grid cells
    damage: number;     // Damage per hit
    fireRate: number;   // Time between attacks in milliseconds
    lastAttackTime: number;
}

export class UndergroundScene extends Scene {
  private cellSize: number = 48;
  private grid: CellContent[][] = [];
  private selectedBuilding: BuildingType | DefenseType = 'foundation';
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
  private defenseProperties: Record<DefenseType, DefenseProperties> = {
    bunker: { range: 3, damage: 10, fireRate: 1000, lastAttackTime: 0 },
    artillery: { range: 5, damage: 30, fireRate: 2000, lastAttackTime: 0 },
    machinegun: { range: 4, damage: 5, fireRate: 500, lastAttackTime: 0 },
    observation: { range: 0, damage: 0, fireRate: 0, lastAttackTime: 0 }
  };
  private attackGraphics: Phaser.GameObjects.Graphics;

  private colors: Record<BuildingType | DefenseType, number> = {
    // Underground buildings
    foundation: 0x555555,
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
    this.initializeGrid();
    this.drawGrid();
    this.setupInteraction();
    this.setupZoomControls();

    // Add wave start button
    const startButton = this.add.text(10, 10, 'Start Wave', {
        backgroundColor: '#00ff00',
        padding: { x: 10, y: 5 }
    })
    .setInteractive()
    .setDepth(100);

    startButton.on('pointerdown', () => {
        this.startWave();
    });

    Debug.log('Scene creation completed', { 
      category: 'system',
      data: {
        gridSize: `${this.grid[0].length}x${this.grid.length}`,
        groundLevel: Math.floor(this.grid.length / 2)
      }
    });

    // Add window resize handler
    this.scale.on('resize', this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.initializeGrid();
    this.drawGrid();
  }

  private initializeGrid() {
    const cols = Math.floor(this.scale.width / this.cellSize);
    const rows = Math.floor((this.scale.height - 100) / this.cellSize); // Account for UI space
    
    // Create new grid or resize existing
    const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));
    
    // Copy existing grid data if it exists
    if (this.grid.length > 0) {
      for (let y = 0; y < Math.min(rows, this.grid.length); y++) {
        for (let x = 0; x < Math.min(cols, this.grid[0].length); x++) {
          newGrid[y][x] = this.grid[y][x];
        }
      }
    }
    
    this.grid = newGrid;

    // Add tunnel entrance at the right side of ground level
    const groundLevel = Math.floor(rows / 2);
    this.grid[groundLevel][cols - 1] = 'tunnel';
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
      return BUILDINGS[type];
    }
    
    // If it's a defense, return defense info
    return {
      type: type,
      name: this.getDefenseName(type as DefenseType),
      color: this.colors[type].toString(16),
      description: this.getDefenseDescription(type as DefenseType)
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
      // deltaY is positive when scrolling down/away, negative when scrolling up/toward
      const zoomChange = -deltaY * 0.001; // Adjust this value to change zoom sensitivity
      this.zoom(zoomChange);
    });

    // Add keyboard zoom controls
    this.input.keyboard?.on('keydown-PLUS', () => {
      this.zoom(0.1);
    });

    this.input.keyboard?.on('keydown-MINUS', () => {
      this.zoom(-0.1);
    });

    // Add touch pinch-to-zoom
    this.input.on('pinch', (pinch: any) => {
      const zoomChange = (pinch.scaleFactor - 1) * 0.1;
      this.zoom(zoomChange);
    });

    // Add middle mouse button drag to pan
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && pointer.button === 1) { // Middle mouse button (button 1)
        this.cameras.main.scrollX -= pointer.velocity.x / this.currentZoom;
        this.cameras.main.scrollY -= pointer.velocity.y / this.currentZoom;
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
        enemy.healthBar.background.x = enemy.x;
        enemy.healthBar.bar.x = enemy.x;
      });

      // Redraw the grid
      this.drawGrid();

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
    const offsetX = (this.scale.width / this.currentZoom - this.grid[0].length * this.cellSize) / 2;
    return Math.floor((worldX - offsetX) / this.cellSize);
  }

  private gridToWorldX(gridX: number): number {
    const offsetX = (this.scale.width / this.currentZoom - this.grid[0].length * this.cellSize) / 2;
    return offsetX + (gridX * this.cellSize) + (this.cellSize / 2);
  }

  private drawGrid() {
    this.graphics.clear();
    
    const cols = this.grid[0].length;
    const rows = this.grid.length;
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
        const building = this.grid[y][x];
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
          totalBuildings: this.grid.flat().filter(cell => cell !== null).length,
          buildingTypes: this.getBuildingCounts(),
          groundLevel: Math.floor(this.grid.length / 2),
          selectedBuilding: this.getBuildingInfo(this.selectedBuilding)
        }
      });
    }
  }

  private setupInteraction() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Convert screen coordinates to world coordinates
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const x = Math.floor((worldPoint.x - (this.scale.width / this.currentZoom - this.grid[0].length * this.cellSize) / 2) / this.cellSize);
      const y = Math.floor(worldPoint.y / this.cellSize);
      
      Debug.log('Attempting to place building', {
        category: 'building',
        data: {
          type: this.selectedBuilding,
          position: { x, y },
          worldPosition: { x: worldPoint.x, y: worldPoint.y },
          gridDimensions: {
            width: this.grid[0].length,
            height: this.grid.length
          },
          groundLevel: Math.floor(this.grid.length / 2)
        }
      });

      if (this.canBuildAt(x, y)) {
        const previousContent = this.grid[y][x];
        this.grid[y][x] = this.selectedBuilding;
        
        Debug.log('Building placed successfully', {
          category: 'building',
          data: {
            type: this.selectedBuilding,
            position: { x, y },
            replacedContent: previousContent,
            buildingStats: this.getBuildingInfo(this.selectedBuilding),
            adjacentCells: {
              north: y > 0 ? this.grid[y-1][x] : null,
              south: y < this.grid.length - 1 ? this.grid[y+1][x] : null,
              east: x < this.grid[0].length - 1 ? this.grid[y][x+1] : null,
              west: x > 0 ? this.grid[y][x-1] : null
            }
          }
        });

        this.drawGrid();
      } else {
        Debug.log('Building placement failed', {
          category: 'building',
          level: 'warn',
          data: {
            type: this.selectedBuilding,
            position: { x, y },
            currentCell: this.grid[y]?.[x] || 'out of bounds',
            reason: this.getBuildFailureReason(x, y)
          }
        });
      }
    });
  }

  private getBuildFailureReason(x: number, y: number): string {
    // Check bounds
    if (y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[0].length) {
      return 'Position out of bounds';
    }

    const groundLevel = Math.floor(this.grid.length / 2);

    // Check if cell is empty
    if (this.grid[y][x] !== null) {
      return 'Cell already occupied';
    }

    const isDefense = ['bunker', 'artillery', 'machinegun', 'observation'].includes(this.selectedBuilding);
    
    if (isDefense) {
      if (y > groundLevel) {
        return 'Defense structures must be at or above ground level';
      }
      // Add more specific defense placement rules
      return 'Invalid defense placement';
    } else {
      if (y < groundLevel) {
        return 'Underground buildings must be below ground level';
      }
      
      if (this.selectedBuilding === 'elevator') {
        if (!this.hasVerticalConnection(x, y) && !this.hasHorizontalConnection(x, y)) {
          return 'Elevator must connect to other structures';
        }
      } else if (!this.hasHorizontalConnection(x, y)) {
        return 'Building must connect to existing structures';
      }
    }

    return 'Unknown reason';
  }

  private canBuildAt(x: number, y: number): boolean {
    // Check bounds
    if (y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[0].length) {
      return false;
    }

    const groundLevel = Math.floor(this.grid.length / 2);

    // Check if cell is empty
    if (this.grid[y][x] !== null) {
      return false;
    }

    const isDefense = ['bunker', 'artillery', 'machinegun', 'observation'].includes(this.selectedBuilding);
    
    if (isDefense) {
      return this.canBuildDefense(x, y, this.selectedBuilding as DefenseType);
    } else {
      // Underground building rules
      if (y < groundLevel) {
        return false;
      }

      if (this.selectedBuilding === 'elevator') {
        // Check for vertical elevator connections
        const cellAbove = y > 0 ? this.grid[y - 1][x] : null;
        const cellBelow = y < this.grid.length - 1 ? this.grid[y + 1][x] : null;
        const hasVerticalConnection = cellAbove === 'elevator' || cellBelow === 'elevator';

        // If at or below ground level, also allow horizontal connections
        if (y >= groundLevel) {
          return hasVerticalConnection || this.hasHorizontalConnection(x, y);
        }
        
        // Above ground, only allow vertical connections
        return hasVerticalConnection;
      }

      return this.hasHorizontalConnection(x, y);
    }
  }

  private canBuildDefense(x: number, y: number, defenseType: DefenseType): boolean {
    const groundLevel = Math.floor(this.grid.length / 2);

    // Check if we're at surface level or above
    if (y > groundLevel) {
      return false;
    }

    switch (defenseType) {
      case 'bunker':
        // Bunkers can be built:
        // 1. On ground level next to other bunkers
        // 2. One level up from ground if above elevator
        if (y === groundLevel) {
          // Allow building next to other bunkers or above elevator
          return this.hasAdjacentBunker(x, y) || this.grid[y + 1][x] === 'elevator';
        } else if (y === groundLevel - 1) {
          // One level up, must be above elevator or next to another bunker
          return this.grid[y + 1][x] === 'elevator' || this.hasAdjacentBunker(x, y);
        }
        return false;

      case 'observation':
        // Observation post can stack up to 3 high (groundLevel - 2)
        if (y < groundLevel - 3) {
          return false;
        }
        // Must be above elevator or another observation post
        const below = this.grid[y + 1][x];
        return below === 'elevator' || below === 'observation';

      case 'artillery':
      case 'machinegun':
        // Can be built on top of bunkers or above elevators
        const cellBelow = this.grid[y + 1][x];
        return cellBelow === 'bunker' || cellBelow === 'elevator';
    }
  }

  private hasAdjacentBunker(x: number, y: number): boolean {
    const horizontalDirections = [[-1, 0], [1, 0]];
    
    // Check for horizontal bunker connections
    return horizontalDirections.some(([dx, dy]) => {
      const newX = x + dx;
      if (newX >= 0 && newX < this.grid[0].length) {
        return this.grid[y][newX] === 'bunker';
      }
      return false;
    });
  }

  private hasHorizontalConnection(x: number, y: number): boolean {
    // Check left and right only
    const horizontalDirections = [
      [-1, 0], // left
      [1, 0],  // right
    ];

    return horizontalDirections.some(([dx, dy]) => {
      const newX = x + dx;
      const newY = y;
      
      if (newY >= 0 && newY < this.grid.length && 
          newX >= 0 && newX < this.grid[0].length) {
        return this.grid[newY][newX] !== null;
      }
      return false;
    });
  }

  private hasVerticalConnection(x: number, y: number): boolean {
    const above = y > 0 ? this.grid[y - 1][x] : null;
    const below = y < this.grid.length - 1 ? this.grid[y + 1][x] : null;
    return above === 'elevator' || below === 'elevator';
  }

  private getBuildingCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.grid.forEach(row => {
      row.forEach(cell => {
        if (cell) {
          counts[cell] = (counts[cell] || 0) + 1;
        }
      });
    });
    return counts;
  }

  private startWave() {
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
    
    // Clear any remaining enemies
    this.enemies.forEach(enemy => {
        enemy.sprite.destroy();
        enemy.healthBar.background.destroy();
        enemy.healthBar.bar.destroy();
    });
    this.enemies = [];
  }

  private spawnEnemy() {
    const groundLevel = Math.floor(this.grid.length / 2);
    const worldX = this.gridToWorldX(0); // Start at leftmost grid position
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
    .setScrollFactor(1) // Make sure it scrolls with camera
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
        gridX: 0, // Track grid position
        x: worldX,
        y: worldY
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
  }

  update(time: number, delta: number) {
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
            if (enemy.gridX >= this.grid[0].length) {
                this.destroyEnemy(index);
            }
        });

        // Handle defense attacks
        this.handleDefenseAttacks(time);

        // Log wave status periodically
        if (time % 1000 < 16) { // Log roughly every second
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
  }

  private handleDefenseAttacks(time: number) {
    const groundLevel = Math.floor(this.grid.length / 2);
    
    // Clear previous attack graphics
    this.attackGraphics.clear();

    // Check each defense in the grid
    for (let y = 0; y <= groundLevel; y++) {
        for (let x = 0; x < this.grid[0].length; x++) {
            const cell = this.grid[y][x];
            if (cell && this.isDefense(cell)) {
                const defenseType = cell as DefenseType;
                const props = this.defenseProperties[defenseType];
                
                // Skip observation posts as they don't attack
                if (defenseType === 'observation') continue;

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
                    }
                }
            }
        }
    }
  }

  private attackEnemy(defenseType: DefenseType, defenseX: number, defenseY: number, enemy: Enemy, time: number) {
    const props = this.defenseProperties[defenseType];
    const defenseWorldX = this.gridToWorldX(defenseX);
    const defenseWorldY = defenseY * this.cellSize + this.cellSize / 2;

    // Create projectile
    const projectile = this.add.graphics();
    projectile.lineStyle(2, 0xff0000, 0.5);
    
    // Calculate projectile path
    const startX = defenseWorldX;
    const startY = defenseWorldY;
    const endX = enemy.x;
    const endY = enemy.y;
    
    // Draw initial projectile line
    projectile.lineBetween(startX, startY, endX, endY);
    
    // Animate projectile
    const duration = 500; // Slower projectile speed (500ms instead of instant)
    const tween = this.tweens.add({
      targets: projectile,
      alpha: 0,
      duration: duration,
      onComplete: () => {
        projectile.destroy();
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
  }
} 
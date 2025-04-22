import { Scene } from 'phaser';
import { GridManager } from '../scenes/GridManager';
import { BuildingType, DefenseType, BUILDINGS, UndergroundType } from '../types/grid';
import { Debug } from '../utils/Debug';

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

interface Resources {
  troops: number;
  maxTroops: number;
  ammo: number;
  maxAmmo: number;
  money: number;
  maxMoney: number;
}

interface DefenseProperties {
  range: number;      // Attack range in grid cells
  damage: number;     // Damage per hit
  fireRate: number;   // Time between attacks in milliseconds
  lastAttackTime: number;
  troopsRequired: number;  // Number of troops needed to operate
  ammoPerShot: number;    // Amount of ammo consumed per shot
}

export class BuildingManager {
  private scene: Scene;
  private gridManager: GridManager;
  private resourceManager: any; // Will be properly typed when ResourceManager is created
  private buildingHealth: (BuildingHealth | null)[][] = [];
  private selectedBuilding: BuildingType | DefenseType = 'tunnel';
  private cellSize: number;
  private colors: Record<BuildingType | DefenseType, number>;
  private buildingCosts: Record<BuildingType | DefenseType, number>;
  private defenseProperties: Record<DefenseType, DefenseProperties>;

  constructor(
    scene: Scene, 
    gridManager: GridManager, 
    resourceManager: any,
    cellSize: number,
    colors: Record<BuildingType | DefenseType, number>,
    buildingCosts: Record<BuildingType | DefenseType, number>,
    defenseProperties: Record<DefenseType, DefenseProperties>
  ) {
    this.scene = scene;
    this.gridManager = gridManager;
    this.resourceManager = resourceManager;
    this.cellSize = cellSize;
    this.colors = colors;
    this.buildingCosts = buildingCosts;
    this.defenseProperties = defenseProperties;
  }

  public initialize() {
    const grid = this.gridManager['grid'];
    const cols = grid[0].length;
    const rows = grid.length;
    this.buildingHealth = Array(rows).fill(null).map(() => Array(cols).fill(null));
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

  public getSelectedBuilding(): BuildingType | DefenseType {
    return this.selectedBuilding;
  }

  public getBuildingInfo(type: BuildingType | DefenseType) {
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

  public setupInteraction() {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const x = Math.floor((worldPoint.x - (this.scene.scale.width / this.scene.cameras.main.zoom - this.gridManager['grid'][0].length * this.cellSize) / 2) / this.cellSize);
      const y = Math.floor(worldPoint.y / this.cellSize);
      const grid = this.gridManager['grid'];
      
      if (this.canBuildAt(x, y)) {
        const previousContent = grid[y][x];
        grid[y][x] = this.selectedBuilding;
        
        this.resourceManager.resources.money -= this.buildingCosts[this.selectedBuilding];
        this.createBuildingHealth(x, y, this.selectedBuilding);
        this.scene.events.emit('updateResources', this.resourceManager.resources);
        
        Debug.log('Building placed successfully', {
          category: 'building',
          data: {
            type: this.selectedBuilding,
            position: { x, y },
            cost: this.buildingCosts[this.selectedBuilding],
            remainingMoney: this.resourceManager.resources.money
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

    if (this.resourceManager.resources.money < this.buildingCosts[this.selectedBuilding]) {
      Debug.log('Not enough money to build', {
        category: 'building',
        level: 'warn',
        data: {
          building: this.selectedBuilding,
          cost: this.buildingCosts[this.selectedBuilding],
          available: this.resourceManager.resources.money
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

  public getBuildingCounts(): Record<string, number> {
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

  public createBuildingHealth(x: number, y: number, type: BuildingType | DefenseType) {
    const grid = this.gridManager['grid'];
    const worldX = this.gridToWorldX(x);
    const worldY = y * this.cellSize + this.cellSize / 2;
    
    // Create health bar background
    const healthBarBg = this.scene.add.rectangle(
        worldX,
        worldY - 30,
        32,
        5,
        0x000000
    )
    .setDepth(50)
    .setScrollFactor(1);

    // Create health bar
    const healthBar = this.scene.add.rectangle(
        worldX,
        worldY - 30,
        32,
        5,
        0x00ff00
    )
    .setDepth(51)
    .setScrollFactor(1);

    // Create health text
    const healthText = this.scene.add.text(
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
        
        troopText = this.scene.add.text(
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

  public updateBuildingText(x: number, y: number) {
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

  public damageBuilding(x: number, y: number, damage: number) {
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

  public destroyBuilding(x: number, y: number) {
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
            this.resourceManager.resources.troops -= this.defenseProperties[defenseType].troopsRequired;
        }

        // Remove building
        grid[y][x] = null;
        this.gridManager.drawGrid();
        
        // Update resources to recalculate max values
        this.resourceManager.updateResources();

        Debug.log('Building destroyed', {
            category: 'combat',
            data: {
                type: building,
                position: { x, y }
            }
        });
    }
  }

  public isDefense(type: BuildingType | DefenseType): type is DefenseType {
    return ['bunker', 'artillery', 'machinegun', 'observation'].includes(type);
  }

  public getBuildingHealth(x: number, y: number): BuildingHealth | null {
    return this.buildingHealth[y][x];
  }

  public getDefenseProperties(type: DefenseType): DefenseProperties {
    return this.defenseProperties[type];
  }

  public updateAllBuildingHealthPositions() {
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

  public distributeTroops() {
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
    let remainingTroops = this.resourceManager.resources.troops;
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

  private gridToWorldX(gridX: number): number {
    const grid = this.gridManager['grid'];
    const offsetX = (this.scene.scale.width / this.scene.cameras.main.zoom - grid[0].length * this.cellSize) / 2;
    return offsetX + (gridX * this.cellSize) + (this.cellSize / 2);
  }

  public update(time: number, delta: number) {
    // Update building-related logic here
    // For example, update building animations, effects, etc.
  }
} 
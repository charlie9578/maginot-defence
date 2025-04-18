export type CellType = 'empty' | 'foundation' | 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';

export type SurfaceType = 'empty' | 'bunker' | 'artillery' | 'machinegun' | 'observation';

export interface GridCell {
  x: number;
  y: number;
  underground: {
    type: CellType;
    level: number;
    connections: Direction[];
  };
  surface: {
    type: SurfaceType;
    level: number;
    health: number;
  };
}

export type Direction = 'north' | 'south' | 'east' | 'west';

export interface BuildingRequirement {
  requiredUnderground: CellType[];
  powerDraw: number;
  manpowerNeeded: number;
  ammunitionUsage: number;
} 
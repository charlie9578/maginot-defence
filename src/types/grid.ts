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

export interface BuildingDefinition {
  type: CellType;
  name: string;
  color: string;
  width: number;
  height: number;
  description: string;
}

export const BUILDINGS: Record<CellType, BuildingDefinition> = {
  empty: {
    type: 'empty',
    name: 'Empty',
    color: '#222222',
    width: 1,
    height: 1,
    description: 'Empty space'
  },
  foundation: {
    type: 'foundation',
    name: 'Foundation',
    color: '#555555',
    width: 2,
    height: 1,
    description: 'Basic support structure'
  },
  ammo: {
    type: 'ammo',
    name: 'Ammo Storage',
    color: '#ff0000',
    width: 2,
    height: 2,
    description: 'Stores ammunition for defense'
  },
  barracks: {
    type: 'barracks',
    name: 'Barracks',
    color: '#00ff00',
    width: 3,
    height: 2,
    description: 'Houses soldiers'
  },
  command: {
    type: 'command',
    name: 'Command Center',
    color: '#0000ff',
    width: 3,
    height: 3,
    description: 'Central command operations'
  },
  elevator: {
    type: 'elevator',
    name: 'Elevator',
    color: '#ffff00',
    width: 1,
    height: 2,
    description: 'Connects to surface'
  },
  tunnel: {
    type: 'tunnel',
    name: 'Tunnel',
    color: '#888888',
    width: 1,
    height: 1,
    description: 'Underground passage'
  }
}; 
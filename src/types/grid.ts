export type UndergroundType = 'foundation' | 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';
export type SurfaceType = 'bunker' | 'artillery' | 'machinegun' | 'observation';
export type BuildingType = UndergroundType | SurfaceType;

export const BUILDING_COLORS: Record<BuildingType, number> = {
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
  observation: 0xA0522D  // Saddle Brown
};

export const isSurfaceDefense = (type: BuildingType): type is SurfaceType => {
  return ['bunker', 'artillery', 'machinegun', 'observation'].includes(type);
};

export interface GridCell {
  x: number;
  y: number;
  underground: {
    type: UndergroundType;
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
  requiredUnderground: UndergroundType[];
  powerDraw: number;
  manpowerNeeded: number;
  ammunitionUsage: number;
}

export interface BuildingDefinition {
  type: UndergroundType;
  name: string;
  color: string;
  width: number;
  height: number;
  description: string;
}

export const BUILDINGS: Record<UndergroundType, BuildingDefinition> = {
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
import React from 'react';

type BuildingType = 'foundation' | 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';
type DefenseType = 'bunker' | 'artillery' | 'machinegun' | 'observation';

interface BuildingSelectorProps {
  onSelectBuilding: (type: BuildingType | DefenseType) => void;
  selectedBuilding: BuildingType | DefenseType;
}

const buildings: { type: BuildingType | DefenseType; name: string; color: string; category: 'underground' | 'defense' }[] = [
  // Underground buildings
  { type: 'foundation', name: 'Foundation', color: '#555555', category: 'underground' },
  { type: 'ammo', name: 'Ammo Storage', color: '#ff0000', category: 'underground' },
  { type: 'barracks', name: 'Barracks', color: '#00ff00', category: 'underground' },
  { type: 'command', name: 'Command Center', color: '#0000ff', category: 'underground' },
  { type: 'elevator', name: 'Elevator', color: '#ffff00', category: 'underground' },
  { type: 'tunnel', name: 'Tunnel', color: '#888888', category: 'underground' },
  // Surface defenses
  { type: 'bunker', name: 'Bunker', color: '#808080', category: 'defense' },
  { type: 'artillery', name: 'Artillery', color: '#8B4513', category: 'defense' },
  { type: 'machinegun', name: 'Machine Gun', color: '#696969', category: 'defense' },
  { type: 'observation', name: 'Observation Post', color: '#A0522D', category: 'defense' },
];

export const BuildingSelector: React.FC<BuildingSelectorProps> = ({
  onSelectBuilding,
  selectedBuilding,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 border-t-2 border-gray-700">
      <div className="max-w-4xl mx-auto">
        <div className="mb-2">
          <h3 className="text-white text-sm mb-1">Underground</h3>
          <div className="flex justify-center gap-4">
            {buildings
              .filter(b => b.category === 'underground')
              .map(({ type, name, color }) => (
                <button
                  key={type}
                  onClick={() => onSelectBuilding(type)}
                  className={`
                    flex flex-col items-center p-2 rounded
                    ${selectedBuilding === type ? 'ring-2 ring-white' : ''}
                    hover:bg-gray-700 transition-colors
                  `}
                >
                  <div
                    className="w-8 h-8 rounded border border-gray-600"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-white text-sm mt-1">{name}</span>
                </button>
              ))}
          </div>
        </div>
        <div>
          <h3 className="text-white text-sm mb-1">Surface Defenses</h3>
          <div className="flex justify-center gap-4">
            {buildings
              .filter(b => b.category === 'defense')
              .map(({ type, name, color }) => (
                <button
                  key={type}
                  onClick={() => onSelectBuilding(type)}
                  className={`
                    flex flex-col items-center p-2 rounded
                    ${selectedBuilding === type ? 'ring-2 ring-white' : ''}
                    hover:bg-gray-700 transition-colors
                  `}
                >
                  <div
                    className="w-8 h-8 rounded border border-gray-600"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-white text-sm mt-1">{name}</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 
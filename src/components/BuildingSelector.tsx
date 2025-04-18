import React from 'react';

type BuildingType = 'foundation' | 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';

interface BuildingSelectorProps {
  onSelectBuilding: (type: BuildingType) => void;
  selectedBuilding: BuildingType;
}

const buildings: { type: BuildingType; name: string; color: string }[] = [
  { type: 'foundation', name: 'Foundation', color: '#555555' },
  { type: 'ammo', name: 'Ammo Storage', color: '#ff0000' },
  { type: 'barracks', name: 'Barracks', color: '#00ff00' },
  { type: 'command', name: 'Command Center', color: '#0000ff' },
  { type: 'elevator', name: 'Elevator', color: '#ffff00' },
  { type: 'tunnel', name: 'Tunnel', color: '#888888' },
];

export const BuildingSelector: React.FC<BuildingSelectorProps> = ({
  onSelectBuilding,
  selectedBuilding,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 border-t-2 border-gray-700">
      <div className="max-w-4xl mx-auto flex justify-center gap-4">
        {buildings.map(({ type, name, color }) => (
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
  );
}; 
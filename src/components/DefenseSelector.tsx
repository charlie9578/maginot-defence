import React from 'react';
import { SurfaceType } from '../types/grid';

interface DefenseSelectorProps {
  onSelectDefense: (type: SurfaceType) => void;
  selectedDefense: SurfaceType;
}

const defenses: { type: SurfaceType; name: string; color: string }[] = [
  { type: 'bunker', name: 'Bunker', color: '#808080' },
  { type: 'artillery', name: 'Artillery', color: '#8B4513' },
  { type: 'machinegun', name: 'Machine Gun', color: '#696969' },
  { type: 'observation', name: 'Observation Post', color: '#A0522D' },
];

export const DefenseSelector: React.FC<DefenseSelectorProps> = ({
  onSelectDefense,
  selectedDefense,
}) => {
  return (
    <div className="fixed bottom-24 left-0 right-0 bg-gray-800 p-4 border-t-2 border-gray-700">
      <div className="max-w-4xl mx-auto flex justify-center gap-4">
        {defenses.map(({ type, name, color }) => (
          <button
            key={type}
            onClick={() => onSelectDefense(type)}
            className={`
              flex flex-col items-center p-2 rounded
              ${selectedDefense === type ? 'ring-2 ring-white' : ''}
              hover:bg-gray-700 transition-colors
              min-w-[80px]
            `}
          >
            <div
              className="w-8 h-8 rounded border border-gray-600"
              style={{ backgroundColor: color }}
            />
            <span className="text-white text-sm mt-1 whitespace-nowrap">{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}; 
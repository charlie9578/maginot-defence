import React, { useEffect, useState } from 'react';
import ResourcePanel from './ResourcePanel'; // Import the new ResourcePanel

type BuildingType = 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';
type DefenseType = 'bunker' | 'artillery' | 'machinegun' | 'observation';

interface BuildingSelectorProps {
  onSelectBuilding: (type: BuildingType | DefenseType) => void;
  selectedBuilding: BuildingType | DefenseType;
  onStartWave: () => void;
  isWaveActive: boolean;
  resources: {
    money: number;
    maxMoney: number;
    troops: number;
    maxTroops: number;
    ammo: number;
    maxAmmo: number;
  };
  killCount: number;
}

const buildings: { type: BuildingType | DefenseType; name: string; color: string; category: 'underground' | 'defense' }[] = [
  // Underground buildings
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
  onStartWave,
  isWaveActive,
  resources,
  killCount
}) => {
  const [currentResources, setCurrentResources] = useState(resources);
  const [currentKillCount, setCurrentKillCount] = useState(killCount);

  useEffect(() => {
    const interval = setInterval(() => {
      
      // Update currentResources with the latest resources
      setCurrentResources(prevResources => ({
        ...prevResources,
        // You can add logic here to modify specific resource values if needed
        money: resources.money,
        troops: resources.troops,
        ammo: resources.ammo,
        maxMoney: resources.maxMoney,
        maxTroops: resources.maxTroops,
        maxAmmo: resources.maxAmmo,
      }));

      setCurrentKillCount(killCount); // Directly set the killCount value

    }, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on unmount
    
  }, [resources, killCount]); // Add killCount to the dependency array



  console.log('Rendering BuildingSelector with props:', {
    selectedBuilding,
    resources: currentResources, // Use updated resources
    killCount: currentKillCount,
    isWaveActive
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 border-t-2 border-gray-700">
      <div className="max-w-4xl mx-auto">
        {/* Resource display moved to ResourcePanel */}
        <ResourcePanel resources={currentResources} killCount={currentKillCount} />

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onStartWave}
              disabled={isWaveActive}
              className={`px-4 py-2 rounded font-bold ${isWaveActive ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              {isWaveActive ? 'Wave Active' : 'Start Wave'}
            </button>
          </div>
        </div>
        
        {/* Building selector */}
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
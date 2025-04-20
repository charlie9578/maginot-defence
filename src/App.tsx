import React, { useEffect, useState } from 'react';
import Phaser from 'phaser';
import { UndergroundScene } from './scenes/UndergroundScene';
import { BuildingSelector } from './components/BuildingSelector';

// Update BuildingType to match what's expected by UndergroundScene
type BuildingType = 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';
type DefenseType = 'bunker' | 'artillery' | 'machinegun' | 'observation';
type BuildingTypeOrDefense = BuildingType | DefenseType;

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingTypeOrDefense>('tunnel');
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  const [resources, setResources] = useState({
    money: 0,
    maxMoney: 0,
    troops: 0,
    maxTroops: 0,
    ammo: 0,
    maxAmmo: 0
  });
  const [killCount, setKillCount] = useState(0);
  const [isWaveActive, setIsWaveActive] = useState(false);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-container',
      backgroundColor: '#1b1b1b',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight - 100,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0, x: 0 },
          debug: false
        }
      },
      scene: UndergroundScene
    };

    const game = new Phaser.Game(config);
    setGameInstance(game);

    return () => {
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (gameInstance) {
      const scene = gameInstance.scene.getScene('UndergroundScene') as UndergroundScene;
      if (scene) {
        scene.setSelectedBuilding(selectedBuilding);
        
        // Set up event listeners for resources and kill count updates
        scene.events.on('updateResources', (newResources: any) => {
          setResources(newResources);
        });
        
        scene.events.on('updateKillCount', (newKillCount: number) => {
          setKillCount(newKillCount);
        });
        
        scene.events.on('waveStateChanged', (active: boolean) => {
          setIsWaveActive(active);
        });
      }
    }
  }, [selectedBuilding, gameInstance]);

  const handleStartWave = () => {
    if (gameInstance) {
      const scene = gameInstance.scene.getScene('UndergroundScene') as UndergroundScene;
      if (scene) {
        scene.startWave();
      }
    }
  };

  return (
    <div className="w-full h-full relative">
      <div id="game-container" className="w-full h-full bg-gray-900" />
      <BuildingSelector
        selectedBuilding={selectedBuilding}
        onSelectBuilding={setSelectedBuilding}
        resources={resources}
        killCount={killCount}
        onStartWave={handleStartWave}
        isWaveActive={isWaveActive}
      />
    </div>
  );
}

export default App; 
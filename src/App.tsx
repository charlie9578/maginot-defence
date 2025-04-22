import React, { useEffect, useState } from 'react';
import Phaser from 'phaser';
import { UndergroundScene } from './scenes/UndergroundScene';
import { BuildingSelector } from './components/BuildingSelector';
import { Resources } from './managers/ResourceManager';

// Update BuildingType to match what's expected by UndergroundScene
type BuildingType = 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';
type DefenseType = 'bunker' | 'artillery' | 'machinegun' | 'observation';
type BuildingTypeOrDefense = BuildingType | DefenseType;

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingTypeOrDefense>('tunnel');
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  const [resources, setResources] = useState<Resources>({
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
        // Set the selected building in the scene
        scene.setSelectedBuilding(selectedBuilding);
      }
    }
  }, [selectedBuilding, gameInstance]);

  // Set up event listeners once when the game instance is created
  useEffect(() => {
    if (gameInstance) {
      const scene = gameInstance.scene.getScene('UndergroundScene') as UndergroundScene;
      if (scene) {
        // Ensure the scene is ready before setting up event listeners
        scene.events.once('ready', () => {
          const handleUpdateResources = (newResources: Resources) => {
            console.log('Resources updated:', newResources); // Debug log
            setResources({ ...newResources }); // This creates a new object reference
          };

          const handleUpdateKillCount = (newKillCount: number) => {
            console.log('Kill count updated:', newKillCount); // Debug log
            setKillCount(newKillCount);
          };

          const handleWaveStateChanged = (active: boolean) => {
            console.log('Wave state changed:', active); // Debug log
            setIsWaveActive(active);
          };

          // Set up event listeners
          scene.events.on('updateResources', handleUpdateResources);
          scene.events.on('updateKillCount', handleUpdateKillCount);
          scene.events.on('waveStateChanged', handleWaveStateChanged);

          // Clean up event listeners when component unmounts
          return () => {
            scene.events.off('updateResources', handleUpdateResources);
            scene.events.off('updateKillCount', handleUpdateKillCount);
            scene.events.off('waveStateChanged', handleWaveStateChanged);
          };
        });
      }
    }
  }, [gameInstance]);

  useEffect(() => {
    console.log('Resources prop changed:', resources);
  }, [resources]);

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
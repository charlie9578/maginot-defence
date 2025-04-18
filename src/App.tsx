import React, { useEffect, useState } from 'react';
import Phaser from 'phaser';
import { UndergroundScene } from './scenes/UndergroundScene';
import { BuildingSelector } from './components/BuildingSelector';

type BuildingType = 'foundation' | 'ammo' | 'barracks' | 'command' | 'elevator' | 'tunnel';

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType>('foundation');
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);

  useEffect(() => {
    const config = {
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
          gravity: { y: 0 },
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
      }
    }
  }, [selectedBuilding, gameInstance]);

  return (
    <div className="w-full h-full relative">
      <div id="game-container" className="w-full h-full bg-gray-900" />
      <BuildingSelector
        selectedBuilding={selectedBuilding}
        onSelectBuilding={setSelectedBuilding}
      />
    </div>
  );
}

export default App; 
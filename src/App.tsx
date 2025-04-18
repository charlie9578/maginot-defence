import React, { useEffect, useState } from 'react';
import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { UndergroundScene } from './scenes/UndergroundScene';
import { BuildingSelector } from './components/BuildingSelector';
import { CellType } from './types/grid';

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState<CellType>('foundation');
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);

  useEffect(() => {
    const config = {
      ...gameConfig,
      scene: [UndergroundScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-container',
        width: '100%',
        height: '100%',
      },
    };

    const game = new Phaser.Game(config);
    setGameInstance(game);

    // Get the scene and set up communication
    const scene = game.scene.getScene('UndergroundScene') as UndergroundScene;
    if (scene) {
      scene.events.on('ready', () => {
        scene.setSelectedBuilding(selectedBuilding);
      });
    }

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
      <div id="game-container" className="w-full" />
      <BuildingSelector
        selectedBuilding={selectedBuilding}
        onSelectBuilding={setSelectedBuilding}
      />
    </div>
  );
}

export default App; 
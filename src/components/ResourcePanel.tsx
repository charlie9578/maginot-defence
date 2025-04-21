import React from 'react';

interface ResourcePanelProps {
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

const ResourcePanel: React.FC<ResourcePanelProps> = ({ resources, killCount }) => {
  return (
    <div className="text-white text-sm bg-black bg-opacity-50 p-2 rounded">
      <div>Money: ${resources.money}/{resources.maxMoney}</div>
      <div>Troops: {resources.troops}/{resources.maxTroops}</div>
      <div>Ammo: {resources.ammo}/{resources.maxAmmo}</div>
      <div>Kills: {killCount}</div>
    </div>
  );
};

export default ResourcePanel;
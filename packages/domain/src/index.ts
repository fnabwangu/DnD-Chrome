export interface Character {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  alive: boolean;
  faction?: string;
}

export interface Faction {
  id: string;
  name: string;
  reputation: number;
}

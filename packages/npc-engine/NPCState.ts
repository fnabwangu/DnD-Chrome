export interface NPCState {
  id: string;
  identity: {
    name: string;
    factionIds: string[];
  };
  physical: {
    locationId: string;
    hp: number;
    conditions: string[];
  };
}

export interface ActionCardProps {
  id: string;
  name: string;
  description: string;
  cost?: number;
  type: "action" | "spell" | "item";
}

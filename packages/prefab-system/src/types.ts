import type { Entity, GeometryNode, Material } from "@ggez/shared";

export type PrefabDefinition = {
  createdAt: string;
  description: string;
  entities: Entity[];
  id: string;
  materials: Material[];
  name: string;
  nodes: GeometryNode[];
  rootNodeIds: string[];
};

export type PrefabSnapshot = {
  entities: Entity[];
  materials: Material[];
  nodes: GeometryNode[];
  rootNodeIds: string[];
};

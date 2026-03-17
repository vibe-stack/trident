import { useMemo, useState } from "react";
import type { Entity, GeometryNode } from "@web-hammer/shared";
import { resolveSceneGraph } from "@web-hammer/shared";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SceneHierarchyPanelProps = {
  entities: Entity[];
  interactive?: boolean;
  nodes: GeometryNode[];
  onFocusNode: (nodeId: string) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  selectedNodeIds: string[];
};

export function SceneHierarchyPanel({
  entities,
  interactive = true,
  nodes,
  onFocusNode,
  onSelectNodes,
  selectedNodeIds
}: SceneHierarchyPanelProps) {
  const [query, setQuery] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sceneGraph = resolveSceneGraph(nodes, entities);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const parentById = new Map<string, string | undefined>();
    const flatItems: Array<{ depth: number; id: string; kind: string; name: string }> = [];
    const matchedIds = new Set<string>();

    nodes.forEach((node) => {
      parentById.set(node.id, node.parentId);
    });
    entities.forEach((entity) => {
      parentById.set(entity.id, entity.parentId);
    });

    if (normalizedQuery) {
      nodes.forEach((node) => {
        if (node.name.toLowerCase().includes(normalizedQuery)) {
          matchedIds.add(node.id);
        }
      });
      entities.forEach((entity) => {
        if (entity.name.toLowerCase().includes(normalizedQuery)) {
          matchedIds.add(entity.id);
        }
      });

      Array.from(matchedIds).forEach((id) => {
        let currentParentId = parentById.get(id);

        while (currentParentId) {
          matchedIds.add(currentParentId);
          currentParentId = parentById.get(currentParentId);
        }
      });
    }

    const appendBranch = (nodeId: string, depth: number) => {
      const node = nodeById.get(nodeId);

      if (!node) {
        return;
      }

      if (!normalizedQuery || matchedIds.has(nodeId)) {
        flatItems.push({
          depth,
          id: node.id,
          kind: node.kind,
          name: node.name
        });
      }

      sceneGraph.nodeChildrenByParentId.get(nodeId)?.forEach((childNodeId) => {
        appendBranch(childNodeId, depth + 1);
      });
      sceneGraph.entityChildrenByParentId.get(nodeId)?.forEach((entityId) => {
        const entity = entityById.get(entityId);

        if (!entity || (normalizedQuery && !matchedIds.has(entity.id))) {
          return;
        }

        flatItems.push({
          depth: depth + 1,
          id: entity.id,
          kind: entity.type,
          name: entity.name
        });
      });
    };

    sceneGraph.rootNodeIds.forEach((nodeId) => {
      appendBranch(nodeId, 0);
    });
    sceneGraph.rootEntityIds.forEach((entityId) => {
      const entity = entityById.get(entityId);

      if (!entity || (normalizedQuery && !matchedIds.has(entity.id))) {
        return;
      }

      flatItems.push({
        depth: 0,
        id: entity.id,
        kind: entity.type,
        name: entity.name
      });
    });

    return flatItems;
  }, [entities, nodes, query]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="space-y-2 px-1 pt-1">
        <div className="text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">Scene</div>
        <Input
          className="h-9 rounded-xl border-white/8 bg-white/5 text-xs"
          disabled={!interactive}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search scene objects"
          value={query}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-1">
        <div className="space-y-0.5 px-1 pb-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <button
                className={cn(
                  "block w-full rounded-xl px-2.5 py-2 text-left text-[12px] font-medium text-foreground/62 transition-colors hover:bg-white/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-45",
                  selectedIdSet.has(item.id) && "bg-emerald-500/14 text-emerald-200"
                )}
                disabled={!interactive}
                key={item.id}
                onClick={(event) => {
                  if (event.shiftKey) {
                    onSelectNodes(
                      selectedIdSet.has(item.id)
                        ? selectedNodeIds.filter((selectedId) => selectedId !== item.id)
                        : [...selectedNodeIds, item.id]
                    );
                    return;
                  }

                  onSelectNodes([item.id]);
                }}
                onDoubleClick={() => onFocusNode(item.id)}
                style={{ paddingLeft: `${item.depth * 14 + 10}px` }}
                type="button"
              >
                <span className="block truncate">{item.name}</span>
                <span className="block text-[10px] text-foreground/35">{item.kind}</span>
              </button>
            ))
          ) : (
            <div className="px-2.5 py-3 text-xs text-foreground/45">No scene objects match the current search.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

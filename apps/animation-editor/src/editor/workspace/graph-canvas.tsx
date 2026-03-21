import {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  MarkerType,
  type Node as FlowNode,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { EditorGraphNode } from "@ggez/anim-schema";
import { Boxes, Film, Layers3, SlidersHorizontal, Workflow } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const NODE_ACTIONS = [
  { kind: "clip", label: "Clip Node", icon: Film },
  { kind: "blend1d", label: "Blend 1D", icon: SlidersHorizontal },
  { kind: "blend2d", label: "Blend 2D", icon: Boxes },
  { kind: "stateMachine", label: "State Machine", icon: Workflow },
  { kind: "subgraph", label: "Subgraph", icon: Layers3 },
] as const;

type NodeActionKind = (typeof NODE_ACTIONS)[number]["kind"];

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areCanvasNodesEqual(left: FlowNode[], right: FlowNode[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((node, index) => {
    const candidate = right[index];
    return (
      candidate &&
      node.id === candidate.id &&
      node.selected === candidate.selected &&
      node.className === candidate.className &&
      (node.data as { kind?: string; name?: string }).kind === (candidate.data as { kind?: string; name?: string }).kind &&
      (node.data as { kind?: string; name?: string }).name === (candidate.data as { kind?: string; name?: string }).name &&
      node.position.x === candidate.position.x &&
      node.position.y === candidate.position.y
    );
  });
}

function areCanvasEdgesEqual(left: Edge[], right: Edge[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((edge, index) => {
    const candidate = right[index];
    return (
      candidate &&
      edge.id === candidate.id &&
      edge.source === candidate.source &&
      edge.target === candidate.target &&
      edge.label === candidate.label &&
      edge.className === candidate.className
    );
  });
}

function toCanvasNode(node: EditorGraphNode, selected = false) {
  return {
    id: node.id,
    position: node.position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected,
    className: cn("animation-flow__node", selected && "selected"),
    data: {
      kind: node.kind,
      name: node.name,
      label: (
        <div className="pointer-events-none flex flex-col gap-1">
          <span className="text-[10px] font-medium text-emerald-300/70">{node.kind}</span>
          <span className="text-sm font-medium text-zinc-100">{node.name}</span>
        </div>
      ),
    },
  };
}

type CanvasNode = ReturnType<typeof toCanvasNode>;

function buildCanvasEdges(
  nodes: EditorGraphNode[],
  graphEdges: { id: string; sourceNodeId: string; targetNodeId: string }[],
  selectedEdgeIds: string[]
) {
  const edges: Edge[] = [...graphEdges.map((edge) => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId }))];

  nodes.forEach((node) => {
    if (node.kind === "blend1d") {
      node.children.forEach((child) => {
        edges.push({
          id: `${child.nodeId}->${node.id}`,
          source: child.nodeId,
          target: node.id,
          label: child.threshold.toString(),
        });
      });
    }

    if (node.kind === "blend2d") {
      node.children.forEach((child) => {
        edges.push({
          id: `${child.nodeId}->${node.id}`,
          source: child.nodeId,
          target: node.id,
          label: `${child.x}, ${child.y}`,
        });
      });
    }
  });

  const deduped = new Map<string, Edge>();
  edges.forEach((edge) => {
    deduped.set(edge.id, {
      ...edge,
      type: "smoothstep",
      className: cn("animation-flow__edge", selectedEdgeIds.includes(edge.id) && "selected"),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: "#71717a",
      },
    });
  });

  return Array.from(deduped.values());
}

export function GraphCanvas(props: {
  graph: { id: string; name: string; nodes: EditorGraphNode[]; edges: { id: string; sourceNodeId: string; targetNodeId: string }[] };
  selectedNodeIds: string[];
  onConnect: (connection: Connection) => void;
  onSelectionChange: (nodeIds: string[]) => void;
  onNodeDragStop: (nodeId: string, position: { x: number; y: number }) => void;
  onAddNode: (kind: NodeActionKind, position: { x: number; y: number }) => void;
  onDeleteNodes: () => void;
  onDeleteEdges: (edgeIds: string[]) => void;
}) {
  const lastSelectedNodeIdsRef = useRef(props.selectedNodeIds);
  const lastSelectedEdgeIdsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const commandRef = useRef<HTMLDivElement | null>(null);
  const previousGraphIdRef = useRef(props.graph.id);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const [menuState, setMenuState] = useState<{ x: number; y: number; flowPosition: { x: number; y: number } } | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  const computedNodes = useMemo<CanvasNode[]>(
    () => props.graph.nodes.map((node) => toCanvasNode(node, props.selectedNodeIds.includes(node.id))),
    [props.graph.nodes, props.selectedNodeIds]
  );

  const computedEdges = useMemo(
    () => buildCanvasEdges(props.graph.nodes, props.graph.edges, selectedEdgeIds),
    [props.graph.edges, props.graph.nodes, selectedEdgeIds]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes((current) => (areCanvasNodesEqual(current, computedNodes) ? current : computedNodes));
  }, [computedNodes, setNodes]);

  useEffect(() => {
    setEdges((current) => (areCanvasEdgesEqual(current, computedEdges) ? current : computedEdges));
  }, [computedEdges, setEdges]);

  useEffect(() => {
    lastSelectedNodeIdsRef.current = props.selectedNodeIds;
  }, [props.selectedNodeIds]);

  useEffect(() => {
    lastSelectedEdgeIdsRef.current = selectedEdgeIds;
  }, [selectedEdgeIds]);

  useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }

    if (previousGraphIdRef.current !== props.graph.id) {
      previousGraphIdRef.current = props.graph.id;
      if (lastSelectedEdgeIdsRef.current.length > 0) {
        lastSelectedEdgeIdsRef.current = [];
        setSelectedEdgeIds([]);
      }
      window.requestAnimationFrame(() => {
        reactFlowInstance.fitView({ padding: 0.18, duration: 180 });
      });
    }
  }, [props.graph.id, reactFlowInstance]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (isTypingTarget || (event.key !== "Backspace" && event.key !== "Delete")) {
        return;
      }

      if (selectedEdgeIds.length === 0 && props.selectedNodeIds.length === 0) {
        return;
      }

      event.preventDefault();

      if (selectedEdgeIds.length > 0) {
        props.onDeleteEdges(selectedEdgeIds);
        lastSelectedEdgeIdsRef.current = [];
        setSelectedEdgeIds([]);
        return;
      }

      props.onDeleteNodes();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [props, selectedEdgeIds]);

  useEffect(() => {
    if (!menuState) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (commandRef.current?.contains(event.target as Node)) {
        return;
      }

      setMenuState(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuState(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuState]);

  function handleOpenContextMenu(event: MouseEvent | ReactMouseEvent) {
    event.preventDefault();

    if (!containerRef.current || !reactFlowInstance) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 12), Math.max(rect.width - 304, 12));
    const y = Math.min(Math.max(event.clientY - rect.top, 12), Math.max(rect.height - 280, 12));

    setMenuState({
      x,
      y,
      flowPosition: reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    });
  }

  function handleCreateNode(kind: NodeActionKind) {
    if (!menuState) {
      return;
    }

    props.onAddNode(kind, menuState.flowPosition);
    setMenuState(null);
  }

  const handleEdgeClick: EdgeMouseHandler = (_, edge) => {
    if (!areStringArraysEqual(lastSelectedEdgeIdsRef.current, [edge.id])) {
      lastSelectedEdgeIdsRef.current = [edge.id];
      setSelectedEdgeIds([edge.id]);
    }
    if (lastSelectedNodeIdsRef.current.length > 0) {
      lastSelectedNodeIdsRef.current = [];
      setNodes((current) => current.map((node) => ({ ...node, selected: false })));
      props.onSelectionChange([]);
    }
  };

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 flex-col bg-[#0d1012]" onContextMenu={handleOpenContextMenu}>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            className="animation-flow"
            colorMode="dark"
            onInit={setReactFlowInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: "#71717a",
              },
            }}
            onNodeClick={(_, node) => {
              if (lastSelectedEdgeIdsRef.current.length > 0) {
                lastSelectedEdgeIdsRef.current = [];
                setSelectedEdgeIds([]);
              }
              setNodes((current) =>
                current.map((entry) => ({
                  ...entry,
                  selected: entry.id === node.id,
                }))
              );
              if (!areStringArraysEqual(lastSelectedNodeIdsRef.current, [node.id])) {
                lastSelectedNodeIdsRef.current = [node.id];
                props.onSelectionChange([node.id]);
              }
            }}
            onEdgeClick={handleEdgeClick}
            onNodeDragStop={(_, draggedNode) => {
              props.onNodeDragStop(draggedNode.id, draggedNode.position);
            }}
            onPaneClick={() => {
              setMenuState(null);
              if (lastSelectedEdgeIdsRef.current.length > 0) {
                lastSelectedEdgeIdsRef.current = [];
                setSelectedEdgeIds([]);
              }
              setNodes((current) => current.map((node) => ({ ...node, selected: false })));
              if (lastSelectedNodeIdsRef.current.length > 0) {
                lastSelectedNodeIdsRef.current = [];
                props.onSelectionChange([]);
              }
            }}
            onPaneContextMenu={handleOpenContextMenu}
            onConnect={props.onConnect}
          >
            <MiniMap pannable zoomable nodeColor="#34d399" maskColor="rgba(9, 10, 12, 0.82)" className="animation-flow__minimap" />
            <Controls className="animation-flow__controls" />
            <Background color="rgba(91, 110, 101, 0.24)" gap={22} size={1} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {menuState ? (
        <div
          ref={commandRef}
          className="absolute z-30 w-72 overflow-hidden rounded-[22px] bg-[#0b1113]/96 shadow-[0_22px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/8 backdrop-blur-xl"
          style={{ left: menuState.x, top: menuState.y }}
        >
          <Command className="rounded-[22px] bg-transparent p-2">
            <CommandInput autoFocus placeholder="Add node..." />
            <CommandList className="max-h-64 px-1 pb-1">
              <CommandEmpty className="px-3 py-6 text-[12px] text-zinc-500">No node matches that search.</CommandEmpty>
              {NODE_ACTIONS.map((action) => {
                const Icon = action.icon;

                return (
                  <CommandItem key={action.kind} value={`${action.label} ${action.kind}`} onSelect={() => handleCreateNode(action.kind)}>
                    <Icon className="size-4 text-emerald-300/80" />
                    <span>{action.label}</span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  );
}

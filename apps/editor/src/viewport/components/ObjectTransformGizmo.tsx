import { Billboard, TransformControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Entity, GeometryNode, Transform } from "@web-hammer/shared";
import { isInstancingNode, localizeTransform, resolveTransformPivot, toTuple, vec3, type Vec3 } from "@web-hammer/shared";
import { objectToTransform, rebaseTransformPivot, worldPointToNodeLocal } from "@/viewport/utils/geometry";
import { resolveViewportSnapSize } from "@/viewport/utils/snap";
import type { ViewportCanvasProps } from "@/viewport/types";
import { Group as ThreeGroup, Vector3 } from "three";

const tempCameraPosition = new Vector3();
const tempPivotWorldPosition = new Vector3();
const tempPivotCameraDirection = new Vector3();

export function ObjectTransformGizmo({
  activeToolId,
  onPreviewEntityTransform,
  onPreviewNodeTransform,
  onUpdateEntityTransform,
  onUpdateNodeTransform,
  selectedEntity,
  selectedEntityWorldTransform,
  selectedNode,
  selectedNodeWorldTransform,
  selectedNodeIds,
  selectedNodes,
  selectedWorldNodes,
  transformMode,
  viewport
}: Pick<
  ViewportCanvasProps,
  | "activeToolId"
  | "onPreviewEntityTransform"
  | "onPreviewNodeTransform"
  | "onUpdateEntityTransform"
  | "onUpdateNodeTransform"
  | "selectedEntity"
  | "selectedNodeIds"
  | "selectedNodes"
  | "transformMode"
  | "viewport"
> & {
  selectedEntityWorldTransform?: Transform;
  selectedNode?: GeometryNode;
  selectedNodeWorldTransform?: Transform;
  selectedWorldNodes: GeometryNode[];
}) {
  const baselineTransformRef = useRef<Transform | undefined>(undefined);
  const pivotTargetRef = useRef<ThreeGroup | null>(null);
  const scene = useThree((state) => state.scene);
  const [activePivotNodeId, setActivePivotNodeId] = useState<string>();
  const selectedTarget: GeometryNode | Entity | undefined = selectedNode ?? selectedEntity;
  const selectedTargetWorldTransform = selectedNode
    ? selectedNodeWorldTransform ?? selectedNode.transform
    : selectedEntity
      ? selectedEntityWorldTransform ?? selectedEntity.transform
      : undefined;
  const selectedObjectId = selectedTarget?.id ?? selectedNodeIds[0];
  const selectedObject = selectedObjectId
    ? scene.getObjectByName(selectedNode ? `node:${selectedObjectId}` : `entity:${selectedObjectId}`)
    : undefined;
  const snapSize = resolveViewportSnapSize(viewport);
  const activePivotNode = activePivotNodeId ? selectedNodes.find((node) => node.id === activePivotNodeId) : undefined;
  const activePivotWorldNode = activePivotNodeId ? selectedWorldNodes.find((node) => node.id === activePivotNodeId) : undefined;
  const pivotEditingEnabled = (activeToolId === "transform" || activeToolId === "mesh-edit") && (!selectedNode || !isInstancingNode(selectedNode));

  useEffect(() => {
    if (!pivotEditingEnabled) {
      setActivePivotNodeId(undefined);
      baselineTransformRef.current = undefined;
    }
  }, [pivotEditingEnabled]);

  useEffect(() => {
    if (activePivotNodeId && !selectedNodes.some((node) => node.id === activePivotNodeId)) {
      setActivePivotNodeId(undefined);
      baselineTransformRef.current = undefined;
    }
  }, [activePivotNodeId, selectedNodes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (!pivotEditingEnabled || !selectedNode) {
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;

      if (modifier || !event.shiftKey || event.key.toLowerCase() !== "p") {
        return;
      }

      event.preventDefault();
      setActivePivotNodeId(selectedNode.id);
      baselineTransformRef.current = undefined;
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pivotEditingEnabled, selectedNode]);

  if (!pivotEditingEnabled) {
    return null;
  }

  const pivot = selectedTarget ? resolveTransformPivot(selectedTarget.transform) : vec3(0, 0, 0);
  const showObjectTransformGizmo =
    activeToolId === "transform" && !activePivotNode && Boolean(selectedObjectId && selectedObject && selectedTarget);

  return (
    <>
      {selectedNodes.map((node) =>
        node.id === activePivotNodeId ? null : (
          <PivotHandleMarker
            key={node.id}
            onSelect={() => {
              setActivePivotNodeId(node.id);
            }}
            position={(selectedWorldNodes.find((candidate) => candidate.id === node.id) ?? node).transform.position}
            selected={false}
          />
        )
      )}

      {activePivotWorldNode ? (
        <group ref={pivotTargetRef} position={toTuple(activePivotWorldNode.transform.position)}>
          <PivotHandleMarker
            onSelect={() => {
              setActivePivotNodeId(activePivotWorldNode.id);
            }}
            position={vec3(0, 0, 0)}
            selected
          />
        </group>
      ) : null}

      {activePivotNode && activePivotWorldNode && pivotTargetRef.current ? (
        <TransformControls
          enabled
          mode="translate"
          object={pivotTargetRef.current}
          onMouseDown={() => {
            baselineTransformRef.current = structuredClone(activePivotNode.transform);
          }}
          onMouseUp={() => {
            if (!baselineTransformRef.current || !pivotTargetRef.current) {
              return;
            }

            const worldPosition = pivotTargetRef.current.getWorldPosition(new Vector3());
            const nextPivot = worldPointToNodeLocal(
              vec3(worldPosition.x, worldPosition.y, worldPosition.z),
              activePivotWorldNode.transform
            );

            onUpdateNodeTransform(
              activePivotNode.id,
              rebaseTransformPivot(baselineTransformRef.current, nextPivot),
              baselineTransformRef.current
            );
            baselineTransformRef.current = undefined;
          }}
          onObjectChange={() => {
            if (!baselineTransformRef.current || !pivotTargetRef.current) {
              return;
            }

            const worldPosition = pivotTargetRef.current.getWorldPosition(new Vector3());
            const nextPivot = worldPointToNodeLocal(
              vec3(worldPosition.x, worldPosition.y, worldPosition.z),
              activePivotWorldNode.transform
            );

            onPreviewNodeTransform(activePivotNode.id, rebaseTransformPivot(baselineTransformRef.current, nextPivot));
          }}
          showX
          showY
          showZ
          translationSnap={snapSize}
        />
      ) : null}

      {showObjectTransformGizmo && selectedObjectId && selectedObject && selectedTarget && selectedTargetWorldTransform ? (
        <TransformControls
          enabled
          mode={transformMode}
          object={selectedObject}
          onMouseDown={() => {
            baselineTransformRef.current = structuredClone(selectedTarget.transform);
          }}
          onMouseUp={() => {
            if (!baselineTransformRef.current) {
              return;
            }

            const nextWorldTransform = objectToTransform(selectedObject, pivot);
            const parentWorldTransform = selectedTarget.parentId
              ? selectedWorldNodes.find((node) => node.id === selectedTarget.parentId)?.transform
              : undefined;
            const nextTransform = localizeTransform(nextWorldTransform, parentWorldTransform);

            if (selectedNode) {
              onUpdateNodeTransform(selectedObjectId, nextTransform, baselineTransformRef.current);
            } else if (selectedEntity) {
              onUpdateEntityTransform(selectedObjectId, nextTransform, baselineTransformRef.current);
            }

            baselineTransformRef.current = undefined;
          }}
          onObjectChange={() => {
            const nextWorldTransform = objectToTransform(selectedObject, pivot);
            const parentWorldTransform = selectedTarget.parentId
              ? selectedWorldNodes.find((node) => node.id === selectedTarget.parentId)?.transform
              : undefined;
            const nextTransform = localizeTransform(nextWorldTransform, parentWorldTransform);

            if (selectedNode) {
              onPreviewNodeTransform(selectedObjectId, nextTransform);
            } else if (selectedEntity) {
              onPreviewEntityTransform(selectedObjectId, nextTransform);
            }
          }}
          rotationSnap={Math.PI / 12}
          scaleSnap={Math.max(snapSize / 16, 0.125)}
          showX
          showY
          showZ
          translationSnap={snapSize}
        />
      ) : null}
    </>
  );
}

function PivotHandleMarker({
  onSelect,
  position,
  selected
}: {
  onSelect: () => void;
  position: Vec3;
  selected: boolean;
}) {
  const markerRootRef = useRef<ThreeGroup | null>(null);
  const billboardRef = useRef<ThreeGroup | null>(null);
  const handleRef = useRef<ThreeGroup | null>(null);
  const outerSize: [number, number] = selected ? [18, 18] : [14, 14];
  const innerSize: [number, number] = selected ? [11, 11] : [8.5, 8.5];

  useFrame(({ camera, size }) => {
    const markerRoot = markerRootRef.current;
    const billboard = billboardRef.current;
    const handle = handleRef.current;

    if (!markerRoot || !billboard || !handle || size.height <= 0) {
      return;
    }

    markerRoot.parent?.getWorldPosition(tempPivotWorldPosition);
    const worldUnitsPerPixel = resolveWorldUnitsPerPixel(camera, tempPivotWorldPosition, size.height);
    const handleOffset = selected ? 0 : worldUnitsPerPixel * 22;
    const forwardOffset = worldUnitsPerPixel * (selected ? 10 : 14);

    camera.getWorldPosition(tempCameraPosition);
    tempPivotCameraDirection
      .subVectors(tempCameraPosition, tempPivotWorldPosition)
      .normalize()
      .multiplyScalar(forwardOffset);

    if (
      Math.abs(markerRoot.position.x - tempPivotCameraDirection.x) > 0.000001 ||
      Math.abs(markerRoot.position.y - tempPivotCameraDirection.y) > 0.000001 ||
      Math.abs(markerRoot.position.z - tempPivotCameraDirection.z) > 0.000001
    ) {
      markerRoot.position.copy(tempPivotCameraDirection);
    }

    if (Math.abs(billboard.scale.x - worldUnitsPerPixel) > 0.000001) {
      billboard.scale.setScalar(worldUnitsPerPixel);
    }

    if (
      Math.abs(handle.position.x - handleOffset) > 0.000001 ||
      Math.abs(handle.position.y - handleOffset) > 0.000001
    ) {
      handle.position.set(handleOffset, handleOffset, 0);
    }
  });

  return (
    <group position={toTuple(position)}>
      <group ref={markerRootRef}>
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          renderOrder={13}
        >
          <sphereGeometry args={[selected ? 0.12 : 0.09, 18, 18]} />
          <meshBasicMaterial
            color={selected ? "#a855f7" : "#9333ea"}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
            transparent
          />
        </mesh>

        <Billboard ref={billboardRef}>
          <group
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            ref={handleRef}
            renderOrder={14}
          >
            <mesh rotation={[0, 0, Math.PI / 4]} renderOrder={14}>
              <planeGeometry args={outerSize} />
              <meshBasicMaterial
                color={selected ? "#f5d0fe" : "#d8b4fe"}
                depthTest={false}
                depthWrite={false}
                opacity={selected ? 1 : 0.94}
                toneMapped={false}
                transparent
              />
            </mesh>
            <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI / 4]} renderOrder={15}>
              <planeGeometry args={innerSize} />
              <meshBasicMaterial
                color={selected ? "#a855f7" : "#9333ea"}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
                transparent
              />
            </mesh>
          </group>
        </Billboard>
      </group>
    </group>
  );
}

function resolveWorldUnitsPerPixel(camera: any, worldPosition: Vector3, viewportHeight: number) {
  if (viewportHeight <= 0) {
    return 1;
  }

  if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
    camera.getWorldPosition(tempCameraPosition);
    const distance = tempCameraPosition.distanceTo(worldPosition);
    const verticalFov = (camera.fov * Math.PI) / 180;

    return (2 * distance * Math.tan(verticalFov / 2)) / viewportHeight;
  }

  if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
    return (camera.top - camera.bottom) / camera.zoom / viewportHeight;
  }

  return 1;
}

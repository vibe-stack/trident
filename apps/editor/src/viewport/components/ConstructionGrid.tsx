import { snapVec3, toTuple, vec3 } from "@web-hammer/shared";
import { useMemo } from "react";
import type { ViewportCanvasProps } from "@/viewport/types";
import { createIndexedGeometry } from "@/viewport/utils/geometry";
import { resolveViewportSnapSize } from "@/viewport/utils/snap";

export function ConstructionGrid({
  activeToolId,
  onPlaceAsset,
  viewport
}: Pick<ViewportCanvasProps, "activeToolId" | "onPlaceAsset" | "viewport">) {
  if (!viewport.grid.visible) {
    return null;
  }

  const snapSize = resolveViewportSnapSize(viewport);
  const minorStep = viewport.grid.snapSize;
  const majorStep = minorStep * viewport.grid.majorLineEvery;
  const extent = viewport.grid.size;

  return (
    <group position={[0, viewport.grid.elevation, 0]}>
      <mesh
        onClick={(event) => {
          if (activeToolId !== "asset-place") {
            return;
          }

          event.stopPropagation();
          const snapped = snapVec3(
            vec3(event.point.x, viewport.grid.elevation, event.point.z),
            snapSize
          );
          onPlaceAsset(snapped);
        }}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
      >
        <planeGeometry args={[extent, extent]} />
        <meshBasicMaterial color="#0a0f13" transparent opacity={0.78} />
      </mesh>
      <GridLines color="#3c4652" opacity={0.72} size={extent} step={minorStep} y={0.002} />
      <GridLines color="#7f8b99" opacity={0.86} size={extent} step={majorStep} y={0.006} />
    </group>
  );
}

function GridLines({
  color,
  opacity,
  size,
  step,
  y
}: {
  color: string;
  opacity: number;
  size: number;
  step: number;
  y: number;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const halfSize = size / 2;
    const safeStep = Math.max(step, 1);

    for (let offset = -halfSize; offset <= halfSize + 0.0001; offset += safeStep) {
      positions.push(-halfSize, y, offset, halfSize, y, offset);
      positions.push(offset, y, -halfSize, offset, y, halfSize);
    }

    return createIndexedGeometry(positions);
  }, [size, step, y]);

  return (
    <lineSegments frustumCulled={false} geometry={geometry} renderOrder={1}>
      <lineBasicMaterial color={color} depthWrite={false} opacity={opacity} toneMapped={false} transparent />
    </lineSegments>
  );
}

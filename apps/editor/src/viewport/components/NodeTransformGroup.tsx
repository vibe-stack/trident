import { resolveTransformPivot, toTuple, type Transform } from "@ggez/shared";
import type { ReactNode } from "react";

export function NodeTransformGroup({
  children,
  name,
  transform
}: {
  children: ReactNode;
  name?: string;
  transform: Transform;
}) {
  const pivot = resolveTransformPivot(transform);

  return (
    <group name={name} position={toTuple(transform.position)} rotation={toTuple(transform.rotation)} scale={toTuple(transform.scale)}>
      <group position={[-pivot.x, -pivot.y, -pivot.z]}>
        {children}
      </group>
    </group>
  );
}

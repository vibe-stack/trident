import type { SVGProps } from "react";
import {
  Box,
  Grid3X3,
  MousePointer2,
  Move3d,
  Package,
  Scissors
} from "lucide-react";
import type { ToolId } from "@web-hammer/tool-system";

export function TridentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M7 4v5.5M12 4v13M17 4v5.5M7 4l-2 2.5M7 4l2 2.5M17 4l-2 2.5M17 4l2 2.5M12 17.5l-2 2.5M12 17.5l2 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ExtrudeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M5.5 7.5 12 4l6.5 3.5L12 11 5.5 7.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M12 11v8.5M9 16l3 3 3-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function toolIconFor(toolId: ToolId) {
  switch (toolId) {
    case "select":
      return MousePointer2;
    case "transform":
      return Move3d;
    case "clip":
      return Scissors;
    case "extrude":
      return ExtrudeIcon;
    case "mesh-edit":
      return Box;
    case "asset-place":
      return Package;
    default:
      return MousePointer2;
  }
}

export { Grid3X3 };

import type { SVGProps } from "react";
import {
  Grid3X3,
  MousePointer2,
  Move3d,
  RotateCw,
  Scaling,
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

export function BrushCreateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7 7h10v10H7z" opacity="0.28" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function MeshEditToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 8.5 12 5l5 3.5v7L12 19l-5-3.5v-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M7 8.5 12 12m5-3.5L12 12m0 0v7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <circle cx="7" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="17" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function AssetPlaceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M6 8.5 12 5l6 3.5v7L12 19l-6-3.5v-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M12 4v8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="m9.5 9.5 2.5 2.5 2.5-2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export function VertexModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <circle cx="7" cy="7" r="2" fill="currentColor" />
      <circle cx="17" cy="8.5" r="2" fill="currentColor" />
      <circle cx="12" cy="17" r="2" fill="currentColor" />
      <path d="M8.8 8.1 15 9.2m-6.2.8 2.1 5.2m5.1-4.3-2.6 4" opacity="0.34" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function EdgeModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M6 16 18 8" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      <circle cx="6" cy="16" r="2" fill="currentColor" />
      <circle cx="18" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

export function FaceModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 7.5 17.5 9.2 14.7 17.2 6.2 15.4Z" fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export function InflateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m12 4 2 2m-2-2-2 2m8 6 2 2m-2-2-2 2m-6 4-2 2m2-2 2 2M4 12l2-2m-2 2 2 2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

export function DeflateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M8 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m8 8-2-2m2 2V6m8 2 2-2m-2 2V6m-8 8-2 2m2-2v2m8-2 2 2m-2-2v2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

export function RaiseTopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 14h10v5H7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M12 5v8m0-8-3 3m3-3 3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function LowerTopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 5h10v5H7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M12 19v-8m0 8-3-3m3 3 3-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function FlipNormalsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 8.5 17 6l-2.7 10L5 18.5 7 8.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M10 12h7m0 0-2.2-2.2M17 12l-2.2 2.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function BevelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M6 16 11 8h7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M6 16h10l2-2" opacity="0.34" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

export function ArcEdgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M6 16c2.2-5.2 9.8-5.2 12 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M6 16h12" opacity="0.28" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <circle cx="6" cy="16" r="1.7" fill="currentColor" />
      <circle cx="18" cy="16" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function MergeFacesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M5.5 8.5 10.5 6l4.5 2.5-5 2.5-4.5-2.5ZM14 10.5l4.5-2.3 0 7-4.5 2.3v-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M10 11h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function FillFaceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 8.5 17 7l-2.5 9L6 17.5Z" fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M9 12h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

export function CutMeshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7.5 14.8 9-5.6M9 7l6 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function SubdivideIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M6 7h12v10H6z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v10M6 12h12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function DeleteFacesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M7 8h10l-1 10H8L7 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M9 8V6h6v2M10 11v4M14 11v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

export function TranslateModeIcon(props: SVGProps<SVGSVGElement>) {
  return <Move3d {...props} />;
}

export function RotateModeIcon(props: SVGProps<SVGSVGElement>) {
  return <RotateCw {...props} />;
}

export function ScaleModeIcon(props: SVGProps<SVGSVGElement>) {
  return <Scaling {...props} />;
}

export function toolIconFor(toolId: ToolId) {
  switch (toolId) {
    case "select":
      return MousePointer2;
    case "transform":
      return Move3d;
    case "brush":
      return BrushCreateIcon;
    case "clip":
      return Scissors;
    case "extrude":
      return ExtrudeIcon;
    case "mesh-edit":
      return MeshEditToolIcon;
    case "asset-place":
      return AssetPlaceIcon;
    default:
      return MousePointer2;
  }
}

export { Grid3X3 };

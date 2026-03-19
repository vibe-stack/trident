import {
  computePolygonNormal,
  getAxisAlignedBrushBounds,
  getFaceVertices,
  polygonSignedArea,
  projectPolygonToPlane,
  reconstructBrushFaces
} from "@ggez/geometry-kernel";
import type { GeometryNode, MetadataValue, PrimitiveNode, Vec3 } from "@ggez/shared";
import {
  averageVec3,
  isBrushNode,
  isGroupNode,
  isMeshNode,
  isModelNode,
  isPrimitiveNode,
  resolveSceneGraph,
  subVec3,
  vec3,
  type Transform
} from "@ggez/shared";
import type { SceneDocument, SceneDocumentSnapshot } from "../document/scene-document";

export type Bounds3 = {
  max: Vec3;
  min: Vec3;
};

export type SpatialAnalysisOptions = {
  elevationBandTolerance?: number;
  landingElevationTolerance?: number;
  minConnectorRise?: number;
  minSurfaceArea?: number;
  overlapAreaThreshold?: number;
  walkableSlopeThreshold?: number;
};

export type NodeSpatialSummary = {
  bounds?: Bounds3;
  center?: Vec3;
  groupId?: string;
  id: string;
  kind: GeometryNode["kind"];
  metadata?: Record<string, MetadataValue>;
  name: string;
  tags: string[];
  walkableSurfaceIds: string[];
};

export type WalkableSurfaceSummary = {
  area: number;
  bounds: Bounds3;
  center: Vec3;
  elevation: number;
  groupId?: string;
  nodeId: string;
  normal: Vec3;
  slope: number;
  surfaceId: string;
  tags: string[];
};

export type ElevationBandSummary = {
  averageElevation: number;
  maxElevation: number;
  minElevation: number;
  surfaceIds: string[];
  totalArea: number;
};

export type BlockoutGroupSummary = {
  groupId: string;
  kind?: string;
  nodeIds: string[];
  tags: string[];
};

export type VerticalConnectorValidation = {
  groupId: string;
  lowerAttachmentSurfaceIds: string[];
  lowerLandingSurfaceId?: string;
  reasons: string[];
  rise: number;
  upperAttachmentSurfaceIds: string[];
  upperLandingSurfaceId?: string;
  valid: boolean;
};

export type SceneSpatialAnalysis = {
  bounds?: Bounds3;
  connectorValidations: VerticalConnectorValidation[];
  elevationBands: ElevationBandSummary[];
  groups: BlockoutGroupSummary[];
  issues: string[];
  nodes: NodeSpatialSummary[];
  walkableSurfaces: WalkableSurfaceSummary[];
};

const DEFAULT_OPTIONS: Required<SpatialAnalysisOptions> = {
  elevationBandTolerance: 0.75,
  landingElevationTolerance: 0.35,
  minConnectorRise: 1.2,
  minSurfaceArea: 0.75,
  overlapAreaThreshold: 0.35,
  walkableSlopeThreshold: 0.72
};

const ZERO = vec3(0, 0, 0);

export function analyzeSceneSpatialLayout(
  input: Iterable<GeometryNode> | SceneDocument | SceneDocumentSnapshot,
  options: SpatialAnalysisOptions = {}
): SceneSpatialAnalysis {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const nodes = resolveNodes(input);
  const sceneGraph = resolveSceneGraph(nodes);
  const analyzedNodes = nodes.filter((node) => !isGroupNode(node));
  const nodeSummaries = analyzedNodes.map((node) =>
    summarizeNode(node, sceneGraph.nodeWorldTransforms.get(node.id) ?? node.transform, resolvedOptions)
  );
  const walkableSurfaces = nodeSummaries.flatMap((summary) => summary.walkableSurfaces);
  const groups = summarizeGroups(analyzedNodes);
  const connectorValidations = groups
    .filter((group) => group.kind === "stairs" || group.tags.includes("connector"))
    .map((group) => validateVerticalConnectorGroup(group.groupId, walkableSurfaces, groups, resolvedOptions));
  const elevationBands = clusterElevationBands(walkableSurfaces, resolvedOptions.elevationBandTolerance);
  const bounds = mergeBounds(nodeSummaries.map((summary) => summary.bounds).filter((value): value is Bounds3 => Boolean(value)));
  const issues: string[] = [];

  if (walkableSurfaces.length === 0) {
    issues.push("No walkable surfaces were detected.");
  } else if (elevationBands.length < 2) {
    issues.push("Walkable space is concentrated in a single elevation band.");
  }

  const invalidConnectors = connectorValidations.filter((validation) => !validation.valid);

  invalidConnectors.forEach((validation) => {
    issues.push(`Connector group ${validation.groupId} is invalid: ${validation.reasons.join("; ")}`);
  });

  if (elevationBands.length >= 2 && connectorValidations.length === 0) {
    issues.push("Multiple elevation bands exist, but no connector groups are tagged for validation.");
  } else if (elevationBands.length >= 2 && connectorValidations.every((validation) => !validation.valid)) {
    issues.push("Vertical layers exist, but no validated connector currently bridges them.");
  }

  if (elevationBands.length > 0) {
    const dominantArea = Math.max(...elevationBands.map((band) => band.totalArea));
    const totalArea = elevationBands.reduce((sum, band) => sum + band.totalArea, 0);

    if (totalArea > 0 && dominantArea / totalArea >= 0.8) {
      issues.push("Most walkable area sits on one elevation band, so verticality is currently weak.");
    }
  }

  return {
    bounds,
    connectorValidations,
    elevationBands,
    groups,
    issues,
    nodes: nodeSummaries.map(({ bounds: nodeBounds, center, node, walkableSurfaces: surfaces }) => ({
      bounds: nodeBounds,
      center,
      groupId: readGroupId(node),
      id: node.id,
      kind: node.kind,
      metadata: node.metadata,
      name: node.name,
      tags: [...(node.tags ?? [])],
      walkableSurfaceIds: surfaces.map((surface) => surface.surfaceId)
    })),
    walkableSurfaces
  };
}

export function validateVerticalConnectorGroup(
  groupId: string,
  walkableSurfaces: WalkableSurfaceSummary[],
  groups: BlockoutGroupSummary[],
  options: SpatialAnalysisOptions = {}
): VerticalConnectorValidation {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const connectorGroup = groups.find((group) => group.groupId === groupId);
  const localSurfaces = walkableSurfaces
    .filter((surface) => surface.groupId === groupId)
    .sort((left, right) => left.elevation - right.elevation);
  const reasons: string[] = [];

  if (!connectorGroup) {
    return {
      groupId,
      lowerAttachmentSurfaceIds: [],
      reasons: ["The group is missing from the scene analysis."],
      rise: 0,
      upperAttachmentSurfaceIds: [],
      valid: false
    };
  }

  if (localSurfaces.length < 2) {
    return {
      groupId,
      lowerAttachmentSurfaceIds: [],
      reasons: ["The connector does not expose enough walkable surfaces to determine a rise."],
      rise: 0,
      upperAttachmentSurfaceIds: [],
      valid: false
    };
  }

  const localBands = clusterElevationBands(localSurfaces, resolvedOptions.landingElevationTolerance);
  const lowestBand = localBands[0];
  const highestBand = localBands[localBands.length - 1];
  const lowerLanding = selectRepresentativeSurface(lowestBand, localSurfaces);
  const upperLanding = selectRepresentativeSurface(highestBand, localSurfaces);
  const rise = lowerLanding && upperLanding ? upperLanding.elevation - lowerLanding.elevation : 0;

  if (!lowerLanding || !upperLanding) {
    reasons.push("The connector could not resolve distinct lower and upper landings.");
  } else if (rise < resolvedOptions.minConnectorRise) {
    reasons.push(`The connector only rises ${rise.toFixed(2)} units.`);
  }

  const externalSurfaces = walkableSurfaces.filter((surface) => surface.groupId !== groupId);
  const lowerAttachments = lowerLanding
    ? externalSurfaces.filter((surface) =>
        areSurfacesAttached(lowerLanding, surface, resolvedOptions.landingElevationTolerance, resolvedOptions.overlapAreaThreshold)
      )
    : [];
  const upperAttachments = upperLanding
    ? externalSurfaces.filter((surface) =>
        areSurfacesAttached(upperLanding, surface, resolvedOptions.landingElevationTolerance, resolvedOptions.overlapAreaThreshold)
      )
    : [];

  if (lowerLanding && lowerAttachments.length === 0) {
    reasons.push("No lower landing attachment was found on another walkable surface.");
  }

  if (upperLanding && upperAttachments.length === 0) {
    reasons.push("No upper landing attachment was found on another walkable surface.");
  }

  return {
    groupId,
    lowerAttachmentSurfaceIds: lowerAttachments.map((surface) => surface.surfaceId),
    lowerLandingSurfaceId: lowerLanding?.surfaceId,
    reasons,
    rise,
    upperAttachmentSurfaceIds: upperAttachments.map((surface) => surface.surfaceId),
    upperLandingSurfaceId: upperLanding?.surfaceId,
    valid: reasons.length === 0
  };
}

function summarizeNode(node: GeometryNode, worldTransform: Transform, options: Required<SpatialAnalysisOptions>) {
  const worldPoints = collectNodeWorldPoints(node, worldTransform);
  const bounds = worldPoints.length > 0 ? createBounds(worldPoints) : undefined;
  const center = bounds ? boundsCenter(bounds) : undefined;

  return {
    bounds,
    center,
    node,
    walkableSurfaces: extractWalkableSurfaces(node, worldTransform, options)
  };
}

function resolveNodes(input: Iterable<GeometryNode> | SceneDocument | SceneDocumentSnapshot) {
  if (typeof input === "object" && input !== null && "nodes" in input) {
    const candidateNodes = input.nodes;

    if (candidateNodes instanceof Map) {
      return Array.from(candidateNodes.values());
    }

    if (Array.isArray(candidateNodes)) {
      return candidateNodes;
    }
  }

  return Array.from(input as Iterable<GeometryNode>);
}

function summarizeGroups(nodes: GeometryNode[]): BlockoutGroupSummary[] {
  const groups = new Map<string, BlockoutGroupSummary>();

  nodes.forEach((node) => {
    const groupId = readGroupId(node);

    if (!groupId) {
      return;
    }

    const existing = groups.get(groupId);

    if (existing) {
      existing.nodeIds.push(node.id);
      existing.tags = Array.from(new Set([...existing.tags, ...(node.tags ?? [])]));
      return;
    }

    groups.set(groupId, {
      groupId,
      kind: readMetadataString(node, "blockoutKind"),
      nodeIds: [node.id],
      tags: [...new Set(node.tags ?? [])]
    });
  });

  return Array.from(groups.values());
}

function extractWalkableSurfaces(node: GeometryNode, worldTransform: Transform, options: Required<SpatialAnalysisOptions>) {
  if (!shouldInspectWalkableSurfaces(node)) {
    return [];
  }

  if (isBrushNode(node)) {
    return extractBrushWalkableSurfaces(node, worldTransform, options);
  }

  if (isMeshNode(node)) {
    return node.data.faces
      .map((face) => getFaceVertices(node.data, face.id).map((vertex) => transformPoint(vertex.position, worldTransform)))
      .map((vertices, index) => createSurfaceSummary(node, `${node.id}:mesh:${index}`, vertices, options))
      .filter((surface): surface is WalkableSurfaceSummary => Boolean(surface));
  }

  if (isPrimitiveNode(node)) {
    return extractPrimitiveWalkableSurfaces(node, worldTransform, options);
  }

  return [];
}

function extractBrushWalkableSurfaces(
  node: Extract<GeometryNode, { kind: "brush" }>,
  worldTransform: Transform,
  options: Required<SpatialAnalysisOptions>
) {
  const rebuilt = reconstructBrushFaces(node.data);

  if (!rebuilt.valid) {
    const axisAlignedBounds = getAxisAlignedBrushBounds(node.data);

    if (!axisAlignedBounds) {
      return [];
    }

    const topVertices = [
      vec3(axisAlignedBounds.x.min, axisAlignedBounds.y.max, axisAlignedBounds.z.min),
      vec3(axisAlignedBounds.x.max, axisAlignedBounds.y.max, axisAlignedBounds.z.min),
      vec3(axisAlignedBounds.x.max, axisAlignedBounds.y.max, axisAlignedBounds.z.max),
      vec3(axisAlignedBounds.x.min, axisAlignedBounds.y.max, axisAlignedBounds.z.max)
    ].map((vertex) => transformPoint(vertex, worldTransform));

    const surface = createSurfaceSummary(node, `${node.id}:top`, topVertices, options);
    return surface ? [surface] : [];
  }

  return rebuilt.faces
    .map((face) =>
      createSurfaceSummary(node, `${node.id}:${face.id}`, face.vertices.map((vertex) => transformPoint(vertex.position, worldTransform)), options)
    )
    .filter((surface): surface is WalkableSurfaceSummary => Boolean(surface));
}

function extractPrimitiveWalkableSurfaces(node: PrimitiveNode, worldTransform: Transform, options: Required<SpatialAnalysisOptions>) {
  if (node.data.shape === "sphere" || node.data.shape === "cone") {
    return [];
  }

  const halfWidth = Math.abs(node.data.size.x) * 0.5;
  const halfDepth = Math.abs(node.data.size.z) * 0.5;
  const top = Math.abs(node.data.size.y) * 0.5;

  const vertices = [
    vec3(-halfWidth, top, -halfDepth),
    vec3(halfWidth, top, -halfDepth),
    vec3(halfWidth, top, halfDepth),
    vec3(-halfWidth, top, halfDepth)
  ].map((vertex) => transformPoint(vertex, worldTransform));
  const surface = createSurfaceSummary(node, `${node.id}:primitive:top`, vertices, options);

  return surface ? [surface] : [];
}

function shouldInspectWalkableSurfaces(node: GeometryNode) {
  const tags = new Set(node.tags ?? []);
  const blockoutPart = readMetadataString(node, "blockoutPart");

  if (tags.has("wall") || tags.has("ceiling")) {
    return false;
  }

  return blockoutPart !== "wall" && blockoutPart !== "ceiling";
}

function createSurfaceSummary(
  node: GeometryNode,
  surfaceId: string,
  vertices: Vec3[],
  options: Required<SpatialAnalysisOptions>
): WalkableSurfaceSummary | undefined {
  if (vertices.length < 3) {
    return undefined;
  }

  const normal = computePolygonNormal(vertices);

  if (normal.y < options.walkableSlopeThreshold) {
    return undefined;
  }

  const area = Math.abs(polygonSignedArea(projectPolygonToPlane(vertices, normal)));

  if (area < options.minSurfaceArea) {
    return undefined;
  }

  const center = averageVec3(vertices);

  return {
    area,
    bounds: createBounds(vertices),
    center,
    elevation: center.y,
    groupId: readGroupId(node),
    nodeId: node.id,
    normal,
    slope: normal.y,
    surfaceId,
    tags: [...(node.tags ?? [])]
  };
}

function collectNodeWorldPoints(node: GeometryNode, worldTransform: Transform): Vec3[] {
  if (isBrushNode(node)) {
    const rebuilt = reconstructBrushFaces(node.data);

    if (rebuilt.valid) {
      return rebuilt.faces.flatMap((face) => face.vertices.map((vertex) => transformPoint(vertex.position, worldTransform)));
    }

    const bounds = getAxisAlignedBrushBounds(node.data);

    if (!bounds) {
      return [];
    }

    return createBoxCorners(
      vec3(bounds.x.min, bounds.y.min, bounds.z.min),
      vec3(bounds.x.max, bounds.y.max, bounds.z.max)
    ).map((vertex) => transformPoint(vertex, worldTransform));
  }

  if (isMeshNode(node)) {
    return node.data.vertices.map((vertex) => transformPoint(vertex.position, worldTransform));
  }

  if (isPrimitiveNode(node)) {
    const half = vec3(Math.abs(node.data.size.x) * 0.5, Math.abs(node.data.size.y) * 0.5, Math.abs(node.data.size.z) * 0.5);
    return createBoxCorners(vec3(-half.x, -half.y, -half.z), half).map((vertex) => transformPoint(vertex, worldTransform));
  }

  if (isModelNode(node)) {
    return createBoxCorners(vec3(-0.65, 0, -0.65), vec3(0.65, 2.2, 0.65)).map((vertex) => transformPoint(vertex, worldTransform));
  }

  return [transformPoint(ZERO, worldTransform)];
}

function clusterElevationBands(surfaces: WalkableSurfaceSummary[], tolerance: number): ElevationBandSummary[] {
  const sorted = surfaces.slice().sort((left, right) => left.elevation - right.elevation);
  const bands: ElevationBandSummary[] = [];

  sorted.forEach((surface) => {
    const current = bands[bands.length - 1];

    if (!current || Math.abs(surface.elevation - current.averageElevation) > tolerance) {
      bands.push({
        averageElevation: surface.elevation,
        maxElevation: surface.elevation,
        minElevation: surface.elevation,
        surfaceIds: [surface.surfaceId],
        totalArea: surface.area
      });
      return;
    }

    current.maxElevation = Math.max(current.maxElevation, surface.elevation);
    current.minElevation = Math.min(current.minElevation, surface.elevation);
    current.surfaceIds.push(surface.surfaceId);
    current.totalArea += surface.area;
    current.averageElevation = (current.averageElevation * (current.surfaceIds.length - 1) + surface.elevation) / current.surfaceIds.length;
  });

  return bands;
}

function selectRepresentativeSurface(
  band: ElevationBandSummary | undefined,
  surfaces: WalkableSurfaceSummary[]
): WalkableSurfaceSummary | undefined {
  if (!band) {
    return undefined;
  }

  const surfaceSet = new Set(band.surfaceIds);
  return surfaces
    .filter((surface) => surfaceSet.has(surface.surfaceId))
    .sort((left, right) => right.area - left.area)[0];
}

function areSurfacesAttached(
  target: WalkableSurfaceSummary,
  candidate: WalkableSurfaceSummary,
  elevationTolerance: number,
  overlapAreaThreshold: number
) {
  if (Math.abs(target.elevation - candidate.elevation) > elevationTolerance) {
    return false;
  }

  return computeHorizontalOverlapArea(target.bounds, candidate.bounds) >= overlapAreaThreshold;
}

function computeHorizontalOverlapArea(left: Bounds3, right: Bounds3) {
  const overlapX = Math.max(0, Math.min(left.max.x, right.max.x) - Math.max(left.min.x, right.min.x));
  const overlapZ = Math.max(0, Math.min(left.max.z, right.max.z) - Math.max(left.min.z, right.min.z));
  return overlapX * overlapZ;
}

function createBounds(points: Vec3[]): Bounds3 {
  const [first, ...rest] = points;

  return rest.reduce(
    (bounds, point) => ({
      max: vec3(
        Math.max(bounds.max.x, point.x),
        Math.max(bounds.max.y, point.y),
        Math.max(bounds.max.z, point.z)
      ),
      min: vec3(
        Math.min(bounds.min.x, point.x),
        Math.min(bounds.min.y, point.y),
        Math.min(bounds.min.z, point.z)
      )
    }),
    {
      max: vec3(first.x, first.y, first.z),
      min: vec3(first.x, first.y, first.z)
    }
  );
}

function mergeBounds(boundsList: Bounds3[]) {
  if (boundsList.length === 0) {
    return undefined;
  }

  return boundsList.slice(1).reduce(
    (bounds, next) => ({
      max: vec3(
        Math.max(bounds.max.x, next.max.x),
        Math.max(bounds.max.y, next.max.y),
        Math.max(bounds.max.z, next.max.z)
      ),
      min: vec3(
        Math.min(bounds.min.x, next.min.x),
        Math.min(bounds.min.y, next.min.y),
        Math.min(bounds.min.z, next.min.z)
      )
    }),
    boundsList[0]
  );
}

function boundsCenter(bounds: Bounds3) {
  return vec3(
    (bounds.min.x + bounds.max.x) * 0.5,
    (bounds.min.y + bounds.max.y) * 0.5,
    (bounds.min.z + bounds.max.z) * 0.5
  );
}

function createBoxCorners(min: Vec3, max: Vec3) {
  return [
    vec3(min.x, min.y, min.z),
    vec3(max.x, min.y, min.z),
    vec3(max.x, max.y, min.z),
    vec3(min.x, max.y, min.z),
    vec3(min.x, min.y, max.z),
    vec3(max.x, min.y, max.z),
    vec3(max.x, max.y, max.z),
    vec3(min.x, max.y, max.z)
  ];
}

function readGroupId(node: GeometryNode) {
  return readMetadataString(node, "blockoutGroup");
}

function readMetadataString(node: GeometryNode, key: string) {
  const value = node.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function transformPoint(point: Vec3, transform: GeometryNode["transform"]) {
  const pivot = transform.pivot ?? ZERO;
  const relative = subVec3(point, pivot);
  const scaled = vec3(
    relative.x * transform.scale.x,
    relative.y * transform.scale.y,
    relative.z * transform.scale.z
  );
  const rotated = rotateEulerXYZ(scaled, transform.rotation);

  return vec3(
    rotated.x + pivot.x + transform.position.x,
    rotated.y + pivot.y + transform.position.y,
    rotated.z + pivot.z + transform.position.z
  );
}

function rotateEulerXYZ(point: Vec3, rotation: Vec3) {
  const sinX = Math.sin(rotation.x);
  const cosX = Math.cos(rotation.x);
  const sinY = Math.sin(rotation.y);
  const cosY = Math.cos(rotation.y);
  const sinZ = Math.sin(rotation.z);
  const cosZ = Math.cos(rotation.z);

  const aroundX = vec3(
    point.x,
    point.y * cosX - point.z * sinX,
    point.y * sinX + point.z * cosX
  );
  const aroundY = vec3(
    aroundX.x * cosY + aroundX.z * sinY,
    aroundX.y,
    -aroundX.x * sinY + aroundX.z * cosY
  );

  return vec3(
    aroundY.x * cosZ - aroundY.y * sinZ,
    aroundY.x * sinZ + aroundY.y * cosZ,
    aroundY.z
  );
}

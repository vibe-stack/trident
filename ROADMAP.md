# WEB HAMMER ROADMAP

## Status

Last updated: 2026-03-06

## Completed

- Initialized the `web-hammer` Bun workspace monorepo.
- Added the architecture source of truth in `ARCHITECTURE.md`.
- Scaffolded the Vite + React + TypeScript editor app in `apps/editor`.
- Created initial workspace packages for the editor core, geometry kernel, render pipeline, tool system, shared types, and workers.
- Wired a minimal editor shell that respects the architecture rule that React is UI-only and geometry lives outside React state.
- Declared and installed the initial dependency set from the architecture spec.
- Implemented the Phase 1 viewport baseline with a render-pipeline-derived scene, perspective editor camera rig, construction grid, and entity markers.
- Expanded `editor-core` with scene revision tracking, mutation helpers, selection actions, redoable commands, and richer editor events.
- Implemented Phase 3 brush reconstruction with triple-plane intersection, half-space classification, ordered face generation, and triangulated brush surfaces.
- Implemented Phase 4 editable mesh topology helpers with polygon-to-half-edge construction, topology validation, face traversal, and triangulation.
- Updated the viewport render path to consume reconstructed brush and mesh surfaces instead of placeholder geometry for authoring nodes.
- Started Phase 5 with object-level viewport hit testing, click-to-select, focus-on-double-click, empty-space clear, and scene-list/inspector selection sync.
- Expanded Phase 5 with BVH-accelerated object raycasting and Shift-drag marquee selection in the viewport.
- Swapped the viewport renderer to Three.js `WebGPURenderer`, fixed brush face shading by splitting brush surface vertices per face, and relaxed orbit controls to allow below-ground camera angles.
- Started Phase 6 with a transform tool baseline: snap-aware translation, duplication, mirror-by-axis, tool switching, and undo/redo shortcuts on top of the command stack.
- Started Phase 7 and Phase 8 baselines: center-split clip for axis-aligned brushes, object-level brush extrusion, mesh inflate/top-offset edits, and grid-based asset placement.
- Started Phase 9 with asset/material panels, brush material assignment, entity authoring actions, asset-driven placement, and a visible worker job queue for async editor tasks.

## Next

- Phase 5: build hit testing, raycasting, and marquee selection on top of BVH-backed render data.
  Current gap: face/edge/vertex hit testing, deeper BVH query plumbing, and robust multi-mode marquee behavior are still missing.
- Phase 6: implement transform tools, snapping, duplication, and mirror workflows.
  Current gap: viewport gizmos, drag transforms, rotate/scale editing, and transform-space controls are still missing.
- Phase 7: add brush editing operations such as clip, split, hollow, merge, and face extrusion.
  Current gap: arbitrary-plane clipping, face extrusion, hollow/merge flows, and non-box brush editing are still missing.
- Phase 8: add mesh editing tools such as extrude, bevel, split edge, loop cut, and merge vertices.
  Current gap: real topology-editing operations are still missing; current mesh edit is object-level deformation only.
- Phase 9: add materials, assets, entity authoring, and worker-backed async jobs.
  Current gap: richer asset catalogs, direct entity selection/editing, real Web Worker execution, and asset/material persistence workflows are still missing.
- Phase 10: implement `.whmap` persistence plus GLTF and engine export flows.

## Notes

- Keep geometry authoritative inside workspace packages, not React components.
- Prefer worker-backed incremental rebuilds for heavy geometry and export tasks.
- Treat `ARCHITECTURE.md` as the source of truth when the roadmap and implementation diverge.

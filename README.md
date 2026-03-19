# Trident

Trident is a browser-based Source-style level editor built as a Bun monorepo. It is aimed at fast blockouts and quick iteration, with brush tools, mesh editing, material authoring, entity placement, lighting, imports, exports, and optional AI-assisted asset generation.

The public GitHub Pages build is a static demo of the editor shell. The local development build includes the lightweight Vite API routes used for Fal-powered texture and model generation.

## What It Includes

- Brush primitives for cube, cylinder, cone, sphere, stairs, and custom polygon blockouts
- Prop and model placement, including GLB import
- Entity and light placement for common gameplay and scene setup tasks
- Material library editing with texture slots, UV controls, and reusable materials
- Scene save/load and export flows, including `.whmap`, glTF, and engine export actions
- A standalone Three.js runtime package for loading structured scene exports in vanilla games
- Optional AI texture and 3D generation backed by Fal when running locally with a server-side API key

## Project Layout

- `apps/editor`: Vite + React + TypeScript editor application
- `packages/editor-core`: scene document, command stack, selection, and event bus
- `packages/geometry-kernel`: brush and mesh operations
- `packages/render-pipeline`: render-facing scene and viewport contracts
- `packages/tool-system`: tool registry and tool state machines
- `packages/shared`: shared types and utilities
- `packages/three-runtime`: vanilla Three.js loader for runtime scene exports
- `packages/workers`: worker task contracts and manager code
- `apps/three-runtime-playground`: minimal Vite + TypeScript app that exercises the runtime loader

## Requirements

- Bun 1.3 or newer
- A modern desktop browser
- A Fal API key if you want the AI generation features locally

## Install

```bash
bun install
```

## Run It Locally

Start the editor in development mode:

```bash
bun run dev
```

That runs the Vite app in `apps/editor` and includes the local API routes for AI features.

## Build The Static Demo

```bash
bun run build
```

This produces the static site output in `apps/editor/dist`.

## Typecheck

```bash
bun run typecheck
```

Typecheck or build the standalone Three runtime playground:

```bash
bun run typecheck:three-runtime
bun run build:three-runtime
```

## How To Use Trident

When the editor opens, you can start blocking out a space immediately:

1. Use the creation toolbar to place brush shapes, props, lights, and entities.
2. Select objects in the viewport and use the inspector and material panels to adjust transforms, materials, UVs, and other properties.
3. Save your scene as `.whmap`, or export it as glTF or through the engine export action from the File menu.

The editor is designed around fast iteration, so most of the workflow is direct manipulation in the viewport with supporting controls in the floating panels and sidebars.

## Runtime Import Workflow

- Use `.whmap` for editor-native save/load and round-tripping.
- Use `Export Runtime Bundle` when you want to ship a map to a vanilla Three.js game.
- The bundle contains a small `scene.runtime.json` manifest plus external asset files under `assets/`, instead of stuffing textures into one giant JSON blob.
- Load the manifest with `@ggez/three-runtime`, which rebuilds geometry, materials, lights, model assets, and preserves node physics metadata for your game code.
- Runtime package docs and code examples live in `packages/three-runtime/README.md`.
- For large web worlds, do not export one giant scene and preload it all. Export streamable level chunks and load/unload runtime bundles on demand.
- If you need shared heavy assets across many chunks, keep them external and let chunk manifests reference them instead of copying them into every bundle.

The playground app in `apps/three-runtime-playground` demonstrates that workflow outside the editor.

## Environment Variables

Trident only requires an environment variable if you want AI model or texture generation.

Create `apps/editor/.env.local` with:

```bash
FAL_KEY=your_fal_api_key_here
```

`FAL_KEY` is read on the server side by the Vite dev server plugins in `apps/editor/server`. It is not needed for the static GitHub Pages demo.

## How To Get A Fal API Key

1. Create an account or sign in at Fal.
2. Open the dashboard and go to the API keys section.
3. Create a new key.
4. Copy the key into `apps/editor/.env.local` as `FAL_KEY=...`.

If you only want to try the public demo on GitHub Pages, you can skip this entirely. The demo is intentionally static, so the AI generation routes are not deployed there.

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow that builds `apps/editor` as a static site and deploys it to GitHub Pages.

The workflow lives at `.github/workflows/deploy-pages.yml` and assumes the site is hosted from the repository path, so the Vite base path is set automatically for Pages builds.

## License

MIT. See the `LICENSE` file for details.

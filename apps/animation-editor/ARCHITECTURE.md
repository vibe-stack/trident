You are working inside an existing monorepo.

Your task is to design and implement a production-grade animation graph system with:
1. a pure runtime library
2. an exporter / compiler pipeline
3. a React-based graph editor app

This must be built in a monorepo-friendly way and be cleanly split into packages under the @ggez/* namespace.

Important architectural rule:
- push as much logic as possible into packages
- the app "animation-editor" must be mostly an editor shell / UI for authoring graphs
- exported runtime artifacts must have zero dependency on React
- runtime libraries must have zero dependency on React
- editor-specific code must stay in the app or editor-focused package(s)
- no tightly coupled app-local business logic if it belongs in reusable packages

Current constraints:
- monorepo already exists
- package namespace base is @ggez/*
- existing app name is "animation-editor"
- editor stack is Vite + React + TypeScript + Tailwind + shadcn/ui
- runtime/exported output must be framework-agnostic
- do not use Zustand for core editor/runtime state
- editor state must be React-compatible but much faster/more explicit for complex graph + preview workflows
- prefer a state architecture based on a custom store, signals, Valtio, or another performant model suitable for graph editors and possible 3D preview interaction
- avoid architecture that causes broad React rerenders on every graph drag/change
- assume this system is meant to be used by Three.js game developers, but architect core packages so they are not hard-locked to React or the editor app
- runtime should integrate into Three.js games through a dedicated bridge package, not through the core package

Goal:
Build a system similar in spirit to Unity Animator / Unreal Animation Blueprint-lite:
- graph/subgraph authoring
- state machines
- transitions
- 1D and 2D blend trees
- animation layers
- per-bone masking
- root motion extraction
- exporter/compiler to optimized runtime format
- runtime evaluator that users can consume directly in their Three.js game

High-level product split:
A) pure core animation runtime package(s)
B) Three.js bridge package(s)
C) exporter/compiler package(s)
D) shared graph/schema/model package(s)
E) editor app and editor-specific UI packages

==================================================
TARGET PACKAGE / APP STRUCTURE
==================================================

Create or adapt the monorepo into a structure close to this:

apps/
  animation-editor/

packages/
  anim-core/
  anim-runtime/
  anim-three/
  anim-schema/
  anim-compiler/
  anim-exporter/
  anim-editor-core/
  anim-editor-react/
  anim-editor-preview/   (optional if useful)
  anim-utils/

Final package names should be:
- @ggez/anim-core
- @ggez/anim-runtime
- @ggez/anim-three
- @ggez/anim-schema
- @ggez/anim-compiler
- @ggez/anim-exporter
- @ggez/anim-editor-core
- @ggez/anim-editor-react
- optionally @ggez/anim-editor-preview
- optionally @ggez/anim-utils

You may adjust exact package boundaries if needed, but only if the result is cleaner and more maintainable.

Package responsibilities:

1) @ggez/anim-schema
- all stable JSON/document/runtime schema definitions
- graph node types
- parameter definitions
- state machine definitions
- layer definitions
- mask definitions
- clip reference schema
- export format versioning
- io validation
- zod or similar runtime validation strongly recommended
- this package must be framework-agnostic

2) @ggez/anim-core
- core data structures
- Rig
- PoseBuffer
- BoneMask
- RootMotionDelta
- clip sampling primitives
- curve sampling utilities
- blending utilities
- additive blending
- mask application
- root motion extraction helpers
- no Three.js dependency
- no React dependency

3) @ggez/anim-runtime
- animator instance
- parameter store
- state machine runtime
- transition evaluation
- blend tree evaluation
- layer stack evaluation
- subgraph execution
- pose cache / scratch buffers
- final runtime evaluator loop
- no React dependency
- depends on anim-core and anim-schema

4) @ggez/anim-three
- utilities to import from Three.js AnimationClip / Skeleton
- mapping bone names to indices
- create rig definitions from Three.js skeletons
- apply final evaluated pose back to Three.js skeleton/bones
- editor preview helpers if needed
- runtime bridge for users integrating with Three.js
- keep this package focused: bridge only, not the whole system

5) @ggez/anim-compiler
- compile editor graph format into optimized runtime graph
- validate graph topology
- resolve references
- flatten/resolve subgraphs where appropriate
- compile masks into per-bone weights
- resolve bone names to indices when rig info is available
- generate optimized runtime graph structures
- topological sort / evaluation ordering
- perform static checks and produce clear compile errors/warnings
- no React dependency

6) @ggez/anim-exporter
- serialize compiled runtime assets to JSON
- optionally support binary export later, but JSON first
- versioned export format
- import/export entrypoints
- package should focus on artifact creation and loading concerns

7) @ggez/anim-editor-core
- editor domain logic
- graph document model
- editor commands
- selection model
- undo/redo
- clipboard model
- node registry
- graph validation hooks
- editor-side store / state engine
- highly performant and React-compatible
- avoid Zustand
- keep React out of here as much as possible
- this should expose subscribe/getSnapshot/action-style APIs or a signal/proxy model usable by React without making React the source of truth

8) @ggez/anim-editor-react
- React bindings/components/hooks for editor-core
- graph canvas components
- node rendering plumbing
- panels
- inspectors
- parameter editors
- graph tabs
- layer panels
- state machine UI
- this package may use React

9) apps/animation-editor
- compose the editor UI using packages above
- routing/layout/theme
- shadcn/ui setup
- toolbars/menus/dialogs
- persistence integration
- preview scene shell
- export actions
- this app should contain as little core business logic as possible

==================================================
KEY ARCHITECTURAL REQUIREMENTS
==================================================

1. Separate authoring format from runtime format
Do NOT use editor state as runtime data.

Need at least:
- Editor document format
- Compiled graph format
- Exported runtime artifact format

Editor format can contain:
- layout positions
- colors
- comments
- collapsed state
- UI metadata

Compiled/runtime export must contain only what runtime needs.

2. Runtime should evaluate into pose buffers, not Three.js AnimationActions
Do NOT build the runtime around Three.js AnimationAction as the main abstraction.
The runtime should evaluate into framework-agnostic pose data structures using typed arrays.
Three.js should only be used as:
- source import bridge
- optional preview bridge
- final skeleton application bridge

3. Bone masking must be first-class
Implement proper float-based per-bone masks, not booleans only.
Need support for:
- include bone + children
- explicit per-bone weight editing
- override and additive layering compatibility

4. Root motion must be first-class
Support extracting root motion from selected clip/root tracks.
Need explicit RootMotionDelta output from runtime update.
Support modes like:
- none
- full
- xz only
- xz + yaw
Root motion should be selectable per layer / graph policy.

5. State machines and blend trees are mandatory
Need:
- animation parameters: float, int, bool, trigger
- states
- transitions
- transition conditions
- exit time
- blend duration
- any-state style transitions if feasible
- 1D blend trees
- 2D blend trees

6. Subgraphs are mandatory
Users should be able to author reusable subgraphs.
Subgraphs should behave like reusable motion logic blocks.

7. Performance-conscious editor architecture
The editor must stay responsive with many graph nodes and inspector updates.
Avoid React-wide rerenders.
Use a state architecture more suitable for graph editors than Zustand for this use case.
A custom evented store or signal/proxy-based store is acceptable.
Design for:
- stable selectors
- local subscriptions
- command-based mutation
- undo/redo
- no giant top-level React state trees

8. Good package API design
Public APIs should be coherent and minimal.
Package boundaries should feel intentional, not arbitrary.

==================================================
CORE DATA MODEL REQUIREMENTS
==================================================

Design the core around these concepts:

Rig
- bone names
- parent indices
- bind pose transforms
- root bone id

PoseBuffer
- typed arrays for translation / rotation / scale
- optimized for reuse
- no per-bone object allocations per frame

BoneMask
- per bone float weights
- helpers for building masks from branches

RootMotionDelta
- translation delta
- yaw delta and/or full quaternion delta depending on mode

AnimationClipAsset
- internal representation of clips/tracks after import/preprocessing
- resolved bone bindings
- time/value arrays
- metadata
- events if useful

AnimatorGraph / CompiledGraph
- compact runtime-oriented representation
- references by ids/indices rather than strings where possible

AnimatorInstance
- per character runtime instance
- parameter storage
- layer state
- state machine state
- scratch poses
- output pose
- root motion output

==================================================
GRAPH / AUTHORING FEATURE REQUIREMENTS
==================================================

Initial feature scope for v1:

Nodes / graph concepts:
- clip node
- state machine node
- subgraph node
- 1D blend node
- 2D blend node
- layer node / layer stack config
- output node
- parameter nodes or parameter references as needed
- root motion policy config
- mask reference
- transition conditions in state machine editor

Graph-level features:
- multiple graphs/subgraphs per document
- named parameters
- named masks
- named layers
- clip references
- graph validation
- compile/export

Editor UX baseline:
- graph canvas
- drag/drop nodes
- connect edges
- inspect and edit node properties
- create/delete/rename graphs
- subgraph support
- parameter panel
- masks panel
- layers panel
- export button
- import/export document support
- undo/redo
- copy/paste
- selection and multiselect
- fit-to-view / zoom / pan

Optional but nice if not too costly:
- minimap
- search
- command palette
- keyboard shortcuts
- preview scrubber
- validation panel

Do not overbuild unnecessary polish before core architecture is correct.

==================================================
RUNTIME FEATURE REQUIREMENTS
==================================================

Runtime must support:
- loading exported runtime graph artifacts
- creating animator instances
- setting parameters
- triggering transitions
- update(dt)
- retrieving root motion delta
- applying final pose through bridge package

Desired runtime API shape should feel roughly like:

const animator = createAnimatorInstance({
  rig,
  graph,
  clips,
});

animator.setFloat("speed", 1.2);
animator.setBool("grounded", true);
animator.trigger("attack");

const result = animator.update(dt);
// result.rootMotion etc.

Three.js bridge should allow something like:
applyAnimatorPoseToSkeleton(animator, skeleton);

Or:
const bridge = createThreeAnimatorBridge(animator, skeleton);

Need clean public API and documentation comments.

==================================================
COMPILER / EXPORTER REQUIREMENTS
==================================================

Need a real compiler pipeline, not just JSON dump.

Compiler stages should include something close to:
1. schema validation
2. semantic validation
3. reference resolution
4. graph normalization
5. subgraph resolution / indexing
6. mask compilation
7. rig-aware binding resolution where possible
8. runtime node emission
9. optimization / compacting
10. export serialization

Compiler output should:
- be deterministic
- be versioned
- produce useful diagnostics
- avoid runtime string-heavy lookups where possible

Need diagnostics:
- invalid references
- circular references where illegal
- invalid transitions
- impossible blend definitions
- missing clips
- invalid mask bones
- unsupported node connections
- compile warnings for suspicious setups

==================================================
STATE MANAGEMENT REQUIREMENTS FOR THE EDITOR
==================================================

Very important:
Do not use Zustand as the main editor store.

Need something more appropriate for high-frequency graph/editor interactions.
Use a store architecture that is React-compatible but independent of React.

Good options:
- custom store with subscribe/getSnapshot and command dispatch
- Valtio if it genuinely fits the design
- another lightweight signal/proxy/evented approach
- split state domains carefully
- command-based mutation and history tracking

Requirements:
- fine-grained subscriptions
- efficient selection updates
- efficient node movement updates
- efficient inspector updates
- no app-wide rerenders on every drag
- easy undo/redo integration
- clean testability

Implement the editor state so core logic lives in @ggez/anim-editor-core and React just binds to it.

==================================================
IMPLEMENTATION EXPECTATIONS
==================================================

Please implement this in phases, but actually write production-ready code, not vague scaffolding.

Phase 1: package scaffolding and architecture
- inspect monorepo
- create packages
- wire TS config/build config as needed
- set up exports
- ensure package references build
- do not break existing monorepo conventions

Phase 2: schema + core data structures
- implement anim-schema
- implement anim-core fundamental structures and utilities
- tests for core blending/masks/root motion helpers

Phase 3: runtime
- implement compiled graph runtime evaluator
- parameter store
- state machine runtime
- 1D blend tree runtime
- layer blending
- mask application
- root motion extraction
- tests

Phase 4: Three.js bridge
- import clips/skeletons
- create rig helpers
- apply pose to skeleton
- basic usage example
- tests where practical

Phase 5: editor core
- editor document model
- command system
- history/undo-redo
- node registry
- graph actions
- validation integration
- high-performance store

Phase 6: editor React UI
- integrate into animation-editor app
- graph canvas
- property inspector
- graph/subgraph management
- layers/params/masks panels
- export flow
- keep app thin

Phase 7: compiler/exporter
- compile editor document -> runtime artifact
- diagnostics
- export/import support
- app integration

Phase 8: polish and docs
- README per package
- basic architecture doc
- example usage for runtime in a Three.js game
- editor usage notes

==================================================
TECHNICAL PREFERENCES
==================================================

- TypeScript throughout
- strict typing
- avoid unnecessary classes if plain data + focused services are cleaner
- typed arrays for hot runtime paths
- no hidden magic
- explicit, readable architecture
- test important pure logic heavily
- keep editor and runtime cleanly separated
- avoid premature binary serialization unless useful later
- JSON export first
- favor composability over monolithic god objects
- no React dependency in runtime/export/schema/core/compiler packages
- minimize Three.js dependency surface to anim-three and preview-related code

==================================================
DELIVERABLES
==================================================

Produce all of the following:

1. Actual implementation across packages/apps
2. Updated monorepo package wiring
3. Clear public APIs
4. Minimal but solid tests for core/runtime/compiler pieces
5. Example exported artifact format
6. Example runtime consumption snippet
7. Short architecture docs / READMEs
8. A summary of what was implemented and what remains as future work

==================================================
IMPORTANT DESIGN NOTES
==================================================

- Treat the editor as an authoring frontend, not the heart of the system
- Treat the compiler/exporter/runtime as the real product
- Do not trap important logic inside React components
- Do not make the runtime depend on editor concepts like canvas positions
- Do not use raw Three.js animation actions as the runtime core
- Do not rely on runtime string lookups where compile-time indexing is possible
- Root motion and masks are not optional extras; build them into the architecture from the beginning
- Build something extensible enough that additive nodes, IK nodes, aim constraints, event tracks, motion matching, or binary export could be added later without tearing everything apart

==================================================
WHAT TO DO FIRST
==================================================

Before coding:
1. inspect the monorepo structure and conventions
2. infer existing package manager / task runner / tsconfig strategy
3. propose the exact package layout you will implement
4. then start implementation

When implementing:
- keep commits/logical changes coherent
- do not dump everything into the app
- move reusable logic into packages immediately
- prefer robust foundations over flashy UI

At the end, provide:
- a concise architecture summary
- the package tree
- the main API entrypoints
- any tradeoffs or deferred features

Additional guidance:
- for the graph UI, use React Flow only if it does not distort the architecture; if used, wrap it so editor-core remains graph-library-agnostic
- prefer a command-based editing model with serializable actions
- ensure export format has an explicit version field
- all bone references in runtime artifacts should be compiled to indices where rig info is available
- build 1D blend trees first, then 2D if time permits, but structure for both from day one
- state machine transitions should support conditions, duration, optional exit time, and interruption policy
- runtime evaluation order should be deterministic
- avoid per-frame allocations in runtime hot paths
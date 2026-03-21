import { describe, expect, it } from "bun:test";
import { compileAnimationEditorDocument } from "./compiler";

describe("@ggez/anim-compiler", () => {
  it("compiles a valid editor document to a runtime graph", () => {
    const result = compileAnimationEditorDocument({
      version: 1,
      name: "Locomotion",
      entryGraphId: "graph-main",
      parameters: [
        { id: "speed", name: "speed", type: "float", defaultValue: 0 }
      ],
      clips: [
        { id: "idle", name: "Idle", duration: 1 },
        { id: "walk", name: "Walk", duration: 1 }
      ],
      masks: [],
      graphs: [
        {
          id: "graph-main",
          name: "Main",
          outputNodeId: "out",
          edges: [],
          nodes: [
            { id: "clip-idle", name: "Idle", kind: "clip", clipId: "idle", speed: 1, loop: true, position: { x: 0, y: 0 } },
            { id: "clip-walk", name: "Walk", kind: "clip", clipId: "walk", speed: 1, loop: true, position: { x: 0, y: 160 } },
            {
              id: "blend",
              name: "Blend",
              kind: "blend1d",
              parameterId: "speed",
              children: [
                { nodeId: "clip-idle", threshold: 0 },
                { nodeId: "clip-walk", threshold: 1 }
              ],
              position: { x: 320, y: 80 }
            },
            { id: "out", name: "Output", kind: "output", sourceNodeId: "blend", position: { x: 560, y: 80 } }
          ]
        }
      ],
      layers: [
        {
          id: "layer-base",
          name: "Base",
          graphId: "graph-main",
          weight: 1,
          blendMode: "override",
          rootMotionMode: "full",
          enabled: true
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.graph?.graphs[0]?.nodes[2]).toEqual({
      type: "blend1d",
      parameterIndex: 0,
      children: [
        { nodeIndex: 0, threshold: 0 },
        { nodeIndex: 1, threshold: 1 }
      ]
    });
  });

  it("reports diagnostics for missing references", () => {
    const result = compileAnimationEditorDocument({
      version: 1,
      name: "Broken",
      entryGraphId: "missing",
      parameters: [],
      clips: [],
      masks: [],
      graphs: [
        {
          id: "graph-main",
          name: "Main",
          outputNodeId: "out",
          edges: [],
          nodes: [
            { id: "clip-idle", name: "Idle", kind: "clip", clipId: "idle", speed: 1, loop: true, position: { x: 0, y: 0 } },
            { id: "out", name: "Output", kind: "output", sourceNodeId: "clip-idle", position: { x: 160, y: 0 } }
          ]
        }
      ],
      layers: [
        {
          id: "layer-base",
          name: "Base",
          graphId: "graph-main",
          weight: 1,
          blendMode: "override",
          rootMotionMode: "none",
          enabled: true
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes("missing clip"))).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes("Entry graph"))).toBe(true);
  });

  it("ignores disconnected invalid draft nodes during compilation", () => {
    const result = compileAnimationEditorDocument({
      version: 1,
      name: "Draft",
      entryGraphId: "graph-main",
      parameters: [
        { id: "speed", name: "speed", type: "float", defaultValue: 0 }
      ],
      clips: [
        { id: "idle", name: "Idle", duration: 1 }
      ],
      masks: [],
      graphs: [
        {
          id: "graph-main",
          name: "Main",
          outputNodeId: "out",
          edges: [],
          nodes: [
            { id: "clip-idle", name: "Idle", kind: "clip", clipId: "idle", speed: 1, loop: true, position: { x: 0, y: 0 } },
            { id: "blend-draft", name: "Draft Blend", kind: "blend1d", parameterId: "", children: [], position: { x: 240, y: 0 } },
            { id: "out", name: "Output", kind: "output", sourceNodeId: "clip-idle", position: { x: 160, y: 0 } }
          ]
        }
      ],
      layers: [
        {
          id: "layer-base",
          name: "Base",
          graphId: "graph-main",
          weight: 1,
          blendMode: "override",
          rootMotionMode: "none",
          enabled: true
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.graph?.graphs[0]?.nodes).toHaveLength(1);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === "warning" && diagnostic.message.includes("disconnected"))).toBe(true);
  });
});

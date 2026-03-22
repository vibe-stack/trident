import type { CopilotToolDeclaration } from "./types";

export const COPILOT_TOOL_DECLARATIONS: CopilotToolDeclaration[] = [
  {
    name: "get_document_summary",
    description: "Returns a compact summary of the current animation document, including counts and high-level ids.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_clips",
    description: "Lists imported clip metadata only: id, name, duration, and source. Does not return raw animation payloads.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_parameters",
    description: "Lists all animation parameters with ids, names, types, and defaults.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_layers",
    description: "Lists animation layers and their graph, blend, mask, and root-motion settings.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_masks",
    description: "Lists authored masks and their root/weight metadata.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_rig_summary",
    description: "Returns the imported rig summary, including bone count and bone names.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_graphs",
    description: "Lists graphs with ids, names, output nodes, node counts, and edge counts.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_graph_details",
    description: "Returns detailed metadata for a single graph, including node summaries, graph edges, and state-machine summaries.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string", description: "Graph id to inspect." }
      },
      required: ["graphId"]
    }
  },
  {
    name: "set_entry_graph",
    description: "Sets the document entry graph used as the default runtime entry point.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string", description: "Graph id to promote to entry graph." }
      },
      required: ["graphId"]
    }
  },
  {
    name: "add_graph",
    description: "Adds a new graph and optionally makes it the entry graph.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Human-readable graph name." },
        setAsEntry: { type: "boolean", description: "Whether to set the new graph as the entry graph." }
      }
    }
  },
  {
    name: "rename_graph",
    description: "Renames an existing graph.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        name: { type: "string" }
      },
      required: ["graphId", "name"]
    }
  },
  {
    name: "add_node",
    description: "Adds a node to a graph and optionally sets common and node-kind-specific properties.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        kind: { type: "string", enum: ["clip", "blend1d", "blend2d", "stateMachine", "subgraph"] },
        name: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        clipId: { type: "string" },
        speed: { type: "number" },
        loop: { type: "boolean" },
        inPlace: { type: "boolean" },
        parameterId: { type: "string" },
        xParameterId: { type: "string" },
        yParameterId: { type: "string" },
        subgraphId: { type: "string" }
      },
      required: ["graphId", "kind"]
    }
  },
  {
    name: "update_node",
    description: "Updates common node fields and safe node-kind-specific fields. Use connect_nodes for wiring and set_blend_children for blend thresholds or points.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        nodeId: { type: "string" },
        name: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        comment: { type: "string" },
        color: { type: "string" },
        collapsed: { type: "boolean" },
        clipId: { type: "string" },
        speed: { type: "number" },
        loop: { type: "boolean" },
        inPlace: { type: "boolean" },
        parameterId: { type: "string" },
        xParameterId: { type: "string" },
        yParameterId: { type: "string" },
        subgraphId: { type: "string" }
      },
      required: ["graphId", "nodeId"]
    }
  },
  {
    name: "connect_nodes",
    description: "Connects a source node to a target output or blend node, updating both semantic references and graph edges.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        sourceNodeId: { type: "string" },
        targetNodeId: { type: "string" }
      },
      required: ["graphId", "sourceNodeId", "targetNodeId"]
    }
  },
  {
    name: "set_blend_children",
    description: "Replaces the children list for a blend node. Use this after wiring nodes to assign exact thresholds or 2D sample coordinates.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        nodeId: { type: "string" },
        children: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              threshold: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              label: { type: "string" }
            },
            required: ["nodeId"]
          }
        }
      },
      required: ["graphId", "nodeId", "children"]
    }
  },
  {
    name: "delete_edges",
    description: "Deletes graph edges by id and disconnects semantic references where applicable.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        edgeIds: { type: "array", items: { type: "string" } }
      },
      required: ["graphId", "edgeIds"]
    }
  },
  {
    name: "delete_nodes",
    description: "Deletes specific graph nodes by id.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        nodeIds: { type: "array", items: { type: "string" } }
      },
      required: ["graphId", "nodeIds"]
    }
  },
  {
    name: "add_parameter",
    description: "Adds a new animation parameter.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["float", "int", "bool", "trigger"] },
        defaultValue: { type: ["number", "boolean"] }
      },
      required: ["name", "type"]
    }
  },
  {
    name: "update_parameter",
    description: "Updates an existing parameter.",
    parameters: {
      type: "object",
      properties: {
        parameterId: { type: "string" },
        name: { type: "string" },
        type: { type: "string", enum: ["float", "int", "bool", "trigger"] },
        defaultValue: { type: ["number", "boolean"] }
      },
      required: ["parameterId"]
    }
  },
  {
    name: "add_layer",
    description: "Adds a new animation layer.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        graphId: { type: "string" },
        weight: { type: "number" },
        blendMode: { type: "string", enum: ["override", "additive"] },
        maskId: { type: "string" },
        rootMotionMode: { type: "string", enum: ["none", "full", "xz", "xz-yaw"] },
        enabled: { type: "boolean" }
      }
    }
  },
  {
    name: "update_layer",
    description: "Updates a layer's routing or blend settings.",
    parameters: {
      type: "object",
      properties: {
        layerId: { type: "string" },
        name: { type: "string" },
        graphId: { type: "string" },
        weight: { type: "number" },
        blendMode: { type: "string", enum: ["override", "additive"] },
        maskId: { type: "string" },
        rootMotionMode: { type: "string", enum: ["none", "full", "xz", "xz-yaw"] },
        enabled: { type: "boolean" }
      },
      required: ["layerId"]
    }
  },
  {
    name: "add_mask",
    description: "Adds a new bone mask.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        rootBoneName: { type: "string" },
        includeChildren: { type: "boolean" },
        weights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              boneName: { type: "string" },
              weight: { type: "number" }
            },
            required: ["boneName", "weight"]
          }
        }
      },
      required: ["name"]
    }
  },
  {
    name: "update_mask",
    description: "Updates an existing mask's root or explicit bone weights.",
    parameters: {
      type: "object",
      properties: {
        maskId: { type: "string" },
        name: { type: "string" },
        rootBoneName: { type: "string" },
        includeChildren: { type: "boolean" },
        weights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              boneName: { type: "string" },
              weight: { type: "number" }
            },
            required: ["boneName", "weight"]
          }
        }
      },
      required: ["maskId"]
    }
  },
  {
    name: "create_state",
    description: "Adds a state to a state machine node.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        name: { type: "string" },
        motionNodeId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        speed: { type: "number" },
        cycleOffset: { type: "number" },
        setAsEntry: { type: "boolean" }
      },
      required: ["graphId", "stateMachineNodeId", "name", "motionNodeId"]
    }
  },
  {
    name: "update_state",
    description: "Updates a state inside a state machine.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        stateId: { type: "string" },
        name: { type: "string" },
        motionNodeId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        speed: { type: "number" },
        cycleOffset: { type: "number" }
      },
      required: ["graphId", "stateMachineNodeId", "stateId"]
    }
  },
  {
    name: "delete_state",
    description: "Deletes a state from a state machine and removes transitions that target it.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        stateId: { type: "string" }
      },
      required: ["graphId", "stateMachineNodeId", "stateId"]
    }
  },
  {
    name: "set_state_machine_entry",
    description: "Sets the entry state for a state machine.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        stateId: { type: "string" }
      },
      required: ["graphId", "stateMachineNodeId", "stateId"]
    }
  },
  {
    name: "add_transition",
    description: "Adds a transition or any-state transition to a state machine.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        toStateId: { type: "string" },
        fromStateId: { type: "string" },
        anyState: { type: "boolean" },
        duration: { type: "number" },
        hasExitTime: { type: "boolean" },
        exitTime: { type: "number" },
        interruptionSource: { type: "string", enum: ["none", "current", "next", "both"] },
        conditions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              parameterId: { type: "string" },
              operator: { type: "string", enum: [">", ">=", "<", "<=", "==", "!=", "set"] },
              value: { type: ["number", "boolean"] }
            },
            required: ["parameterId", "operator"]
          }
        }
      },
      required: ["graphId", "stateMachineNodeId", "toStateId"]
    }
  },
  {
    name: "update_transition",
    description: "Updates a transition inside a state machine.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        transitionId: { type: "string" },
        anyState: { type: "boolean" },
        fromStateId: { type: "string" },
        toStateId: { type: "string" },
        duration: { type: "number" },
        hasExitTime: { type: "boolean" },
        exitTime: { type: "number" },
        interruptionSource: { type: "string", enum: ["none", "current", "next", "both"] },
        conditions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              parameterId: { type: "string" },
              operator: { type: "string", enum: [">", ">=", "<", "<=", "==", "!=", "set"] },
              value: { type: ["number", "boolean"] }
            },
            required: ["parameterId", "operator"]
          }
        }
      },
      required: ["graphId", "stateMachineNodeId", "transitionId"]
    }
  },
  {
    name: "delete_transition",
    description: "Deletes a transition from a state machine.",
    parameters: {
      type: "object",
      properties: {
        graphId: { type: "string" },
        stateMachineNodeId: { type: "string" },
        transitionId: { type: "string" },
        anyState: { type: "boolean" }
      },
      required: ["graphId", "stateMachineNodeId", "transitionId"]
    }
  },
  {
    name: "compile_document",
    description: "Compiles the current animation document and returns diagnostic summaries.",
    parameters: { type: "object", properties: {} }
  }
];
import type { ParameterDefinition } from "@ggez/anim-schema";
import type { StateMachineNode } from "./types";

function formatCondition(condition: StateMachineNode["transitions"][number]["conditions"][number], parameters: ParameterDefinition[]): string {
  const parameter = parameters.find((entry) => entry.id === condition.parameterId);
  const parameterName = parameter?.name ?? "Unbound";

  if (condition.operator === "set") {
    return `${parameterName} set`;
  }

  if (typeof condition.value === "boolean") {
    return `${parameterName} ${condition.operator} ${condition.value ? "true" : "false"}`;
  }

  return `${parameterName} ${condition.operator} ${condition.value ?? 0}`;
}

function StateFlowRow(props: {
  label: string;
  detail: string;
  tone?: "default" | "accent";
}) {
  return (
    <div className={props.tone === "accent" ? "rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-400/15" : "rounded-2xl bg-black/20 p-3 ring-1 ring-white/6"}>
      <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">{props.label}</div>
      <div className="mt-1 text-[12px] text-zinc-200">{props.detail}</div>
    </div>
  );
}

export function StateMachineOverview(props: {
  node: StateMachineNode;
  parameters: ParameterDefinition[];
}) {
  const entryState = props.node.states.find((state) => state.id === props.node.entryStateId);
  const transitionRows = props.node.transitions.map((transition) => {
    const fromName = props.node.states.find((state) => state.id === transition.fromStateId)?.name ?? "Missing state";
    const toName = props.node.states.find((state) => state.id === transition.toStateId)?.name ?? "Missing state";
    const summary = transition.conditions.length > 0 ? transition.conditions.map((condition) => formatCondition(condition, props.parameters)).join(" and ") : "No conditions";
    return { id: transition.id, label: `${fromName} to ${toName}`, detail: summary };
  });
  const anyStateRows = props.node.anyStateTransitions.map((transition) => {
    const toName = props.node.states.find((state) => state.id === transition.toStateId)?.name ?? "Missing state";
    const summary = transition.conditions.length > 0 ? transition.conditions.map((condition) => formatCondition(condition, props.parameters)).join(" and ") : "No conditions";
    return { id: transition.id, label: `Any State to ${toName}`, detail: summary };
  });

  return (
    <div className="space-y-3 rounded-[22px] bg-white/4 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium text-zinc-200">Flow Overview</div>
          <div className="mt-1 text-[11px] leading-5 text-zinc-500">This is a compact summary of the state machine. The editable controls live in the States and Transitions sections below.</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">States</div>
            <div className="mt-1 text-[13px] font-medium text-zinc-100">{props.node.states.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Links</div>
            <div className="mt-1 text-[13px] font-medium text-zinc-100">{props.node.transitions.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Any</div>
            <div className="mt-1 text-[13px] font-medium text-zinc-100">{props.node.anyStateTransitions.length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <StateFlowRow label="Entry State" detail={entryState?.name ?? "No entry state selected"} tone="accent" />
        <StateFlowRow label="Current Structure" detail={props.node.states.length > 0 ? props.node.states.map((state) => state.name).join(" / ") : "Add states to start authoring transitions"} />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium tracking-[0.01em] text-zinc-400">State Transitions</div>
        {transitionRows.length === 0 ? <div className="rounded-2xl bg-black/20 p-3 text-[11px] leading-5 text-zinc-500">No direct state-to-state transitions yet.</div> : null}
        {transitionRows.map((row) => (
          <StateFlowRow key={row.id} label={row.label} detail={row.detail} />
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium tracking-[0.01em] text-zinc-400">Any State</div>
        {anyStateRows.length === 0 ? <div className="rounded-2xl bg-black/20 p-3 text-[11px] leading-5 text-zinc-500">No Any State shortcuts configured.</div> : null}
        {anyStateRows.map((row) => (
          <StateFlowRow key={row.id} label={row.label} detail={row.detail} />
        ))}
      </div>
    </div>
  );
}

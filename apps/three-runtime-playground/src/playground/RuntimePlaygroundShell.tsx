import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, FileUp, Pause, Play, ScrollText, Settings2, Square, X } from "lucide-react";
import { SYSTEM_OPTIONS } from "./constants";
import type { PanelSection, PlaygroundControls, StageStats, ToolbarAction } from "./types";

type RuntimePlaygroundShellProps = {
  controls: PlaygroundControls;
  error?: string;
  panel: PanelSection;
  stage: ReactNode;
  stageStats: StageStats;
  status: string;
};

export function RuntimePlaygroundShell({
  controls,
  error,
  panel,
  stage,
  stageStats,
  status
}: RuntimePlaygroundShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(89,116,129,0.16),_transparent_28%),linear-gradient(180deg,_#11161b_0%,_#0b1015_100%)] text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />
      <main className="relative z-10 flex min-h-screen flex-1">
        <section className="relative flex-1">
          <TopBar controls={controls} />
          <div className="absolute inset-0">{stage}</div>
          {error ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 mx-auto max-w-3xl rounded-2xl border border-rose-400/30 bg-rose-950/85 px-4 py-3 text-sm text-rose-100 shadow-[0_20px_80px_rgba(40,4,4,0.45)] backdrop-blur">
              {error}
            </div>
          ) : null}
        </section>
        <RuntimeSidebar
          drawerOpen={drawerOpen}
          logOpen={logOpen}
          onToggleDrawer={() => setDrawerOpen((current) => !current)}
          onToggleLog={() => setLogOpen((current) => !current)}
          panel={panel}
          stageStats={stageStats}
          status={status}
        />
      </main>
    </div>
  );
}

function TopBar({ controls }: { controls: PlaygroundControls }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/62 p-1 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-md">
        {controls.toolbarActions.map((action) => (
          <button
            className={
              action.tone === "primary"
                ? "flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/14 px-3 py-1.5 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/20"
                : `flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    action.active
                      ? "border-emerald-300/35 bg-emerald-300/14 text-emerald-50"
                      : "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                  }`
            }
            key={action.label}
            onClick={action.onClick}
            type="button"
          >
            <ToolbarIcon action={action} />
            <span>{action.label}</span>
          </button>
        ))}
        <input
          accept=".zip,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              controls.onFileSelected(file);
            }

            event.target.value = "";
          }}
          ref={controls.fileInputRef}
          type="file"
        />
      </div>
    </header>
  );
}

function RuntimeSidebar({
  drawerOpen,
  logOpen,
  onToggleDrawer,
  onToggleLog,
  panel,
  stageStats,
  status
}: {
  drawerOpen: boolean;
  logOpen: boolean;
  onToggleDrawer: () => void;
  onToggleLog: () => void;
  panel: PanelSection;
  stageStats: StageStats;
  status: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center">
      <motion.button
        animate={drawerOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
        aria-label="Show runtime panel"
        className="pointer-events-auto absolute right-0 flex h-15 w-8 items-center justify-center rounded-l-2xl border border-r-0 border-white/10 bg-slate-950/78 text-slate-200 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-slate-900/90"
        onClick={onToggleDrawer}
        style={{ pointerEvents: drawerOpen ? "none" : "auto" }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </motion.button>
      <AnimatePresence initial={false}>
        {drawerOpen ? (
          <motion.aside
            animate={{ opacity: 1, x: 0 }}
            className="pointer-events-auto mr-0 w-[18rem] overflow-hidden rounded-l-2xl border border-r-0 border-white/10 bg-slate-950/80 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur"
            exit={{ opacity: 0, x: 24 }}
            initial={{ opacity: 0, x: 24 }}
            transition={{ damping: 26, stiffness: 280, type: "spring" }}
          >
            <div className="border-b border-white/8 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-white">
                  <Settings2 className="h-4 w-4 text-cyan-200" />
                  <span className="text-sm font-medium">Runtime</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className={`rounded-full border px-2 py-1 text-[11px] transition ${
                      logOpen ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50" : "border-white/10 bg-white/[0.04] text-slate-300"
                    }`}
                    onClick={onToggleLog}
                    type="button"
                  >
                    <span className="flex items-center gap-1">
                      <ScrollText className="h-3.5 w-3.5" />
                      Log
                    </span>
                  </button>
                  <button
                    aria-label="Hide runtime panel"
                    className="rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-slate-300 transition hover:bg-white/[0.08]"
                    onClick={onToggleDrawer}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-4 px-3 py-3">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="State" value={panel.playbackLabel} />
                <MiniStat label="Status" value={status} />
                <MiniStat label="Meshes" value={String(stageStats.meshes)} />
                <MiniStat label="Nodes" value={String(stageStats.nodes)} />
              </div>
              <section className="space-y-2">
                <SectionHeading eyebrow="Gameplay" title="Systems" />
                <div className="space-y-1.5">
                  {SYSTEM_OPTIONS.map((system) => (
                    <SystemToggle
                      checked={panel.systemState[system.key]}
                      key={system.key}
                      label={system.label}
                      onCheckedChange={(enabled) => panel.onToggleSystem(system.key, enabled)}
                    />
                  ))}
                </div>
              </section>
              <AnimatePresence initial={false}>
                {logOpen ? (
                  <motion.section
                    animate={{ height: "auto", opacity: 1 }}
                    className="space-y-2 overflow-hidden"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <SectionHeading eyebrow="Telemetry" title="Event Log" />
                    <div className="max-h-52 space-y-1.5 overflow-y-auto">
                      {panel.eventLog.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-400">
                          No runtime events yet.
                        </div>
                      ) : (
                        panel.eventLog.map((entry) => (
                          <div
                            className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2 font-mono text-[11px] text-slate-200"
                            key={entry}
                          >
                            {entry}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.section>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{title}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2">
      <div className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-medium text-white">{value}</div>
    </div>
  );
}

function SystemToggle({
  checked,
  label,
  onCheckedChange
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2 text-xs text-slate-100">
      <span>{label}</span>
      <button
        aria-pressed={checked}
        className={`relative h-6 w-10 rounded-full border transition ${checked ? "border-cyan-300/45 bg-cyan-300/20" : "border-white/10 bg-white/10"}`}
        onClick={(event) => {
          event.preventDefault();
          onCheckedChange(!checked);
        }}
        type="button"
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

function ToolbarIcon({ action }: { action: ToolbarAction }) {
  if (action.icon === "import") {
    return <FileUp className="h-3.5 w-3.5" />;
  }

  if (action.icon === "pause") {
    return <Pause className="h-3.5 w-3.5" />;
  }

  if (action.icon === "stop") {
    return <Square className="h-3.5 w-3.5" />;
  }

  return <Play className="h-3.5 w-3.5" />;
}

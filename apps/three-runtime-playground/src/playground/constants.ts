import type { EnabledSystemKey } from "./types";

export const SYSTEM_OPTIONS: Array<{ key: EnabledSystemKey; label: string }> = [
  { key: "trigger", label: "Trigger" },
  { key: "sequence", label: "Sequence" },
  { key: "openable", label: "Openable" },
  { key: "mover", label: "Mover" },
  { key: "pathMover", label: "Path Mover" }
];

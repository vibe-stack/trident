import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import type { CodexModelId, CopilotSettings } from "@/lib/copilot/types";
import { loadCopilotSettings, saveCopilotSettings } from "@/lib/copilot/settings";

type CodexStatus = { available: boolean; version?: string; error?: string } | null;

export function CopilotSettingsDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<CopilotSettings>(loadCopilotSettings);
  const [codexStatus, setCodexStatus] = useState<CodexStatus>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSettings(loadCopilotSettings());
    void fetchCodexStatus();
  }, [open]);

  async function fetchCodexStatus() {
    try {
      const response = await fetch("/api/codex/status");
      setCodexStatus(await response.json());
    } catch {
      setCodexStatus({ available: false, error: "Could not check Codex status" });
    }
  }

  function handleSave() {
    saveCopilotSettings(settings);
    setOpen(false);
    onSaved?.();
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={<Button className="size-7 rounded-lg text-foreground/48 hover:text-foreground" size="icon-sm" variant="ghost" />}
      >
        <Settings className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="border-white/8 bg-[#091012]/96 shadow-[0_28px_96px_rgba(0,0,0,0.5)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Codex Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">Model</label>
            <select
              className="h-10 w-full rounded-xl border border-white/8 bg-[#0d1718]/92 px-3 text-sm text-foreground"
              disabled={!codexStatus?.available}
              onChange={(event) => setSettings({ codex: { model: event.target.value as CodexModelId } })}
              value={settings.codex.model}
            >
              <option value="gpt-5.4">GPT-5.4</option>
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
              <option value="gpt-5.1-codex-max">GPT-5.1 Codex Max</option>
              <option value="gpt-4.1">GPT-4.1</option>
              <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
              <option value="o3">o3</option>
              <option value="o4-mini">o4-mini</option>
              <option value="codex-mini-latest">Codex Mini</option>
            </select>
          </div>

          <div className="space-y-2">
            {codexStatus === null ? (
              <p className="text-[11px] text-foreground/40">Checking Codex CLI...</p>
            ) : codexStatus.available ? (
              <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                <CheckCircle className="size-3.5" />
                Codex CLI detected {codexStatus.version ? `(${codexStatus.version})` : ""}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] text-amber-300">
                  <AlertTriangle className="size-3.5" />
                  Codex CLI not found
                </div>
                <p className="text-[10px] text-foreground/36">Install with: npm install -g @openai/codex</p>
              </div>
            )}
            <p className="text-[10px] text-foreground/36">Codex uses your local login session. Run codex login in your terminal to authenticate.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button className="rounded-xl" onClick={() => setOpen(false)} size="sm" variant="ghost">
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={handleSave} size="sm">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState } from "react";
import { Settings, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import type { CopilotSettings, CopilotModelId } from "@/lib/copilot/types";
import { loadCopilotSettings, saveCopilotSettings } from "@/lib/copilot/settings";

export function CopilotSettingsDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<CopilotSettings>(loadCopilotSettings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setSettings(loadCopilotSettings());
    }
  }, [open]);

  const handleSave = () => {
    saveCopilotSettings(settings);
    setOpen(false);
    onSaved?.();
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button className="size-7 rounded-lg text-foreground/48 hover:text-foreground" size="icon-sm" variant="ghost" />
        }
      >
        <Settings className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0a1510] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copilot Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">
              API Key
            </label>
            <div className="relative">
              <Input
                className="h-10 rounded-xl border-white/10 bg-white/[0.045] pr-10 text-sm font-mono"
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="Enter your Gemini API key"
                type={showKey ? "text" : "password"}
                value={settings.apiKey}
              />
              <Button
                className="absolute right-1 top-1 size-8 rounded-lg text-foreground/48"
                onClick={() => setShowKey(!showKey)}
                size="icon-sm"
                variant="ghost"
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-foreground/36">
              Stored locally in your browser. Never sent to our servers.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">
              Model
            </label>
            <select
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm text-foreground"
              onChange={(e) => setSettings({ ...settings, model: e.target.value as CopilotModelId })}
              value={settings.model}
            >
              <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">
              Temperature ({settings.temperature.toFixed(1)})
            </label>
            <input
              className="w-full accent-emerald-400"
              max={1}
              min={0}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              step={0.1}
              type="range"
              value={settings.temperature}
            />
            <div className="flex justify-between text-[10px] text-foreground/36">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              className="rounded-xl"
              onClick={() => setOpen(false)}
              size="sm"
              variant="ghost"
            >
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

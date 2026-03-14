import type { CopilotSettings } from "./types";

const STORAGE_KEY = "web-hammer:copilot";

const DEFAULT_SETTINGS: CopilotSettings = {
  apiKey: "",
  model: "gemini-3-flash-preview",
  temperature: 0.3
};

export function loadCopilotSettings(): CopilotSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<CopilotSettings>;

    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : DEFAULT_SETTINGS.apiKey,
      model:
        parsed.model === "gemini-3-flash-preview" || parsed.model === "gemini-3.1-pro-preview"
          ? parsed.model
          : DEFAULT_SETTINGS.model,
      temperature:
        typeof parsed.temperature === "number" && parsed.temperature >= 0 && parsed.temperature <= 1
          ? parsed.temperature
          : DEFAULT_SETTINGS.temperature
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCopilotSettings(settings: CopilotSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function hasCopilotApiKey(): boolean {
  return loadCopilotSettings().apiKey.length > 0;
}

import type { AnyCopilotProvider, CopilotProviderId } from "./types";
import { createGeminiProvider } from "./gemini-provider";
import { createCodexProvider } from "./codex-provider";

export function createCopilotProvider(providerId: CopilotProviderId): AnyCopilotProvider {
  switch (providerId) {
    case "codex":
      return { kind: "session-based", provider: createCodexProvider() };
    default:
      return { kind: "request-response", provider: createGeminiProvider() };
  }
}

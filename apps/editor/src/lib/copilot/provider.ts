import type { CopilotProvider } from "./types";
import { createGeminiProvider } from "./gemini-provider";

export function createCopilotProvider(_providerId?: string): CopilotProvider {
  return createGeminiProvider();
}

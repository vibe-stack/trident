import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorCore } from "@web-hammer/editor-core";
import type { CopilotSession } from "@/lib/copilot/types";
import { runAgenticLoop } from "@/lib/copilot/agentic-loop";
import { createCopilotProvider } from "@/lib/copilot/provider";
import { buildSystemPrompt } from "@/lib/copilot/system-prompt";
import { loadCopilotSettings, hasCopilotApiKey } from "@/lib/copilot/settings";
import { COPILOT_TOOL_DECLARATIONS } from "@/lib/copilot/tool-declarations";
import { executeTool } from "@/lib/copilot/tool-executor";

const EMPTY_SESSION: CopilotSession = {
  messages: [],
  status: "idle",
  iterationCount: 0
};

export function useCopilot(editor: EditorCore) {
  const [session, setSession] = useState<CopilotSession>(EMPTY_SESSION);
  const [configured, setConfigured] = useState(hasCopilotApiKey);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const check = () => setConfigured(hasCopilotApiKey());
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const settings = loadCopilotSettings();

      if (!settings.apiKey) {
        setSession((prev) => ({
          ...prev,
          status: "error",
          error: "No API key configured. Open Copilot settings to add one."
        }));
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const provider = createCopilotProvider();
      const systemPrompt = buildSystemPrompt(editor);

      await runAgenticLoop(
        prompt,
        session.messages,
        {
          maxIterations: 25,
          provider,
          providerConfig: {
            apiKey: settings.apiKey,
            model: settings.model,
            temperature: settings.temperature
          },
          systemPrompt,
          tools: COPILOT_TOOL_DECLARATIONS,
          executeTool: (toolCall) => executeTool(editor, toolCall),
          onUpdate: (updated) => {
            setSession({ ...updated, messages: [...updated.messages] });
          }
        },
        controller.signal
      );

      abortRef.current = null;
    },
    [editor, session.messages]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSession(EMPTY_SESSION);
  }, []);

  return {
    session,
    sendMessage,
    abort,
    clearHistory,
    isConfigured: configured,
    refreshConfigured: () => setConfigured(hasCopilotApiKey())
  };
}

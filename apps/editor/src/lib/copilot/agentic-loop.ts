import type {
  CopilotMessage,
  CopilotProvider,
  CopilotProviderConfig,
  CopilotSession,
  CopilotToolCall,
  CopilotToolDeclaration,
  CopilotToolResult
} from "./types";

export type AgenticLoopConfig = {
  maxIterations: number;
  provider: CopilotProvider;
  providerConfig: CopilotProviderConfig;
  systemPrompt: string;
  tools: CopilotToolDeclaration[];
  executeTool: (call: CopilotToolCall) => CopilotToolResult;
  onUpdate: (session: CopilotSession) => void;
};

function uid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TAG = "[AI-VIBE]";

export async function runAgenticLoop(
  userPrompt: string,
  existingMessages: CopilotMessage[],
  config: AgenticLoopConfig,
  signal?: AbortSignal
): Promise<CopilotSession> {
  console.group(`${TAG} Session start`);
  console.log(`${TAG} User prompt:`, userPrompt);
  console.log(`${TAG} Model:`, config.providerConfig.model);
  console.log(`${TAG} Temperature:`, config.providerConfig.temperature);
  console.log(`${TAG} Tools available:`, config.tools.map((t) => t.name));
  console.log(`${TAG} System prompt:\n`, config.systemPrompt);
  console.log(`${TAG} Existing messages:`, existingMessages.length);
  console.groupEnd();

  const messages: CopilotMessage[] = [
    ...existingMessages,
    {
      id: uid(),
      role: "user",
      content: userPrompt,
      timestamp: Date.now()
    }
  ];

  const session: CopilotSession = {
    messages,
    status: "thinking",
    iterationCount: 0
  };

  config.onUpdate({ ...session, messages: [...messages] });

  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    if (signal?.aborted) {
      console.log(`${TAG} Aborted at iteration ${iteration + 1}`);
      session.status = "aborted";
      config.onUpdate({ ...session, messages: [...messages] });
      return session;
    }

    session.status = "thinking";
    session.iterationCount = iteration + 1;
    config.onUpdate({ ...session, messages: [...messages] });

    console.group(`${TAG} Iteration ${iteration + 1}`);
    console.log(`${TAG} Sending ${messages.length} messages to LLM...`);

    let response;

    try {
      const t0 = performance.now();
      response = await config.provider.generateContent(
        messages,
        config.tools,
        config.systemPrompt,
        config.providerConfig,
        signal
      );
      const elapsed = Math.round(performance.now() - t0);
      console.log(`${TAG} LLM responded in ${elapsed}ms`);
    } catch (error) {
      console.error(`${TAG} LLM error:`, error);
      console.groupEnd();

      if (error instanceof DOMException && error.name === "AbortError") {
        session.status = "aborted";
        config.onUpdate({ ...session, messages: [...messages] });
        return session;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown API error";
      session.status = "error";
      session.error = errorMessage;
      config.onUpdate({ ...session, messages: [...messages] });
      return session;
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      console.log(`${TAG} Final text response:`, response.text);
      console.groupEnd();

      messages.push({
        id: uid(),
        role: "assistant",
        content: response.text,
        rawParts: response.rawParts,
        timestamp: Date.now()
      });
      session.status = "idle";
      session.messages = messages;
      config.onUpdate({ ...session, messages: [...messages] });
      return session;
    }

    console.log(`${TAG} Text:`, response.text || "(none)");
    console.log(`${TAG} Tool calls (${response.toolCalls.length}):`);
    for (const tc of response.toolCalls) {
      console.log(`  ${TAG} → ${tc.name}`, JSON.stringify(tc.args, null, 2));
    }

    messages.push({
      id: uid(),
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
      rawParts: response.rawParts,
      timestamp: Date.now()
    });

    session.status = "executing";
    config.onUpdate({ ...session, messages: [...messages] });

    const toolResults: CopilotToolResult[] = [];

    for (const toolCall of response.toolCalls) {
      if (signal?.aborted) {
        console.log(`${TAG} Aborted during tool execution`);
        console.groupEnd();
        session.status = "aborted";
        config.onUpdate({ ...session, messages: [...messages] });
        return session;
      }

      const t0 = performance.now();
      const result = config.executeTool(toolCall);
      const elapsed = Math.round(performance.now() - t0);

      const parsed = JSON.parse(result.result);
      if (parsed.success === false) {
        console.warn(`  ${TAG} ✗ ${toolCall.name} FAILED (${elapsed}ms):`, parsed.error);
      } else {
        console.log(`  ${TAG} ✓ ${toolCall.name} (${elapsed}ms):`, result.result);
      }

      toolResults.push(result);
    }

    messages.push({
      id: uid(),
      role: "tool",
      content: "",
      toolResults,
      timestamp: Date.now()
    });

    console.groupEnd();
    config.onUpdate({ ...session, messages: [...messages] });
  }

  console.warn(`${TAG} Hit max iterations (${config.maxIterations})`);

  messages.push({
    id: uid(),
    role: "assistant",
    content: "Reached maximum iterations. Stopping here.",
    timestamp: Date.now()
  });

  session.status = "idle";
  session.messages = messages;
  config.onUpdate({ ...session, messages: [...messages] });
  return session;
}

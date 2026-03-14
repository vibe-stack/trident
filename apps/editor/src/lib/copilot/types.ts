export type CopilotModelId = "gemini-3-flash-preview" | "gemini-3.1-pro-preview";

export type CopilotSettings = {
  apiKey: string;
  model: CopilotModelId;
  temperature: number;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: CopilotToolCall[];
  toolResults?: CopilotToolResult[];
  /** Raw provider response parts — preserved verbatim for thought signatures */
  rawParts?: unknown[];
  timestamp: number;
};

export type CopilotToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type CopilotToolResult = {
  callId: string;
  name: string;
  result: string;
};

export type CopilotToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type CopilotProviderConfig = {
  apiKey: string;
  model: string;
  temperature: number;
};

export type CopilotResponse = {
  text: string;
  toolCalls: CopilotToolCall[];
  /** Raw parts from the model response, preserved for thought signatures */
  rawParts: unknown[];
};

export type CopilotSessionStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "error"
  | "aborted";

export type CopilotSession = {
  messages: CopilotMessage[];
  status: CopilotSessionStatus;
  error?: string;
  iterationCount: number;
};

export type CopilotProvider = {
  generateContent(
    messages: CopilotMessage[],
    tools: CopilotToolDeclaration[],
    systemPrompt: string,
    config: CopilotProviderConfig,
    signal?: AbortSignal
  ): Promise<CopilotResponse>;
};

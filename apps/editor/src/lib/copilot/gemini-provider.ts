import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import type {
  CopilotMessage,
  CopilotProvider,
  CopilotProviderConfig,
  CopilotResponse,
  CopilotToolCall,
  CopilotToolDeclaration
} from "./types";

function convertMessages(messages: CopilotMessage[]) {
  const contents: Record<string, unknown>[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      // Replay raw parts verbatim to preserve thoughtSignature
      if (message.rawParts && message.rawParts.length > 0) {
        contents.push({ role: "model", parts: message.rawParts });
      } else {
        const parts: Record<string, unknown>[] = [];

        if (message.content) {
          parts.push({ text: message.content });
        }

        if (message.toolCalls) {
          for (const tc of message.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.args } });
          }
        }

        if (parts.length > 0) {
          contents.push({ role: "model", parts });
        }
      }
    } else if (message.role === "tool" && message.toolResults) {
      const parts = message.toolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: JSON.parse(tr.result) as Record<string, unknown>
        }
      }));

      contents.push({ role: "user", parts });
    }
  }

  return contents;
}

function convertToolDeclarations(tools: CopilotToolDeclaration[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

export function createGeminiProvider(): CopilotProvider {
  return {
    async generateContent(
      messages: CopilotMessage[],
      tools: CopilotToolDeclaration[],
      systemPrompt: string,
      config: CopilotProviderConfig,
      signal?: AbortSignal
    ): Promise<CopilotResponse> {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const contents = convertMessages(messages);

      const response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: config.temperature,
          tools: [{ functionDeclarations: convertToolDeclarations(tools) }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO
            }
          }
        }
      });

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Extract raw parts from the response to preserve thoughtSignature
      const rawParts: unknown[] =
        (response.candidates?.[0]?.content?.parts as unknown[]) ?? [];

      const toolCalls: CopilotToolCall[] = [];
      const functionCalls = response.functionCalls;

      if (functionCalls) {
        for (const fc of functionCalls) {
          toolCalls.push({
            id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: fc.name ?? "",
            args: (fc.args as Record<string, unknown>) ?? {}
          });
        }
      }

      return {
        text: response.text ?? "",
        toolCalls,
        rawParts
      };
    }
  };
}

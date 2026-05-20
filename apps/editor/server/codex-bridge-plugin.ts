import { spawn, execSync, type ChildProcess } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { WebSocketServer, type WebSocket } from "ws";

type CodexSession = {
  process: ChildProcess;
  readline: ReadlineInterface;
  ws: WebSocket;
  requestId: number;
  pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
  pendingToolCalls: Map<number, { resolve: (value: unknown) => void }>;
  threadId?: string;
  agentText: string;
};

export function createCodexBridgePlugin(): Plugin {
  return {
    name: "codex-bridge",
    configureServer(server) {
      registerCodexStatusApi(server);
      registerCodexWebSocket(server);
    },
    configurePreviewServer(server) {
      registerCodexStatusApi(server);
      registerCodexWebSocket(server);
    }
  };
}

// ── HTTP status endpoint ──────────────────────────────────────

function registerCodexStatusApi(server: Pick<ViteDevServer, "middlewares"> | Pick<PreviewServer, "middlewares">) {
  server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split("?")[0] === "/api/codex/status") {
      const result = checkCodexAvailability();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    
    if (req.url?.split("?")[0] === "/api/codex/models") {
      const result = getCodexModels();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    next();
  });
}

function checkCodexAvailability(): { available: boolean; version?: string; error?: string } {
  // Ensure common binary paths are included (Homebrew, nvm, etc.)
  const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", `${process.env.HOME}/.local/bin`];
  const envPath = `${process.env.PATH}:${extraPaths.join(":")}`;

  try {
    const isWindows = process.platform === "win32";
    const bin = isWindows ? "codex.cmd" : "codex";
    const version = execSync(`${bin} --version`, {
      encoding: "utf-8",
      timeout: 5000,
      env: { ...process.env, PATH: envPath },
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return { available: true, version };
  } catch {
    return { available: false, error: "Codex CLI not found. Install with: npm install -g @openai/codex" };
  }
}

function getCodexModels(): { models: string[]; error?: string } {
  const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", `${process.env.HOME}/.local/bin`];
  const envPath = `${process.env.PATH}:${extraPaths.join(":")}`;
  try {
    const isWindows = process.platform === "win32";
    const bin = isWindows ? "codex.cmd" : "codex";
    const output = execSync(`${bin} models`, {
      encoding: "utf-8",
      timeout: 5000,
      env: { ...process.env, PATH: envPath },
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    
    try {
      const json = JSON.parse(output);
      if (Array.isArray(json)) return { models: json.map(m => typeof m === "string" ? m : (m.id || m.name || JSON.stringify(m))) };
    } catch {
      // Ignore JSON error
    }

    const models = output.split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.includes(" ") && !line.includes("Missing environment variable"));

    return { models };
  } catch (err: any) {
    return { models: [], error: err.message };
  }
}

// ── WebSocket bridge ──────────────────────────────────────────

function registerCodexWebSocket(server: Pick<ViteDevServer, "httpServer"> | Pick<PreviewServer, "httpServer">) {
  if (!server.httpServer) return;

  const httpServer = server.httpServer;

  if ((httpServer as { __ggezCodexBridgeRegistered?: boolean }).__ggezCodexBridgeRegistered) {
    return;
  }

  (httpServer as { __ggezCodexBridgeRegistered?: boolean }).__ggezCodexBridgeRegistered = true;

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws/codex") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    let session: CodexSession | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(ws, msg, session, (s) => { session = s; });
      } catch (error) {
        sendToClient(ws, { type: "error", message: "Invalid message format", fatal: false });
      }
    });

    ws.on("close", () => {
      if (session) {
        cleanupSession(session);
        session = null;
      }
    });
  });
}

async function handleClientMessage(
  ws: WebSocket,
  msg: { type: string; [key: string]: unknown },
  session: CodexSession | null,
  setSession: (s: CodexSession | null) => void
) {
  switch (msg.type) {
    case "start": {
      if (session) {
        cleanupSession(session);
      }

      try {
        const newSession = await startCodexSession(ws, msg as {
          type: "start";
          model: string;
          systemPrompt: string;
          threadId?: string;
          tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
          userMessage: string;
          projectPath?: string;
        });
        setSession(newSession);
      } catch (error) {
        sendToClient(ws, {
          type: "error",
          message: error instanceof Error ? error.message : "Failed to start Codex session",
          fatal: true
        });
      }
      break;
    }

    case "tool_result": {
      if (!session) return;
      const { id, result, success } = msg as { type: "tool_result"; id: string; result: string; success: boolean };
      const rpcId = parseInt(id, 10);
      const pending = session.pendingToolCalls.get(rpcId);

      if (pending) {
        session.pendingToolCalls.delete(rpcId);
        // Send JSON-RPC response back to codex
        const parsed = tryParseJson(result);
        sendToCodex(session, {
          id: rpcId,
          result: {
            contentItems: [{ type: "inputText", text: typeof parsed === "string" ? parsed : JSON.stringify(parsed) }],
            success
          }
        });
        pending.resolve(null);
      }
      break;
    }

    case "abort": {
      if (session) {
        cleanupSession(session);
        setSession(null);
      }
      break;
    }
  }
}

async function startCodexSession(
  ws: WebSocket,
  config: {
    model: string;
    systemPrompt: string;
    threadId?: string;
    tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    userMessage: string;
          projectPath?: string;
  }
): Promise<CodexSession> {
  sendToClient(ws, { type: "status", status: "connecting" });

  // Spawn codex app-server — extend PATH to find Homebrew/nvm binaries
  const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", `${process.env.HOME}/.local/bin`];
  const envPath = `${process.env.PATH}:${extraPaths.join(":")}`;
  
  const isWindows = process.platform === "win32";
  const bin = isWindows ? "codex.cmd" : "codex";

  const workingDir = config.projectPath || process.cwd();
  // Log for debugging
  console.log(`[codex-bridge] Spawning Codex with working directory: ${workingDir}`);
  
  const proc = spawn(bin, ["app-server"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PATH: envPath },
    cwd: workingDir,
    shell: isWindows
  });

  proc.on("error", (err) => {
    sendToClient(ws, {
      type: "error",
      message: `Failed to start Codex: ${err.message}`,
      fatal: true
    });
  });

  const readline = createInterface({ input: proc.stdout! });

  const session: CodexSession = {
    process: proc,
    readline,
    ws,
    requestId: 0,
    pendingRequests: new Map(),
    pendingToolCalls: new Map(),
    agentText: ""
  };

  // Set up stdio message handling
  readline.on("line", (line) => {
    console.log(`\n<========== [FROM CODEX] ==========\n${line.slice(0, 500)}${line.length > 500 ? '...' : ''}\n=================================\n`);
    try {
      const msg = JSON.parse(line);
      handleCodexMessage(session, msg);
    } catch {
      // It's not a JSON-RPC message, could be a log or an error from Codex
      console.log(`[codex app-server] ${line}`);
    }
  });

  if (proc.stderr) {
    proc.stderr.on("data", (data: Buffer | string) => {
      console.error(`[codex app-server error] ${data.toString()}`);
    });
  }

  proc.on("exit", (code) => {
    console.log(`[codex app-server] Process exited with code ${code}`);
    
    // Reject any pending JSON-RPC requests so startCodexSession doesn't hang forever
    for (const pending of session.pendingRequests.values()) {
      pending.reject(new Error(`Codex process exited with code ${code}`));
    }
    session.pendingRequests.clear();

    for (const pending of session.pendingToolCalls.values()) {
      pending.resolve(null);
    }
    session.pendingToolCalls.clear();

    if (ws.readyState === ws.OPEN) {
      sendToClient(ws, {
        type: "error",
        message: `Codex process exited with code ${code}`,
        fatal: true
      });
    }
  });

  // 1. Handshake
  await sendCodexRequest(session, "initialize", {
    clientInfo: { name: "trident-editor", title: "Trident Editor", version: "0.1.0" },
    capabilities: { experimentalApi: true }
  });
  sendToCodex(session, { method: "initialized", params: {} });

  // 2. Start thread with dynamic tools
  const dynamicTools = config.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));

  const threadResult = await sendCodexRequest(
    session,
    config.threadId ? "thread/resume" : "thread/start",
    {
      ...(config.threadId ? { threadId: config.threadId } : {}),
      ...(config.model ? { model: config.model } : {}),
      baseInstructions: config.systemPrompt,
      dynamicTools,
      serviceName: "trident-editor",
      // Undocumented / experimental attempts to override proxy loop limits
      maxIterations: 100,
      options: { maxIterations: 100, max_iterations: 100 }
    }
  ) as { thread?: { id?: string } };

  session.threadId = threadResult?.thread?.id;

  if (session.threadId) {
    sendToClient(ws, { type: "thread", threadId: session.threadId });
  }

  sendToClient(ws, { type: "status", status: "thinking" });

  // 3. Start turn with user message
  sendToCodex(session, {
    method: "turn/start",
    id: ++session.requestId,
    params: {
      threadId: session.threadId,
      input: [{ type: "text", text: config.userMessage }],
      // Undocumented / experimental attempts to override proxy loop limits
      maxIterations: 100,
      options: { maxIterations: 100, max_iterations: 100 }
    }
  });

  return session;
}

function handleCodexMessage(session: CodexSession, msg: { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown }) {
  // Handle responses to our requests
  if (msg.id !== undefined && !msg.method) {
    const pending = session.pendingRequests.get(msg.id);
    if (pending) {
      session.pendingRequests.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(JSON.stringify(msg.error)));
      } else {
        pending.resolve(msg.result);
      }
    }
    return;
  }

  // Handle server-to-client requests (need response)
    // DEBUG: Log full tool call message from Codex
    console.log(`
<========== [FROM CODEX - RAW MSG] ==========
${JSON.stringify(msg, null, 2)}
===========================================`);
  if (msg.id !== undefined && msg.method === "item/tool/call") {
    const params = msg.params as { callId: string; tool: string; arguments: Record<string, unknown> | string };
    // Parse arguments if they are a JSON string (Codex sometimes sends them as stringified JSON)
    let args: Record<string, unknown> = {};
    if (params.arguments) {
      if (typeof params.arguments === "string") {
        try {
          args = JSON.parse(params.arguments);
        } catch {
          console.error("[codex-bridge] Failed to parse tool arguments:", params.arguments);
          args = {};
        }
      } else if (typeof params.arguments === "object") {
        args = params.arguments as Record<string, unknown>;
      }
    }
    sendToClient(session.ws, {
      type: "tool_call",
      id: String(msg.id),
      name: params.tool,
      args
    });
    // Store pending tool call — will be resolved when browser sends tool_result
    session.pendingToolCalls.set(msg.id, { resolve: () => {} });
    return;
  }

  // Handle approval requests — auto-approve for now
  if (msg.id !== undefined && (msg.method === "item/commandExecution/requestApproval" || msg.method === "item/fileChange/requestApproval")) {
    sendToCodex(session, { id: msg.id, result: { decision: "accept" } });
    return;
  }

  // Handle notifications
  if (!msg.method) return;

  const params = msg.params as Record<string, unknown> | undefined;

  switch (msg.method) {
    case "item/agentMessage/delta": {
      const delta = (params as { delta?: string })?.delta;
      if (delta) {
        session.agentText += delta;
        sendToClient(session.ws, { type: "delta", text: delta });
      }
      break;
    }

    case "item/started": {
      const item = params?.item as { type?: string; tool?: string; id?: string } | undefined;
      if (item?.type === "dynamicToolCall") {
        sendToClient(session.ws, { type: "status", status: "executing" });
      }
      break;
    }

    case "item/completed": {
      const item = params?.item as { type?: string; tool?: string; id?: string; status?: string } | undefined;
      if (item?.type === "dynamicToolCall" && item.tool) {
        sendToClient(session.ws, {
          type: "tool_status",
          id: item.id ?? "",
          name: item.tool,
          status: item.status === "completed" ? "completed" : "failed"
        });
        sendToClient(session.ws, { type: "status", status: "thinking" });
      }
      break;
    }

    case "turn/completed": {
      sendToClient(session.ws, {
        type: "turn_complete",
        text: session.agentText
      });
      cleanupSession(session);
      break;
    }

    case "codex/event/agent_message": {
      const message = (params as { msg?: { message?: string } })?.msg?.message;
      if (message) {
        // If this CLI proxy sends the full message at once instead of streaming deltas
        session.agentText = message;
      }
      break;
    }

    case "codex/event/task_complete": {
      const lastMsg = (params as { msg?: { last_agent_message?: string } })?.msg?.last_agent_message;
      if (lastMsg) {
        session.agentText = lastMsg;
      }
      sendToClient(session.ws, {
        type: "turn_complete",
        text: session.agentText
      });
      cleanupSession(session);
      break;
    }

    case "codex/event/error": {
      const errorMsg = (params as { msg?: { message?: string } })?.msg?.message;
      if (errorMsg) {
        sendToClient(session.ws, {
          type: "error",
          message: `Codex Error: ${errorMsg}`,
          fatal: true
        });
        cleanupSession(session);
      }
      break;
    }

    case "turn/failed": {
      const turn = params?.turn as { error?: { message?: string } } | undefined;
      sendToClient(session.ws, {
        type: "error",
        message: turn?.error?.message ?? "Turn failed",
        fatal: true
      });
      cleanupSession(session);
      break;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function sendToCodex(session: CodexSession, msg: unknown) {
  const line = JSON.stringify(msg);
  console.log(`\n==========> [TO CODEX] ==========\n${line}\n=================================\n`);
  if (session.process.stdin?.writable) {
    session.process.stdin.write(line + "\n");
  }
}

function sendCodexRequest(session: CodexSession, method: string, params: Record<string, unknown>): Promise<unknown> {
  const id = ++session.requestId;
  return new Promise((resolve, reject) => {
    console.log(`[BRIDGE] Starting request id=${id} method=${method}`);
    session.pendingRequests.set(id, { resolve: (val) => {
      console.log(`[BRIDGE] Resolved request id=${id} method=${method}`);
      resolve(val);
    }, reject: (err) => {
      console.log(`[BRIDGE] Rejected request id=${id} method=${method} error=${err}`);
      reject(err);
    } });
    sendToCodex(session, { method, id, params });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (session.pendingRequests.has(id)) {
        session.pendingRequests.delete(id);
        reject(new Error(`Codex request ${method} timed out`));
      }
    }, 30000);
  });
}

function sendToClient(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function cleanupSession(session: CodexSession) {
  session.readline.close();
  if (!session.process.killed) {
    session.process.kill("SIGTERM");
    setTimeout(() => {
      if (!session.process.killed) {
        session.process.kill("SIGKILL");
      }
    }, 5000);
  }
  session.pendingRequests.forEach(({ reject }) => reject(new Error("Session closed")));
  session.pendingRequests.clear();
  session.pendingToolCalls.clear();
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

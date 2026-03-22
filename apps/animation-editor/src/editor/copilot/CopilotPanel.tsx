import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Square, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopilotSettingsDialog } from "./CopilotSettingsDialog";
import type { CopilotMessage, CopilotSession } from "@/lib/copilot/types";

type CopilotPanelProps = {
  onClose: () => void;
  onSendMessage: (prompt: string) => void;
  onAbort: () => void;
  onClearHistory: () => void;
  onSettingsChanged: () => void;
  session: CopilotSession;
  isConfigured: boolean;
};

export function CopilotPanel(props: CopilotPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isActive = props.session.status === "thinking" || props.session.status === "executing";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [props.session.messages, props.session.status]);

  function handleSubmit() {
    const prompt = input.trim();
    if (!prompt || isActive) {
      return;
    }

    setInput("");
    props.onSendMessage(prompt);
  }

  const visibleMessages = props.session.messages.filter((message) => message.role !== "tool");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/7 bg-[#091012]/88 shadow-[0_24px_80px_rgba(0,0,0,0.42)] ring-1 ring-white/7 backdrop-blur-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-white/8 bg-linear-to-r from-white/3 to-transparent px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">
          <Bot className="size-3.5 text-emerald-300" />
          Codex Graph
        </div>
        <div className="flex items-center gap-0.5">
          {props.session.messages.length > 0 ? (
            <Button className="size-7 rounded-lg text-foreground/48 hover:text-foreground" onClick={props.onClearHistory} size="icon-sm" variant="ghost">
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
          <CopilotSettingsDialog onSaved={props.onSettingsChanged} />
          <Button className="size-7 rounded-lg text-foreground/48 hover:text-foreground" onClick={props.onClose} size="icon-sm" variant="ghost">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-linear-to-b from-transparent via-transparent to-black/10 px-3 py-3" ref={scrollRef}>
        {visibleMessages.length === 0 && !isActive ? (
          <div className="flex h-full items-center justify-center">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/6 bg-white/3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <Bot className="size-6 text-foreground/22" />
              </div>
              <p className="text-xs leading-relaxed text-foreground/42">
                {props.isConfigured ? "Describe the animation graph you want to build." : "Configure Codex first."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isActive ? <ThinkingIndicator session={props.session} /> : null}
            {props.session.status === "error" && props.session.error ? (
              <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">{props.session.error}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/8 bg-black/10 p-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Textarea
              className="min-h-19 resize-none rounded-[22px] border-white/8 bg-[#0d1718]/92 px-3 py-2.5 text-xs leading-relaxed text-foreground placeholder:text-foreground/34 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/20"
              disabled={isActive || !props.isConfigured}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={props.isConfigured ? "Describe the graph you want. Press Cmd+Enter to send." : "Configure Codex first"}
              value={input}
            />
          </div>
          {isActive ? (
            <Button className="mb-5 size-10 shrink-0 rounded-2xl" onClick={props.onAbort} size="icon" variant="destructive">
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button className="mb-5 size-10 shrink-0 rounded-2xl bg-emerald-500 text-[#06100d] hover:bg-emerald-400" disabled={!input.trim() || !props.isConfigured} onClick={handleSubmit} size="icon">
              <Send className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[22px] rounded-br-md border border-emerald-300/12 bg-linear-to-br from-emerald-400/18 to-emerald-500/8 px-3 py-2 text-xs text-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {message.toolCalls?.length ? (
        <div className="flex flex-wrap gap-1">
          {message.toolCalls.map((toolCall) => (
            <div className="flex items-center gap-1 rounded-full border border-emerald-300/10 bg-[#0d1918] px-2 py-1 text-[9px] tracking-[0.08em] text-emerald-300/88 uppercase" key={toolCall.id}>
              <Wrench className="size-2" />
              {toolCall.name}
            </div>
          ))}
        </div>
      ) : null}
      {message.content ? <MarkdownContent content={message.content} /> : null}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className="copilot-markdown max-w-[95%] rounded-[22px] rounded-bl-md border border-white/6 bg-[#0d1718]/88 px-3 py-2 text-xs leading-relaxed text-foreground/74 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/^#### (.+)$/gm, '<h4 class="mt-2 mb-0.5 text-[11px] font-semibold text-foreground/82">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-2 mb-0.5 text-xs font-semibold text-foreground/86">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-2 mb-0.5 text-xs font-bold text-foreground/90">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-2 mb-0.5 text-[13px] font-bold text-foreground/94">$1</h1>');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => `<pre class="my-1 rounded-2xl border border-white/5 bg-black/22 px-2.5 py-2 text-[10px] leading-snug overflow-x-auto"><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code class="rounded-md border border-emerald-300/10 bg-emerald-400/8 px-1 py-px text-[10px] text-emerald-200">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground/88">$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/^[\-*] (.+)$/gm, '<li class="ml-3 list-disc">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal">$1</li>');
  html = html.replace(/((?:<li class="ml-3 list-decimal">.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>');
  html = html.replace(/\n\n+/g, '</p><p class="mt-1.5">');
  html = `<p>${html}</p>`;
  html = html.replace(/(?<!<\/pre>)\n(?!<)/g, "<br>");
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function ThinkingIndicator({ session }: { session: CopilotSession }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-1">
      <Loader2 className="size-3 animate-spin text-emerald-400" />
      <span className="text-[10px] text-foreground/48">
        {session.status === "executing" ? "Executing tools..." : `Thinking${session.iterationCount > 1 ? ` (step ${session.iterationCount})` : ""}...`}
      </span>
    </div>
  );
}
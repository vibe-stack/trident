import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Square, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopilotSettingsDialog } from "@/components/editor-shell/CopilotSettingsDialog";
import type { CopilotMessage, CopilotSession } from "@/lib/copilot/types";
import { cn } from "@/lib/utils";

type CopilotPanelProps = {
  onClose: () => void;
  onSendMessage: (prompt: string) => void;
  onAbort: () => void;
  onClearHistory: () => void;
  onSettingsChanged: () => void;
  session: CopilotSession;
  isConfigured: boolean;
};

export function CopilotPanel({
  onClose,
  onSendMessage,
  onAbort,
  onClearHistory,
  onSettingsChanged,
  session,
  isConfigured
}: CopilotPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = session.status === "thinking" || session.status === "executing";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages, session.status]);

  const handleSubmit = () => {
    const trimmed = input.trim();

    if (!trimmed || isActive) {
      return;
    }

    setInput("");
    onSendMessage(trimmed);
  };

  const visibleMessages = session.messages.filter((m) => m.role !== "tool");

  return (
    <div className="flex h-full flex-col border-l border-white/8 bg-[#08110e]/94 backdrop-blur-xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">
          <Bot className="size-3.5 text-emerald-400" />
          AI Vibe
        </div>
        <div className="flex items-center gap-0.5">
          {session.messages.length > 0 && (
            <Button
              className="size-7 rounded-lg text-foreground/48 hover:text-foreground"
              onClick={onClearHistory}
              size="icon-sm"
              title="Clear history"
              variant="ghost"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <CopilotSettingsDialog onSaved={onSettingsChanged} />
          <Button
            className="size-7 rounded-lg text-foreground/48 hover:text-foreground"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3" ref={scrollRef}>
        {visibleMessages.length === 0 && !isActive ? (
          <div className="flex h-full items-center justify-center">
            <div className="space-y-2 text-center">
              <Bot className="mx-auto size-8 text-foreground/20" />
              <p className="text-xs text-foreground/40">
                {isConfigured
                  ? "Describe what you want to build."
                  : "Configure your API key in settings to get started."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isActive && <ThinkingIndicator session={session} />}
            {session.status === "error" && session.error && (
              <div className="rounded-xl bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">
                {session.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/8 p-3">
        <div className="flex gap-2">
          <Input
            autoFocus
            className="h-9 flex-1 rounded-xl border-white/10 bg-white/[0.045] text-xs"
            disabled={isActive || !isConfigured}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={isConfigured ? "Describe what to build..." : "Set up API key first"}
            ref={inputRef}
            value={input}
          />
          {isActive ? (
            <Button
              className="size-9 shrink-0 rounded-xl"
              onClick={onAbort}
              size="icon"
              variant="destructive"
            >
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button
              className="size-9 shrink-0 rounded-xl"
              disabled={!input.trim() || !isConfigured}
              onClick={handleSubmit}
              size="icon"
            >
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
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-600/20 px-2.5 py-1.5 text-xs text-foreground/88">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.toolCalls.map((tc) => (
            <div
              className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300"
              key={tc.id}
            >
              <Wrench className="size-2" />
              {tc.name}
            </div>
          ))}
        </div>
      )}
      {message.content && <MarkdownContent content={message.content} />}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className="copilot-markdown max-w-[95%] rounded-2xl rounded-bl-md bg-white/[0.04] px-2.5 py-1.5 text-xs leading-relaxed text-foreground/72"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // headings
  html = html.replace(/^#### (.+)$/gm, '<h4 class="mt-2 mb-0.5 text-[11px] font-semibold text-foreground/80">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-2 mb-0.5 text-xs font-semibold text-foreground/85">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-2 mb-0.5 text-xs font-bold text-foreground/90">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-2 mb-0.5 text-[13px] font-bold text-foreground/92">$1</h1>');

  // code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="my-1 rounded-lg bg-white/[0.06] px-2 py-1.5 text-[10px] leading-snug overflow-x-auto"><code>${code.trim()}</code></pre>`
  );

  // inline code
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-white/[0.08] px-1 py-px text-[10px] text-emerald-200">$1</code>');

  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground/88">$1</strong>');

  // italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-3 list-disc">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>');

  // ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal">$1</li>');
  html = html.replace(/((?:<li class="ml-3 list-decimal">.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>');

  // paragraphs (double newlines)
  html = html.replace(/\n\n+/g, '</p><p class="mt-1.5">');
  html = `<p>${html}</p>`;

  // single newlines to <br> (but not inside pre)
  html = html.replace(/(?<!<\/pre>)\n(?!<)/g, "<br>");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ThinkingIndicator({ session }: { session: CopilotSession }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Loader2 className="size-3 animate-spin text-emerald-400" />
      <span className="text-[10px] text-foreground/48">
        {session.status === "executing"
          ? "Executing tools..."
          : `Thinking${session.iterationCount > 1 ? ` (step ${session.iterationCount})` : ""}...`}
      </span>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AiMessage {
  id: string;
  role: "user" | "model";
  content: string;
  createdAt: number;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const data = await fetchApi<{ reply: string }>("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const aiMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: "model",
        content: data.reply,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      toast({
        title: "AI error",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [input, isLoading, messages, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-14 sm:h-16 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm leading-tight">VaultBot</p>
            <p className="text-xs text-muted-foreground leading-tight">AI Assistant · Powered by Gemini</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={clearHistory}
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 gap-4">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-600/10 border border-violet-500/20 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-violet-500/60" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Ask VaultBot anything</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Your private AI assistant. Ask questions, get help with writing, coding, analysis, and more.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                "Summarize my ideas",
                "Write a message for me",
                "Explain something",
                "Help me plan",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-3xl",
                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm max-w-[80vw] md:max-w-xl whitespace-pre-wrap break-words shadow-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/60 text-foreground rounded-tl-sm border border-border/40"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border/50 bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-end gap-2 bg-muted/30 rounded-xl p-2 border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all max-w-3xl">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask VaultBot anything..."
            className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 px-2 py-2.5 shadow-none flex-1"
            disabled={isLoading}
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 border-0 shadow-sm transition-all"
            disabled={!input.trim() || isLoading}
            onClick={send}
            title="Send to AI"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Powered by Google Gemini · Conversations are not stored
        </p>
      </div>
    </div>
  );
}

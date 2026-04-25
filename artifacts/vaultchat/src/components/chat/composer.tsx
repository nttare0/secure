import { useState, useRef } from "react";
import { useSendMessage } from "@/hooks/use-messages";
import { useSendDm } from "@/hooks/use-dms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  File as FileIcon,
  Loader2,
  Shield,
  Reply,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/hooks/use-messages";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export type ComposerTarget =
  | { type: "room"; id: number }
  | { type: "dm"; userId: number };

interface ComposerProps {
  target: ComposerTarget;
  replyTo?: Message | null;
  onClearReply?: () => void;
}

export function Composer({ target, replyTo, onClearReply }: ComposerProps) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sendMessage = useSendMessage();
  const sendDm = useSendDm();
  const isPending = target.type === "room" ? sendMessage.isPending : sendDm.isPending;

  const handleSend = () => {
    if (!content.trim() && !file) return;

    if (file && file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 100MB.",
        variant: "destructive",
      });
      return;
    }

    const handlers = {
      onSuccess: () => {
        setContent("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onClearReply?.();
      },
      onError: (err: Error) => {
        toast({
          title: "Failed to send message",
          description: err.message,
          variant: "destructive",
        });
      },
    };

    if (target.type === "room") {
      sendMessage.mutate(
        {
          roomId: target.id,
          content: content.trim(),
          file: file || undefined,
          replyToId: replyTo?.id,
        },
        handlers,
      );
    } else {
      sendDm.mutate(
        {
          userId: target.userId,
          content: content.trim(),
          file: file || undefined,
          replyToId: replyTo?.id,
        },
        handlers,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setFile(f);
    }
  };

  return (
    <div className="p-4 bg-background border-t border-border/50">
      {replyTo && (
        <div className="mb-3 flex items-start gap-3 bg-muted/50 p-2 pl-3 rounded-lg border border-border/50 max-w-2xl border-l-2 border-l-primary">
          <Reply className="h-4 w-4 text-primary shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">Replying to {replyTo.username}</p>
            <p className="text-sm truncate text-foreground/80">
              {replyTo.content || (replyTo.attachment ? `📎 ${replyTo.attachment.originalName}` : "")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onClearReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {file && (
        <div className="mb-3 flex items-center gap-3 bg-muted/50 p-2 rounded-lg border border-border/50 max-w-md">
          <div className="h-10 w-10 bg-background rounded border border-border flex items-center justify-center shrink-0">
            {file.type.startsWith("image/") ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <FileIcon className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-muted/30 rounded-xl p-2 border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || !!file}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a secure message..."
          className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 px-2 py-2.5 shadow-none"
          disabled={isPending}
          rows={1}
        />

        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-lg transition-all shadow-sm"
          disabled={(!content.trim() && !file) || isPending}
          onClick={handleSend}
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
      <div className="flex justify-between items-center mt-2 px-2">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" /> End-to-end encrypted · Up to 100MB
        </p>
        <p className="text-[10px] text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

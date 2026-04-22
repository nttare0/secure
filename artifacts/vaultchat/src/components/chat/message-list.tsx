import { useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Message } from "@/hooks/use-messages";
import { format } from "date-fns";
import { Download, File as FileIcon, Shield } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const { data: user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background/50">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Secure Connection Established</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          This room is empty. Send a message to start the conversation. 
          All communication is private and secure.
        </p>
      </div>
    );
  }

  // Sort messages newest at bottom (they come newest first from API)
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let currentDate = "";

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background">
      {sortedMessages.map((msg, i) => {
        const isMe = msg.userId === user?.id;
        const msgDate = format(new Date(msg.createdAt), "MMM d, yyyy");
        const showDate = msgDate !== currentDate;
        currentDate = msgDate;
        
        // Check if previous message was from same user within last 5 mins
        const prevMsg = i > 0 ? sortedMessages[i - 1] : null;
        const isConsecutive = prevMsg && 
          prevMsg.userId === msg.userId && 
          !showDate &&
          (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000);

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex justify-center my-6">
                <div className="bg-muted/50 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground border border-border/50">
                  {msgDate}
                </div>
              </div>
            )}
            
            <div className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start", isConsecutive ? "mt-1" : "mt-4")}>
              {!isConsecutive && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isMe && <span className="text-xs font-semibold text-foreground/80">{msg.username}</span>}
                  <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdAt), "h:mm a")}</span>
                </div>
              )}
              
              <div className={cn(
                "px-4 py-2.5 rounded-2xl relative group",
                isMe 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-muted text-foreground rounded-tl-sm border border-border/50"
              )}>
                {msg.content && (
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{msg.content}</p>
                )}
                
                {msg.attachment && (
                  <div className={cn("mt-2 overflow-hidden", msg.content ? "pt-2 border-t border-current/10" : "")}>
                    {msg.attachment.mimeType.startsWith('image/') ? (
                      <a href={`${API_BASE}/uploads/${msg.attachment.filename}`} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-current/10">
                        <img 
                          src={`${API_BASE}/uploads/${msg.attachment.filename}`} 
                          alt={msg.attachment.originalName} 
                          className="max-w-full max-h-[300px] object-cover"
                        />
                      </a>
                    ) : (
                      <a 
                        href={`${API_BASE}/uploads/${msg.attachment.filename}`}
                        download={msg.attachment.originalName}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl transition-colors border",
                          isMe ? "bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20" : "bg-background hover:bg-background/80 border-border"
                        )}
                      >
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", isMe ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground")}>
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{msg.attachment.originalName}</p>
                          <p className={cn("text-xs mt-0.5", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {(msg.attachment.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Download className="h-4 w-4 shrink-0 opacity-70" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}

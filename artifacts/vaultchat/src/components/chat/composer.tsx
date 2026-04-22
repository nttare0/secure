import { useState, useRef } from "react";
import { useSendMessage } from "@/hooks/use-messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X, Image as ImageIcon, File as FileIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ComposerProps {
  roomId: number;
}

export function Composer({ roomId }: ComposerProps) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const sendMessage = useSendMessage();

  const handleSend = () => {
    if (!content.trim() && !file) return;
    
    // Check file size (10MB)
    if (file && file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    sendMessage.mutate({ roomId, content: content.trim(), file: file || undefined }, {
      onSuccess: () => {
        setContent("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (err: any) => {
        toast({
          title: "Failed to send message",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="p-4 bg-background border-t border-border/50">
      {file && (
        <div className="mb-3 flex items-center gap-3 bg-muted/50 p-2 rounded-lg border border-border/50 max-w-md">
          <div className="h-10 w-10 bg-background rounded border border-border flex items-center justify-center shrink-0">
            {file.type.startsWith('image/') ? <ImageIcon className="h-5 w-5 text-primary" /> : <FileIcon className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => {
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}>
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
          disabled={sendMessage.isPending || !!file}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a secure message..."
          className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 px-2 py-2.5 shadow-none"
          disabled={sendMessage.isPending}
          rows={1}
        />
        
        <Button 
          type="button" 
          size="icon" 
          className="h-10 w-10 shrink-0 rounded-lg transition-all shadow-sm"
          disabled={(!content.trim() && !file) || sendMessage.isPending}
          onClick={handleSend}
        >
          {sendMessage.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
      <div className="flex justify-between items-center mt-2 px-2">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" /> End-to-end encrypted
        </p>
        <p className="text-[10px] text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

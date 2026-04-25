import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import { API_BASE } from "@/lib/api";
import type { MessageAttachment } from "@/hooks/use-messages";

interface FileViewerProps {
  attachment: MessageAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function classify(mime: string): "image" | "video" | "audio" | "pdf" | "text" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return "other";
}

export function FileViewer({ attachment, open, onOpenChange }: FileViewerProps) {
  if (!attachment) return null;
  const url = `${API_BASE}/uploads/${attachment.filename}`;
  const kind = classify(attachment.mimeType || "");
  const sizeMb = (attachment.size / 1024 / 1024).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden bg-background border-border/50"
      >
        <DialogTitle className="sr-only">{attachment.originalName}</DialogTitle>
        <DialogDescription className="sr-only">
          File preview for {attachment.originalName}
        </DialogDescription>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground">{attachment.originalName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sizeMb} MB · {attachment.mimeType || "file"}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-3">
            <a href={url} download={attachment.originalName}>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Download">
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="bg-muted/20 flex items-center justify-center min-h-[60vh] max-h-[80vh] overflow-auto">
          {kind === "image" && (
            <img
              src={url}
              alt={attachment.originalName}
              className="max-w-full max-h-[80vh] object-contain"
            />
          )}
          {kind === "video" && (
            <video
              src={url}
              controls
              className="max-w-full max-h-[80vh]"
              preload="metadata"
            />
          )}
          {kind === "audio" && (
            <div className="p-8 w-full max-w-xl">
              <audio src={url} controls className="w-full" preload="metadata" />
            </div>
          )}
          {kind === "pdf" && (
            <iframe
              src={url}
              title={attachment.originalName}
              className="w-full h-[80vh] border-0 bg-white"
            />
          )}
          {kind === "text" && (
            <iframe
              src={url}
              title={attachment.originalName}
              className="w-full h-[80vh] border-0 bg-background"
            />
          )}
          {kind === "other" && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Preview not available</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                This file type can't be previewed in the browser. Download to open it.
              </p>
              <a href={url} download={attachment.originalName}>
                <Button>
                  <Download className="mr-2 h-4 w-4" />
                  Download {sizeMb} MB
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

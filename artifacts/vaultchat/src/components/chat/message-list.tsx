import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  type Message,
  type MessageAttachment,
  useDeleteMessage,
  useEditMessage,
} from "@/hooks/use-messages";
import { useDeleteDm, useEditDm } from "@/hooks/use-dms";
import { format } from "date-fns";
import {
  Download,
  File as FileIcon,
  Shield,
  MoreHorizontal,
  Reply,
  Pencil,
  Trash2,
  Forward,
  Check,
  X,
  Image as ImageIcon,
  Play,
  Music,
  FileText,
  Phone,
  Video as VideoIcon,
  Users,
} from "lucide-react";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileViewer } from "./file-viewer";
import { ForwardDialog } from "./forward-dialog";
import { useToast } from "@/hooks/use-toast";

export type MessageListContext =
  | { type: "room"; id: number; ownerId?: number }
  | { type: "dm"; userId: number };

interface MessageListProps {
  messages: Message[];
  context: MessageListContext;
  onReply?: (message: Message) => void;
}

function attachmentKind(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function AttachmentBlock({
  attachment,
  isMe,
  onOpen,
}: {
  attachment: MessageAttachment;
  isMe: boolean;
  onOpen: () => void;
}) {
  const url = `${API_BASE}/uploads/${attachment.filename}`;
  const kind = attachmentKind(attachment.mimeType || "");

  if (kind === "image") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="block rounded-lg overflow-hidden border border-current/10 cursor-zoom-in"
      >
        <img
          src={url}
          alt={attachment.originalName}
          className="max-w-full max-h-[300px] object-cover"
          loading="lazy"
        />
      </button>
    );
  }

  if (kind === "video") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl transition-colors border w-full text-left",
          isMe
            ? "bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20"
            : "bg-background hover:bg-background/80 border-border",
        )}
      >
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            isMe
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <Play className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.originalName}</p>
          <p
            className={cn(
              "text-xs mt-0.5",
              isMe ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            Video · {(attachment.size / 1024 / 1024).toFixed(2)} MB · Tap to play
          </p>
        </div>
      </button>
    );
  }

  if (kind === "audio") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl transition-colors border w-full text-left",
          isMe
            ? "bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20"
            : "bg-background hover:bg-background/80 border-border",
        )}
      >
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            isMe
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <Music className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.originalName}</p>
          <p
            className={cn(
              "text-xs mt-0.5",
              isMe ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            Audio · {(attachment.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-colors border w-full text-left",
        isMe
          ? "bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20"
          : "bg-background hover:bg-background/80 border-border",
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          isMe
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.originalName}</p>
        <p
          className={cn(
            "text-xs mt-0.5",
            isMe ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {(attachment.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </button>
  );
}

function ReplyPreviewBlock({
  reply,
  isMe,
}: {
  reply: NonNullable<Message["replyTo"]>;
  isMe: boolean;
}) {
  const text =
    reply.content ||
    (reply.attachmentName ? `📎 ${reply.attachmentName}` : "Original message");
  return (
    <div
      className={cn(
        "mb-2 -mt-0.5 px-2.5 py-1.5 rounded-md border-l-2 text-xs",
        isMe
          ? "bg-primary-foreground/10 border-primary-foreground/40"
          : "bg-background/60 border-primary",
      )}
    >
      <p
        className={cn(
          "font-semibold",
          isMe ? "text-primary-foreground/90" : "text-primary",
        )}
      >
        {reply.username || "Deleted user"}
      </p>
      <p
        className={cn(
          "truncate",
          isMe ? "text-primary-foreground/80" : "text-foreground/70",
        )}
      >
        {text}
      </p>
    </div>
  );
}

function CallEventBubble({ msg }: { msg: Message }) {
  const ev = msg.callEvent;
  if (!ev) return null;
  const isGroup = ev.participants.length > 2;
  const Icon = ev.kind === "video" ? VideoIcon : isGroup ? Users : Phone;
  const durationLabel = ev.duration != null
    ? (() => {
        const m = Math.floor(ev.duration / 60);
        const s = ev.duration % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
      })()
    : null;
  return (
    <div className="flex justify-center my-3">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/80 border border-border/50 text-xs text-muted-foreground max-w-xs">
        <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span className="truncate">
          {isGroup ? "Group" : ""} {ev.kind} call
          {ev.participants.length > 0 && !isGroup && ` with ${ev.participants.filter(p => p !== msg.username).join(", ")}`}
          {durationLabel && <> · {durationLabel}</>}
        </span>
        <span className="text-muted-foreground/60 shrink-0">{format(new Date(msg.createdAt), "h:mm a")}</span>
      </div>
    </div>
  );
}

export function MessageList({ messages, context, onReply }: MessageListProps) {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const editRoomMessage = useEditMessage();
  const deleteRoomMessage = useDeleteMessage();
  const editDm = useEditDm();
  const deleteDm = useDeleteDm();

  const [viewerAttachment, setViewerAttachment] = useState<MessageAttachment | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [forwardSource, setForwardSource] = useState<
    { type: "room" | "dm"; messageId: number } | null
  >(null);

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
          This {context.type === "room" ? "room" : "conversation"} is empty. Send a message
          to start the conversation. All communication is private and secure.
        </p>
      </div>
    );
  }

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditingText(msg.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = (msg: Message) => {
    const content = editingText.trim();
    if (!content || content === msg.content) {
      cancelEdit();
      return;
    }
    const onSuccess = () => cancelEdit();
    const onError = (err: Error) =>
      toast({ title: "Edit failed", description: err.message, variant: "destructive" });

    if (context.type === "room") {
      editRoomMessage.mutate(
        { roomId: context.id, messageId: msg.id, content },
        { onSuccess, onError },
      );
    } else {
      editDm.mutate(
        { userId: context.userId, messageId: msg.id, content },
        { onSuccess, onError },
      );
    }
  };

  const handleDelete = (id: number) => {
    const onError = (err: Error) =>
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    if (context.type === "room") {
      deleteRoomMessage.mutate({ roomId: context.id, messageId: id }, { onError });
    } else {
      deleteDm.mutate({ userId: context.userId, messageId: id }, { onError });
    }
    setConfirmDeleteId(null);
  };

  let currentDate = "";

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background">
        {sortedMessages.map((msg, i) => {
          const isMe = msg.userId === user?.id;
          const msgDate = format(new Date(msg.createdAt), "MMM d, yyyy");
          const showDate = msgDate !== currentDate;
          currentDate = msgDate;

          const prevMsg = i > 0 ? sortedMessages[i - 1] : null;
          const isConsecutive =
            prevMsg &&
            prevMsg.userId === msg.userId &&
            !showDate &&
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <
              5 * 60 * 1000;

          const canEdit = isMe && !msg.attachment;
          const canDelete =
            isMe ||
            (context.type === "room" && context.ownerId === user?.id);

          const isEditing = editingId === msg.id;

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-6">
                  <div className="bg-muted/50 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground border border-border/50">
                    {msgDate}
                  </div>
                </div>
              )}

              {msg.messageType === "call" && <CallEventBubble msg={msg} />}

              {msg.messageType !== "call" && <div
                className={cn(
                  "group/message flex items-start gap-2 max-w-[85%]",
                  isMe ? "ml-auto flex-row-reverse" : "mr-auto",
                  isConsecutive ? "mt-1" : "mt-4",
                )}
              >
                <div className={cn("flex flex-col min-w-0", isMe ? "items-end" : "items-start")}>
                  {!isConsecutive && (
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {!isMe && (
                        <span className="text-xs font-semibold text-foreground/80">
                          {msg.username}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                      {msg.forwardedFrom && (
                        <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                          <Forward className="h-2.5 w-2.5" />
                          Forwarded from {msg.forwardedFrom}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl relative",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm border border-border/50",
                    )}
                  >
                    {msg.replyTo && <ReplyPreviewBlock reply={msg.replyTo} isMe={isMe} />}

                    {isEditing ? (
                      <div className="space-y-2 min-w-[240px]">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(msg);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className={cn(
                            "min-h-[60px] resize-none text-[15px]",
                            isMe
                              ? "bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
                              : "",
                          )}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-7",
                              isMe && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                            )}
                            onClick={cancelEdit}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant={isMe ? "secondary" : "default"}
                            className="h-7"
                            onClick={() => saveEdit(msg)}
                            disabled={
                              editRoomMessage.isPending || editDm.isPending || !editingText.trim()
                            }
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.content && (
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                            {msg.content}
                            {msg.editedAt && (
                              <span
                                className={cn(
                                  "ml-2 text-[10px] italic",
                                  isMe
                                    ? "text-primary-foreground/60"
                                    : "text-muted-foreground",
                                )}
                              >
                                (edited)
                              </span>
                            )}
                          </p>
                        )}

                        {msg.attachment && (
                          <div
                            className={cn(
                              "overflow-hidden",
                              msg.content ? "mt-2 pt-2 border-t border-current/10" : "",
                            )}
                          >
                            <AttachmentBlock
                              attachment={msg.attachment}
                              isMe={isMe}
                              onOpen={() => setViewerAttachment(msg.attachment)}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div
                    className={cn(
                      "flex items-center self-center opacity-0 group-hover/message:opacity-100 focus-within:opacity-100 transition-opacity",
                    )}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          aria-label="Message actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMe ? "end" : "start"} className="w-44">
                        {onReply && (
                          <DropdownMenuItem onClick={() => onReply(msg)}>
                            <Reply className="h-4 w-4 mr-2" /> Reply
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            setForwardSource({ type: context.type, messageId: msg.id })
                          }
                        >
                          <Forward className="h-4 w-4 mr-2" /> Forward
                        </DropdownMenuItem>
                        {msg.attachment && (
                          <DropdownMenuItem
                            onClick={() => setViewerAttachment(msg.attachment)}
                          >
                            {msg.attachment.mimeType.startsWith("image/") ? (
                              <ImageIcon className="h-4 w-4 mr-2" />
                            ) : (
                              <FileText className="h-4 w-4 mr-2" />
                            )}
                            Open file
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem onClick={() => startEdit(msg)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmDeleteId(msg.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>}
            </div>
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      <FileViewer
        attachment={viewerAttachment}
        open={!!viewerAttachment}
        onOpenChange={(o) => !o && setViewerAttachment(null)}
      />

      <ForwardDialog
        open={!!forwardSource}
        onOpenChange={(o) => !o && setForwardSource(null)}
        source={forwardSource}
      />

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the message for everyone in the chat. Any attached
              file is also deleted if no other message references it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

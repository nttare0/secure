import { Shield, Circle, Phone, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, type AvatarSpec } from "@/components/avatar";
import { Button } from "@/components/ui/button";

interface DmHeaderProps {
  username: string;
  lastSeen?: number | null;
  avatar?: AvatarSpec | null;
  isOnline?: boolean;
  typingLabel?: string | null;
  menuSlot?: React.ReactNode;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  callDisabled?: boolean;
}

const ONLINE_WINDOW_MS = 60 * 1000; // 60s = "online"

export function DmHeader({
  username,
  lastSeen,
  avatar,
  isOnline: isOnlineProp,
  typingLabel,
  menuSlot,
  onAudioCall,
  onVideoCall,
  callDisabled,
}: DmHeaderProps) {
  const recentlySeen = !!lastSeen && Date.now() - lastSeen < ONLINE_WINDOW_MS;
  const isOnline = isOnlineProp ?? recentlySeen;
  const presenceLabel = !lastSeen
    ? "Offline"
    : isOnline
      ? "Online now"
      : `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;

  return (
    <div className="h-14 sm:h-16 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-between px-3 sm:px-6 shrink-0 z-10 sticky top-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        {menuSlot}
        <div className="relative shrink-0">
          <Avatar username={username} avatar={avatar ?? null} size="md" />
          {isOnline && (
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background"
              aria-label="Online"
            />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-foreground leading-tight truncate">
            {username}
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {typingLabel ? (
              <span className="flex items-center gap-1.5 text-primary">
                <TypingDots />
                <span className="truncate max-w-[180px] sm:max-w-none">{typingLabel}</span>
              </span>
            ) : (
              <span
                className={
                  isOnline
                    ? "flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                    : "flex items-center gap-1.5"
                }
              >
                <Circle
                  className={
                    isOnline
                      ? "h-2 w-2 fill-current text-emerald-500"
                      : "h-2 w-2 fill-current text-muted-foreground/50"
                  }
                />
                <span className="truncate max-w-[180px] sm:max-w-none">{presenceLabel}</span>
              </span>
            )}
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3" /> Secure
            </span>
          </div>
        </div>
      </div>
      {(onAudioCall || onVideoCall) && (
        <div className="flex items-center gap-1 shrink-0">
          {onAudioCall && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onAudioCall}
              disabled={callDisabled}
              aria-label={`Audio call ${username}`}
              title="Audio call"
              className="h-9 w-9 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {onVideoCall && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onVideoCall}
              disabled={callDisabled}
              aria-label={`Video call ${username}`}
              title="Video call"
              className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
            >
              <Video className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "120ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "240ms" }} />
    </span>
  );
}

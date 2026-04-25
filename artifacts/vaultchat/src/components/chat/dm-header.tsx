import { Shield, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DmHeaderProps {
  username: string;
  lastSeen?: number | null;
  menuSlot?: React.ReactNode;
}

const ONLINE_WINDOW_MS = 60 * 1000; // 60s = "online"

export function DmHeader({ username, lastSeen, menuSlot }: DmHeaderProps) {
  const isOnline = !!lastSeen && Date.now() - lastSeen < ONLINE_WINDOW_MS;
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
          <div className="h-9 w-9 sm:h-10 sm:w-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-medium border border-border/50">
            {username.charAt(0).toUpperCase()}
          </div>
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
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3" /> Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Shield, MessageSquare } from "lucide-react";

interface DmHeaderProps {
  username: string;
  menuSlot?: React.ReactNode;
}

export function DmHeader({ username, menuSlot }: DmHeaderProps) {
  return (
    <div className="h-14 sm:h-16 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-between px-3 sm:px-6 shrink-0 z-10 sticky top-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        {menuSlot}
        <div className="h-9 w-9 sm:h-10 sm:w-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-medium border border-border/50 shrink-0">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-foreground leading-tight truncate">{username}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Direct message
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

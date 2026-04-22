import { Shield, MessageSquare } from "lucide-react";

interface DmHeaderProps {
  username: string;
}

export function DmHeader({ username }: DmHeaderProps) {
  return (
    <div className="h-16 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-medium border border-border/50">
          {username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">{username}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Direct message
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-3 w-3" /> Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

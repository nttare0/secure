import { cn } from "@/lib/utils";
import { findAvatarPreset } from "@/lib/avatars";

export interface AvatarSpec {
  kind: string; // 'initials' | 'preset'
  value: string | null;
}

interface AvatarProps {
  username: string;
  avatar?: AvatarSpec | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}

const SIZE_MAP = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

const EMOJI_SIZE_MAP = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-4xl",
};

export function Avatar({
  username,
  avatar,
  size = "md",
  className,
  ring = false,
}: AvatarProps) {
  const sizeClass = SIZE_MAP[size];
  const ringClass = ring ? "ring-2 ring-background" : "";

  if (avatar?.kind === "preset" && avatar.value) {
    const preset = findAvatarPreset(avatar.value);
    if (preset) {
      return (
        <div
          className={cn(
            sizeClass,
            ringClass,
            "rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 select-none",
            preset.gradient,
            className,
          )}
          aria-label={`${username} avatar`}
        >
          <span className={cn(EMOJI_SIZE_MAP[size], "leading-none")}>{preset.emoji}</span>
        </div>
      );
    }
  }

  // Initials fallback (also when avatar is null/undefined)
  const initial = (username || "?").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        sizeClass,
        ringClass,
        "rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium shrink-0 select-none",
        className,
      )}
      aria-label={`${username} avatar`}
    >
      {initial}
    </div>
  );
}

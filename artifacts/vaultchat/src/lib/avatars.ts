export interface AvatarPreset {
  id: string;
  emoji: string;
  gradient: string;
  label: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "shield", emoji: "🛡️", gradient: "from-indigo-500 to-violet-700", label: "Shield" },
  { id: "fox", emoji: "🦊", gradient: "from-orange-500 to-red-600", label: "Fox" },
  { id: "wolf", emoji: "🐺", gradient: "from-slate-500 to-slate-800", label: "Wolf" },
  { id: "dragon", emoji: "🐉", gradient: "from-emerald-500 to-teal-700", label: "Dragon" },
  { id: "lion", emoji: "🦁", gradient: "from-yellow-500 to-amber-700", label: "Lion" },
  { id: "tiger", emoji: "🐯", gradient: "from-orange-400 to-yellow-600", label: "Tiger" },
  { id: "owl", emoji: "🦉", gradient: "from-stone-500 to-stone-800", label: "Owl" },
  { id: "eagle", emoji: "🦅", gradient: "from-sky-600 to-blue-900", label: "Eagle" },
  { id: "shark", emoji: "🦈", gradient: "from-cyan-500 to-blue-700", label: "Shark" },
  { id: "ghost", emoji: "👻", gradient: "from-violet-400 to-purple-700", label: "Ghost" },
  { id: "skull", emoji: "💀", gradient: "from-zinc-600 to-zinc-900", label: "Skull" },
  { id: "fire", emoji: "🔥", gradient: "from-rose-500 to-orange-600", label: "Fire" },
  { id: "lightning", emoji: "⚡", gradient: "from-yellow-400 to-amber-600", label: "Lightning" },
  { id: "moon", emoji: "🌙", gradient: "from-indigo-500 to-blue-900", label: "Moon" },
  { id: "rocket", emoji: "🚀", gradient: "from-red-500 to-pink-700", label: "Rocket" },
  { id: "robot", emoji: "🤖", gradient: "from-slate-400 to-slate-700", label: "Robot" },
];

export function findAvatarPreset(id: string | null | undefined): AvatarPreset | null {
  if (!id) return null;
  return AVATAR_PRESETS.find((a) => a.id === id) ?? null;
}

export interface Wallpaper {
  id: string;
  name: string;
  file: string;
  position?: string;
}

export const WALLPAPERS: Wallpaper[] = [
  { id: "kakashi", name: "Kakashi", file: "kakashi.jpg" },
  { id: "jack-sparrow", name: "Jack Sparrow", file: "jack-sparrow.jpg" },
  { id: "pennywise", name: "Pennywise", file: "pennywise.jpg" },
  { id: "blue-demon", name: "Blue Demon", file: "blue-demon.jpg" },
  { id: "king-of-blood", name: "Crimson King", file: "king-of-blood.jpg" },
  { id: "world-map", name: "World Map", file: "world-map.jpg" },
  { id: "bear-roar", name: "Bear Roar", file: "bear-roar.jpg" },
  { id: "tiger-claws", name: "Tiger Claws", file: "tiger-claws.jpg" },
  { id: "golden-lion", name: "Golden Lion", file: "golden-lion.jpg" },
  { id: "sasuke-akatsuki", name: "Sasuke", file: "sasuke-akatsuki.jpg" },
  { id: "shenron", name: "Shenron", file: "shenron.jpg" },
  { id: "red-moon", name: "Red Moon", file: "red-moon.jpg" },
  { id: "black-dragon", name: "Black Dragon", file: "black-dragon.jpg" },
  { id: "phantom-blade", name: "Phantom Blade", file: "phantom-blade.jpg" },
  { id: "dark-soldier", name: "Dark Soldier", file: "dark-soldier.jpg" },
];

export function wallpaperUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  const w = WALLPAPERS.find((x) => x.id === id);
  if (!w) return null;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/wallpapers/${w.file}`;
}

export function findWallpaper(id: string | null | undefined): Wallpaper | null {
  if (!id) return null;
  return WALLPAPERS.find((w) => w.id === id) ?? null;
}

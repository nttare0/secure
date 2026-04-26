export interface AnimeAvatar {
  id: string;
  name: string;
  source: string;
}

export const ANIME_AVATARS: AnimeAvatar[] = [
  { id: "naruto", name: "Naruto", source: "Naruto" },
  { id: "sasuke", name: "Sasuke", source: "Naruto" },
  { id: "kakashi", name: "Kakashi", source: "Naruto" },
  { id: "itachi", name: "Itachi", source: "Naruto" },
  { id: "goku", name: "Goku", source: "Dragon Ball" },
  { id: "vegeta", name: "Vegeta", source: "Dragon Ball" },
  { id: "gohan", name: "Gohan", source: "Dragon Ball" },
  { id: "tanjiro", name: "Tanjiro", source: "Demon Slayer" },
  { id: "nezuko", name: "Nezuko", source: "Demon Slayer" },
  { id: "zenitsu", name: "Zenitsu", source: "Demon Slayer" },
];

export function animeAvatarUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  const a = ANIME_AVATARS.find((x) => x.id === id);
  if (!a) return null;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/avatars/${a.id}.png`;
}

export function findAnimeAvatar(id: string | null | undefined): AnimeAvatar | null {
  if (!id) return null;
  return ANIME_AVATARS.find((a) => a.id === id) ?? null;
}

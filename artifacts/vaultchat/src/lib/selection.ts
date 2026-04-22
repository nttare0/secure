export type Selection =
  | { type: "room"; id: number }
  | { type: "dm"; userId: number };

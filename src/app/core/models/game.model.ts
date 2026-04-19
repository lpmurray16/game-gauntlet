export interface Game {
  id: string;
  title: string;
  platform: string;
  rawg_id?: string;
  cover_url?: string;
  genre?: string;
  year?: number;
  notes?: string;
  created?: string;
  updated?: string;
}

export interface RawgGame {
  id: number;
  name: string;
  background_image: string;
  released: string;
  genres: { name: string }[];
  platforms: { platform: { name: string } }[];
}

import { createClient } from "https://esm.sh/@libsql/client@0.6.0/web";

export const db = createClient({
  url: process.env.DB_URL,
  authToken: process.env.DB_TOKEN,
});

const data: Response = await fetch(
  "https://api.jetlag.games/api/collections/mps_maps/records?page=1&perPage=1000&sort=popularity&expand=creator"
).then((resp) => resp.json());

for (const item of data.items) {
  await db.execute({
    sql: "INSERT INTO `jltg-homegame-maps-cache` (id, brief_description, continent, creator, deleted, creator_name, creator_avatar, game_modes, latitude, longitude, map_url, title, popularity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      item.id,
      item.brief_description,
      item.continent,
      item.creator,
      item.deleted,
      item.expand.creator.username,
      item.expand.creator.avatar,
      item.game_modes.join(","),
      item.latitude,
      item.longitude,
      item.map,
      item.title,
      item.popularity,
    ],
  });
}

export interface Response {
  items: Item[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface Item {
  brief_description: string;
  collectionId: string;
  collectionName: string;
  continent: string;
  created: string;
  creator: string;
  deleted: boolean;
  detailed_description: string;
  expand: Expand;
  game_modes: string[];
  id: string;
  latitude: number;
  longitude: number;
  map: string;
  popularity: number;
  title: string;
  updated: string;
}

export interface Expand {
  creator: Creator;
}

export interface Creator {
  avatar: string;
  collectionId: string;
  collectionName: string;
  created: string;
  emailVisibility: boolean;
  id: string;
  locale: string;
  updated: string;
  username: string;
  verified: boolean;
}

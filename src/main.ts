import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.12.0";
import { createClient } from "https://esm.sh/@libsql/client@0.6.0/web";
import { states } from "./generated-states.ts";

const listener = BunnySDK.net.tcp.unstable_new();

export const db = createClient({
  url: process.env.DB_URL,
  authToken: process.env.DB_TOKEN,
});

function haversineDistance(
  pointA: [number, number],
  pointB: [number, number]
): number {
  const radius = 6371; // km

  const lon1 = (pointA[0] * Math.PI) / 180;
  const lat1 = (pointA[1] * Math.PI) / 180;
  const lon2 = (pointB[0] * Math.PI) / 180;
  const lat2 = (pointB[1] * Math.PI) / 180;

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}

console.log("Listening on: ", BunnySDK.net.tcp.toString(listener));
BunnySDK.net.http.serve(async (req) => {
  // const countryCode = "CH";
  // const regionCode = "TG";
  const url = new URL(req.url);

  if (url.pathname !== "/get-local-maps")
    return new Response("404 not found", {
      status: 404,
      statusText: "Not Found",
    });

  const countryCode = req.headers.get("cdn-requestcountrycode");
  const stateCode = req.headers.get("cdn-requeststatecode");
  const expectedISOCode = countryCode + "-" + stateCode;

  let center: null | [number, number] = states[expectedISOCode];
  let dataAccuracy = "-";

  /*
  CREATE TABLE `jltg-homegame-maps-cache` (
  id TEXT NOT NULL PRIMARY KEY,
  brief_description TEXT,
  continent TEXT,
  creator TEXT,
  deleted boolean,
  creator_name TEXT,
  creator_avatar TEXT,
  game_modes TEXT,
  latitude FLOAT,
  longitude FLOAT,
  map_url TEXT,
  title TEXT,
  popularity INT
);
  */

  const regions = await db.execute(
    "SELECT id, brief_description, continent, creator, creator_name, creator_avatar, game_modes, latitude, longitude, map_url, title, popularity FROM `jltg-homegame-maps-cache`"
  );

  if (center) {
    dataAccuracy = "optimal";
  } else {
    let primaryFallback: null | [number, number] = null;
    let secondaryFallback: null | [number, number] = null;

    for (const code of Object.keys(states)) {
      if (code.startsWith(expectedISOCode)) {
        primaryFallback = states[code];
        break;
      } else if (code.startsWith(countryCode + "-"))
        secondaryFallback = states[code];
    }

    if (primaryFallback) {
      center = primaryFallback;
      dataAccuracy = "primary-fallback";
    } else if (secondaryFallback) {
      center = secondaryFallback;
      dataAccuracy = "country-fallback";
    } else {
      center = [0, 0];
      dataAccuracy = "unknown";
    }
  }

  const enrichedRegions = regions.rows.map(
    ({
      id,
      brief_description,
      continent,
      creator,
      game_modes,
      creator_name,
      creator_avatar,
      latitude,
      longitude,
      map_url,
      title,
      popularity,
    }) => ({
      id,
      title,
      brief_description,
      continent,
      creator,
      latitude,
      longitude,
      popularity,
      map: map_url,
      collectionName: "mps_maps",
      expand: {
        creator: {
          id: creator,
          username: creator_name,
          avatar: creator_avatar,
          collectionName: "map_users",
        },
      },
      game_modes: game_modes.split(","),
      geoip_proximity: haversineDistance([longitude, latitude], center),
    })
  );
  enrichedRegions.sort((a, b) => a.geoip_proximity - b.geoip_proximity);

  console.log(
    `[INFO]: ${req.method} - ${req.url} - ${expectedISOCode} - ${center} ${dataAccuracy}`
  );
  return new Response(JSON.stringify({ items: enrichedRegions.slice(0, 10) }), {
    headers: {
      "content-type": "application/json",
      vary: "Remote-Addr, X-Forwarded-For",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
});

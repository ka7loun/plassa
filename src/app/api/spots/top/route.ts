import { db } from "@/server/db";
import { hostLeaderboard } from "@/server/dashboard";
import { handler, json } from "@/server/http";
import { topSpots } from "@/server/spots";

// Public ranking: best-rated places in Sousse and the most active hosts.
export const GET = handler(async () => {
  const [spots, hosts] = await Promise.all([topSpots(db(), 10), hostLeaderboard(db(), 5)]);
  return json({ spots, hosts });
});

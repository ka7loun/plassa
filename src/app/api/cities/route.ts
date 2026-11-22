import { db } from "@/server/db";
import { handler, json } from "@/server/http";
import { listCities } from "@/server/spots";

export const GET = handler(async () => json(await listCities(db())));

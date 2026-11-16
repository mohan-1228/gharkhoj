import { json, route } from "@/server/lib/http";
import { getCities } from "@/server/services/lookup-service";

export const GET = route(async () =>
  json({ items: await getCities() }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }),
);

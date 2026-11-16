import { json, route } from "@/server/lib/http";
import { getAmenities } from "@/server/services/lookup-service";

export const GET = route(async () =>
  json({ items: await getAmenities() }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }),
);

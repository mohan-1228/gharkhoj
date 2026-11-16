import { z } from "zod";
import { json, parseQuery, route } from "@/server/lib/http";
import { getNeighborhoods } from "@/server/services/lookup-service";

const query = z.object({ cityId: z.coerce.number().int().positive().optional() });

export const GET = route(async (req) => {
  const { cityId } = parseQuery(req, query);
  return json(
    { items: await getNeighborhoods(cityId) },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
});

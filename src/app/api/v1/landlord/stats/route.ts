import { getCurrentUser } from "@/server/auth/session";
import { json, route } from "@/server/lib/http";
import { landlordStats } from "@/server/services/landlord-service";

export const GET = route(async () => json(await landlordStats(await getCurrentUser())));

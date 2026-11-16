import type { Role } from "@prisma/client";

/** The authenticated actor passed into every service call. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

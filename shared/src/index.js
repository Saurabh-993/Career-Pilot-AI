// shared/ — zod schemas used by BOTH client and server.
// One source of truth for data shapes: the server validates AI output against
// these, and the client can trust anything it receives already matches them.
// Real schemas (Resume, Profile, JobMatch…) arrive in Phase 1 per PLAN.md §7.

import { z } from "zod";

// Tiny demo schema (used by tests / the AI smoke test as a pattern to copy):
export const HealthSchema = z.object({
  ok: z.boolean(),
  uptimeSeconds: z.number(),
  groqKeyConfigured: z.boolean(),
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { mpServerAllowed } from "@/lib/mp-server-auth";
import type { Json } from "@/integrations/supabase/types";

const Row = z.object({
  userId: z.string().max(64), name: z.string().min(1).max(24), clsId: z.string().max(32), role: z.string().max(16), role2: z.string().max(16),
  place: z.number().int().min(1).max(8), score: z.number().int().min(0).max(10_000_000), gold: z.number().int().min(0).max(10_000_000),
  outcome: z.string().max(16), title: z.object({ name: z.string().max(60), meaning: z.string().max(200) }),
  stats: z.record(z.string().max(24), z.number().min(0).max(1e9)), items: z.array(z.record(z.string(), z.unknown())).max(6),
});
const Payload = z.object({
  id: z.string().uuid(), code: z.string().max(12), mode: z.enum(["coop", "traicion", "caos"]), difficulty: z.string().max(16),
  outcome: z.enum(["victory", "defeat"]), floors: z.number().int().min(1).max(20), startedAt: z.number(), rows: z.array(Row).min(1).max(8),
});

/** El servidor de salas publica aquí el resultado final (idempotente por id de partida). */
export const Route = createFileRoute("/api/public/mp/result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!mpServerAllowed(request)) return new Response("forbidden", { status: 401 });
        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });
        const uuid = /^[0-9a-f-]{36}$/i;
        const rows = parsed.data.rows.map(r => ({ ...r, userId: uuid.test(r.userId) ? r.userId : "" }));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("mp_record_match", { payload: JSON.parse(JSON.stringify({ ...parsed.data, rows })) as Json });
        if (error) { console.error("[mp/result]", error.message); return Response.json({ error: "store failed" }, { status: 500 }); }
        return Response.json({ stored: data === true });
      },
    },
  },
});

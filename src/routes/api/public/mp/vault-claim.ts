import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { mpServerAllowed } from "@/lib/mp-server-auth";

const Body = z.object({ userId: z.string().uuid(), vaultId: z.string().uuid(), match: z.string().max(40) });

/** El servidor de salas reclama (una sola vez) un objeto del arcón para llevarlo a la expedición. */
export const Route = createFileRoute("/api/public/mp/vault-claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!mpServerAllowed(request)) return new Response("forbidden", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("mp_claim_vault", { _user: parsed.data.userId, _id: parsed.data.vaultId, _match: parsed.data.match });
        if (error) { console.error("[mp/vault-claim]", error.message); return Response.json({ error: "claim failed" }, { status: 500 }); }
        return Response.json({ item: data ?? null });
      },
    },
  },
});

import { GatewayError } from '@lovable.dev/ai-gateway';
import { setResponseStatus } from '@tanstack/react-start/server';

export async function aiPause() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('combat_ai_status').select('paused,reason,status').eq('id', 'combat').maybeSingle();
  if (error) return 'No se pudo comprobar el estado de IA; no se enviará una solicitud.';
  if (data?.paused) { if (data.status === 403) setResponseStatus(403); return data.reason; }
  return '';
}
export async function aiFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'No se pudo generar el texto.';
  const status = error instanceof GatewayError ? error.httpStatus : 0;
  if (status === 403) setResponseStatus(403);
  if (status === 402 || status === 403) {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('combat_ai_status').upsert({ id: 'combat', paused: true, reason: message, status, updated_at: new Date().toISOString() });
  }
  return { ok: false as const, error: message, stop: status !== 429 && !(status && status >= 500) };
}
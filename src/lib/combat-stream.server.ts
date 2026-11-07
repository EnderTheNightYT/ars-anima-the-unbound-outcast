import { streamResponse } from '@lovable.dev/ai-gateway';

/** Existing Gateway SDK, streamed and consumed on the server; never retries terminal refusals. */
export async function combatText(payload: Parameters<typeof streamResponse>[0]) {
  const stream = await streamResponse(payload, { maxRetries: 0 });
  let text = '';
  for await (const raw of stream) {
    const event = raw as { type?: string; delta?: string; error?: { message?: string } };
    if (event.type?.startsWith('response.refusal')) throw new Error(event.delta || 'La IA rechazó esta solicitud.');
    if (event.type === 'error' || event.type === 'response.failed') throw new Error(event.error?.message || 'La generación terminó sin resultado.');
    if (event.type === 'response.output_text.delta') text += event.delta ?? '';
  }
  if (!text.trim()) throw new Error('La IA no devolvió texto; la solicitud ha terminado.');
  return text;
}
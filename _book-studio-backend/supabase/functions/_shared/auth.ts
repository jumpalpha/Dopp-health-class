// Shared request guard for Book Studio edge functions.
//
// Uses ONLY the public anon key plus the caller's own JWT, so every database and
// storage call is subject to Row Level Security. No service-role key is used
// anywhere in this backend.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED = (Deno.env.get('STUDIO_ALLOWED_ORIGINS') ?? 'https://doppsclass.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const h: Record<string, string> = {
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (ALLOWED.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'authorization, content-type, apikey, x-client-info';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Expose-Headers'] = 'Content-Disposition';
  }
  return h;
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

/**
 * Returns a Supabase client acting AS the caller, or a Response to send back
 * (401/403) when the caller is not the 2FA-verified owner.
 */
export async function requireOwner(req: Request): Promise<SupabaseClient | Response> {
  const origin = req.headers.get('Origin');
  if (origin && !ALLOWED.includes(origin)) return json(req, 403, { error: 'origin not allowed' });

  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/.test(auth)) return json(req, 401, { error: 'sign in required' });

  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pass the token explicitly: with no stored session, getUser() would otherwise fail.
  const { data: u, error: uErr } = await client.auth.getUser(auth.replace(/^Bearer\s+/, ''));
  if (uErr || !u?.user) return json(req, 401, { error: 'session invalid or expired' });

  const { data: ok, error } = await client.rpc('bs_is_owner');
  if (error || ok !== true) return json(req, 403, { error: 'not authorized (owner sign-in required)' });

  return client;
}

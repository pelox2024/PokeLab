/**
 * Accès Supabase (index de recherche full-text des cartes).
 * On appelle PostgREST directement (fetch) plutôt que via supabase-js pour
 * garder l'app légère — un seul endpoint RPC est utilisé côté recherche.
 *
 * La clé « publishable » est publique par nature (lecture seule, protégée par
 * RLS). Elle peut être surchargée par les variables d'env Vite si besoin.
 */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://krvnckglgxobdvqaezqd.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_U71Xd3ZXVeseY_IlVla3kQ_Ue85bazF";

export const hasSupabase = !!SUPABASE_URL && !!SUPABASE_KEY;

/** Appelle une fonction RPC Postgres exposée via PostgREST. */
export async function rpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Supabase ${fn} ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

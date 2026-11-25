import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

let client: SupabaseClient | null = null;

/** Lazily-created browser Supabase client. Returns null if env is missing. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anon!, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: false },
    });
  }
  return client;
}

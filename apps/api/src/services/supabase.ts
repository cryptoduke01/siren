import { createClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env");
  }
  return { url, serviceRoleKey };
}

export function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "siren-api" } },
  });
}


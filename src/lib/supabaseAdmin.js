import { createClient } from '@supabase/supabase-js';
// Server-only. Uses the service-role key and bypasses RLS. Never import in a client component.
export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
    { auth: { persistSession: false } }
  );
}

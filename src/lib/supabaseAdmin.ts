// Server-side Supabase client using service-role key.
// Bypasses RLS — only import this in API route handlers (server-side only).
// Never import in client components or pages.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

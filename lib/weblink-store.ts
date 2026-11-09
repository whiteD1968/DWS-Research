import type { SupabaseClient } from "@supabase/supabase-js";
import { weblinkParent } from "@/lib/weblinks";

// The database hands back at most 1,000 rows per request, and a habit of saving 30 tabs a day passes that in a month,
// so saved links are read a page at a time.
export async function allWeblinkRows<T>(db: SupabaseClient, ownerId: string, columns: string, max = 20000): Promise<{ rows: T[]; error: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await db.from("notes").select(columns).eq("owner_id", ownerId).eq("parent_type", weblinkParent).order("created_at", { ascending: false }).order("id").range(from, from + 999);
    if (error) return { rows, error: true };
    rows.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return { rows, error: false };
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pinterestParent, pinterestReady, pinterestSettingsFrom, type PinterestBoard } from "@/lib/pinterest";
import { pinterestBoards } from "@/lib/pinterest-sync";
import { PinterestImport } from "@/components/pinterest-import";

export const maxDuration = 60;

const problems: Record<string, string> = {
  setup: "Pinterest isn’t set up yet. Add PINTEREST_APP_ID and PINTEREST_APP_SECRET in Vercel, then redeploy.",
  declined: "Pinterest sign-in was cancelled.",
  state: "That sign-in link expired. Please connect again.",
  token: "Pinterest didn’t finish the sign-in. Check the app keys and the redirect address, then connect again.",
  save: "Signed in, but the connection couldn’t be saved. Please retry.",
};

export default async function PinterestPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const query = await searchParams;
  const { data: row } = await db.from("notes").select("metadata").eq("owner_id", user.id).eq("parent_type", pinterestParent).limit(1).maybeSingle();
  const settings = pinterestSettingsFrom(row?.metadata);
  const connected = !!settings.accessToken;
  let boards: PinterestBoard[] = []; let loadError = "";
  if (connected) { try { boards = await pinterestBoards(db, user.id); } catch (problem) { loadError = problem instanceof Error ? problem.message : "Couldn’t load your boards."; } }
  // Boards imported before link to their Collection.
  const { data: collections } = connected ? await db.from("collections").select("id,metadata->>pinterest_board_id").eq("owner_id", user.id).not("metadata->>pinterest_board_id", "is", null) : { data: [] };
  const imported = Object.fromEntries((collections || []).map(row => [String((row as Record<string, unknown>).pinterest_board_id), String(row.id)]));
  return <>
    <nav className="breadcrumb-row"><Link href="/library?view=images">Library / images</Link><span>/</span><span>Pinterest</span></nav>
    <header className="page-header"><div><p className="eyebrow">Import</p><h1 className="page-title">Pinterest</h1>
      <p className="page-description">Bring the images from your Pinterest boards into the Library. Each board becomes a Collection, and every image keeps a link back to its pin.</p></div></header>
    {query.error && <p className="notice notice-error" role="alert">{problems[query.error] || "Something went wrong. Please retry."}</p>}
    {query.connected && <p className="notice" role="status">Pinterest is connected{settings.username ? ` as ${settings.username}` : ""}.</p>}
    {!connected ? <section className="pinterest-connect">
      <p>{pinterestReady() ? "Sign in with Pinterest to choose which boards to import. The site only asks to read your boards and pins." : problems.setup}</p>
      {pinterestReady() && <a className="button button-primary" href="/api/pinterest/connect">Connect Pinterest</a>}
    </section> : <PinterestImport username={settings.username} boards={boards.map(board => ({ id: board.id, name: board.name, description: board.description || "", pins: board.pin_count ?? null, secret: board.privacy === "SECRET", cover: board.media?.image_cover_url || "" }))} imported={imported} loadError={loadError} />}
  </>;
}

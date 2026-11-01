import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardList } from "@/components/board-list";
import { NewBoardForm } from "@/components/board-organizer";
import { organizationOptions } from "@/lib/boards/organization";

export default async function BoardsPage() {
  const user = await requireUser();
  const options = await organizationOptions(await createClient(), user.id);
  return <section className="boards-page">
    <header className="page-header"><div><p className="eyebrow">Boards</p><h1 className="page-title">Boards</h1><p className="page-description">Loose ideas live here until they become projects. Boards inside a project are listed under it.</p></div></header>
    <NewBoardForm projects={options.projects} topics={options.topics} />
    <BoardList ownerId={user.id} grouped />
  </section>;
}

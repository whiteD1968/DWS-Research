import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardList } from "@/components/board-list";
import { NewBoardForm } from "@/components/board-organizer";
import { organizationOptions } from "@/lib/boards/organization";

// Boards are made inside the project they belong to.
export async function ProjectBoards({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const user = await requireUser();
  const options = await organizationOptions(await createClient(), user.id);
  return <section className="section-block project-boards">
    <div className="section-heading"><h2>Boards</h2></div>
    <NewBoardForm projects={options.projects} topics={options.topics} projectId={projectId} projectTitle={projectTitle} />
    <BoardList ownerId={user.id} projectId={projectId} />
  </section>;
}

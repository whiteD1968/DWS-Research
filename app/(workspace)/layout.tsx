import { WorkspaceShell } from "@/components/workspace-shell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reminderBucket } from "@/lib/reminders";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  // Reminders due today or already overdue show as a count beside Home.
  const db = await createClient();
  const { data } = await db.from("notes").select("metadata").eq("owner_id", user.id).not("metadata->>remind_at", "is", null).is("metadata->>done_at", null).limit(200);
  const dueReminders = (data || []).filter(row => typeof row.metadata?.remind_at === "string" && reminderBucket(row.metadata.remind_at) !== "upcoming").length;

  return <WorkspaceShell userEmail={user.email} dueReminders={dueReminders}>{children}</WorkspaceShell>;
}

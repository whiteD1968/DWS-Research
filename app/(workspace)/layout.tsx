import { WorkspaceShell } from "@/components/workspace-shell";
import { requireUser } from "@/lib/auth";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return <WorkspaceShell userEmail={user.email}>{children}</WorkspaceShell>;
}

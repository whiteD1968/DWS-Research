import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { BoardList } from "@/components/board-list";
export default async function BoardsPage({ searchParams }: { searchParams: Promise<{ boardPage?: string }> }) {
  const user = await requireUser();
  return <section><h1>Boards</h1><Link className="button" href="/research">Research Topics</Link><BoardList ownerId={user.id} page={Number((await searchParams).boardPage || 1)} /></section>;
}

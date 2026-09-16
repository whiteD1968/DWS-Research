import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { BoardList } from "@/components/board-list";
export default async function BoardsPage() {
  const user = await requireUser();
  return <section><h1>Boards</h1><Link className="button" href="/research">Research Topics</Link><BoardList ownerId={user.id} /></section>;
}

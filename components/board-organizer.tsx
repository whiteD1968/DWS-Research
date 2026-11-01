"use client";
import { useState } from "react";
import { createBoard, organizeBoard } from "@/app/(workspace)/boards/organize-actions";
import type { NamedOption } from "@/lib/boards/organization";

function TopicChecklist({ topics, chosen, onToggle, name }: { topics: NamedOption[]; chosen: string[]; onToggle?: (id: string, on: boolean) => void; name?: string }) {
  if (!topics.length) return <p className="board-organizer-empty">No topics yet. Create one under Topics to tag boards.</p>;
  return <fieldset className="board-topic-list"><legend>Topics</legend>{topics.map(topic => <label key={topic.id}><input type="checkbox" name={name} value={topic.id} checked={onToggle ? chosen.includes(topic.id) : undefined} defaultChecked={onToggle ? undefined : chosen.includes(topic.id)} onChange={onToggle ? e => onToggle(topic.id, e.target.checked) : undefined} />{topic.title}</label>)}</fieldset>;
}

export function ProjectSelect({ projects, value, onChange, name }: { projects: NamedOption[]; value?: string; onChange?: (value: string) => void; name?: string }) {
  return <label>Project<select name={name} value={onChange ? value : undefined} defaultValue={onChange ? undefined : value} onChange={onChange ? e => onChange(e.target.value) : undefined}><option value="">None (loose idea)</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>;
}

// Start a blank board. Inside a project the project is fixed; on the Boards page it can be chosen.
export function NewBoardForm({ projects, topics, projectId, projectTitle }: { projects: NamedOption[]; topics: NamedOption[]; projectId?: string; projectTitle?: string }) {
  const [busy, setBusy] = useState(false);
  return <details className="panel new-board"><summary className="button button-primary">+ New board</summary>
    <form className="form-stack board-organizer" action={async data => { setBusy(true); try { await createBoard(data); } finally { setBusy(false); } }}>
      <label>Title<input name="title" required maxLength={200} placeholder={projectTitle ? `${projectTitle} — first ideas` : "Loose idea"} /></label>
      {projectId ? <><input type="hidden" name="project_id" value={projectId} /><p>In project <strong>{projectTitle}</strong></p></> : <ProjectSelect projects={projects} name="project_id" value="" />}
      <TopicChecklist topics={topics} chosen={[]} name="topic_id" />
      <button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create board"}</button>
    </form>
  </details>;
}

// Shown in a board's title panel: move the board between projects and tag it with topics.
export function BoardOrganizer({ boardId, projects, topics, initial, run, onSaved, disabled }: { boardId: string; projects: NamedOption[]; topics: NamedOption[]; initial: { projectId: string | null; topicIds: string[] }; run: (task: (revision: string) => Promise<string>) => Promise<void>; onSaved: (placement: { projectId: string | null; topicIds: string[] }) => void; disabled?: boolean }) {
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [topicIds, setTopicIds] = useState(initial.topicIds);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const changed = projectId !== (initial.projectId ?? "") || topicIds.length !== initial.topicIds.length || topicIds.some(id => !initial.topicIds.includes(id));
  return <div className="board-organizer">
    <h3>Where this board lives</h3>
    <ProjectSelect projects={projects} value={projectId} onChange={value => { setProjectId(value); setMessage(""); }} />
    <TopicChecklist topics={topics} chosen={topicIds} onToggle={(id, on) => { setTopicIds(on ? [...topicIds, id] : topicIds.filter(topic => topic !== id)); setMessage(""); }} />
    <button type="button" className="button" disabled={busy || disabled || !changed} onClick={async () => { setBusy(true); setMessage(""); try { let placement = initial; await run(async revision => { const result = await organizeBoard(boardId, projectId || null, topicIds, revision); placement = { projectId: result.projectId, topicIds: result.topicIds }; return result.revision; }); onSaved(placement); setMessage("Saved."); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Saving…" : "Save project and topics"}</button>
    {message && <p role="status">{message}</p>}
  </div>;
}

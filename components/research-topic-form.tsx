import { manageTopic } from "@/app/(workspace)/research/actions";
import { topicStatuses, type Topic } from "@/lib/research";

export function ResearchTopicForm({ topic }: { topic?: Topic }) {
  return <form action={manageTopic} className="form-stack research-form">
    <input type="hidden" name="op" value={topic ? "edit" : "create"} />
    {topic && <input type="hidden" name="topic_id" value={topic.id} />}
    <label className="field">Title<input name="title" required maxLength={200} defaultValue={topic?.title} /></label>
    <label className="field">Research question<textarea name="question" rows={3} defaultValue={topic?.question ?? ""} /></label>
    <label className="field">Summary / scope<textarea name="summary" rows={4} defaultValue={topic?.summary ?? ""} /></label>
    <label className="field">Status<select name="status" defaultValue={topic?.status ?? "active"}>{topicStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
    <button className="button button-primary">{topic ? "Save topic" : "Create topic"}</button>
  </form>;
}

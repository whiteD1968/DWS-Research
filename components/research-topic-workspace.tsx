import { DeleteContent } from "@/components/content-controls";
import Link from "next/link";
import { manageTopic } from "@/app/(workspace)/research/actions";
import { isLiterature, reviewFields, topicLinks, topicModes, type Topic, type TopicLink, type ResearchRecord, type TopicRecordType, type topicContext } from "@/lib/research";
import { getSignedMediaUrlMap } from "@/lib/media";
import { researchArea, researchType } from "@/lib/research-organization";
import { TopicPdfUpload } from "@/components/topic-pdf-upload";
import { documentBytes } from "@/lib/topic-pdf";

export async function ResearchTopicWorkspace({ topic, context, mode, error, saved }: {
  topic: Topic; context: Awaited<ReturnType<typeof topicContext>>; mode: string; error?: string; saved?: boolean;
}) {
  const links = context.links.filter(link => link.source_type === "research_thread" && link.source_id === topic.id);
  const notes = context.records.note.filter(note => note.parent_type === "research_thread" && note.parent_id === topic.id);
  const members = (type: TopicRecordType) => links.filter(link => link.target_type === type && link.relationship_type === topicLinks[type].relationship);
  const recordFor = (link: TopicLink) => context.records[link.target_type as keyof typeof context.records]?.find(record => record.id === link.target_id);
  const mediaIds = new Set([...members("media").map(link => link.target_id), ...members("reference").map(link => recordFor(link)?.primary_media_id)]);
  const signed = await getSignedMediaUrlMap(context.records.media.filter(media => mediaIds.has(media.id) && media.bucket).map(media => ({ id: media.id, bucket: media.bucket!, storage_path: media.storage_path ?? null })));
  const hidden = (op: string) => <><input type="hidden" name="op" value={op} /><input type="hidden" name="topic_id" value={topic.id} /><input type="hidden" name="mode" value={mode} /></>;
  const unlink = (link: TopicLink) => <form action={manageTopic}>{hidden("unlink")}<input type="hidden" name="link_id" value={link.id} /><button className="text-button">Unlink</button></form>;
  const destination = (type: string, record: ResearchRecord) => type === "reference" ? `/library/references/${record.id}` : type === "research_session" ? `/discover/sessions/${record.id}` : type === "media" ? signed.get(record.id) : type === "project" ? `/projects/${record.id}` : type === "collection" ? `/collections/${record.id}` : "/boards";
  function addExisting(type: TopicRecordType, filter: (record: ResearchRecord) => boolean = () => true) {
    const candidates = context.records[type].filter(record => filter(record) && !members(type).some(link => link.target_id === record.id));
    return <details className="research-add"><summary>Add existing {type === "media" ? "PDF document" : type.replace("_", " ")}</summary><form action={manageTopic} className="research-inline">{hidden("link")}<input type="hidden" name="record_type" value={type} />
      <label>Choose record<select name="record_id" required><option value="">Select...</option>{candidates.map(record => <option key={record.id} value={record.id}>{record.title || record.query || "Untitled"}</option>)}</select></label><button className="button" disabled={!candidates.length}>Add</button>
    </form></details>;
  }
  function review(link: TopicLink) {
    return <details className="research-review"><summary>Literature review &middot; {String(link.metadata.review_status ?? "unreviewed").replace("_", " ")}</summary><form action={manageTopic} className="form-stack">{hidden("review")}<input type="hidden" name="link_id" value={link.id} />
      <label className="field">Review status<select name="review_status" defaultValue={String(link.metadata.review_status ?? "unreviewed")}>{["unreviewed", "included", "excluded", "key_source"].map(status => <option key={status}>{status}</option>)}</select></label>
      {reviewFields.map(field => <label className="field" key={field}>{field.replaceAll("_", " ")}<textarea name={field} rows={2} defaultValue={typeof link.metadata[field] === "string" ? link.metadata[field] as string : ""} /></label>)}<button className="button">Save review</button>
    </form></details>;
  }
  function recordList(items: TopicLink[], visual = false, reviews = false) {
    return <div className={visual ? "research-visual-grid" : "research-list"}>{items.map(link => {
      const record = recordFor(link);
      if (!record) return null;
      const href = destination(link.target_type, record);
      const image = record.primary_media_id ? signed.get(record.primary_media_id) : null;
      return <article className="research-item" key={link.id}>{visual && <div className="research-preview">{image ?
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" /> : <span>{record.reference_type || "Reference"}</span>}</div>}
        <div className="research-item-heading"><div><small>{record.reference_type || link.target_type.replace("_", " ")}</small><h3>{href ? <a href={href} target={link.target_type === "media" ? "_blank" : undefined} rel="noreferrer">{record.title || record.query || "Untitled"}</a> : record.title}</h3></div>{unlink(link)}</div>
        {link.target_type === "research_session" && <p className="research-counts">{record.created_at?.slice(0, 10)} &middot; {record.filters?.contentType || "All"} &middot; {record.result_snapshot?.length ?? 0} results &middot; {Object.keys(record.saved_items ?? {}).length} saved</p>}
        {link.target_type === "media" && <div className="topic-document-info"><p>{record.original_filename} &middot; {documentBytes(record.byte_size ?? 0)} &middot; {record.created_at?.slice(0, 10)}</p>
          {typeof record.metadata?.document_type === "string" && <small>{record.metadata.document_type}</small>}
          {typeof link.metadata.relevance_note === "string" && <p>{link.metadata.relevance_note}</p>}
          {href ? <a className="text-button" href={href} target="_blank" rel="noreferrer">Open PDF</a> : <p>PDF link unavailable. Refresh to try again.</p>}
          <Link className="text-button" href={`/library/items/media/${record.id}`}>Research pages →</Link>
          <details><summary>Edit metadata</summary><form action={manageTopic} className="form-stack research-form">{hidden("document-edit")}<input type="hidden" name="link_id" value={link.id} /><label className="field">Document title<input name="title" required maxLength={200} defaultValue={record.title ?? ""} /></label><label className="field">Document type<input name="document_type" defaultValue={typeof record.metadata?.document_type === "string" ? record.metadata.document_type : ""} placeholder="Paper, thesis, report..." /></label><button className="button">Save metadata</button></form></details>
        </div>}
        {reviews && review(link)}
      </article>;
    })}{!items.length && <p>No linked records yet.</p>}</div>;
  }
  function noteForm(note?: ResearchRecord) {
    return <form action={manageTopic} className="form-stack research-form">{hidden("note")}<input type="hidden" name="note_id" value={note?.id ?? ""} /><label className="field">Title<input name="title" defaultValue={note?.title ?? ""} /></label><label className="field">Note<textarea name="plain_text" required rows={6} defaultValue={note?.plain_text ?? ""} /></label><button className="button">Save note</button></form>;
  }
  const referenceLinks = members("reference");
  const literature = referenceLinks.filter(link => { const record = recordFor(link); return record && isLiterature(record); });
  const precedents = referenceLinks.filter(link => !literature.includes(link));
  const simpleType = ({ collections: "collection", boards: "board", projects: "project" } as Record<string, TopicRecordType>)[mode];
  return <div className="research-workspace"><Link href="/research">Research</Link><header className="page-header"><div><p className="eyebrow">{researchArea(topic.metadata)} &middot; {researchType(topic.metadata)} &middot; {topic.status}</p><h1 className="page-title">{topic.title}</h1>{topic.question && <p className="topic-primary-question">{topic.question}</p>}</div><div className="detail-actions"><Link className="button" href={`/research/${topic.id}/edit`}>Edit topic</Link><DeleteContent kind="research_thread" id={topic.id} title={topic.title} /></div></header>
    {error && <p className="notice notice-error" role="alert">{error}</p>}{saved && <p className="notice notice-success" role="status">Saved.</p>}
    <nav className="research-tabs" aria-label="Topic views">{topicModes.map(tab => <Link key={tab} href={tab === "boards" ? `/research/${topic.id}/boards` : `/research/${topic.id}?mode=${tab}`} aria-current={mode === tab ? "page" : undefined}>{tab === "projects" ? "Linked Projects" : tab[0].toUpperCase() + tab.slice(1)}</Link>)}</nav>
    {mode === "overview" && <><section className="research-scope"><h2>{topic.question || "Research question"}</h2><p>{topic.summary || "No scope recorded yet."}</p><div className="research-counts"><span>{referenceLinks.length} references</span><span>{members("media").length} documents</span><span>{members("research_session").length} Discover sessions</span><span>{notes.length} notes</span></div></section>
      <section><h2>Key references and precedents</h2>{recordList(referenceLinks.filter(link => link.metadata.review_status === "key_source"), true)}</section><section><h2>Linked Projects</h2>{recordList(members("project"))}</section>
      <section><h2>Recent activity</h2><div className="research-list">{links.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map(link => <p key={link.id}>{recordFor(link)?.title || recordFor(link)?.name || "Record"} &middot; {link.relationship_type.replaceAll("_", " ")} &middot; {link.created_at.slice(0, 10)}</p>)}</div><small>Topic updated {new Date(topic.updated_at).toLocaleString("en-US")}</small></section></>}
    {mode === "discover" && <><Link className="button" href="/discover">New Discover search</Link>{addExisting("research_session")}{recordList(members("research_session"))}</>}
    {mode === "literature" && <>{!literature.length && !members("media").length && <p>No literature or research documents linked yet.</p>}<TopicPdfUpload topicId={topic.id} /><div className="research-tools">{addExisting("reference", isLiterature)}{addExisting("media", record => record.mime_type === "application/pdf")}<Link href="/discover">Add from Discover</Link></div><h2>References / Literature Sources</h2>{recordList(literature, false, true)}<section className="topic-documents"><h2>Documents</h2>{recordList(members("media"), false, true)}</section></>}
    {mode === "precedents" && <><div className="research-tools">{addExisting("reference", record => !isLiterature(record))}<Link href="/discover">Add from Discover</Link></div>{recordList(precedents, true, true)}</>}
    {mode === "notes" && <><details className="research-create"><summary>+ New note</summary>{noteForm()}</details>{notes.map(note => <article className="research-item" key={note.id}><h3>{note.title || "Untitled note"}</h3><p className="research-note-text">{note.plain_text}</p><details><summary>Edit note</summary>{noteForm(note)}</details><DeleteContent stayOnPage kind="note" id={note.id} title={note.title || "Untitled note"} /></article>)}{!notes.length && <p>No notes yet.</p>}</>}
    {mode === "themes" && <><details className="research-create"><summary>+ New theme</summary><form action={manageTopic} className="form-stack research-form">{hidden("theme")}<label className="field">Title<input name="title" required maxLength={200} /></label><label className="field">Description<textarea name="description" rows={3} /></label><button className="button">Create theme</button></form></details>
      {links.filter(link => link.relationship_type === "has_theme").map(theme => {
        const themeMembers = context.links.filter(link => link.source_type === "research_topic_theme" && link.source_id === theme.id);
        const available = [...links.filter(link => ["reference", "media", "project"].includes(link.target_type)).map(link => ({ type: link.target_type, record: recordFor(link) })), ...notes.map(record => ({ type: "note", record }))].filter(item => item.record);
        return <section className="research-theme" key={theme.id}><div className="research-item-heading"><h2>{recordFor(theme)?.name || "Theme"}</h2>{unlink(theme)}</div><p>{theme.note}</p><details><summary>Edit description</summary><form action={manageTopic} className="form-stack">{hidden("theme-edit")}<input type="hidden" name="link_id" value={theme.id} /><label className="field">Description<textarea name="description" defaultValue={theme.note ?? ""} /></label><button className="button">Save description</button></form></details>
          <form action={manageTopic} className="research-inline">{hidden("theme-link")}<input type="hidden" name="theme_id" value={theme.id} /><label>Topic record<select name="record" required><option value="">Select...</option>{available.filter(item => !themeMembers.some(link => link.target_type === item.type && link.target_id === item.record!.id)).map(item => <option key={`${item.type}:${item.record!.id}`} value={`${item.type}:${item.record!.id}`}>{item.record!.title || "Untitled"} ({item.type})</option>)}</select></label><button className="button">Add to theme</button></form>
          {themeMembers.map(link => <div className="research-item-heading" key={link.id}><span>{recordFor(link)?.title || "Unavailable record"}</span><form action={manageTopic}>{hidden("theme-unlink")}<input type="hidden" name="theme_id" value={theme.id} /><input type="hidden" name="link_id" value={link.id} /><button className="text-button">Unlink</button></form></div>)}
        </section>;
      })}</>}
    {simpleType && <>{addExisting(simpleType)}{recordList(members(simpleType))}</>}
  </div>;
}

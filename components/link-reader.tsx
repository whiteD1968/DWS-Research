"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLinksToProject, deleteLinks, refreshLink, removeLinkFromProject, saveLink } from "@/app/(workspace)/links/actions";
import { faviconUrl, parseTags, type Weblink } from "@/lib/weblinks";

// Reads a saved link inside the site. Pages that refuse to be framed get a preview card and a one-click new tab instead.
export function LinkReader({ link, embed, projects, linkedProjects }: { link: Weblink; embed: string | null; projects: { id: string; title: string }[]; linkedProjects: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title); const [url, setUrl] = useState(link.url);
  const [notes, setNotes] = useState(link.notes); const [tagText, setTagText] = useState("");
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  const run = (task: () => Promise<unknown>, after?: () => void) => { setError(""); start(async () => { try { await task(); after?.(); router.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong."); } }); };
  const frameSrc = embed || (link.frame !== "blocked" ? link.url : null);
  const inProjects = projects.filter(project => linkedProjects.includes(project.id));
  const otherProjects = projects.filter(project => !linkedProjects.includes(project.id));

  return <div className="link-reader">
    <div className="link-reader-bar">
      <Link href="/links" className="text-button">← Links</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="link-favicon" src={faviconUrl(link.domain)} alt="" width={20} height={20} referrerPolicy="no-referrer" />
      <div className="link-reader-title"><h1>{link.title}</h1><span>{link.domain}</span></div>
      <a className="button button-primary" href={link.url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
    </div>

    <div className="link-reader-layout">
      <div className="link-frame-wrap">
        {frameSrc ? <>
          <iframe className="link-frame" src={frameSrc} title={link.title} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads" allow="fullscreen; encrypted-media; picture-in-picture; clipboard-write" />
          <p className="link-frame-note">Blank or asking you to sign in? Some sites only work in their own tab. <a href={link.url} target="_blank" rel="noreferrer">Open it in a new tab ↗</a></p>
        </> : <div className="link-blocked">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {link.image && <img src={link.image} alt="" referrerPolicy="no-referrer" />}
          <p className="eyebrow">{link.siteName || link.domain}</p>
          <h2>{link.title}</h2>
          {link.description && <p>{link.description}</p>}
          <p className="link-blocked-why">{link.domain} doesn&apos;t allow its pages to be shown inside other sites, so it opens in its own tab.</p>
          <a className="button button-primary" href={link.url} target="_blank" rel="noreferrer">Open {link.domain} ↗</a>
        </div>}
      </div>

      <aside className="link-side" aria-label="About this link">
        {editing ? <form className="opp-form" onSubmit={event => { event.preventDefault(); run(() => saveLink(link.id, { title, url, notes }), () => setEditing(false)); }}>
          <label className="field"><span>Title</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={300} /></label>
          <label className="field"><span>Address</span><input value={url} onChange={event => setUrl(event.target.value)} maxLength={2000} /></label>
          <label className="field"><span>Notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={5} maxLength={20000} /></label>
          <div className="cv-form-actions"><button type="button" className="button" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary" disabled={pending}>Save</button></div>
        </form> : <>
          {link.description && <p className="link-side-desc">{link.description}</p>}
          {link.notes ? <p className="opp-notes">{link.notes}</p> : <button type="button" className="text-button" onClick={() => setEditing(true)}>+ Add a note</button>}
          <p className="link-side-url"><a href={link.url} target="_blank" rel="noreferrer">{link.url}</a></p>
          <p className="record-meta">Saved {new Date(link.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}{link.batch ? ` · ${link.batch}` : ""}</p>
        </>}

        <h3>Tags</h3>
        <ul className="item-tags">{link.tags.map(tag => <li key={tag}><Link href={`/links?tag=${encodeURIComponent(tag)}`}>{tag}</Link><button type="button" aria-label={`Remove tag ${tag}`} disabled={pending} onClick={() => run(() => saveLink(link.id, { tags: link.tags.filter(item => item !== tag) }))}>×</button></li>)}
          <li><form onSubmit={event => { event.preventDefault(); const add = parseTags(tagText); if (add.length) run(() => saveLink(link.id, { tags: [...link.tags, ...add] }), () => setTagText("")); }}><input value={tagText} onChange={event => setTagText(event.target.value)} placeholder="Add tag" aria-label="Add a tag" maxLength={60} disabled={pending} /></form></li></ul>

        <h3>Projects</h3>
        {inProjects.length > 0 && <ul className="link-side-projects">{inProjects.map(project => <li key={project.id}><Link href={`/projects/${project.id}?mode=links`}>{project.title}</Link><button type="button" aria-label={`Remove from ${project.title}`} disabled={pending} onClick={() => run(() => removeLinkFromProject(link.id, project.id))}>×</button></li>)}</ul>}
        {otherProjects.length > 0 ? <select value="" disabled={pending} onChange={event => { const id = event.target.value; if (id) run(() => addLinksToProject([link.id], id)); }} aria-label="Add to project"><option value="">Add to a project…</option>{otherProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select> : !projects.length && <p className="record-meta">No projects yet.</p>}

        <div className="opp-actions">
          {!editing && <button type="button" className="text-button" onClick={() => setEditing(true)}>Edit</button>}
          <button type="button" className="text-button" disabled={pending} onClick={() => run(() => refreshLink(link.id))} title="Read the page again for its title, preview, and whether it can open here">Refresh details</button>
          <span className="opp-actions-spacer" />
          <button type="button" className="button button-danger-quiet" disabled={pending} onClick={() => { if (window.confirm("Delete this link?")) run(() => deleteLinks([link.id]), () => router.push("/links")); }}>Delete</button>
        </div>
        {error && <p className="cv-error" role="alert">{error}</p>}
      </aside>
    </div>
  </div>;
}

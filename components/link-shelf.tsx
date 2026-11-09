"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLinksToProject, deleteLinks, importLinks, markLinksOpened, removeLinkFromProject, smartTagLinks, tagLinks } from "@/app/(workspace)/links/actions";
import { autoTags, decodeImport, faviconUrl, linkKey, matchesLink, parseLinkList, parseTags, tagCounts, domainOf, type LinkDraft, type Weblink } from "@/lib/weblinks";

type Project = { id: string; title: string };
type Membership = { linkId: string; projectId: string };
type GroupBy = "batch" | "tag" | "site" | "none";
const groupLabels: Record<GroupBy, string> = { batch: "Saved together", tag: "Tag", site: "Website", none: "Newest first" };
const errorText = (failure: unknown, fallback: string) => (failure instanceof Error ? failure.message : fallback);

export function LinkShelf({ links, projects, memberships, smartTagging, initialProject, initialTag }: { links: Weblink[]; projects: Project[]; memberships: Membership[]; smartTagging: boolean; initialProject?: string; initialTag?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState(initialTag || "");
  const [project, setProject] = useState(initialProject && projects.some(item => item.id === initialProject) ? initialProject : "");
  const [groupBy, setGroupBy] = useState<GroupBy>("batch");
  const [view, setView] = useState<"list" | "cards">("list");
  // The list-or-pictures choice is remembered on this computer.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { if (localStorage.getItem("dws-links-view") === "cards") setView("cards"); } catch { /* storage unavailable */ } }, []);
  const chooseView = (next: "list" | "cards") => { setView(next); try { localStorage.setItem("dws-links-view", next); } catch { /* storage unavailable */ } };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<LinkDraft[] | null>(null);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // The Chrome extension and the bookmarklet arrive with the tabs in the address after #import=.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#import=")) return;
    const drafts = decodeImport(hash.slice(8));
    history.replaceState(null, "", window.location.pathname + window.location.search);
    // Reading the address happens once, after the page has loaded in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImporting(drafts.length ? drafts : []);
  }, []);

  const projectTitle = useMemo(() => new Map(projects.map(item => [item.id, item.title])), [projects]);
  const linkProjects = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of memberships) if (projectTitle.has(item.projectId)) map.set(item.linkId, [...(map.get(item.linkId) || []), item.projectId]);
    return map;
  }, [memberships, projectTitle]);
  const tags = useMemo(() => tagCounts(links), [links]);
  const unopened = links.filter(link => !link.openedAt).length;
  const untagged = links.filter(link => !link.tags.length).length;
  const shown = links.filter(link => matchesLink(link, query)
    && (!tag || (tag === ":untagged" ? !link.tags.length : tag === ":new" ? !link.openedAt : link.tags.includes(tag)))
    && (!project || (linkProjects.get(link.id) || []).includes(project)));
  const groups = useMemo(() => groupLinks(shown, groupBy), [shown, groupBy]);
  const chosen = [...selected].filter(id => links.some(link => link.id === id));

  const run = (task: () => Promise<string | void>, after?: () => void) => {
    setError(""); setMessage("");
    start(async () => { try { const note = await task(); if (note) setMessage(note); after?.(); router.refresh(); } catch (failure) { setError(errorText(failure, "Something went wrong. Please retry.")); } });
  };
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleMany = (ids: string[]) => setSelected(current => { const next = new Set(current); const all = ids.every(id => next.has(id)); for (const id of ids) if (all) next.delete(id); else next.add(id); return next; });
  const opened = (ids: string[]) => { markLinksOpened(ids).catch(() => null); };

  return <>
    <div className="contacts-toolbar links-toolbar">
      <button type="button" className="button button-primary" onClick={() => setImporting([])}>+ Save links</button>
      {links.length > 0 && <input className="contacts-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${links.length} ${links.length === 1 ? "link" : "links"}`} aria-label="Search links" />}
      {links.length > 0 && projects.length > 0 && <select className="links-select" value={project} onChange={event => setProject(event.target.value)} aria-label="Filter by project"><option value="">All projects</option>{projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}
      {links.length > 0 && <select className="links-select" value={groupBy} onChange={event => setGroupBy(event.target.value as GroupBy)} aria-label="Group by">{(Object.keys(groupLabels) as GroupBy[]).map(key => <option key={key} value={key}>{key === "none" ? groupLabels[key] : `By ${groupLabels[key].toLowerCase()}`}</option>)}</select>}
      {links.length > 0 && <div className="links-view" role="radiogroup" aria-label="View"><button type="button" role="radio" aria-checked={view === "list"} className={view === "list" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => chooseView("list")}>List</button><button type="button" role="radio" aria-checked={view === "cards"} className={view === "cards" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => chooseView("cards")}>Pictures</button></div>}
    </div>
    {links.length > 0 && <div className="cv-kinds contacts-filters links-tags" role="radiogroup" aria-label="Filter by tag">
      <button type="button" role="radio" aria-checked={!tag} className={!tag ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setTag("")}>All · {links.length}</button>
      {unopened > 0 && <button type="button" role="radio" aria-checked={tag === ":new"} className={tag === ":new" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setTag(":new")}>Not opened · {unopened}</button>}
      {tags.map(item => <button key={item.name} type="button" role="radio" aria-checked={tag === item.name} className={tag === item.name ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setTag(item.name)}>{item.name} · {item.count}</button>)}
      {untagged > 0 && <button type="button" role="radio" aria-checked={tag === ":untagged"} className={tag === ":untagged" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setTag(":untagged")}>Untagged · {untagged}</button>}
    </div>}

    {(message || error) && <p className={error ? "notice notice-error" : "notice notice-success"} role={error ? "alert" : "status"}>{error || message}</p>}

    {chosen.length > 0 && <SelectionBar count={chosen.length} projects={projects} smartTagging={smartTagging} pending={pending}
      onClear={() => setSelected(new Set())}
      onTag={name => run(async () => { await tagLinks(chosen, [name]); return `Tagged ${chosen.length} “${name}”.`; })}
      onProject={id => run(async () => { const count = await addLinksToProject(chosen, id); return `Added ${count} to ${projectTitle.get(id)}.`; })}
      onSmart={() => run(async () => { const count = await smartTagLinks(chosen); return count ? `Claude tagged ${count} ${count === 1 ? "link" : "links"}.` : "No new tags suggested."; })}
      onOpen={() => { const list = links.filter(link => chosen.includes(link.id)).slice(0, 40); for (const link of list) window.open(link.url, "_blank", "noopener"); opened(list.map(link => link.id)); if (list.length > 1) setMessage("If only the first one opened, allow pop-ups for this site in Chrome (the icon at the right end of the address bar) and try again."); }}
      onDelete={() => { if (window.confirm(`Delete ${chosen.length} ${chosen.length === 1 ? "link" : "links"}? This can't be undone.`)) run(async () => { const count = await deleteLinks(chosen); return `Deleted ${count} ${count === 1 ? "link" : "links"}.`; }, () => setSelected(new Set())); }} />}

    {!links.length && <div className="empty-state"><h2>Thirty tabs open?</h2><p>Save them all at once with the DWS Chrome button, or paste a list of links. Each one gets tagged by what it is (Architecture, Fabrication, Opportunities, Video…), you can file the keepers into projects, and they open right here in the site.</p><button type="button" className="button button-primary" onClick={() => setImporting([])}>Save your first links</button></div>}
    {links.length > 0 && !shown.length && <p className="opp-empty">Nothing matches. Try another word or filter.</p>}

    {groups.map(group => {
      const ids = group.links.map(link => link.id);
      const all = ids.every(id => selected.has(id));
      return <section key={group.key} className="links-group" aria-label={group.label}>
        {groupBy !== "none" && <div className="links-group-head"><label className="links-check"><input type="checkbox" checked={all} onChange={() => toggleMany(ids)} aria-label={`Select all in ${group.label}`} /></label><h2>{group.label}</h2><span>{group.links.length}</span>
          <button type="button" className="text-button" onClick={() => { for (const link of group.links.slice(0, 40)) window.open(link.url, "_blank", "noopener"); opened(ids.slice(0, 40)); }} title="Opens each link in a new Chrome tab">Open all ↗</button></div>}
        {view === "cards" ? <ul className="links-cards">{group.links.map(link => <li key={`${group.key}-${link.id}`} className={selected.has(link.id) ? "link-card link-card-on" : "link-card"}>
          <Link href={`/links/${link.id}`} className="link-card-image" onClick={() => opened([link.id])} tabIndex={-1} aria-hidden="true"><LinkImage link={link} /></Link>
          <label className="links-check link-card-check"><input type="checkbox" checked={selected.has(link.id)} onChange={() => toggle(link.id)} aria-label={`Select ${link.title}`} /></label>
          <div className="link-card-body">
            <Link href={`/links/${link.id}`} className="link-title" onClick={() => opened([link.id])}>{link.title}{!link.openedAt && <span className="link-new" aria-label="Not opened yet" />}</Link>
            <span className="link-meta">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="link-favicon-small" src={faviconUrl(link.domain)} alt="" width={14} height={14} loading="lazy" referrerPolicy="no-referrer" />{link.domain}
              <a href={link.url} target="_blank" rel="noreferrer" onClick={() => opened([link.id])} aria-label={`Open ${link.title} in a new tab`} title="Open in a new Chrome tab">↗</a></span>
            {link.tags.length > 0 && <span className="link-chips">{link.tags.slice(0, 3).map(name => <button key={name} type="button" className="link-tag" onClick={() => setTag(name)}>{name}</button>)}</span>}
          </div>
        </li>)}</ul> : <ul className="links-list">{group.links.map(link => <li key={`${group.key}-${link.id}`} className={selected.has(link.id) ? "link-row link-row-on" : "link-row"}>
          <label className="links-check"><input type="checkbox" checked={selected.has(link.id)} onChange={() => toggle(link.id)} aria-label={`Select ${link.title}`} /></label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="link-favicon" src={faviconUrl(link.domain)} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
          <div className="link-body">
            <Link href={`/links/${link.id}`} className="link-title" onClick={() => opened([link.id])}>{link.title}{!link.openedAt && <span className="link-new" aria-label="Not opened yet" />}</Link>
            <span className="link-meta">{link.domain}{link.description ? ` · ${link.description}` : ""}</span>
            {(link.tags.length > 0 || (linkProjects.get(link.id) || []).length > 0) && <span className="link-chips">
              {link.tags.map(name => <button key={name} type="button" className="link-tag" onClick={() => setTag(name)}>{name}</button>)}
              {(linkProjects.get(link.id) || []).map(id => <span key={id} className="link-project"><Link href={`/projects/${id}?mode=links`}>{projectTitle.get(id)}</Link><button type="button" aria-label={`Remove from ${projectTitle.get(id)}`} disabled={pending} onClick={() => run(() => removeLinkFromProject(link.id, id))}>×</button></span>)}
            </span>}
          </div>
          {link.image ? <Link href={`/links/${link.id}`} className="link-thumb" onClick={() => opened([link.id])} tabIndex={-1} aria-hidden="true"><LinkImage link={link} /></Link> : <span />}
          <div className="link-actions">
            <Link className="cv-kind" href={`/links/${link.id}`} onClick={() => opened([link.id])}>Open</Link>
            <a className="cv-kind" href={link.url} target="_blank" rel="noreferrer" onClick={() => opened([link.id])} title="Open in a new Chrome tab" aria-label={`Open ${link.title} in a new tab`}>↗</a>
          </div>
        </li>)}</ul>}
      </section>;
    })}

    {importing && <ImportDialog initial={importing} existing={links} projects={projects} defaultProject={project} onClose={() => setImporting(null)} onSaved={note => { setImporting(null); setMessage(note); setError(""); router.refresh(); }} />}
  </>;
}

// The page's own preview picture; when there isn't one, or it won't load, the site's icon stands in.
function LinkImage({ link }: { link: Weblink }) {
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  if (link.image && !failed) return <img src={link.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="link-image-empty"><img src={faviconUrl(link.domain)} alt="" width={32} height={32} loading="lazy" referrerPolicy="no-referrer" /></span>;
}

function groupLinks(links: Weblink[], by: GroupBy) {
  if (by === "none") return [{ key: "all", label: "All links", links }];
  const map = new Map<string, Weblink[]>();
  const put = (key: string, link: Weblink) => map.set(key, [...(map.get(key) || []), link]);
  for (const link of links) {
    if (by === "batch") put(link.batch || "Saved one at a time", link);
    else if (by === "site") put(link.domain || "Other", link);
    else if (link.tags.length) for (const name of link.tags) put(name, link);
    else put("Untagged", link);
  }
  const groups = [...map.entries()].map(([label, items]) => ({ key: label, label, links: items }));
  if (by === "batch") return groups; // already newest first
  return groups.sort((a, b) => (a.label === "Untagged" ? 1 : b.label === "Untagged" ? -1 : b.links.length - a.links.length || a.label.localeCompare(b.label)));
}

function SelectionBar({ count, projects, smartTagging, pending, onClear, onTag, onProject, onSmart, onOpen, onDelete }: { count: number; projects: Project[]; smartTagging: boolean; pending: boolean; onClear: () => void; onTag: (name: string) => void; onProject: (id: string) => void; onSmart: () => void; onOpen: () => void; onDelete: () => void }) {
  const [name, setName] = useState("");
  return <div className="links-selection" role="region" aria-label="Selected links">
    <strong>{count} selected</strong>
    <form onSubmit={event => { event.preventDefault(); const value = parseTags(name)[0]; if (value) { onTag(value); setName(""); } }}><input value={name} onChange={event => setName(event.target.value)} placeholder="Add a tag" aria-label="Tag to add" maxLength={40} disabled={pending} /><button className="button" disabled={pending || !name.trim()}>Tag</button></form>
    {projects.length > 0 && <select value="" onChange={event => { if (event.target.value) onProject(event.target.value); }} disabled={pending} aria-label="Add to project"><option value="">Add to project…</option>{projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}
    {smartTagging && <button type="button" className="button" onClick={onSmart} disabled={pending} title="Claude reads the titles and suggests topic tags">{pending ? "Working…" : "Smart tag"}</button>}
    <button type="button" className="button" onClick={onOpen} disabled={pending}>Open in tabs ↗</button>
    <button type="button" className="button button-danger-quiet" onClick={onDelete} disabled={pending}>Delete</button>
    <button type="button" className="text-button" onClick={onClear}>Clear</button>
  </div>;
}

function ImportDialog({ initial, existing, projects, defaultProject, onClose, onSaved }: { initial: LinkDraft[]; existing: Weblink[]; projects: Project[]; defaultProject: string; onClose: () => void; onSaved: (note: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"paste" | "chrome">(initial.length ? "paste" : "chrome");
  const [text, setText] = useState("");
  const [fromFile, setFromFile] = useState<LinkDraft[] | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [extraTags, setExtraTags] = useState("");
  const [project, setProject] = useState(defaultProject);
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  const known = useMemo(() => new Set(existing.map(link => linkKey(link.url))), [existing]);
  const drafts = useMemo(() => (initial.length ? initial : fromFile ?? parseLinkList(text)), [initial, fromFile, text]);
  const isDupe = (draft: LinkDraft) => known.has(linkKey(draft.url));
  const picked = drafts.filter(draft => !skip.has(draft.url) && !isDupe(draft));
  const dupes = drafts.filter(isDupe).length;

  const save = () => {
    setError("");
    start(async () => {
      try {
        const result = await importLinks(picked, { tags: parseTags(extraTags), projectId: project || undefined, auto });
        const where = project ? ` and added to ${projects.find(item => item.id === project)?.title}` : "";
        onSaved(`Saved ${result.added} ${result.added === 1 ? "link" : "links"}${where}.${result.skipped ? ` ${result.skipped} ${result.skipped === 1 ? "was" : "were"} already saved.` : ""}`);
      } catch (failure) { setError(errorText(failure, "Could not save the links.")); }
    });
  };

  return <dialog ref={dialog} className="content-dialog opp-dialog links-dialog" aria-label="Save links" onClose={onClose}>
    <p className="eyebrow">Save links</p>
    {!initial.length && <div className="cv-kinds" role="tablist" aria-label="How to add links">
      <button type="button" role="tab" aria-selected={tab === "chrome"} className={tab === "chrome" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setTab("chrome")}>All my Chrome tabs</button>
      <button type="button" role="tab" aria-selected={tab === "paste"} className={tab === "paste" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setTab("paste")}>Paste or upload a list</button>
    </div>}

    {!initial.length && tab === "chrome" && <ChromeHelp />}
    {!initial.length && tab === "paste" && <div className="links-paste">
      <textarea value={text} onChange={event => { setText(event.target.value); setFromFile(null); }} rows={7} placeholder={"One link per line, or titles with links:\nhttps://www.archdaily.com/…\nKiln building guide - https://…\n\nA bookmarks file or OneTab export works too."} aria-label="Links to save" autoFocus />
      <label className="text-button links-file">Or choose a bookmarks file (.html)
        <input type="file" accept=".html,.htm,.txt,.md,.csv" onChange={async event => { const file = event.target.files?.[0]; if (file) { setFromFile(parseLinkList(await file.text())); setText(""); } }} />
      </label>
    </div>}

    {drafts.length > 0 && <>
      <h3 className="links-review-head">{drafts.length} {drafts.length === 1 ? "link" : "links"} found{dupes ? ` · ${dupes} already saved` : ""}</h3>
      <ul className="links-review">{drafts.map(draft => {
        const dupe = isDupe(draft); const on = !dupe && !skip.has(draft.url);
        const preview = auto ? autoTags(draft.url, draft.title) : [];
        return <li key={draft.url} className={on ? "" : "links-review-off"}>
          <label><input type="checkbox" checked={on} disabled={dupe} onChange={() => setSkip(current => { const next = new Set(current); if (next.has(draft.url)) next.delete(draft.url); else next.add(draft.url); return next; })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faviconUrl(domainOf(draft.url))} alt="" width={16} height={16} referrerPolicy="no-referrer" />
            <span><strong>{draft.title || domainOf(draft.url)}</strong><small>{draft.url}</small></span></label>
          <span className="link-chips">{dupe ? <span className="opp-pill">Already saved</span> : preview.map(name => <span key={name} className="link-tag link-tag-static">{name}</span>)}</span>
        </li>;
      })}</ul>
      <div className="cv-row">
        <label className="field"><span>Tags for all of these (optional)</span><input value={extraTags} onChange={event => setExtraTags(event.target.value)} placeholder="spring studio, kiln research" maxLength={300} /></label>
        <label className="field"><span>Add to a project (optional)</span><select value={project} onChange={event => setProject(event.target.value)}><option value="">No project</option>{projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      </div>
      <label className="links-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} /> Tag automatically by website and topic</label>
    </>}
    {(initial.length > 0 || tab === "paste") && !drafts.length && <p className="opp-empty">{initial.length ? "" : "Paste links above and they'll be listed here to check before saving."}</p>}
    <div className="cv-form-actions">{error && <p className="cv-error" role="alert">{error}</p>}
      <button type="button" className="button" onClick={() => dialog.current?.close()} disabled={pending}>Cancel</button>
      {drafts.length > 0 && <button type="button" className="button button-primary" onClick={save} disabled={pending || !picked.length}>{pending ? "Saving and reading pages…" : `Save ${picked.length} ${picked.length === 1 ? "link" : "links"}`}</button>}
    </div>
  </dialog>;
}

// One click in Chrome sends every tab in the window here. The bookmarklet does a single tab, for any browser.
function ChromeHelp() {
  const bookmarklet = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const target = `${window.location.origin}/links#import=`;
    const code = `javascript:(()=>{const d=btoa(unescape(encodeURIComponent(JSON.stringify([{u:location.href,t:document.title}])))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');window.open(${JSON.stringify(target)}+d,'_blank')})()`;
    // React refuses javascript: addresses in markup, so the bookmarklet's address is set directly.
    bookmarklet.current?.setAttribute("href", code);
  }, []);
  return <div className="links-help">
    <ol>
      <li><a className="button button-primary" href="/links/extension" download>Download the DWS Chrome button</a> and unzip it.</li>
      <li>In Chrome, go to <code>chrome://extensions</code>, turn on <strong>Developer mode</strong> (top right), click <strong>Load unpacked</strong>, and choose the unzipped <strong>dws-save-tabs</strong> folder.</li>
      <li>Pin it: click the puzzle piece next to the address bar and pin <strong>Save tabs to DWS</strong>.</li>
      <li>Any time, click it and choose <strong>Save this window</strong>. This page opens with every tab listed and tagged, ready to save.</li>
    </ol>
    <p className="links-help-alt"><strong>No extension?</strong> In Chrome, right-click a tab, choose <strong>Bookmark all tabs</strong> (or press Ctrl/⌘+Shift+D), then open the Bookmark manager, select the new folder&apos;s bookmarks, copy (Ctrl/⌘+C), and paste them on the other tab here.</p>
    <p className="links-help-alt"><strong>Just one tab?</strong> Drag this to your bookmarks bar: <a ref={bookmarklet} className="cv-kind links-bookmarklet" href="#" onClick={event => event.preventDefault()}>+ Save to DWS</a></p>
  </div>;
}

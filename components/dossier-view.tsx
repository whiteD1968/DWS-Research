/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { recordHref } from "@/lib/records";
import { countdownLabel, dossierSections, evidenceLabels, wordCount, type EvidenceKind } from "@/lib/dossier";
import { EvidencePicker, PrintDossier, RemoveEvidence, ReviewDate, StatementEditor } from "@/components/dossier-controls";

export type DossierItem = { link: string; kind: EvidenceKind; id: string; title: string; detail: string; image: string | null };
type Section = (typeof dossierSections)[number] & { text: string; items: DossierItem[] };

export function DossierView({ reviewDate, days, sections }: { reviewDate: string; days: number | null; sections: Section[] }) {
  return <div className="dossier">
    <header className="page-header"><div><p className="eyebrow">Tenure &amp; promotion</p><h1 className="page-title">Dossier</h1><p className="page-description">A statement and the evidence behind it, for each part of the case. Add work from anywhere in the studio, or file a journal entry here as you go.</p></div>
      <div className="dossier-header-actions"><PrintDossier /><Link className="button button-primary" href="/tenure/cv?new=1">+ Log accomplishment</Link></div></header>

    <section className="dossier-overview" aria-label="Overview">
      <div className="dossier-review"><p className="eyebrow">Review</p>{days !== null ? <><strong>{countdownLabel(days)}</strong><span>{new Date(`${reviewDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</span></> : <strong>Set your review date</strong>}<ReviewDate value={reviewDate} /></div>
      {sections.map(section => <a key={section.key} href={`#${section.key}`} className="dossier-tile"><p className="eyebrow">{section.short}</p><strong>{section.items.length}</strong><span>{section.items.length === 1 ? "piece of evidence" : "pieces of evidence"}</span><span className={wordCount(section.text) ? "dossier-tile-words" : "dossier-tile-words dossier-tile-empty"}>{wordCount(section.text) ? `Statement · ${wordCount(section.text)} words` : "No statement yet"}</span></a>)}
    </section>

    {sections.map((section, index) => <section key={section.key} id={section.key} className="dossier-section">
      <div className="dossier-section-head"><span className="dossier-section-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{section.label}</h2><p>{section.prompt}</p></div></div>
      <div className="dossier-section-body">
        <div><h3 className="dossier-subhead">Statement</h3><StatementEditor section={section.key} label={section.label} initial={section.text} placeholder={`Write your ${section.label.toLowerCase()} statement. Start rough; it saves as you go.`} /><div className="dossier-print-text">{section.text || "No statement yet."}</div></div>
        <div><h3 className="dossier-subhead">Evidence <span>{section.items.length}</span></h3>
          {section.items.length ? <ul className="dossier-evidence">{section.items.map(item => <li key={item.link}>
            {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="dossier-evidence-icon" aria-hidden="true">{evidenceLabels[item.kind].slice(0, 1)}</span>}
            <Link href={recordHref(item.kind, item.id)}><strong>{item.title}</strong><span>{item.detail}</span></Link>
            <RemoveEvidence id={item.link} title={item.title} />
          </li>)}</ul> : <p className="dossier-empty">Nothing here yet. Add a project, exhibition reference, syllabus, or images of student work.</p>}
          <EvidencePicker section={section.key} label={section.label} />
        </div>
      </div>
    </section>)}
  </div>;
}

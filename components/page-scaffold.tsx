type Panel = {
  kicker: string;
  title: string;
  copy: string;
};

type Row = {
  meta: string;
  title: string;
  copy: string;
};

type PageScaffoldProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  primaryPanel: Panel;
  secondaryPanel: Panel;
  rows: Row[];
};

export function PageScaffold({
  eyebrow,
  title,
  description,
  status,
  primaryPanel,
  secondaryPanel,
  rows,
}: PageScaffoldProps) {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <span className="status-pill">{status}</span>
      </section>

      <section className="workspace-grid" aria-label={`${title} workspace preview`}>
        <article className="panel">
          <p className="panel-kicker">{primaryPanel.kicker}</p>
          <h2 className="panel-title">{primaryPanel.title}</h2>
          <p className="panel-copy">{primaryPanel.copy}</p>
        </article>

        <article className="panel">
          <p className="panel-kicker">{secondaryPanel.kicker}</p>
          <h2 className="panel-title">{secondaryPanel.title}</h2>
          <p className="panel-copy">{secondaryPanel.copy}</p>
        </article>
      </section>

      <section className="placeholder-list" aria-label={`${title} placeholders`} style={{ marginTop: 20 }}>
        {rows.map((row) => (
          <article className="placeholder-row" key={`${row.meta}-${row.title}`}>
            <div className="placeholder-meta">{row.meta}</div>
            <div>
              <h3 className="placeholder-title">{row.title}</h3>
              <p className="placeholder-copy">{row.copy}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

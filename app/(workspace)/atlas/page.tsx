import Link from "next/link";
export default function AtlasPage() {
  return <><header className="page-header"><div><p className="eyebrow">Knowledge atlas / Planned</p><h1 className="page-title">Materials. Methods. Possibilities.</h1><p className="page-description">A future home for reusable knowledge about materials, fabrication processes, products, vendors, and tools.</p></div></header><section className="panel"><h2>Build the research behind your atlas</h2><p className="panel-copy">For now, gather sources in Collections and investigate materials and methods in Research Topics.</p><div className="detail-actions"><Link className="button" href="/collections">Open collections</Link><Link className="button" href="/research">Open research</Link></div></section></>;
}

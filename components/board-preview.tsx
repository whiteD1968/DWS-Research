/* eslint-disable @next/next/no-img-element -- Authenticated thumbnail endpoints. */
export type PreviewRecord = { key: string; title: string; type: string; image?: string };
export function BoardPreview({ records }: { records: PreviewRecord[] }) {
  return <div className="board-preview" aria-label={records.length ? "Linked record preview" : "Board preview unavailable"}>
    {records.length ? records.slice(0, 6).map((record, index) => <div key={`${record.key}-${index}`} className={`board-preview-tile ${record.image ? "has-image" : ""}`}>
      {record.image ? <img src={record.image} alt="" loading="lazy" decoding="async" /> : <><small>{record.type}</small><span>{record.title}</span></>}
    </div>) : <span className="board-preview-empty">Open board to explore</span>}
  </div>;
}

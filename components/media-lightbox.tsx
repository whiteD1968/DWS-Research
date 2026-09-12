"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SignedMediaItem } from "@/lib/media";

type MediaLightboxProps = {
  items: SignedMediaItem[];
};

export function MediaLightbox({ items }: MediaLightboxProps) {
  const visibleItems = useMemo(() => items.filter((item) => item.signedUrl), [items]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [fitMode, setFitMode] = useState<"fit" | "zoom">("fit");

  const close = useCallback(() => setActiveIndex(null), []);
  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null || visibleItems.length === 0) {
        return current;
      }

      return (current - 1 + visibleItems.length) % visibleItems.length;
    });
  }, [visibleItems.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null || visibleItems.length === 0) {
        return current;
      }

      return (current + 1) % visibleItems.length;
    });
  }, [visibleItems.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (activeIndex === null) {
        return;
      }

      if (event.key === "Escape") {
        close();
      }

      if (event.key === "ArrowLeft") {
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, close, showNext, showPrevious]);

  if (visibleItems.length === 0) {
    return null;
  }

  const activeItem = activeIndex === null ? null : visibleItems[activeIndex];
  const activePosition = activeIndex ?? 0;

  return (
    <>
      <div className="media-contact-sheet" aria-label="Linked media">
        {visibleItems.map((item, index) => (
          <button
            className={isDrawing(item) ? "media-contact-item media-contact-item-wide" : "media-contact-item"}
            key={item.id}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={item.alt_text ?? item.caption ?? item.title ?? item.original_filename ?? ""}
              loading="lazy"
              src={item.signedUrl ?? ""}
            />
            <span className="media-contact-meta">
              <span>{item.caption ?? item.title ?? item.original_filename ?? "Untitled image"}</span>
              <span>{getMediaTypeLabel(item)}</span>
            </span>
          </button>
        ))}
      </div>

      {activeItem ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
          <div className="lightbox-topbar">
            <div>
              <p>{activeItem.title ?? activeItem.original_filename ?? "Untitled image"}</p>
              <span>
                {activePosition + 1} / {visibleItems.length}
              </span>
            </div>
            <div className="lightbox-actions">
              <button type="button" onClick={() => setFitMode(fitMode === "fit" ? "zoom" : "fit")}>
                {fitMode === "fit" ? "Zoom" : "Fit"}
              </button>
              <button type="button" onClick={close}>
                Close
              </button>
            </div>
          </div>

          <button className="lightbox-nav lightbox-prev" type="button" onClick={showPrevious}>
            Prev
          </button>
          <div className={fitMode === "fit" ? "lightbox-stage" : "lightbox-stage lightbox-stage-zoom"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={activeItem.alt_text ?? activeItem.caption ?? activeItem.title ?? ""}
              src={activeItem.signedUrl ?? ""}
            />
          </div>
          <button className="lightbox-nav lightbox-next" type="button" onClick={showNext}>
            Next
          </button>

          {activeItem.caption ? <p className="lightbox-caption">{activeItem.caption}</p> : null}
        </div>
      ) : null}
    </>
  );
}

function isDrawing(item: SignedMediaItem) {
  return item.metadata?.visual_type === "drawing" || Boolean(item.metadata?.drawing_type);
}

function getMediaTypeLabel(item: SignedMediaItem) {
  const visualType = typeof item.metadata?.visual_type === "string" ? item.metadata.visual_type : null;
  const drawingType = typeof item.metadata?.drawing_type === "string" ? item.metadata.drawing_type : null;

  return drawingType || visualType || item.mime_type || "image";
}

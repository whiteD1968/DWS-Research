"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RecordKind = "project" | "reference";

type MediaUploadPanelProps = {
  recordId: string;
  recordKind: RecordKind;
  hasPrimaryImage: boolean;
};

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
  status: "staged" | "uploading" | "saved" | "error";
  progress: number;
  error?: string;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStoragePath({
  ownerId,
  recordKind,
  recordId,
  fileName,
}: {
  ownerId: string;
  recordKind: RecordKind;
  recordId: string;
  fileName: string;
}) {
  const folder = recordKind === "project" ? "projects" : "references";
  return `${ownerId}/${folder}/${recordId}/${crypto.randomUUID()}-${sanitizeFileName(fileName) || "image"}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploadPanel({ recordId, recordKind, hasPrimaryImage }: MediaUploadPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const stagedCount = useMemo(
    () => files.filter((file) => file.status === "staged" || file.status === "error").length,
    [files],
  );

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const nextFiles = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: allowedImageTypes.has(file.type) ? ("staged" as const) : ("error" as const),
      progress: allowedImageTypes.has(file.type) ? 0 : 100,
      error: allowedImageTypes.has(file.type) ? undefined : "Unsupported image type",
    }));

    setFiles((current) => [...current, ...nextFiles]);
    setMessage(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  function updateFile(id: string, patch: Partial<StagedFile>) {
    setFiles((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function uploadAll() {
    const uploadableFiles = files.filter((item) => item.status === "staged" || item.status === "error");
    const validFiles = uploadableFiles.filter((item) => allowedImageTypes.has(item.file.type));

    if (validFiles.length === 0) {
      setMessage("Select at least one supported jpg, png, or webp image.");
      return;
    }

    setIsUploading(true);
    setMessage(null);

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setIsUploading(false);
      setMessage("Sign in again before uploading images.");
      return;
    }

    let uploadedCount = 0;
    let shouldSetPrimary = !hasPrimaryImage;

    for (const staged of validFiles) {
      updateFile(staged.id, { status: "uploading", progress: 15, error: undefined });

      try {
        const storagePath = buildStoragePath({
          ownerId: userData.user.id,
          recordKind,
          recordId,
          fileName: staged.file.name,
        });

        const { error: uploadError } = await supabase.storage.from("research-media").upload(storagePath, staged.file, {
          contentType: staged.file.type,
          upsert: false,
        });

        if (uploadError) {
          throw uploadError;
        }

        updateFile(staged.id, { progress: 65 });

        const cleanName = sanitizeFileName(staged.file.name) || "image";
        const { data: media, error: mediaError } = await supabase
          .from("media")
          .insert({
            owner_id: userData.user.id,
            media_type: "image",
            title: cleanName,
            bucket: "research-media",
            storage_path: storagePath,
            original_filename: staged.file.name,
            mime_type: staged.file.type,
            byte_size: staged.file.size,
          })
          .select("id")
          .single();

        if (mediaError || !media) {
          throw mediaError ?? new Error("Unable to create media record.");
        }

        updateFile(staged.id, { progress: 82 });

        const { error: relationshipError } = await supabase.from("relationships").upsert(
          {
            owner_id: userData.user.id,
            source_type: recordKind,
            source_id: recordId,
            relationship_type: "has_media",
            target_type: "media",
            target_id: media.id,
            metadata: { sort_order: Date.now() + uploadedCount },
          },
          { onConflict: "source_type,source_id,relationship_type,target_type,target_id" },
        );

        if (relationshipError) {
          throw relationshipError;
        }

        if (shouldSetPrimary) {
          const tableName = recordKind === "project" ? "projects" : "references";
          const columnName = recordKind === "project" ? "cover_media_id" : "primary_media_id";
          const { error: primaryError } = await supabase
            .from(tableName)
            .update({ [columnName]: media.id })
            .eq("id", recordId);

          if (primaryError) {
            throw primaryError;
          }

          shouldSetPrimary = false;
        }

        uploadedCount += 1;
        updateFile(staged.id, { status: "saved", progress: 100 });
      } catch (error) {
        updateFile(staged.id, {
          status: "error",
          progress: 100,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    setIsUploading(false);

    if (uploadedCount > 0) {
      setMessage(`${uploadedCount} image${uploadedCount === 1 ? "" : "s"} uploaded.`);
      router.refresh();
    } else {
      setMessage("No images were uploaded. Review the file errors and try again.");
    }
  }

  return (
    <section className="panel form-stack upload-panel">
      <div>
        <p className="panel-kicker">{recordKind === "project" ? "Project media" : "Reference media"}</p>
        <h2 className="panel-title">Stage visual files</h2>
      </div>
      <label className="drop-field">
        <span>Select jpg, png, or webp images</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          multiple
          onChange={(event) => addFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
      </label>

      {files.length > 0 ? (
        <div className="staging-grid" aria-label="Selected files staged for upload">
          {files.map((item) => (
            <article className="staged-file" key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={item.previewUrl} />
              <div className="staged-file-body">
                <p>{item.file.name}</p>
                <span>
                  {item.file.type || "unknown"} - {formatBytes(item.file.size)}
                </span>
                <div className="upload-progress" aria-label={`${item.progress}% complete`}>
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                <span className={`upload-state upload-state-${item.status}`}>
                  {item.error ?? item.status}
                </span>
              </div>
              <button
                aria-label={`Remove ${item.file.name}`}
                className="staged-remove"
                disabled={isUploading && item.status === "uploading"}
                onClick={() => removeFile(item.id)}
                type="button"
              >
                x
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <div className="upload-actions">
        <button className="button button-primary" disabled={isUploading || stagedCount === 0} onClick={uploadAll} type="button">
          {isUploading ? "Uploading..." : "Upload all"}
        </button>
        {message ? <p className="upload-message">{message}</p> : null}
      </div>
    </section>
  );
}

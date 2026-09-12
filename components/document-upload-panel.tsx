"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DocumentUploadPanelProps = {
  projectId: string;
};

type StagedDocument = {
  id: string;
  file: File;
  status: "staged" | "uploading" | "saved" | "error";
  progress: number;
  error?: string;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const readable = withoutExtension.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return readable || "Untitled document";
}

function buildStoragePath({ ownerId, projectId, fileName }: { ownerId: string; projectId: string; fileName: string }) {
  return `${ownerId}/projects/${projectId}/${crypto.randomUUID()}-${sanitizeFileName(fileName) || "document.pdf"}`;
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

export function DocumentUploadPanel({ projectId }: DocumentUploadPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stagedCount = useMemo(
    () => documents.filter((document) => document.status === "staged" || document.status === "error").length,
    [documents],
  );

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const nextDocuments = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: file.type === "application/pdf" ? ("staged" as const) : ("error" as const),
      progress: file.type === "application/pdf" ? 0 : 100,
      error: file.type === "application/pdf" ? undefined : "Only PDF documents are supported.",
    }));

    setDocuments((current) => [...current, ...nextDocuments]);
    setMessage(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeDocument(id: string) {
    setDocuments((current) => current.filter((document) => document.id !== id));
  }

  function updateDocument(id: string, patch: Partial<StagedDocument>) {
    setDocuments((current) => current.map((document) => (document.id === id ? { ...document, ...patch } : document)));
  }

  async function uploadAll() {
    const validDocuments = documents.filter(
      (document) => (document.status === "staged" || document.status === "error") && document.file.type === "application/pdf",
    );

    if (validDocuments.length === 0) {
      setMessage("Select at least one PDF document.");
      return;
    }

    setIsUploading(true);
    setMessage(null);

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setIsUploading(false);
      setMessage("Sign in again before uploading documents.");
      return;
    }

    let uploadedCount = 0;

    for (const document of validDocuments) {
      updateDocument(document.id, { status: "uploading", progress: 15, error: undefined });

      try {
        const storagePath = buildStoragePath({
          ownerId: userData.user.id,
          projectId,
          fileName: document.file.name,
        });

        const { error: uploadError } = await supabase.storage
          .from("research-documents")
          .upload(storagePath, document.file, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        updateDocument(document.id, { progress: 65 });

        const { data: media, error: mediaError } = await supabase
          .from("media")
          .insert({
            owner_id: userData.user.id,
            media_type: "document",
            title: titleFromFileName(document.file.name),
            bucket: "research-documents",
            storage_path: storagePath,
            original_filename: document.file.name,
            mime_type: "application/pdf",
            byte_size: document.file.size,
            metadata: {},
          })
          .select("id")
          .single();

        if (mediaError || !media) {
          throw mediaError ?? new Error("Unable to create document record.");
        }

        updateDocument(document.id, { progress: 84 });

        const { error: relationshipError } = await supabase.from("relationships").upsert(
          {
            owner_id: userData.user.id,
            source_type: "project",
            source_id: projectId,
            relationship_type: "has_document",
            target_type: "media",
            target_id: media.id,
            metadata: { sort_order: Date.now() + uploadedCount },
          },
          { onConflict: "source_type,source_id,relationship_type,target_type,target_id" },
        );

        if (relationshipError) {
          throw relationshipError;
        }

        uploadedCount += 1;
        updateDocument(document.id, { status: "saved", progress: 100 });
      } catch (error) {
        updateDocument(document.id, {
          status: "error",
          progress: 100,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    setIsUploading(false);

    if (uploadedCount > 0) {
      setMessage(`${uploadedCount} document${uploadedCount === 1 ? "" : "s"} uploaded.`);
      router.refresh();
    } else {
      setMessage("No documents were uploaded. Review the file errors and try again.");
    }
  }

  return (
    <section className="panel form-stack document-upload-panel">
      <div>
        <p className="panel-kicker">+ Add document</p>
        <h2 className="panel-title">Stage research PDFs</h2>
      </div>
      <label
        className={isDragging ? "drop-field document-drop-field drop-field-active" : "drop-field document-drop-field"}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <span>Drop PDFs here or select documents</span>
        <input
          accept="application/pdf"
          disabled={isUploading}
          multiple
          onChange={(event) => addFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
      </label>

      {documents.length > 0 ? (
        <div className="document-staging-list" aria-label="Selected PDF documents staged for upload">
          {documents.map((document) => (
            <article className="staged-document" key={document.id}>
              <div>
                <p>{document.file.name}</p>
                <span>PDF - {formatBytes(document.file.size)}</span>
              </div>
              <div className="upload-progress" aria-label={`${document.progress}% complete`}>
                <span style={{ width: `${document.progress}%` }} />
              </div>
              <span className={`upload-state upload-state-${document.status}`}>
                {document.error ?? document.status}
              </span>
              <button
                aria-label={`Remove ${document.file.name}`}
                className="text-button"
                disabled={isUploading && document.status === "uploading"}
                onClick={() => removeDocument(document.id)}
                type="button"
              >
                Remove
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

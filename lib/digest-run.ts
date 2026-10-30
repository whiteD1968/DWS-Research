import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDigest, type Digest, type ReminderRow } from "@/lib/digest";
import { opportunityFrom, opportunityParent, type Opportunity } from "@/lib/opportunities";
import { contactFrom, contactParent, type Contact } from "@/lib/contacts";
import { leadFrom, leadParent, type Lead } from "@/lib/opportunity-scout";
import { dossierSettingsParent, parseReviewDate } from "@/lib/dossier";

// Gathers one owner's morning. Every query filters by owner, because the job runs with the service client.
export async function gatherDigest(db: SupabaseClient, ownerId: string, baseUrl: string, { now = new Date(), quiet = false } = {}): Promise<Digest | null> {
  const [reminders, opps, people, leadRows, settings] = await Promise.all([
    db.from("notes").select("id,title,plain_text,parent_type,metadata").eq("owner_id", ownerId).not("metadata->>remind_at", "is", null).is("metadata->>done_at", null).order("metadata->>remind_at", { ascending: true }).limit(200),
    db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", ownerId).eq("parent_type", opportunityParent).limit(1000),
    db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", ownerId).eq("parent_type", contactParent).limit(5000),
    db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", ownerId).eq("parent_type", leadParent).order("created_at", { ascending: false }).limit(20),
    db.from("notes").select("metadata").eq("owner_id", ownerId).eq("parent_type", dossierSettingsParent).limit(1).maybeSingle(),
  ]);
  const failed = [reminders, opps, people, leadRows, settings].find(result => result.error);
  if (failed) throw new Error("Could not load the morning's items.");
  return buildDigest({
    reminders: (reminders.data || []) as ReminderRow[],
    opportunities: (opps.data || []).map(opportunityFrom).filter((item): item is Opportunity => !!item),
    contacts: (people.data || []).map(contactFrom).filter((item): item is Contact => !!item),
    leads: (leadRows.data || []).map(leadFrom).filter((item): item is Lead => !!item),
    reviewDate: parseReviewDate((settings.data?.metadata as { review_date?: unknown } | undefined)?.review_date) || "",
    baseUrl, now, quiet,
  });
}

// Resend's REST API, so there's no extra dependency. Without a verified domain, Resend's shared sender
// can only deliver to the address on the Resend account, which is fine for a one-person studio.
export async function sendDigest(to: string, digest: Digest) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email isn't set up yet. Add RESEND_API_KEY in Vercel.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.DIGEST_FROM || "DWS Research <onboarding@resend.dev>", to: [to], subject: digest.subject, html: digest.html, text: digest.text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ? `The email service said: ${body.message}` : "The email service didn't accept the message.");
  }
}

export function siteUrl(fallback: string) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return fallback;
}

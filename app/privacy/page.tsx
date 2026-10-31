import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy · DWS Research" };

// Public, so anyone, including services the workspace reads from, can see how it handles data.
export default function PrivacyPage() {
  return <main className="privacy-page">
    <p className="eyebrow">DWS Research</p>
    <h1>Privacy policy</h1>
    <p className="privacy-updated">Last updated October 31, 2026</p>
    <p>DWS Research is a private research workspace used by Dustin White Studio. It is not offered to the public, and only its owner can sign in.</p>
    <h2>What it stores</h2>
    <p>The workspace stores the images, documents, notes, references, and boards its owner adds. When the owner follows a public Pinterest board, it also stores the images from that board’s public feed, each with its pin link, board name, and description.</p>
    <h2>How it is used</h2>
    <p>Imported content is used only inside the workspace, to organize, search, and describe the owner’s own research material. Images may be sent to Anthropic’s Claude to write captions, titles, and tags. Nothing is sold, shared with advertisers, or published.</p>
    <h2>Outside services</h2>
    <p>The workspace only reads public Pinterest feeds and never signs in to, posts to, edits, or deletes anything on Pinterest. The owner can stop following a board at any time.</p>
    <h2>Where data is kept</h2>
    <p>Data is kept in the workspace’s database and file storage (Supabase), and the site is hosted on Vercel. Access is limited to the signed-in owner.</p>
    <h2>Deleting data</h2>
    <p>The owner can delete any imported item, or stop following a board, from within the workspace at any time.</p>
    <h2>Contact</h2>
    <p>Questions about this policy can be sent to Dustin White Studio through <a href="https://www.pinterest.com/duwhite/">pinterest.com/duwhite</a>.</p>
  </main>;
}

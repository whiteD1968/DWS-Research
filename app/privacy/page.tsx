import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy · DWS Research" };

// Public, so services that connect to the workspace (such as Pinterest) can link to it.
export default function PrivacyPage() {
  return <main className="privacy-page">
    <p className="eyebrow">DWS Research</p>
    <h1>Privacy policy</h1>
    <p className="privacy-updated">Last updated October 31, 2026</p>
    <p>DWS Research is a private research workspace used by Dustin White Studio. It is not offered to the public, and only its owner can sign in.</p>
    <h2>What it stores</h2>
    <p>The workspace stores the images, documents, notes, references, and boards its owner adds. When the owner connects an outside account, it also stores what that connection brings in. For Pinterest, that means the images from boards the owner chooses to import, each with its pin link, source link, board name, and description, plus the sign-in tokens needed to read those boards.</p>
    <h2>How it is used</h2>
    <p>Imported content is used only inside the workspace, to organize, search, and describe the owner’s own research material. Images may be sent to Anthropic’s Claude to write captions, titles, and tags. Nothing is sold, shared with advertisers, or published.</p>
    <h2>Access to connected accounts</h2>
    <p>The Pinterest connection asks only to read the owner’s account, boards, and pins. It never posts, edits, or deletes anything on Pinterest. The owner can disconnect at any time from the workspace, which deletes the stored tokens, and can also revoke access from Pinterest’s settings.</p>
    <h2>Where data is kept</h2>
    <p>Data is kept in the workspace’s database and file storage (Supabase), and the site is hosted on Vercel. Access is limited to the signed-in owner.</p>
    <h2>Deleting data</h2>
    <p>The owner can delete any imported item, or disconnect a service, from within the workspace at any time.</p>
    <h2>Contact</h2>
    <p>Questions about this policy can be sent to Dustin White Studio through <a href="https://www.pinterest.com/duwhite/">pinterest.com/duwhite</a>.</p>
  </main>;
}

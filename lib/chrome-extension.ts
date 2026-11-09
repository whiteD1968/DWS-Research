// The "Save tabs to DWS" Chrome extension, built for whichever site address it is downloaded from.
// It reads the open tabs' addresses and titles, then opens the Links page with them after #import=, where they are
// reviewed and saved with the normal sign-in. The extension itself stores nothing and talks to no server.
export function chromeExtensionFiles(origin: string, icons: { size: number; data: Uint8Array }[] = []) {
  const iconMap = Object.fromEntries(icons.map(icon => [String(icon.size), `icon-${icon.size}.png`]));
  const manifest = {
    manifest_version: 3,
    name: "Save tabs to DWS",
    description: "Send every open tab to the Links page of DWS Research, tagged and ready to file.",
    version: "1.0.0",
    permissions: ["tabs"],
    action: { default_title: "Save tabs to DWS", default_popup: "popup.html", ...(icons.length ? { default_icon: iconMap } : {}) },
    ...(icons.length ? { icons: iconMap } : {}),
    commands: { _execute_action: { suggested_key: { default: "Alt+Shift+S" }, description: "Open Save tabs to DWS" } },
  };
  const popup = `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{width:260px;margin:0;padding:14px;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#121212;background:#f6f4ef}
h1{margin:0 0 10px;font-size:13px;font-weight:600;letter-spacing:.02em}
button{display:block;width:100%;margin:0 0 8px;padding:10px 12px;border:1px solid #cfc9bf;border-radius:6px;background:#fff;font:inherit;text-align:left;cursor:pointer}
button:hover{border-color:#121212}button.primary{background:#2b44e8;border-color:#2b44e8;color:#fff}button.primary:hover{background:#1c2fb8}
button:disabled{opacity:.5;cursor:default}label{display:flex;gap:6px;align-items:center;margin:4px 0 10px;color:#5e5b55}
small{display:block;color:#5e5b55}
</style></head><body>
<h1>Save tabs to DWS</h1>
<button id="window" class="primary">Save this window</button>
<button id="all">Save all windows</button>
<label><input type="checkbox" id="pinned"> Include pinned tabs</label>
<small id="note"></small>
<script src="popup.js"></script>
</body></html>
`;
  const script = `const site = ${JSON.stringify(origin)};
const note = document.getElementById("note");
const usable = (tab, pinned) => /^https?:/.test(tab.url || "") && !(tab.url || "").startsWith(site) && (pinned || !tab.pinned);
function encode(list) {
  const bytes = new TextEncoder().encode(JSON.stringify(list));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}
async function count() {
  const pinned = document.getElementById("pinned").checked;
  const here = (await chrome.tabs.query({ currentWindow: true })).filter(tab => usable(tab, pinned)).length;
  const all = (await chrome.tabs.query({})).filter(tab => usable(tab, pinned)).length;
  document.getElementById("window").textContent = "Save this window (" + here + " tabs)";
  document.getElementById("all").textContent = "Save all windows (" + all + " tabs)";
  document.getElementById("window").disabled = !here; document.getElementById("all").disabled = !all;
}
async function save(query) {
  const pinned = document.getElementById("pinned").checked;
  const seen = new Set(); const list = [];
  for (const tab of await chrome.tabs.query(query)) {
    if (!usable(tab, pinned) || seen.has(tab.url)) continue;
    seen.add(tab.url); list.push({ u: tab.url, t: (tab.title || "").slice(0, 300) });
  }
  if (!list.length) { note.textContent = "No web pages to save in this window."; return; }
  await chrome.tabs.create({ url: site + "/links#import=" + encode(list.slice(0, 300)) });
  window.close();
}
document.getElementById("window").addEventListener("click", () => save({ currentWindow: true }));
document.getElementById("all").addEventListener("click", () => save({}));
document.getElementById("pinned").addEventListener("change", count);
note.textContent = "Opens " + site.replace(/^https?:\\/\\//, "") + " to review and save. Your tabs stay open.";
count();
`;
  const readme = `Save tabs to DWS
================

Install (once):
1. Unzip this file. Keep the dws-save-tabs folder somewhere it will stay, like Documents.
2. In Chrome, open chrome://extensions
3. Turn on "Developer mode" (top right).
4. Click "Load unpacked" and choose the dws-save-tabs folder.
5. Click the puzzle piece next to the address bar and pin "Save tabs to DWS".

Use:
Click the DWS button and choose "Save this window" (or press Alt+Shift+S).
${origin}/links opens with every tab listed and tagged. Check them, add a project if you like, and save.

The extension only reads tab addresses and titles when you click it, and sends them nowhere except that page.
`;
  return [
    { name: "dws-save-tabs/manifest.json", data: JSON.stringify(manifest, null, 2) },
    { name: "dws-save-tabs/popup.html", data: popup },
    { name: "dws-save-tabs/popup.js", data: script },
    { name: "dws-save-tabs/README.txt", data: readme },
    ...icons.map(icon => ({ name: `dws-save-tabs/icon-${icon.size}.png`, data: icon.data })),
  ];
}

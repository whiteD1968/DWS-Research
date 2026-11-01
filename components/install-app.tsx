"use client";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Offers "Install desktop app" when Chrome or Edge says the site can be installed. The browser stops offering once it's installed, so the button goes away.
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed || !prompt) return null;
  return <button type="button" className="text-button install-app" onClick={async () => { await prompt.prompt(); const { outcome } = await prompt.userChoice; if (outcome === "accepted") setInstalled(true); setPrompt(null); }}>
    Install desktop app
  </button>;
}

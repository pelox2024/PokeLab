/**
 * Installation PWA : capture l'évènement `beforeinstallprompt` au démarrage
 * (il se déclenche tôt) et l'expose via un hook pour proposer l'installation.
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

/** À appeler une fois au démarrage (main.tsx). */
export function initPwaInstallCapture(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("pwa:installable"));
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(!!deferred);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onAvail = () => setCanInstall(!!deferred);
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      deferred = null;
    };
    window.addEventListener("pwa:installable", onAvail);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa:installable", onAvail);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const res = await deferred.userChoice;
    deferred = null;
    setCanInstall(false);
    return res.outcome === "accepted";
  };

  return { canInstall, installed, promptInstall, ios: isIos() };
}

import { useEffect, useRef, useState } from "react";

/**
 * Google AdSense ad shown as the second row of every Profits table.
 * Fill in both IDs from AdSense (Ads → By ad unit → Display ad → Get code).
 * While either is empty, nothing renders and the AdSense script is never loaded.
 */
const ADSENSE_CLIENT: string = "ca-pub-1219390617775936";
const ADSENSE_SLOT: string = ""; // e.g. "1234567890"

const ENABLED = ADSENSE_CLIENT !== "" && ADSENSE_SLOT !== "";
const SCRIPT_SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

/** Loads the AdSense script once per visit; resolves false when an ad blocker stops it. */
let scriptLoaded: Promise<boolean> | null = null;
const loadAdScript = (): Promise<boolean> => {
  scriptLoaded ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${SCRIPT_SRC}?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return scriptLoaded;
};

/**
 * One ad as a table row, the size of a shard row (AdSense's minimum height is 50px).
 * Renders nothing until both IDs are set, or when an ad blocker stops the script.
 */
export const AdRow = ({ colSpan }: { colSpan: number }) => {
  const [blocked, setBlocked] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!ENABLED) return;
    let active = true;
    // Ask for exactly one ad per mounted row (StrictMode runs effects twice in dev).
    if (!requested.current) {
      requested.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Ad blockers can make the push throw; the row is hidden below.
      }
    }
    loadAdScript().then((ok) => {
      if (active && !ok) setBlocked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ENABLED || blocked) return null;

  return (
    <tr className="profit-ad border-b border-slate-700/50 bg-slate-900/60">
      <td colSpan={colSpan} className="px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">Ad</span>
          {/* Fixed height, expandable width: no data-ad-format, so AdSense keeps the 50px. */}
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", maxWidth: 1200, height: 50 }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_SLOT}
            data-adtest={import.meta.env.DEV ? "on" : undefined}
          />
        </div>
      </td>
    </tr>
  );
};

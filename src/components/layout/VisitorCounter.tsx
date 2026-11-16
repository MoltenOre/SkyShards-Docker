import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

// Served by the Cloudflare Worker in front of the site (POST counts a visit, GET only reads).
// Not available in `pnpm dev` or the Docker image on its own, so the badge simply stays hidden there.
const VISITS_URL = "/_visits";
const SESSION_KEY = "skyshards-visit-counted";

const isCountedThisSession = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

const markCountedThisSession = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage blocked: the visit may be counted again on the next load, which is fine.
  }
};

/** Total-visits badge shown next to the logo. Counts once per browser session. */
export const VisitorCounter = () => {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const shouldCount = !isCountedThisSession();
    // Mark before the request so React StrictMode's second effect run doesn't count twice.
    if (shouldCount) markCountedThisSession();

    fetch(VISITS_URL, { method: shouldCount ? "POST" : "GET", cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ total?: unknown }>) : null))
      .then((data) => {
        if (active && typeof data?.total === "number") setTotal(data.total);
      })
      .catch(() => {
        // Counter unavailable: keep the badge hidden.
      });

    return () => {
      active = false;
    };
  }, []);

  if (total === null) return null;

  return (
    <span
      title="Total visits"
      aria-label={`${total.toLocaleString("en-US")} total visits`}
      className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700"
    >
      <Eye className="w-3 h-3" aria-hidden />
      <span>{total.toLocaleString("en-US")}</span>
    </span>
  );
};

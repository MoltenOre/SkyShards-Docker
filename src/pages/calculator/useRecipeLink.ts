import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useToast } from "../../components/ui/toastContext";
import { SHARD_DESCRIPTIONS } from "../../constants";
import { DataService, buildProfileImport, hypixelService, pickProfile, type ProfileImport } from "../../services";
import type { Shard } from "../../types/types";
import { buildShardIndex, isRecipeLinkEmpty, parseRecipeLink, resolveShardIdentifier, saveHypixelProfileMeta } from "../../utilities";

/** What a /recipe link resolved to, handed to the page to apply in one go. */
export interface ResolvedRecipeLink {
  /** The target shard; null when the link named none or named one that does not exist. */
  shard: Shard | null;
  /** Explicit ?count; null means "what is left to max the attribute". */
  count: number | null;
  /** The imported profile; null without ?user or when the import failed. */
  imported: ProfileImport | null;
}

const PROFILE_TOAST_ID = "recipe-link-profile";

/**
 * Applies a /recipe link (see utilities/recipeLink.ts) once per distinct URL: resolves
 * the target shard, imports ?user's profile, then calls `apply` with both. A failed
 * profile import still applies the target, so the link always shows a recipe.
 */
export const useRecipeLink = (apply: (link: ResolvedRecipeLink) => void): void => {
  const { target: pathTarget } = useParams();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const { toast } = useToast();

  // Latest callbacks, so the effect runs per URL and not per render.
  const applyRef = useRef(apply);
  const toastRef = useRef(toast);
  useEffect(() => {
    applyRef.current = apply;
    toastRef.current = toast;
  });

  useEffect(() => {
    const link = parseRecipeLink(pathTarget, new URLSearchParams(search));
    if (isRecipeLinkEmpty(link)) return;

    // StrictMode and quick navigations start a second run; only the latest one applies.
    let cancelled = false;
    const notify: typeof toast = (opts) => toastRef.current(opts);

    const resolve = async () => {
      let shard: Shard | null = null;
      if (link.target) {
        const shards = await DataService.getInstance().loadShards();
        shard = resolveShardIdentifier(link.target, buildShardIndex(shards, SHARD_DESCRIPTIONS));
        if (!shard && !cancelled) {
          notify({ title: "Unknown shard", description: `No shard matches "${link.target}".`, variant: "error", duration: 6000 });
        }
      }

      let imported: ProfileImport | null = null;
      if (link.user) {
        notify({ id: PROFILE_TOAST_ID, title: `Loading ${link.user}'s profile…`, variant: "info", duration: 30_000 });
        try {
          const response = await hypixelService.fetchPlayerProfile(link.user);
          if (cancelled) return;
          const profile = pickProfile(response, link.profile);
          if (profile) {
            imported = buildProfileImport(profile);
            saveHypixelProfileMeta({ username: response.username, profileName: profile.profile.cute_name, lastImportTime: Date.now() });
            notify({
              id: PROFILE_TOAST_ID,
              title: `Imported ${response.username} (${profile.profile.cute_name})`,
              description: "Using your shards and attribute levels.",
              variant: "success",
            });
          } else {
            const reason = link.profile && response.profiles.length > 0 ? `No profile named "${link.profile}".` : "No SkyBlock profiles found.";
            notify({ id: PROFILE_TOAST_ID, title: `Could not import ${response.username}`, description: reason, variant: "error", duration: 6000 });
          }
        } catch (err) {
          if (cancelled) return;
          const description = err instanceof Error ? err.message : "Failed to fetch profile";
          notify({ id: PROFILE_TOAST_ID, title: `Could not import ${link.user}`, description, variant: "error", duration: 6000 });
        }
      }

      if (!cancelled && (shard || imported)) applyRef.current({ shard, count: link.count, imported });
    };

    resolve().catch((err) => console.error("Failed to open recipe link:", err));
    return () => {
      cancelled = true;
    };
  }, [pathTarget, search]);
};

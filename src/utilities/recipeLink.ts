// The /recipe deep link, meant for in-game mods that open the site for a hovered shard:
//
//   /recipe/<shard>
//   /recipe?target=<shard>&user=<ign>&count=<n>&profile=<name>
//
// Both forms can be mixed (/recipe/<shard>?user=<ign>); the path segment wins over
// ?target. <shard> is anything `resolveShardIdentifier` understands. Pure: no React.

export interface RecipeLink {
  /** Shard identifier as written in the link; not yet resolved. */
  target: string | null;
  /** Minecraft username whose profile is imported. */
  user: string | null;
  /** SkyBlock profile name ("Apple") or id; otherwise the player's selected profile. */
  profile: string | null;
  /** How many shards to make; otherwise what is left to max the attribute. */
  count: number | null;
}

/** Upper bound on ?count, so a typo cannot start a calculation that never ends. */
export const MAX_LINK_COUNT = 100_000;

const firstParam = (params: URLSearchParams, names: readonly string[]): string | null => {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) return value;
  }
  return null;
};

const parseCount = (value: string | null): number | null => {
  if (value === null) return null;
  const count = Number(value);
  if (!Number.isFinite(count) || count < 1) return null;
  return Math.min(Math.floor(count), MAX_LINK_COUNT);
};

/** Read a /recipe link. `pathTarget` is the `:target` route param, if any. Unknown parameters are ignored. */
export const parseRecipeLink = (pathTarget: string | undefined, params: URLSearchParams): RecipeLink => {
  return {
    target: pathTarget?.trim() || firstParam(params, ["target", "shard", "id"]),
    user: firstParam(params, ["user", "username", "ign", "player"]),
    profile: firstParam(params, ["profile"]),
    count: parseCount(firstParam(params, ["count", "quantity", "qty", "amount"])),
  };
};

/** True when the link asks for anything at all. */
export const isRecipeLinkEmpty = (link: RecipeLink): boolean => !link.target && !link.user;

import { LEVELED_SHARDS, fusedCountToTierLevel, type ShardLevelKey } from "../constants";
import type { CalculationFormData } from "../schemas";
import type { HypixelProfileResponse, ProfileData } from "./hypixelService";

/** What importing one SkyBlock profile changes in the calculator. */
export interface ProfileImport {
  /** Owned shards by key. */
  inventory: Map<string, number>;
  /** Shards fused into each attribute, by key. */
  ownedAttributes: Map<string, number>;
  /** Form levels of the leveled shards, derived from their attributes. */
  levels: Pick<CalculationFormData, ShardLevelKey>;
  /** Ironman and Stranded profiles cannot use the Bazaar. */
  ironman: boolean;
}

const IRONMAN_GAME_MODES: ReadonlySet<string> = new Set(["ironman", "island"]);

export const buildProfileImport = (profile: ProfileData): ProfileImport => {
  const fusedCount = (shardId: string) => profile.attributes.find((attr) => attr.id.toUpperCase() === shardId.toUpperCase())?.level ?? 0;
  const levels = Object.fromEntries(LEVELED_SHARDS.map(({ shardId, rarity, key }) => [key, fusedCountToTierLevel(fusedCount(shardId), rarity)])) as Pick<
    CalculationFormData,
    ShardLevelKey
  >;

  return {
    inventory: new Map(profile.shards.filter((shard) => shard.amount > 0).map((shard) => [shard.id, shard.amount])),
    ownedAttributes: new Map(profile.attributes.filter((attr) => attr.level > 0).map((attr) => [attr.id, attr.level])),
    levels,
    ironman: IRONMAN_GAME_MODES.has(profile.profile.game_mode?.toLowerCase() ?? ""),
  };
};

/** Most recently saved first. */
export const sortProfilesByLastSave = (profiles: readonly ProfileData[]): ProfileData[] =>
  [...profiles].sort((a, b) => b.profile.last_save - a.profile.last_save);

/**
 * The profile a link or import should use: the one named by `hint` (cute name or id,
 * case-insensitive), else the one the player has selected in game, else the most
 * recently saved. Null when the player has no profiles or `hint` matches none.
 */
export const pickProfile = (response: HypixelProfileResponse, hint?: string | null): ProfileData | null => {
  const { profiles } = response;
  if (profiles.length === 0) return null;

  if (hint) {
    const wanted = hint.trim().toLowerCase();
    return profiles.find(({ profile }) => profile.cute_name.toLowerCase() === wanted || profile.profile_id.toLowerCase() === wanted) ?? null;
  }

  const selectedId = response.selected_profile_id;
  return (
    profiles.find(({ profile }) => (selectedId ? profile.profile_id === selectedId : profile.selected)) ??
    profiles.find(({ profile }) => profile.selected) ??
    sortProfilesByLastSave(profiles)[0]
  );
};

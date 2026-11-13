import type { Shard } from "../types/types";
import type { ShardDescriptions } from "../types/shardDescription";

// Resolves the many ways a shard can be named in a link to one shard. In-game mods know
// the item they hover by its Hypixel / NEU id, people know it by name, and the site uses
// its own keys, so all of these must lead to the same shard:
//
//   R34                          site key (case-insensitive, "-N" suffix kept)
//   SHARD_PYTHON / PYTHON        Hypixel item id, with or without the SHARD_ prefix
//   Python / lizard_king         shard name; "_", "-", "+" and spaces are interchangeable
//   accessory_size               attribute id (desc.json)
//   ATTRIBUTE_ACCESSORY_SIZE_SHARD;1, ATTRIBUTE_SHARD_ACCESSORY_SIZE
//                                mod-style attribute ids; a trailing ";N" is ignored
//   Accessory Size               attribute title
//
// Pure: no React, no fetching. Callers pass the loaded shards and descriptions.

/** Lowercase, every run of non-alphanumerics becomes one "_", no leading/trailing "_". */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type Source = "key" | "internalId" | "name" | "attribute" | "title";

/**
 * Lookup order when the input gives no hint. Names come before attribute ids because two
 * of them collide ("starborn" is L44's name and L32's attribute); an explicit
 * ATTRIBUTE_ or SHARD_ prefix overrides this (see `resolveShardIdentifier`).
 */
const DEFAULT_ORDER: readonly Source[] = ["key", "internalId", "name", "attribute", "title"];
const ATTRIBUTE_ORDER: readonly Source[] = ["key", "attribute", "title", "internalId", "name"];
const SHARD_ID_ORDER: readonly Source[] = ["key", "internalId", "name", "attribute", "title"];

export type ShardIndex = Record<Source, Map<string, Shard>>;

/** Build once per shard list; `resolveShardIdentifier` only reads it. */
export const buildShardIndex = (shards: readonly Shard[], descriptions: ShardDescriptions): ShardIndex => {
  const index: ShardIndex = { key: new Map(), internalId: new Map(), name: new Map(), attribute: new Map(), title: new Map() };
  // First writer wins, so a collision inside one source keeps the lower key.
  const add = (source: Source, value: string | undefined, shard: Shard) => {
    if (!value) return;
    const key = normalize(value);
    if (key && !index[source].has(key)) index[source].set(key, shard);
  };
  for (const shard of shards) {
    add("key", shard.id, shard);
    add("internalId", shard.internal_id, shard);
    add("internalId", shard.internal_id?.replace(/^SHARD_/i, ""), shard);
    add("name", shard.name, shard);
    const desc = descriptions[shard.id];
    add("attribute", desc?.id, shard);
    add("title", desc?.title, shard);
  }
  return index;
};

/**
 * The shard an identifier names, or null. Tries the identifier as given, then with mod
 * decorations stripped (ATTRIBUTE_ / SHARD_ prefixes, a _SHARD suffix).
 */
export const resolveShardIdentifier = (identifier: string, index: ShardIndex): Shard | null => {
  // "ATTRIBUTE_ACCESSORY_SIZE_SHARD;1": the ";1" is the mod's item variant, not part of the id.
  const raw = identifier.trim().replace(/;\d*$/, "");
  const full = normalize(raw);
  if (!full) return null;

  const isAttribute = full.startsWith("attribute_");
  const isShardId = !isAttribute && full.startsWith("shard_");

  const candidates = new Set<string>([full]);
  let stripped = full;
  stripped = stripped.replace(/^attribute_shard_/, "").replace(/^attribute_/, "");
  stripped = stripped.replace(/^shard_/, "").replace(/_shard$/, "");
  candidates.add(stripped);

  const order = isAttribute ? ATTRIBUTE_ORDER : isShardId ? SHARD_ID_ORDER : DEFAULT_ORDER;
  for (const source of order) {
    for (const candidate of candidates) {
      const shard = index[source].get(candidate);
      if (shard) return shard;
    }
  }
  return null;
};

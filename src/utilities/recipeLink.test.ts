import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import type { FusionJson, Shard } from "../types/types";
import { SHARD_DESCRIPTIONS } from "../constants";
import { MAX_LINK_COUNT, isRecipeLinkEmpty, parseRecipeLink } from "./recipeLink";
import { buildShardIndex, resolveShardIdentifier } from "./shardLookup";

const fusion = JSON.parse(readFileSync(resolve(__dirname, "../../public/fusion-data.json"), "utf-8")) as FusionJson;
const shards: Shard[] = Object.entries(fusion.shards).map(([id, shard]) => ({ ...shard, id, rate: 0 }));
const index = buildShardIndex(shards, SHARD_DESCRIPTIONS);
const lookup = (identifier: string) => resolveShardIdentifier(identifier, index)?.id ?? null;

describe("resolveShardIdentifier", () => {
  it("reads mod-style attribute ids, with or without the ;N variant", () => {
    expect(lookup("ATTRIBUTE_ACCESSORY_SIZE_SHARD;1")).toBe("R34");
    expect(lookup("ATTRIBUTE_ACCESSORY_SIZE_SHARD")).toBe("R34");
    expect(lookup("ATTRIBUTE_SHARD_ACCESSORY_SIZE;1")).toBe("R34");
    expect(lookup("accessory_size")).toBe("R34");
    expect(lookup("Accessory Size")).toBe("R34");
  });

  it("reads site keys, Hypixel item ids and shard names", () => {
    expect(lookup("r9")).toBe("R9");
    expect(lookup("SHARD_PYTHON")).toBe("R9");
    expect(lookup("PYTHON_SHARD")).toBe("R9");
    expect(lookup("python")).toBe("R9");
    expect(lookup("Lizard King")).toBe("R8");
    expect(lookup("lizard_king")).toBe("R8");
    expect(lookup("lizard-king")).toBe("R8");
  });

  it("lets an ATTRIBUTE_ or SHARD_ prefix settle a name that is also an attribute id", () => {
    // "Starborn" is L44's name and L32's attribute.
    expect(lookup("starborn")).toBe("L44");
    expect(lookup("SHARD_STARBORN")).toBe("L44");
    expect(lookup("ATTRIBUTE_STARBORN_SHARD;1")).toBe("L32");
  });

  it("returns null for anything else", () => {
    expect(lookup("")).toBeNull();
    expect(lookup(";1")).toBeNull();
    expect(lookup("NOT_A_REAL_SHARD")).toBeNull();
  });

  it("resolves every shard by its key, item id, name and attribute id", () => {
    for (const shard of shards) {
      expect(lookup(shard.id), shard.id).toBe(shard.id);
      expect(lookup(shard.internal_id), shard.internal_id).toBe(shard.id);
      expect(lookup(`ATTRIBUTE_${SHARD_DESCRIPTIONS[shard.id].id.toUpperCase()}_SHARD;1`), SHARD_DESCRIPTIONS[shard.id].id).toBe(shard.id);
    }
  });
});

describe("parseRecipeLink", () => {
  const parse = (path: string | undefined, query: string) => parseRecipeLink(path, new URLSearchParams(query));

  it("reads the query form", () => {
    expect(parse(undefined, "user=Noobyguy775&target=ATTRIBUTE_ACCESSORY_SIZE_SHARD;1&count=12")).toEqual({
      target: "ATTRIBUTE_ACCESSORY_SIZE_SHARD;1",
      user: "Noobyguy775",
      profile: null,
      count: 12,
    });
  });

  it("prefers the path target and accepts aliases", () => {
    expect(parse("ATTRIBUTE_ACCESSORY_SIZE_SHARD", "shard=python&ign=Foo&quantity=3&profile=Apple")).toEqual({
      target: "ATTRIBUTE_ACCESSORY_SIZE_SHARD",
      user: "Foo",
      profile: "Apple",
      count: 3,
    });
  });

  it("ignores counts that are not positive numbers and caps huge ones", () => {
    expect(parse("R9", "count=0").count).toBeNull();
    expect(parse("R9", "count=abc").count).toBeNull();
    expect(parse("R9", "count=2.9").count).toBe(2);
    expect(parse("R9", "count=1e9").count).toBe(MAX_LINK_COUNT);
  });

  it("is empty without a target or user", () => {
    expect(isRecipeLinkEmpty(parse(undefined, ""))).toBe(true);
    expect(isRecipeLinkEmpty(parse(undefined, "count=5"))).toBe(true);
    expect(isRecipeLinkEmpty(parse(undefined, "user=Foo"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { HypixelProfileResponse, ProfileData } from "./hypixelService";
import { buildProfileImport, pickProfile } from "./profileImport";

const profile = (id: string, cuteName: string, lastSave: number, extra: Partial<ProfileData["profile"]> = {}): ProfileData => ({
  profile: { profile_id: id, cute_name: cuteName, game_mode: null, last_save: lastSave, selected: false, ...extra },
  shards: [],
  attributes: [],
});

const response = (profiles: ProfileData[], selected: string | null = null): HypixelProfileResponse => ({
  username: "Player",
  uuid: "uuid",
  profiles,
  selected_profile_id: selected,
});

describe("pickProfile", () => {
  const apple = profile("a", "Apple", 1);
  const banana = profile("b", "Banana", 3);
  const cherry = profile("c", "Cherry", 2, { selected: true });

  it("takes the named profile, by cute name or id", () => {
    expect(pickProfile(response([apple, banana]), "apple")).toBe(apple);
    expect(pickProfile(response([apple, banana]), "B")).toBe(banana);
    expect(pickProfile(response([apple, banana]), "Durian")).toBeNull();
  });

  it("falls back to the selected profile, then the most recently saved", () => {
    expect(pickProfile(response([apple, banana, cherry], "a"))).toBe(apple);
    expect(pickProfile(response([apple, banana, cherry]))).toBe(cherry);
    expect(pickProfile(response([apple, banana]))).toBe(banana);
    expect(pickProfile(response([]))).toBeNull();
  });
});

describe("buildProfileImport", () => {
  it("keeps owned shards and attributes, derives levels and ironman", () => {
    const imported = buildProfileImport({
      profile: { profile_id: "a", cute_name: "Apple", game_mode: "island", last_save: 0, selected: true },
      shards: [
        { id: "R9", name: "Python", amount: 5, rarity: "rare" },
        { id: "C1", name: "Grove", amount: 0, rarity: "common" },
      ],
      attributes: [
        { id: "R9", name: "Python", level: 48 },
        { id: "C1", name: "Grove", level: 0 },
      ],
    });
    expect([...imported.inventory]).toEqual([["R9", 5]]);
    expect([...imported.ownedAttributes]).toEqual([["R9", 48]]);
    expect(imported.levels.pythonLevel).toBe(10);
    expect(imported.levels.newtLevel).toBe(0);
    expect(imported.ironman).toBe(true);
    expect(buildProfileImport(profile("b", "Banana", 0)).ironman).toBe(false);
  });
});

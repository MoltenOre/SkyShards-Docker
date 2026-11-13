# SkyShards

[🌐 Live App](https://skyshards.com/)

SkyShards is a website for the Hypixel Skyblock attribute fusion system.

## Features
- Calculate the fastest/cheapest way to fuse attributes
- Automatic adjustment of fusion tree based on custom rates and current bazaar prices
- Clean and responsive design

## Linking to a recipe (for mods)
Open the calculator preset to a shard, e.g. from an in-game mod when hovering one:

```
https://skyshards.com/recipe/ATTRIBUTE_ACCESSORY_SIZE_SHARD
https://skyshards.com/recipe?user=Noobyguy775&target=ATTRIBUTE_ACCESSORY_SIZE_SHARD;1&count=12
```

| Parameter | Meaning |
| --- | --- |
| `target` (or the path segment) | The shard: site key (`R34`), item id (`SHARD_PYTHON`), name (`Lizard King`, `lizard_king`), attribute id (`accessory_size`, `ATTRIBUTE_ACCESSORY_SIZE_SHARD;1`). A trailing `;N` is ignored. |
| `user` | Minecraft username. Imports the player's shards and attribute levels and turns on "use inventory"; Ironman/Stranded profiles switch the calculator to Ironman. |
| `profile` | Optional profile name or id. Defaults to the profile selected in game. |
| `count` | How many shards to make. Defaults to what is left to max the attribute. |

## Getting Started
To run locally:
```sh
pnpm install
pnpm run dev
```

## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

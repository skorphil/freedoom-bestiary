import { assertEquals } from "@std/assert";
import {
  buildGridLayout,
  computeSpritesheetDimensions,
  cellToPosition,
  buildSpritesheetMetadata,
  type PaddedCell,
} from "../src/create-spritesheet.ts";
import { GridCell, Version } from "../src/types.ts";

function createPaddedMap(layout: any, w: number, h: number): Map<string, PaddedCell> {
  const map = new Map<string, PaddedCell>();
  for (const key of layout.cells.keys()) {
    map.set(key, { x: 0, y: 0, w, h, path: "" });
  }
  return map;
}

Deno.test("buildGridLayout - frames sorted alphabetically", () => {
  const cells: GridCell[] = [
    {
      frame: "B",
      angle: 1,
      mirror: false,
      sourceFile: "b1.png",
      file: { name: "b1.png", url: "" },
    },
    {
      frame: "A",
      angle: 1,
      mirror: false,
      sourceFile: "a1.png",
      file: { name: "a1.png", url: "" },
    },
    {
      frame: "C",
      angle: 1,
      mirror: false,
      sourceFile: "c1.png",
      file: { name: "c1.png", url: "" },
    },
  ];
  const layout = buildGridLayout(cells);
  assertEquals(layout.frames, ["A", "B", "C"]);
});

Deno.test("buildGridLayout - angles sorted numerically", () => {
  const cells: GridCell[] = [
    {
      frame: "A",
      angle: 8,
      mirror: false,
      sourceFile: "a8.png",
      file: { name: "a8.png", url: "" },
    },
    {
      frame: "A",
      angle: 1,
      mirror: false,
      sourceFile: "a1.png",
      file: { name: "a1.png", url: "" },
    },
    {
      frame: "A",
      angle: 0,
      mirror: false,
      sourceFile: "a0.png",
      file: { name: "a0.png", url: "" },
    },
  ];
  const layout = buildGridLayout(cells);
  assertEquals(layout.angles, [0, 1, 8]);
});

Deno.test("buildGridLayout - cell map key format", () => {
  const cells: GridCell[] = [
    {
      frame: "A",
      angle: 3,
      mirror: false,
      sourceFile: "a3.png",
      file: { name: "a3.png", url: "" },
    },
  ];
  const layout = buildGridLayout(cells);
  assertEquals(layout.cells.has("A_3"), true);
});

Deno.test("buildGridLayout - angle-0 cells included", () => {
  const cells: GridCell[] = [
    {
      frame: "H",
      angle: 0,
      mirror: false,
      sourceFile: "h0.png",
      file: { name: "h0.png", url: "" },
    },
  ];
  const layout = buildGridLayout(cells);
  assertEquals(layout.cells.has("H_0"), true);
});

Deno.test("buildGridLayout - mirror cells stored separately", () => {
  const cells: GridCell[] = [
    {
      frame: "A",
      angle: 2,
      mirror: false,
      sourceFile: "a2a8.png",
      file: { name: "a2a8.png", url: "" },
    },
    {
      frame: "A",
      angle: 8,
      mirror: true,
      sourceFile: "a2a8.png",
      file: { name: "a2a8.png", url: "" },
    },
  ];
  const layout = buildGridLayout(cells);
  assertEquals(layout.cells.has("A_2"), true);
  assertEquals(layout.cells.has("A_8"), true);
});

Deno.test("buildGridLayout - cross-frame mirror", () => {
  const cells: GridCell[] = [
    {
      frame: "A",
      angle: 2,
      mirror: false,
      sourceFile: "a2d8.png",
      file: { name: "a2d8.png", url: "" },
    },
    {
      frame: "D",
      angle: 8,
      mirror: true,
      sourceFile: "a2d8.png",
      file: { name: "a2d8.png", url: "" },
    },
  ];
  const layout = buildGridLayout(cells);
  assertEquals(layout.cells.has("A_2"), true);
  assertEquals(layout.cells.has("D_8"), true);
});

Deno.test("buildGridLayout - empty input", () => {
  const layout = buildGridLayout([]);
  assertEquals(layout.frames.length, 0);
  assertEquals(layout.angles.length, 0);
  assertEquals(layout.cells.size, 0);
});

Deno.test("computeSpritesheetDimensions - 3x2 grid", () => {
  const layout = {
    frames: ["A", "B", "C"],
    angles: [1, 2],
    cells: new Map(),
  };
  const dims = computeSpritesheetDimensions(layout, 64, 96);
  assertEquals(dims.width, 192); // 3 cols * 64
  assertEquals(dims.height, 192); // 2 rows * 96
});

Deno.test("computeSpritesheetDimensions - single cell", () => {
  const layout = {
    frames: ["A"],
    angles: [1],
    cells: new Map(),
  };
  const dims = computeSpritesheetDimensions(layout, 64, 96);
  assertEquals(dims.width, 64);
  assertEquals(dims.height, 96);
});

Deno.test("cellToPosition - row 0, col 0", () => {
  const pos = cellToPosition(0, 0, 64, 96);
  assertEquals(pos.x, 0);
  assertEquals(pos.y, 0);
});

Deno.test("cellToPosition - row 0, col 1", () => {
  const pos = cellToPosition(0, 1, 64, 96);
  assertEquals(pos.x, 64);
  assertEquals(pos.y, 0);
});

Deno.test("cellToPosition - row 1, col 0", () => {
  const pos = cellToPosition(1, 0, 64, 96);
  assertEquals(pos.x, 0);
  assertEquals(pos.y, 96);
});

Deno.test("cellToPosition - row 2, col 3", () => {
  const pos = cellToPosition(2, 3, 32, 48);
  assertEquals(pos.x, 96); // 3 * 32
  assertEquals(pos.y, 96); // 2 * 48
});

Deno.test("buildSpritesheetMetadata - date and author", () => {
  const version: Version = {
    date: "2023-07-16T23:14:24-07:00",
    sha: "57246cae8f7901d4bc63072f9632685d1e3b507d",
    url: "https://github.com/freedoom/freedoom/commit/57246cae8f7901d4bc63072f9632685d1e3b507d",
    author: "Steven Elliott",
    message: "png: Map color 255 to color 133",
    files: [],
  };
  const layout = {
    frames: ["A"],
    angles: [1],
    cells: new Map([
      [
        "A_1",
        {
          frame: "A",
          angle: 1,
          mirror: false,
          sourceFile: "a1.png",
          file: { name: "a1.png", url: "" },
        },
      ],
    ]),
  };
  const entry = buildSpritesheetMetadata(
    version,
    layout,
    "out/spritesheets/POSS/2023-07-16.webp",
    64,
    96,
    createPaddedMap(layout, 64, 96),
  );
  assertEquals(entry.date, "2023-07-16T23:14:24-07:00");
  assertEquals(entry.author, "Steven Elliott");
  assertEquals(entry.commitMessage, "png: Map color 255 to color 133");
  assertEquals(
    entry.commitUrl,
    "https://github.com/freedoom/freedoom/commit/57246cae8f7901d4bc63072f9632685d1e3b507d",
  );
});

Deno.test("buildSpritesheetMetadata - spritesheetPath", () => {
  const version: Version = {
    date: "2023-07-16T23:14:24-07:00",
    sha: "57246cae",
    url: "http://test",
    author: "Author",
    message: "msg",
    files: [],
  };
  const layout = { frames: [], angles: [], cells: new Map() };
  const entry = buildSpritesheetMetadata(
    version,
    layout,
    "out/spritesheets/TROO/2023.webp",
    64,
    96,
    createPaddedMap(layout, 64, 96),
  );
  assertEquals(entry.spritesheetPath, "out/spritesheets/TROO/2023.webp");
});

Deno.test("buildSpritesheetMetadata - sprite entries", () => {
  const version: Version = {
    date: "2023-07-16T23:14:24-07:00",
    sha: "57246cae",
    url: "http://test",
    author: "Author",
    message: "msg",
    files: [],
  };
  const layout = {
    frames: ["A"],
    angles: [0, 1],
    cells: new Map([
      [
        "A_0",
        {
          frame: "A",
          angle: 0,
          mirror: false,
          sourceFile: "a0.png",
          file: { name: "a0.png", url: "" },
        },
      ],
      [
        "A_1",
        {
          frame: "A",
          angle: 1,
          mirror: false,
          sourceFile: "a1.png",
          file: { name: "a1.png", url: "" },
        },
      ],
    ]),
  };
  const entry = buildSpritesheetMetadata(version, layout, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  assertEquals(entry.sprites.length, 2);
  assertEquals(entry.sprites[0].frame, "A");
  assertEquals(entry.sprites[0].angle, "0");
  assertEquals(entry.sprites[1].angle, "1");
});

Deno.test("buildSpritesheetMetadata - frame and angle strings", () => {
  const version: Version = {
    date: "2023-07-16T23:14:24-07:00",
    sha: "57246cae",
    url: "http://test",
    author: "Author",
    message: "msg",
    files: [],
  };
  const layout = {
    frames: ["H"],
    angles: [0],
    cells: new Map([
      [
        "H_0",
        {
          frame: "H",
          angle: 0,
          mirror: false,
          sourceFile: "h0.png",
          file: { name: "h0.png", url: "" },
        },
      ],
    ]),
  };
  const entry = buildSpritesheetMetadata(version, layout, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  assertEquals(entry.sprites[0].frame, "H");
  assertEquals(entry.sprites[0].angle, "0");
});

Deno.test("buildSpritesheetMetadata - x and y positions", () => {
  const version: Version = {
    date: "2023-07-16T23:14:24-07:00",
    sha: "57246cae",
    url: "http://test",
    author: "Author",
    message: "msg",
    files: [],
  };
  const layout = {
    frames: ["A", "B"],
    angles: [1, 2],
    cells: new Map([
      [
        "A_1",
        {
          frame: "A",
          angle: 1,
          mirror: false,
          sourceFile: "a1.png",
          file: { name: "a1.png", url: "" },
        },
      ],
      [
        "A_2",
        {
          frame: "A",
          angle: 2,
          mirror: false,
          sourceFile: "a2.png",
          file: { name: "a2.png", url: "" },
        },
      ],
      [
        "B_1",
        {
          frame: "B",
          angle: 1,
          mirror: false,
          sourceFile: "b1.png",
          file: { name: "b1.png", url: "" },
        },
      ],
      [
        "B_2",
        {
          frame: "B",
          angle: 2,
          mirror: false,
          sourceFile: "b2.png",
          file: { name: "b2.png", url: "" },
        },
      ],
    ]),
  };
  const entry = buildSpritesheetMetadata(version, layout, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  // Frame A, angle 1 = row 0, col 0 = (0, 0)
  assertEquals(entry.sprites[0].x, 0);
  assertEquals(entry.sprites[0].y, 0);
  // Frame A, angle 2 = row 0, col 1 = (64, 0)
  assertEquals(entry.sprites[1].x, 64);
  assertEquals(entry.sprites[1].y, 0);
});

Deno.test("buildSpritesheetMetadata - mirror different position", () => {
  const version: Version = {
    date: "2023-07-16T23:14:24-07:00",
    sha: "57246cae",
    url: "http://test",
    author: "Author",
    message: "msg",
    files: [],
  };
  const layout = {
    frames: ["A"],
    angles: [2, 8],
    cells: new Map([
      [
        "A_2",
        {
          frame: "A",
          angle: 2,
          mirror: false,
          sourceFile: "a2a8.png",
          file: { name: "a2a8.png", url: "" },
        },
      ],
      [
        "A_8",
        {
          frame: "A",
          angle: 8,
          mirror: true,
          sourceFile: "a2a8.png",
          file: { name: "a2a8.png", url: "" },
        },
      ],
    ]),
  };
  const entry = buildSpritesheetMetadata(version, layout, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  const sprite2 = entry.sprites.find((s) => s.angle === "2");
  const sprite8 = entry.sprites.find((s) => s.angle === "8");
  assertEquals(sprite2?.x, 0);
  assertEquals(sprite8?.x, 64);
});

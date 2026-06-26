import { expect, test } from "bun:test";
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

test("buildGridLayout - frames sorted alphabetically", () => {
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
  expect(layout.frames).toEqual(["A", "B", "C"]);
});

test("buildGridLayout - angles sorted numerically", () => {
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
  expect(layout.angles).toEqual([0, 1, 8]);
});

test("buildGridLayout - cell map key format", () => {
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
  expect(layout.cells.has("A_3")).toEqual(true);
});

test("buildGridLayout - angle-0 cells included", () => {
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
  expect(layout.cells.has("H_0")).toEqual(true);
});

test("buildGridLayout - mirror cells stored separately", () => {
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
  expect(layout.cells.has("A_2")).toEqual(true);
  expect(layout.cells.has("A_8")).toEqual(true);
});

test("buildGridLayout - cross-frame mirror", () => {
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
  expect(layout.cells.has("A_2")).toEqual(true);
  expect(layout.cells.has("D_8")).toEqual(true);
});

test("buildGridLayout - empty input", () => {
  const layout = buildGridLayout([]);
  expect(layout.frames.length).toEqual(0);
  expect(layout.angles.length).toEqual(0);
  expect(layout.cells.size).toEqual(0);
});

test("computeSpritesheetDimensions - 3x2 grid", () => {
  const layout = {
    frames: ["A", "B", "C"],
    angles: [1, 2],
    cells: new Map(),
  };
  const dims = computeSpritesheetDimensions(layout as any, 64, 96);
  expect(dims.width).toEqual(192); // 3 cols * 64
  expect(dims.height).toEqual(192); // 2 rows * 96
});

test("computeSpritesheetDimensions - single cell", () => {
  const layout = {
    frames: ["A"],
    angles: [1],
    cells: new Map(),
  };
  const dims = computeSpritesheetDimensions(layout as any, 64, 96);
  expect(dims.width).toEqual(64);
  expect(dims.height).toEqual(96);
});

test("cellToPosition - row 0, col 0", () => {
  const pos = cellToPosition(0, 0, 64, 96);
  expect(pos.x).toEqual(0);
  expect(pos.y).toEqual(0);
});

test("cellToPosition - row 0, col 1", () => {
  const pos = cellToPosition(0, 1, 64, 96);
  expect(pos.x).toEqual(64);
  expect(pos.y).toEqual(0);
});

test("cellToPosition - row 1, col 0", () => {
  const pos = cellToPosition(1, 0, 64, 96);
  expect(pos.x).toEqual(0);
  expect(pos.y).toEqual(96);
});

test("cellToPosition - row 2, col 3", () => {
  const pos = cellToPosition(2, 3, 32, 48);
  expect(pos.x).toEqual(96); // 3 * 32
  expect(pos.y).toEqual(96); // 2 * 48
});

test("buildSpritesheetMetadata - date and author", () => {
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
    layout as any,
    "out/spritesheets/POSS/2023-07-16.webp",
    64,
    96,
    createPaddedMap(layout, 64, 96),
  );
  expect(entry.date).toEqual("2023-07-16T23:14:24-07:00");
  expect(entry.author).toEqual("Steven Elliott");
  expect(entry.commitMessage).toEqual("png: Map color 255 to color 133");
  expect(
    entry.commitUrl,
  ).toEqual("https://github.com/freedoom/freedoom/commit/57246cae8f7901d4bc63072f9632685d1e3b507d");
});

test("buildSpritesheetMetadata - spritesheetPath", () => {
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
    layout as any,
    "out/spritesheets/TROO/2023.webp",
    64,
    96,
    createPaddedMap(layout, 64, 96),
  );
  expect(entry.spritesheetPath).toEqual("out/spritesheets/TROO/2023.webp");
});

test("buildSpritesheetMetadata - sprite entries", () => {
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
  const entry = buildSpritesheetMetadata(version, layout as any, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  expect(entry.sprites.length).toEqual(2);
  expect(entry.sprites[0].frame).toEqual("A");
  expect(entry.sprites[0].angle).toEqual("0");
  expect(entry.sprites[1].angle).toEqual("1");
});

test("buildSpritesheetMetadata - frame and angle strings", () => {
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
  const entry = buildSpritesheetMetadata(version, layout as any, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  expect(entry.sprites[0].frame).toEqual("H");
  expect(entry.sprites[0].angle).toEqual("0");
});

test("buildSpritesheetMetadata - x and y positions", () => {
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
  const entry = buildSpritesheetMetadata(version, layout as any, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  // Frame A, angle 1 = row 0, col 0 = (0, 0)
  expect(entry.sprites[0].x).toEqual(0);
  expect(entry.sprites[0].y).toEqual(0);
  // Frame A, angle 2 = row 1, col 0 = (0, 96)
  expect(entry.sprites[1].x).toEqual(0);
  expect(entry.sprites[1].y).toEqual(96);
  // Frame B, angle 1 = row 0, col 1 = (64, 0)
  expect(entry.sprites[2].x).toEqual(64);
  expect(entry.sprites[2].y).toEqual(0);
});

test("buildSpritesheetMetadata - mirror different position", () => {
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
  const entry = buildSpritesheetMetadata(version, layout as any, "path.webp", 64, 96, createPaddedMap(layout, 64, 96));
  const sprite2 = entry.sprites.find((s) => s.angle === "2");
  const sprite8 = entry.sprites.find((s) => s.angle === "8");
  expect(sprite2?.x).toEqual(0);
  expect(sprite2?.y).toEqual(0);
  expect(sprite8?.x).toEqual(0);
  expect(sprite8?.y).toEqual(96);
});

import { expect, test } from "bun:test";
import { Spritesheet } from "../app/src/models/Spritesheet.ts";
import type { SpritesheetVersion, SpriteMeta } from "../app/src/models/schema.ts";

// Mock data
const mockAtlas: Partial<SpritesheetVersion> = {
  sha: "test-sha",
  sprites: [
    { frame: "A", angle: "1", x: 0, y: 0, width: 20, height: 20, author: "", state: "", url: "" },
    { frame: "A", angle: "0", x: 20, y: 0, width: 20, height: 20, author: "", state: "", url: "" },
    { frame: "B", angle: "1", x: 40, y: 0, width: 20, height: 20, author: "", state: "", url: "" },
  ]
};

const mockMeta: Partial<SpriteMeta> = {
  freedoomName: "Test Monster",
  idling: [
    { frame: "A", delay: 2 },
    { frame: "B", delay: 1 }
  ]
};

test("Spritesheet - bounding box calculation", () => {
  const sheet = new Spritesheet(
    "TEST",
    {} as any,
    mockAtlas as any,
    mockMeta as any
  );
  
  const size = sheet.getStageSize();
  expect(size.width).toBe(20);
  expect(size.height).toBe(24);
});

test("Spritesheet - getAnimationsWithAngles", () => {
  const sheet = new Spritesheet(
    "TEST",
    {} as any,
    mockAtlas as any,
    mockMeta as any
  );
  
  const anims = sheet.getAnimationsWithAngles();
  const idling = anims.find(a => a.name === "idling");
  expect(idling).toBeDefined();
  // Frame A has angle 0, so it ignores angle 1.
  // Frame B has only angle 1, so angle 1 is included.
  expect(idling?.angles).toContain(0);
  expect(idling?.angles).toContain(1);
  expect(idling?.angles).not.toContain(2);
});

test("Spritesheet - angle 0 takes precedence", () => {
  const sheet = new Spritesheet(
    "TEST",
    {} as any,
    mockAtlas as any,
    mockMeta as any
  );
  
  // Frame A has both angle 0 and angle 1. Angle 0 should take precedence.
  const gen = sheet.play("idling", 1);
  const result = gen.next().value;
  expect(result.source.frame).toBe("A");
  expect(result.source.angle).toBe("0");
});

test("Spritesheet - play generator timing", () => {
  const sheet = new Spritesheet(
    "TEST",
    {} as any,
    mockAtlas as any,
    mockMeta as any
  );
  
  const gen = sheet.play("idling", 1);
  
  // Tick 1: Frame A
  let result = gen.next().value;
  expect(result.source.frame).toBe("A");
  
  // Tick 2: Still Frame A (delay 2)
  result = gen.next().value;
  expect(result.source.frame).toBe("A");
  
  // Tick 3: Frame B (delay 1)
  result = gen.next().value;
  expect(result.source.frame).toBe("B");
  
  // Tick 4: Back to Frame A (looping)
  result = gen.next().value;
  expect(result.source.frame).toBe("A");
});

test("Spritesheet - angle fallback", () => {
  const sheet = new Spritesheet(
    "TEST",
    {} as any,
    mockAtlas as any,
    mockMeta as any
  );
  
  // Angle 2 doesn't exist for A, should fallback to 0 or 1
  const gen = sheet.play("idling", 2);
  const result = gen.next().value;
  expect(result.source.frame).toBe("A");
  // We'll define specific fallback logic: if requested angle is missing, try 0, then any.
  expect(["0", "1"]).toContain(result.source.angle);
});

test("Spritesheet - invalid animation throws", () => {
  const sheet = new Spritesheet(
    "TEST",
    {} as any,
    mockAtlas as any,
    mockMeta as any
  );
  
  expect(() => sheet.play("non-existent", 1).next()).toThrow();
});

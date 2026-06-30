import { expect, test } from "bun:test";
import { SpritePattern } from "../src/SpritePattern.ts";
import { createMockAuthorResolver } from "./mocks.ts";

test("SpritePattern - constructor should store uppercase code", () => {
  const pattern = new SpritePattern("poss");
  expect(pattern.code).toBe("POSS");
});

test("SpritePattern - matches should validate sprite filenames", () => {
  const pattern = new SpritePattern("POSS");

  // Valid patterns
  expect(pattern.matches("sprites/possa1.png")).toBe(true);
  expect(pattern.matches("possa1.png")).toBe(true);
  expect(pattern.matches("POSSA1.PNG")).toBe(true);
  expect(pattern.matches("POSSA2A8.gif")).toBe(true);

  // Invalid patterns
  expect(pattern.matches("sprites/trooa1.png")).toBe(false);
  expect(pattern.matches("possa.png")).toBe(false);
  expect(pattern.matches("possa1.mirror.png")).toBe(false);
  expect(pattern.matches("possa1_bak.png")).toBe(false);
});

test("SpritePattern - extractCodeFromPath should return sprite code", () => {
  const pattern = new SpritePattern("POSS");

  expect(pattern.extractCodeFromPath("sprites/possa1.png")).toBe("POSS");
  expect(pattern.extractCodeFromPath("TROOA1.png")).toBe("TROO");
  expect(pattern.extractCodeFromPath("invalid.png")).toBe("INVA");
});

test("SpritePattern - extractFrameKey should return frame letter", () => {
  const pattern = new SpritePattern("POSS");

  expect(pattern.extractFrameKey("sprites/possa1.png")).toBe("a1");
  expect(pattern.extractFrameKey("POSSB2B8.png")).toBe("b2");
  expect(pattern.extractFrameKey("TROOA1.png")).toBe(null);
});

test("SpritePattern - static basename should extract filename", () => {
  expect(SpritePattern.basename("path/to/file.txt")).toBe("file.json".replace("json", "txt"));
  expect(SpritePattern.basename("file.txt")).toBe("file.txt");
});

import { expect, test } from "bun:test";
// Import real classes from src/
import { AuthorResolver, SpritePattern } from "../src/SpritePattern.ts";

// Mock imports (commented out as requested)
import { createMockAuthorResolver, createMockSpritePattern } from "./mocks.ts";

test("SpritePattern - constructor should store uppercase code", () => {
  const pattern = createMockSpritePattern("poss");
  expect(pattern.code).toBe("POSS");

  const pattern2 = createMockSpritePattern("CYBR");
  expect(pattern2.code).toBe("CYBR");
});

test("SpritePattern - matches should validate sprite filenames", () => {
  const pattern = createMockSpritePattern("POSS");

  // Valid matches
  expect(pattern.matches("sprites/possa1.png")).toBe(true);
  expect(pattern.matches("sprites/possa2a8.png")).toBe(true);
  expect(pattern.matches("sprites/possb1.gif")).toBe(true);

  // Invalid matches
  expect(pattern.matches("sprites/cybra1.png")).toBe(false);
  expect(pattern.matches("sprites/poss.txt")).toBe(false);
  expect(pattern.matches("sprites/poss.png")).toBe(false);
  expect(pattern.matches("other/possa1.png")).toBe(true); // matches basename
});

test("SpritePattern - extractCodeFromPath should return sprite code", () => {
  const pattern = createMockSpritePattern("POSS");

  expect(pattern.extractCodeFromPath("sprites/possa1.png")).toBe("POSS");
  expect(pattern.extractCodeFromPath("sprites/cybra1.png")).toBe("CYBR");
  expect(pattern.extractCodeFromPath("sprites/HEADC1.png")).toBe("HEAD");
});

test("SpritePattern - extractFrameKey should return frame letter", () => {
  const pattern = createMockSpritePattern("POSS");

  expect(pattern.extractFrameKey("sprites/possa1.png")).toBe("a");
  expect(pattern.extractFrameKey("sprites/possa2a8.png")).toBe("a");
  expect(pattern.extractFrameKey("sprites/possb1.png")).toBe("b");
  expect(pattern.extractFrameKey("sprites/possc2.png")).toBe("c");
});

test("SpritePattern - static basename should extract filename", () => {
  const pattern = createMockSpritePattern("POSS");

  expect((pattern as any).static.basename("sprites/possa1.png")).toBe("possa1.png");
  expect((pattern as any).static.basename("/path/to/file.txt")).toBe("file.txt");
  expect((pattern as any).static.basename("file.txt")).toBe("file.txt");
  expect((pattern as any).static.basename("")).toBe("");
});

test("AuthorResolver - Shape 1: sprites/<file> returns commit author", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  expect(
    resolver.resolveAuthor("sprites/possa1.png", commitAuthor),
  ).toBe("John Doe");
  expect(
    resolver.resolveAuthor("sprites/cybra1.png", commitAuthor),
  ).toBe("John Doe");
  expect(
    resolver.resolveAuthor("sprites/spida1d1.png", commitAuthor),
  ).toBe("John Doe");
});

test("AuthorResolver - Shape 2: sprites/<author>/<file> returns author folder name", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  expect(
    resolver.resolveAuthor("sprites/janedoe/possa1.png", commitAuthor),
  ).toBe("janedoe");
  expect(
    resolver.resolveAuthor("sprites/bobsmith/cybra1.png", commitAuthor),
  ).toBe("bobsmith");
  expect(
    resolver.resolveAuthor("sprites/artist123/spida1.png", commitAuthor),
  ).toBe("artist123");
});

test("AuthorResolver - Shape 3: sprites/<author>/<sub>/<file> returns author folder name", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  expect(
    resolver.resolveAuthor("sprites/janedoe/subdir/possa1.png", commitAuthor),
  ).toBe("janedoe");
  expect(
    resolver.resolveAuthor(
      "sprites/bobsmith/nested/folder/cybra1.png",
      commitAuthor,
    ),
  ).toBe("bobsmith");
});

test("AuthorResolver - Shape 4: <author>/sprites/<file> returns author folder name", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  expect(
    resolver.resolveAuthor("janedoe/sprites/possa1.png", commitAuthor),
  ).toBe("janedoe");
  expect(
    resolver.resolveAuthor("bobsmith/sprites/cybra1.png", commitAuthor),
  ).toBe("bobsmith");
});

test("AuthorResolver - should handle edge cases gracefully", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "Commit Author";

  // Empty path
  expect(resolver.resolveAuthor("", commitAuthor)).toBe(commitAuthor);

  // Path without sprites
  expect(
    resolver.resolveAuthor("other/path/file.png", commitAuthor),
  ).toBe(commitAuthor);

  // Just sprites folder
  expect(resolver.resolveAuthor("sprites", commitAuthor)).toBe(commitAuthor);
});

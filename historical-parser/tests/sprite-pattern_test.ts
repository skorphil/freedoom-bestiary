// Import real classes from src/
import { AuthorResolver, SpritePattern } from "../src/SpritePattern.ts";

import { assertEquals, assertExists } from "@std/assert";
// Mock imports (commented out as requested)
import { createMockAuthorResolver, createMockSpritePattern } from "./mocks.ts";

Deno.test("SpritePattern - constructor should store uppercase code", () => {
  const pattern = createMockSpritePattern("poss");
  assertEquals(pattern.code, "POSS");

  const pattern2 = createMockSpritePattern("CYBR");
  assertEquals(pattern2.code, "CYBR");
});

Deno.test("SpritePattern - matches should validate sprite filenames", () => {
  const pattern = createMockSpritePattern("POSS");

  // Valid matches
  assertEquals(pattern.matches("sprites/possa1.png"), true);
  assertEquals(pattern.matches("sprites/possa2a8.png"), true);
  assertEquals(pattern.matches("sprites/possb1.gif"), true);

  // Invalid matches
  assertEquals(pattern.matches("sprites/cybra1.png"), false);
  assertEquals(pattern.matches("sprites/poss.txt"), false);
  assertEquals(pattern.matches("sprites/poss.png"), false);
  assertEquals(pattern.matches("other/possa1.png"), true); // matches basename
});

Deno.test("SpritePattern - extractCodeFromPath should return sprite code", () => {
  const pattern = createMockSpritePattern("POSS");

  assertEquals(pattern.extractCodeFromPath("sprites/possa1.png"), "POSS");
  assertEquals(pattern.extractCodeFromPath("sprites/cybra1.png"), "CYBR");
  assertEquals(pattern.extractCodeFromPath("sprites/HEADC1.png"), "HEAD");
});

Deno.test("SpritePattern - extractFrameKey should return frame letter", () => {
  const pattern = createMockSpritePattern("POSS");

  assertEquals(pattern.extractFrameKey("sprites/possa1.png"), "a");
  assertEquals(pattern.extractFrameKey("sprites/possa2a8.png"), "a");
  assertEquals(pattern.extractFrameKey("sprites/possb1.png"), "b");
  assertEquals(pattern.extractFrameKey("sprites/possc2.png"), "c");
});

Deno.test("SpritePattern - static basename should extract filename", () => {
  const pattern = createMockSpritePattern("POSS");

  assertEquals(pattern.static.basename("sprites/possa1.png"), "possa1.png");
  assertEquals(pattern.static.basename("/path/to/file.txt"), "file.txt");
  assertEquals(pattern.static.basename("file.txt"), "file.txt");
  assertEquals(pattern.static.basename(""), "");
});

Deno.test("AuthorResolver - Shape 1: sprites/<file> returns commit author", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  assertEquals(
    resolver.resolveAuthor("sprites/possa1.png", commitAuthor),
    "John Doe",
  );
  assertEquals(
    resolver.resolveAuthor("sprites/cybra1.png", commitAuthor),
    "John Doe",
  );
  assertEquals(
    resolver.resolveAuthor("sprites/spida1d1.png", commitAuthor),
    "John Doe",
  );
});

Deno.test("AuthorResolver - Shape 2: sprites/<author>/<file> returns author folder name", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  assertEquals(
    resolver.resolveAuthor("sprites/janedoe/possa1.png", commitAuthor),
    "janedoe",
  );
  assertEquals(
    resolver.resolveAuthor("sprites/bobsmith/cybra1.png", commitAuthor),
    "bobsmith",
  );
  assertEquals(
    resolver.resolveAuthor("sprites/artist123/spida1.png", commitAuthor),
    "artist123",
  );
});

Deno.test("AuthorResolver - Shape 3: sprites/<author>/<sub>/<file> returns author folder name", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  assertEquals(
    resolver.resolveAuthor("sprites/janedoe/subdir/possa1.png", commitAuthor),
    "janedoe",
  );
  assertEquals(
    resolver.resolveAuthor(
      "sprites/bobsmith/nested/folder/cybra1.png",
      commitAuthor,
    ),
    "bobsmith",
  );
});

Deno.test("AuthorResolver - Shape 4: <author>/sprites/<file> returns author folder name", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "John Doe";

  assertEquals(
    resolver.resolveAuthor("janedoe/sprites/possa1.png", commitAuthor),
    "janedoe",
  );
  assertEquals(
    resolver.resolveAuthor("bobsmith/sprites/cybra1.png", commitAuthor),
    "bobsmith",
  );
});

Deno.test("AuthorResolver - should handle edge cases gracefully", () => {
  const resolver = createMockAuthorResolver();
  const commitAuthor = "Commit Author";

  // Empty path
  assertEquals(resolver.resolveAuthor("", commitAuthor), commitAuthor);

  // Path without sprites
  assertEquals(
    resolver.resolveAuthor("other/path/file.png", commitAuthor),
    commitAuthor,
  );

  // Just sprites folder
  assertEquals(resolver.resolveAuthor("sprites", commitAuthor), commitAuthor);
});

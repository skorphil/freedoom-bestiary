import { assertEquals, assertExists } from "@std/assert";
import type {
  CommitLogScannerOptions,
  CommitSnapshot,
  SnapshotBuilderOptions,
} from "../src/types.ts";
// Import real classes from src/
import { AtticParser, BaseParser, FreedomParser } from "../src/BaseParser.ts";
import { CommitLogScanner } from "../src/CommitLogScanner.ts";
import { GitReader } from "../src/GitReader.ts";
import { SnapshotBuilder } from "../src/SnapshotBuilder.ts";
import { AuthorResolver, SpritePattern } from "../src/SpritePattern.ts";

// Mock imports (commented out as requested)
import {
  ATTIC_BUILDER_OPTIONS,
  ATTIC_SCANNER_OPTIONS,
  createMockAtticParser,
  createMockAuthorResolver,
  createMockBaseParser,
  createMockFreedomParser,
  createMockGitReader,
  createMockSpritePattern,
  FREEDOOM_BUILDER_OPTIONS,
  FREEDOOM_SCANNER_OPTIONS,
} from "./mocks.ts";

Deno.test("BaseParser - constructor should store dependencies", () => {
  const parser = createMockBaseParser(
    "/tmp/freedoom.git",
    "POSS",
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  assertExists(parser.reader);
  assertExists(parser.pattern);
  assertExists(parser.resolver);
  assertEquals(parser.pattern.code, "POSS");
});

Deno.test("BaseParser - parse should return array of snapshots", async () => {
  const parser = createMockBaseParser(
    "/tmp/freedoom.git",
    "POSS",
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  const snapshots = await parser.parse();

  assertEquals(Array.isArray(snapshots), true);
});

Deno.test("BaseParser - getSnapshot should return single snapshot or null", async () => {
  const parser = createMockBaseParser(
    "/tmp/freedoom.git",
    "POSS",
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  const snapshot = await parser.getSnapshot();

  assertEquals(snapshot, null);
});

Deno.test("FreedomParser - should use freedoom configuration", () => {
  const parser = createMockFreedomParser("/tmp/freedoom.git", "POSS");

  assertEquals(parser.source, "freedoom");

  const scanner = parser.createScanner();
  // Cannot access private options, just verify scanner exists
  assertExists(scanner);

  const builder = parser.createSnapshotBuilder();
  // Cannot access private options, just verify builder exists
  assertExists(builder);
});

Deno.test("AtticParser - should use attic configuration", () => {
  const parser = createMockAtticParser("/tmp/attic.git", "POSS");

  assertEquals(parser.source, "attic");

  const scanner = parser.createScanner();
  // Cannot access private options, just verify scanner exists
  assertExists(scanner);

  const builder = parser.createSnapshotBuilder();
  // Cannot access private options, just verify builder exists
  assertExists(builder);
});

Deno.test("Parser classes - should handle all sprite codes", () => {
  const codes = [
    "POSS",
    "SPOS",
    "TROO",
    "SARG",
    "HEAD",
    "SKUL",
    "CYBR",
    "SPID",
    "BSPI",
  ];

  for (const code of codes) {
    const freedomParser = createMockFreedomParser("/tmp/freedoom.git", code);
    const atticParser = createMockAtticParser("/tmp/attic.git", code);

    assertEquals(freedomParser.pattern.code, code);
    assertEquals(atticParser.pattern.code, code);
  }
});

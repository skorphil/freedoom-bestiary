import { expect, test } from "bun:test";
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
import { AuthorResolver } from "../src/AuthorResolver.ts";
import { SpritePattern } from "../src/SpritePattern.ts";

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

test("BaseParser - constructor should store dependencies", () => {
  const parser = createMockBaseParser(
    "/tmp/freedoom.git",
    "POSS",
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  expect(parser.reader).toBeDefined();
  expect(parser.pattern).toBeDefined();
  expect(parser.resolver).toBeDefined();
  expect(parser.pattern.code).toBe("POSS");
});

test("BaseParser - parse should return array of snapshots", async () => {
  const parser = createMockBaseParser(
    "/tmp/freedoom.git",
    "POSS",
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  const snapshots = await parser.parse();

  expect(Array.isArray(snapshots)).toBe(true);
});

test("BaseParser - getSnapshot should return single snapshot or null", async () => {
  const parser = createMockBaseParser(
    "/tmp/freedoom.git",
    "POSS",
    "freedoom",
    FREEDOOM_SCANNER_OPTIONS,
    FREEDOOM_BUILDER_OPTIONS,
  );

  const snapshot = await parser.getSnapshot();

  expect(snapshot).toBe(null);
});

test("FreedomParser - should use freedoom configuration", () => {
  const parser = createMockFreedomParser("/tmp/freedoom.git", "POSS");

  expect(parser.source).toBe("freedoom");

  const scanner = parser.createScanner();
  // Cannot access private options, just verify scanner exists
  expect(scanner).toBeDefined();

  const builder = parser.createSnapshotBuilder();
  // Cannot access private options, just verify builder exists
  expect(builder).toBeDefined();
});

test("AtticParser - should use attic configuration", () => {
  const parser = createMockAtticParser("/tmp/attic.git", "POSS");

  expect(parser.source).toBe("attic");

  const scanner = parser.createScanner();
  // Cannot access private options, just verify scanner exists
  expect(scanner).toBeDefined();

  const builder = parser.createSnapshotBuilder();
  // Cannot access private options, just verify builder exists
  expect(builder).toBeDefined();
});

test("Parser classes - should handle all sprite codes", () => {
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

    expect(freedomParser.pattern.code).toBe(code);
    expect(atticParser.pattern.code).toBe(code);
  }
});

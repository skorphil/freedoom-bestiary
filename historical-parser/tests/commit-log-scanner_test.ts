import { assertEquals, assertExists } from "@std/assert";
import type { ScanUnit } from "../src/types.ts";
// Import real classes from src/
import { CommitLogScanner } from "../src/CommitLogScanner.ts";
import { GitReader } from "../src/GitReader.ts";
import { SpritePattern } from "../src/SpritePattern.ts";

import {
  ATTIC_SCANNER_OPTIONS,
  FREEDOOM_SCANNER_OPTIONS,
  TEST_COMMIT_AUTHOR,
  TEST_COMMIT_DATE,
  TEST_COMMIT_MESSAGE,
  TEST_COMMIT_SHA,
} from "./mocks.ts";

Deno.test("CommitLogScanner - should parse simple freedoom-style log", async () => {
  // Create real instances
  const pattern = new SpritePattern("POSS");
  const logLines = [
    `${TEST_COMMIT_SHA}|${TEST_COMMIT_DATE}|${TEST_COMMIT_AUTHOR}|${TEST_COMMIT_MESSAGE}`,
    "A\tsprites/possa1.png",
    "M\tsprites/possa2a8.png",
    "D\tsprites/old.png",
    `${TEST_COMMIT_SHA}2|${TEST_COMMIT_DATE}|${TEST_COMMIT_AUTHOR}|Second commit`,
    "A\tsprites/possa3a7.png",
  ];

  // Create a mock reader object that simulates the GitReader interface
  const mockReader = {
    async *streamLog(): AsyncGenerator<string> {
      for (const line of logLines) {
        yield line;
      }
    },
  };

  const scanner = new CommitLogScanner(
    mockReader as any,
    pattern,
    FREEDOOM_SCANNER_OPTIONS,
  );

  const results: ScanUnit[] = [];
  for await (const unit of scanner.scan()) {
    results.push(unit);
  }

  assertEquals(results.length, 2);
  assertEquals(results[0].sha, TEST_COMMIT_SHA);
  assertEquals(results[0].changesMap.get("sprites/possa1.png"), "A");
  assertEquals(results[0].changesMap.get("sprites/possa2a8.png"), "M");
  assertEquals(results[0].folder, null);
});

Deno.test("CommitLogScanner - should group by folder for attic-style log", async () => {
  // Create real instances
  const pattern = new SpritePattern("POSS");
  const logLines = [
    `${TEST_COMMIT_SHA}|${TEST_COMMIT_DATE}|${TEST_COMMIT_AUTHOR}|${TEST_COMMIT_MESSAGE}`,
    "A\tsprites/johndoe/possa1.png",
    "M\tsprites/janedoe/possa2.png",
  ];

  // Create a mock reader object that simulates the GitReader interface
  const mockReader = {
    async *streamLog(): AsyncGenerator<string> {
      for (const line of logLines) {
        yield line;
      }
    },
  };

  const scanner = new CommitLogScanner(
    mockReader as any,
    pattern,
    ATTIC_SCANNER_OPTIONS,
  );

  const results: ScanUnit[] = [];
  for await (const unit of scanner.scan()) {
    results.push(unit);
  }

  // Should produce 2 units (one per folder)
  assertEquals(results.length, 2);

  // Find units by folder
  const johndoeUnit = results.find((u) => u.folder === "johndoe");
  const janedoeUnit = results.find((u) => u.folder === "janedoe");

  assertExists(johndoeUnit);
  assertExists(janedoeUnit);
});

Deno.test("CommitLogScanner - should handle rename status (R100)", async () => {
  // Create real instances
  const pattern = new SpritePattern("POSS");
  const logLines = [
    `${TEST_COMMIT_SHA}|${TEST_COMMIT_DATE}|${TEST_COMMIT_AUTHOR}|${TEST_COMMIT_MESSAGE}`,
    "R100\tsprites/possa0.png\tsprites/possa1.png",
  ];

  // Create a mock reader object that simulates the GitReader interface
  const mockReader = {
    async *streamLog(): AsyncGenerator<string> {
      for (const line of logLines) {
        yield line;
      }
    },
  };

  const scanner = new CommitLogScanner(
    mockReader as any,
    pattern,
    FREEDOOM_SCANNER_OPTIONS,
  );

  const results: ScanUnit[] = [];
  for await (const unit of scanner.scan()) {
    results.push(unit);
  }

  assertEquals(results.length, 1);
  assertEquals(results[0].changesMap.get("sprites/possa1.png"), "R100");
});

Deno.test("CommitLogScanner - should filter inactive statuses", async () => {
  // Create real instances
  const pattern = new SpritePattern("POSS");
  const logLines = [
    `${TEST_COMMIT_SHA}|${TEST_COMMIT_DATE}|${TEST_COMMIT_AUTHOR}|${TEST_COMMIT_MESSAGE}`,
    "A\tsprites/possa1.png",
    "U\tsprites/untracked.png",
    "C\tsprites/conflicted.png",
  ];

  // Create a mock reader object that simulates the GitReader interface
  const mockReader = {
    async *streamLog(): AsyncGenerator<string> {
      for (const line of logLines) {
        yield line;
      }
    },
  };

  const customOptions = {
    groupByFolder: false,
    activeStatuses: ["A", "M"],
    skippedStatuses: ["D"],
  };

  const scanner = new CommitLogScanner(
    mockReader as any,
    pattern,
    customOptions,
  );

  const results: ScanUnit[] = [];
  for await (const unit of scanner.scan()) {
    results.push(unit);
  }

  assertEquals(results.length, 1);
  assertExists(results[0].changesMap.get("sprites/possa1.png"));
  assertEquals(results[0].changesMap.get("sprites/untracked.png"), undefined);
  assertEquals(results[0].changesMap.get("sprites/conflicted.png"), undefined);
});

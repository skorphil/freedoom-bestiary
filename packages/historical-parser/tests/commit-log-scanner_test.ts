import { expect, test } from "bun:test";
import type { ScanUnit } from "../src/types.ts";
// Import real classes from src/
import { CommitLogScanner } from "../src/CommitLogScanner.ts";
import { SpritePattern } from "../src/SpritePattern.ts";

import {
  ATTIC_SCANNER_OPTIONS,
  FREEDOOM_SCANNER_OPTIONS,
  TEST_COMMIT_AUTHOR,
  TEST_COMMIT_DATE,
  TEST_COMMIT_MESSAGE,
  TEST_COMMIT_SHA,
} from "./mocks.ts";

test("CommitLogScanner - should parse simple freedoom-style log", async () => {
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

  expect(results.length).toBe(2);
  expect(results[0].sha).toBe(TEST_COMMIT_SHA);
  expect(results[0].changesMap.get("sprites/possa1.png")).toBe("A");
  expect(results[0].changesMap.get("sprites/possa2a8.png")).toBe("M");
  expect(results[0].folder).toBe(null);
});

test("CommitLogScanner - should group by folder for attic-style log", async () => {
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
  expect(results.length).toBe(2);

  // Find units by folder
  const johndoeUnit = results.find((u) => u.folder === "johndoe");
  const janedoeUnit = results.find((u) => u.folder === "janedoe");

  expect(johndoeUnit).toBeDefined();
  expect(janedoeUnit).toBeDefined();
});

test("CommitLogScanner - should handle rename status (R100)", async () => {
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

  expect(results.length).toBe(1);
  expect(results[0].changesMap.get("sprites/possa1.png")).toBe("R100");
});

test("CommitLogScanner - should filter inactive statuses", async () => {
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

  expect(results.length).toBe(1);
  expect(results[0].changesMap.get("sprites/possa1.png")).toBeDefined();
  expect(results[0].changesMap.get("sprites/untracked.png")).toBeUndefined();
  expect(results[0].changesMap.get("sprites/conflicted.png")).toBeUndefined();
});

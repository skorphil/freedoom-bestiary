import { expect, test, describe, beforeEach } from "bun:test";
import { CommitLogScanner } from "../src/CommitLogScanner.ts";
import { SpritePattern } from "../src/SpritePattern.ts";

describe("CommitLogScanner", () => {
  let mockReader: any;
  let pattern: SpritePattern;

  beforeEach(() => {
    pattern = new SpritePattern("POSS");
    mockReader = {
      streamLog: async function* () {
        yield "COMMIT_START|sha1|date1|author1|message1|COMMIT_END";
        yield "A\tsprites/possa1.png";
        yield "M\tsprites/possb1.png";
      }
    };
  });

  test("should parse simple freedoom-style log", async () => {
    const scanner = new CommitLogScanner(mockReader, pattern, {
      groupByFolder: false,
      activeStatuses: ["A", "M"],
      skippedStatuses: ["D"]
    });

    const units = [];
    for await (const unit of scanner.scan()) {
      units.push(unit);
    }

    expect(units.length).toBe(1);
    expect(units[0].sha).toBe("sha1");
    expect(units[0].changesMap.get("sprites/possa1.png")).toBe("A");
  });
});

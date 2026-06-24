import { assertEquals, assertExists } from "@std/assert";
import { parseBlobUrl, buildRawUrl } from "../src/get-image.ts";

Deno.test("parseBlobUrl - freedoom/freedoom blob URL", () => {
  const url =
    "https://github.com/freedoom/freedoom/blob/abc123def456/sprites/trooa1.png";
  const result = parseBlobUrl(url);
  assertEquals(result?.repo, "freedoom/freedoom");
  assertEquals(result?.sha, "abc123def456");
  assertEquals(result?.path, "sprites/trooa1.png");
});

Deno.test("parseBlobUrl - freedoom/attic blob URL", () => {
  const url = "https://github.com/freedoom/attic/blob/def456/old.png";
  const result = parseBlobUrl(url);
  assertEquals(result?.repo, "freedoom/attic");
  assertEquals(result?.sha, "def456");
  assertEquals(result?.path, "old.png");
});

Deno.test("parseBlobUrl - non-github URL", () => {
  const url = "https://example.com/file.png";
  const result = parseBlobUrl(url);
  assertEquals(result, null);
});

Deno.test("parseBlobUrl - raw URL (not blob)", () => {
  const url = "https://github.com/foo/bar/raw/sha/file.png";
  const result = parseBlobUrl(url);
  assertEquals(result, null);
});

Deno.test("buildRawUrl - freedoom blob to raw", () => {
  const blobUrl =
    "https://github.com/freedoom/freedoom/blob/abc123/sprites/trooa1.png";
  const result = buildRawUrl(blobUrl);
  assertEquals(
    result,
    "https://raw.githubusercontent.com/freedoom/freedoom/abc123/sprites/trooa1.png",
  );
});

Deno.test("buildRawUrl - attic blob to raw", () => {
  const blobUrl = "https://github.com/freedoom/attic/blob/def456/old.png";
  const result = buildRawUrl(blobUrl);
  assertEquals(
    result,
    "https://raw.githubusercontent.com/freedoom/attic/def456/old.png",
  );
});

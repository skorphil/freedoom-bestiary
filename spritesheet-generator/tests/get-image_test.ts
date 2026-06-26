import { expect, test } from "bun:test";
import { parseBlobUrl, buildRawUrl } from "../src/get-image.ts";

test("parseBlobUrl - freedoom/freedoom blob URL", () => {
  const url =
    "https://github.com/freedoom/freedoom/blob/abc123def456/sprites/trooa1.png";
  const result = parseBlobUrl(url);
  expect(result?.repo).toEqual("freedoom/freedoom");
  expect(result?.sha).toEqual("abc123def456");
  expect(result?.path).toEqual("sprites/trooa1.png");
});

test("parseBlobUrl - freedoom/attic blob URL", () => {
  const url = "https://github.com/freedoom/attic/blob/def456/old.png";
  const result = parseBlobUrl(url);
  expect(result?.repo).toEqual("freedoom/attic");
  expect(result?.sha).toEqual("def456");
  expect(result?.path).toEqual("old.png");
});

test("parseBlobUrl - non-github URL", () => {
  const url = "https://example.com/file.png";
  const result = parseBlobUrl(url);
  expect(result).toEqual(null);
});

test("parseBlobUrl - raw URL (not blob)", () => {
  const url = "https://github.com/foo/bar/raw/sha/file.png";
  const result = parseBlobUrl(url);
  expect(result).toEqual(null);
});

test("buildRawUrl - freedoom blob to raw", () => {
  const blobUrl =
    "https://github.com/freedoom/freedoom/blob/abc123/sprites/trooa1.png";
  const result = buildRawUrl(blobUrl);
  expect(result).toEqual("https://raw.githubusercontent.com/freedoom/freedoom/abc123/sprites/trooa1.png");
});

test("buildRawUrl - attic blob to raw", () => {
  const blobUrl = "https://github.com/freedoom/attic/blob/def456/old.png";
  const result = buildRawUrl(blobUrl);
  expect(result).toEqual("https://raw.githubusercontent.com/freedoom/attic/def456/old.png");
});

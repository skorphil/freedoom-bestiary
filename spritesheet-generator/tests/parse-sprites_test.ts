import { expect, test } from "bun:test";
import {
	detectSource,
	extractGridCells,
	parseSpriteName,
} from "../src/parse-sprites.ts";
import type { Version } from "../src/types.ts";

test("parseSpriteName - single angle front", () => {
	const result = parseSpriteName("trooa1.png", "TROO");
	expect(result.length).toEqual(1);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(1);
	expect(result[0].mirror).toEqual(false);
	expect(result[0].sourceFile).toEqual("trooa1.png");
});

test("parseSpriteName - single angle back", () => {
	const result = parseSpriteName("trooa5.png", "TROO");
	expect(result.length).toEqual(1);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(5);
	expect(result[0].mirror).toEqual(false);
});

test("parseSpriteName - dual-angle lower-first", () => {
	const result = parseSpriteName("trooa2a8.png", "TROO");
	expect(result.length).toEqual(2);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(2);
	expect(result[0].mirror).toEqual(false);
	expect(result[1].frame).toEqual("A");
	expect(result[1].angle).toEqual(8);
	expect(result[1].mirror).toEqual(true);
});

test("parseSpriteName - dual-angle reversed order", () => {
	const result = parseSpriteName("skula6a4.png", "SKUL");
	expect(result.length).toEqual(2);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(6);
	expect(result[0].mirror).toEqual(false);
	expect(result[1].frame).toEqual("A");
	expect(result[1].angle).toEqual(4);
	expect(result[1].mirror).toEqual(true);
});

test("parseSpriteName - cross-frame dual", () => {
	const result = parseSpriteName("skela2d8.png", "SKEL");
	expect(result.length).toEqual(2);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(2);
	expect(result[0].mirror).toEqual(false);
	expect(result[1].frame).toEqual("D");
	expect(result[1].angle).toEqual(8);
	expect(result[1].mirror).toEqual(true);
});

test("parseSpriteName - angle 0 rotation-invariant", () => {
	const result = parseSpriteName("possh0.png", "POSS");
	expect(result.length).toEqual(1);
	expect(result[0].frame).toEqual("H");
	expect(result[0].angle).toEqual(0);
	expect(result[0].mirror).toEqual(false);
});

test("parseSpriteName - gif extension", () => {
	const result = parseSpriteName("trooa1.gif", "TROO");
	expect(result.length).toEqual(1);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(1);
	expect(result[0].mirror).toEqual(false);
});

test("parseSpriteName - uppercase input", () => {
	const result = parseSpriteName("TROOA1.PNG", "TROO");
	expect(result.length).toEqual(1);
	expect(result[0].frame).toEqual("A");
	expect(result[0].angle).toEqual(1);
});

test("parseSpriteName - wrong code", () => {
	const result = parseSpriteName("trooa1.png", "POSS");
	expect(result.length).toEqual(0);
});

test("parseSpriteName - non-sprite filename", () => {
	const result = parseSpriteName("readme.txt", "TROO");
	expect(result.length).toEqual(0);
});

test("parseSpriteName - sourceFile preserved in dual", () => {
	const result = parseSpriteName("trooa3a7.png", "TROO");
	expect(result.length).toEqual(2);
	expect(result[0].sourceFile).toEqual("trooa3a7.png");
	expect(result[1].sourceFile).toEqual("trooa3a7.png");
});

test("extractGridCells - basic extraction", () => {
	const files = [
		{ name: "possa1.png", url: "http://example.com/possa1.png" },
		{ name: "possa2.png", url: "http://example.com/possa2.png" },
		{ name: "possh0.png", url: "http://example.com/possh0.png" },
	];
	const cells = extractGridCells(files, "POSS");
	// A1, A2, H0, and auto-mirrored A8 (from A2)
	expect(cells.length).toEqual(4);
	expect(cells[0].frame).toEqual("A");
	expect(cells[0].angle).toEqual(1);
	expect(cells[0].file.name).toEqual("possa1.png");
});

test("extractGridCells - auto-mirrors missing angles", () => {
	const files = [
		{ name: "trooa2.png", url: "http://example.com/trooa2.png" },
	];
	const cells = extractGridCells(files, "TROO");
	// Should have A2 and A8 (mirrored)
	expect(cells.length).toEqual(2);
	const a2 = cells.find(c => c.angle === 2)!;
	const a8 = cells.find(c => c.angle === 8)!;
	
	expect(a2.mirror).toEqual(false);
	expect(a8.mirror).toEqual(true);
	expect(a8.frame).toEqual("A");
	expect(a8.file.name).toEqual("trooa2.png");
});

test("extractGridCells - does not double-mirror if already present", () => {
	const files = [
		{ name: "trooa2a8.png", url: "http://example.com/trooa2a8.png" },
	];
	const cells = extractGridCells(files, "TROO");
	// Should still only have 2 cells, A2 and A8
	expect(cells.length).toEqual(2);
	expect(cells.filter(c => c.angle === 2).length).toEqual(1);
	expect(cells.filter(c => c.angle === 8).length).toEqual(1);
});

test("extractGridCells - mirrors from high to low", () => {
	const files = [
		{ name: "trooa6.png", url: "http://example.com/trooa6.png" },
	];
	const cells = extractGridCells(files, "TROO");
	// Should have A6 and A4 (mirrored)
	expect(cells.length).toEqual(2);
	const a6 = cells.find(c => c.angle === 6)!;
	const a4 = cells.find(c => c.angle === 4)!;
	expect(a6.mirror).toEqual(false);
	expect(a4.mirror).toEqual(true);
});

test("detectSource - all freedoom", () => {
	const version: Version = {
		date: "2023-01-01",
		sha: "x",
		url: "",
		author: "",
		message: "",
		files: [
			{
				name: "possa1.png",
				url: "https://github.com/freedoom/freedoom/blob/abc/sprites/possa1.png",
			},
			{
				name: "possa2.png",
				url: "https://github.com/freedoom/freedoom/blob/abc/sprites/possa2.png",
			},
		],
	};
	expect(detectSource(version)).toEqual("freedoom");
});

test("detectSource - all attic", () => {
	const version: Version = {
		date: "2024-05-22",
		sha: "x",
		url: "",
		author: "",
		message: "",
		files: [
			{
				name: "skula1.png",
				url: "https://github.com/freedoom/attic/blob/abc/sprites/skula1.png",
			},
		],
	};
	expect(detectSource(version)).toEqual("attic");
});

test("detectSource - majority wins", () => {
	const version: Version = {
		date: "2024-05-22",
		sha: "x",
		url: "",
		author: "",
		message: "",
		files: [
			{
				name: "skula1.png",
				url: "https://github.com/freedoom/freedoom/blob/abc/sprites/skula1.png",
			},
			{
				name: "skula2.png",
				url: "https://github.com/freedoom/attic/blob/def/sprites/skula2.png",
			},
			{
				name: "skula3.png",
				url: "https://github.com/freedoom/freedoom/blob/abc/sprites/skula3.png",
			},
		],
	};
	expect(detectSource(version)).toEqual("freedoom");
});

test("detectSource - tie-break is first file", () => {
	const version: Version = {
		date: "2024-05-22",
		sha: "x",
		url: "",
		author: "",
		message: "",
		files: [
			{
				name: "skula1.png",
				url: "https://github.com/freedoom/attic/blob/abc/sprites/skula1.png",
			},
			{
				name: "skula2.png",
				url: "https://github.com/freedoom/freedoom/blob/def/sprites/skula2.png",
			},
		],
	};
	expect(detectSource(version)).toEqual("attic");
});

test("detectSource - empty files returns unknown", () => {
	const version: Version = {
		date: "",
		sha: "",
		url: "",
		author: "",
		message: "",
		files: [],
	};
	expect(detectSource(version)).toEqual("unknown");
});

test("detectSource - unparseable URL returns unknown", () => {
	const version: Version = {
		date: "",
		sha: "",
		url: "",
		author: "",
		message: "",
		files: [{ name: "x.png", url: "https://example.com/foo.png" }],
	};
	expect(detectSource(version)).toEqual("unknown");
});

import { assertEquals } from "@std/assert";
import {
	detectSource,
	extractGridCells,
	parseSpriteName,
} from "../src/parse-sprites.ts";
import type { Version } from "../src/types.ts";

Deno.test("parseSpriteName - single angle front", () => {
	const result = parseSpriteName("trooa1.png", "TROO");
	assertEquals(result.length, 1);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 1);
	assertEquals(result[0].mirror, false);
	assertEquals(result[0].sourceFile, "trooa1.png");
});

Deno.test("parseSpriteName - single angle back", () => {
	const result = parseSpriteName("trooa5.png", "TROO");
	assertEquals(result.length, 1);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 5);
	assertEquals(result[0].mirror, false);
});

Deno.test("parseSpriteName - dual-angle lower-first", () => {
	const result = parseSpriteName("trooa2a8.png", "TROO");
	assertEquals(result.length, 2);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 2);
	assertEquals(result[0].mirror, false);
	assertEquals(result[1].frame, "A");
	assertEquals(result[1].angle, 8);
	assertEquals(result[1].mirror, false);
});

Deno.test("parseSpriteName - dual-angle reversed order", () => {
	const result = parseSpriteName("skula6a4.png", "SKUL");
	assertEquals(result.length, 2);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 6);
	assertEquals(result[0].mirror, false);
	assertEquals(result[1].frame, "A");
	assertEquals(result[1].angle, 4);
	assertEquals(result[1].mirror, false);
});

Deno.test("parseSpriteName - cross-frame dual", () => {
	const result = parseSpriteName("skela2d8.png", "SKEL");
	assertEquals(result.length, 2);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 2);
	assertEquals(result[0].mirror, false);
	assertEquals(result[1].frame, "D");
	assertEquals(result[1].angle, 8);
	assertEquals(result[1].mirror, false);
});

Deno.test("parseSpriteName - angle 0 rotation-invariant", () => {
	const result = parseSpriteName("possh0.png", "POSS");
	assertEquals(result.length, 1);
	assertEquals(result[0].frame, "H");
	assertEquals(result[0].angle, 0);
	assertEquals(result[0].mirror, false);
});

Deno.test("parseSpriteName - gif extension", () => {
	const result = parseSpriteName("trooa1.gif", "TROO");
	assertEquals(result.length, 1);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 1);
	assertEquals(result[0].mirror, false);
});

Deno.test("parseSpriteName - uppercase input", () => {
	const result = parseSpriteName("TROOA1.PNG", "TROO");
	assertEquals(result.length, 1);
	assertEquals(result[0].frame, "A");
	assertEquals(result[0].angle, 1);
});

Deno.test("parseSpriteName - wrong code", () => {
	const result = parseSpriteName("trooa1.png", "POSS");
	assertEquals(result.length, 0);
});

Deno.test("parseSpriteName - non-sprite filename", () => {
	const result = parseSpriteName("readme.txt", "TROO");
	assertEquals(result.length, 0);
});

Deno.test("parseSpriteName - sourceFile preserved in dual", () => {
	const result = parseSpriteName("trooa3a7.png", "TROO");
	assertEquals(result.length, 2);
	assertEquals(result[0].sourceFile, "trooa3a7.png");
	assertEquals(result[1].sourceFile, "trooa3a7.png");
});

Deno.test("extractGridCells - basic extraction", () => {
	const files = [
		{ name: "possa1.png", url: "http://example.com/possa1.png" },
		{ name: "possa2.png", url: "http://example.com/possa2.png" },
		{ name: "possh0.png", url: "http://example.com/possh0.png" },
	];
	const cells = extractGridCells(files, "POSS");
	// A1, A2, H0, and auto-mirrored A8 (from A2)
	assertEquals(cells.length, 4);
	assertEquals(cells[0].frame, "A");
	assertEquals(cells[0].angle, 1);
	assertEquals(cells[0].file.name, "possa1.png");
});

Deno.test("extractGridCells - auto-mirrors missing angles", () => {
	const files = [
		{ name: "trooa2.png", url: "http://example.com/trooa2.png" },
	];
	const cells = extractGridCells(files, "TROO");
	// Should have A2 and A8 (mirrored)
	assertEquals(cells.length, 2);
	const a2 = cells.find(c => c.angle === 2)!;
	const a8 = cells.find(c => c.angle === 8)!;
	
	assertEquals(a2.mirror, false);
	assertEquals(a8.mirror, true);
	assertEquals(a8.frame, "A");
	assertEquals(a8.file.name, "trooa2.png");
});

Deno.test("extractGridCells - does not double-mirror if already present", () => {
	const files = [
		{ name: "trooa2a8.png", url: "http://example.com/trooa2a8.png" },
	];
	const cells = extractGridCells(files, "TROO");
	// Should still only have 2 cells, A2 and A8
	assertEquals(cells.length, 2);
	assertEquals(cells.filter(c => c.angle === 2).length, 1);
	assertEquals(cells.filter(c => c.angle === 8).length, 1);
});

Deno.test("extractGridCells - mirrors from high to low", () => {
	const files = [
		{ name: "trooa6.png", url: "http://example.com/trooa6.png" },
	];
	const cells = extractGridCells(files, "TROO");
	// Should have A6 and A4 (mirrored)
	assertEquals(cells.length, 2);
	const a6 = cells.find(c => c.angle === 6)!;
	const a4 = cells.find(c => c.angle === 4)!;
	assertEquals(a6.mirror, false);
	assertEquals(a4.mirror, true);
});

Deno.test("detectSource - all freedoom", () => {
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
	assertEquals(detectSource(version), "freedoom");
});

Deno.test("detectSource - all attic", () => {
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
	assertEquals(detectSource(version), "attic");
});

Deno.test("detectSource - majority wins", () => {
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
	assertEquals(detectSource(version), "freedoom");
});

Deno.test("detectSource - tie-break is first file", () => {
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
	assertEquals(detectSource(version), "attic");
});

Deno.test("detectSource - empty files returns unknown", () => {
	const version: Version = {
		date: "",
		sha: "",
		url: "",
		author: "",
		message: "",
		files: [],
	};
	assertEquals(detectSource(version), "unknown");
});

Deno.test("detectSource - unparseable URL returns unknown", () => {
	const version: Version = {
		date: "",
		sha: "",
		url: "",
		author: "",
		message: "",
		files: [{ name: "x.png", url: "https://example.com/foo.png" }],
	};
	assertEquals(detectSource(version), "unknown");
});

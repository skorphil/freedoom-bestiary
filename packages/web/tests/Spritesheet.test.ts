import { expect, test } from "bun:test";
import type {
	AnimationName,
	Character,
	CharacterCode,
	Spritesheet as SpritesheetData,
} from "@freedoom-bestiary/database/schema";
import { Spritesheet } from "../app/src/models/Spritesheet.ts";

// Mock data
const mockAtlas: SpritesheetData = {
	spritesheetId: "uuid-1",
	fileName: "test.webp",
	commitDate: new Date("2023-01-01"),
	commitSha: "test-sha",
	commitMessage: "test",
	commitUrl: "test",
	sprites: [
		{
			frame: "A",
			angle: 1,
			x: 0,
			y: 0,
			width: 20,
			height: 20,
			contributions: [],
			state: "new",
			spriteUrl: "",
		},
		{
			frame: "A",
			angle: 0,
			x: 20,
			y: 0,
			width: 20,
			height: 20,
			contributions: [],
			state: "new",
			spriteUrl: "",
		},
		{
			frame: "B",
			angle: 1,
			x: 40,
			y: 0,
			width: 20,
			height: 20,
			contributions: [],
			state: "new",
			spriteUrl: "",
		},
	],
};

const mockMeta: Character = {
	freedoomName: "Test Monster",
	description: "A test monster",
	animations: {
		idling: [
			{ frame: "A", delay: 2 },
			{ frame: "B", delay: 1 },
		],
	},
} as unknown as Character;

const getMeta = () => mockMeta;

test("Spritesheet - bounding box calculation", () => {
	const sheet = new Spritesheet("TEST" as CharacterCode, mockAtlas, getMeta);

	const size = sheet.getStageSize();
	expect(size.width).toBe(100);
	expect(size.height).toBe(120);
});

test("Spritesheet - getAnimations", () => {
	const sheet = new Spritesheet("TEST" as CharacterCode, mockAtlas, getMeta);

	const anims = sheet.getAnimations();
	const idling = anims.idling;
	expect(idling).toBeDefined();
	// Frame A has angle 0, so it includes angle 0.
	// Frame B has only angle 1, so angle 1 is included.
	expect(idling?.angles).toContain(0);
	expect(idling?.angles).toContain(1);
	expect(idling?.angles).not.toContain(2);
});

test("Spritesheet - getCharacterName and getCharacterDescription", () => {
	const sheet = new Spritesheet("TEST" as CharacterCode, mockAtlas, getMeta);

	expect(sheet.getCharacterName()).toBe("Test Monster");
	expect(sheet.getCharacterDescription()).toBe("A test monster");
});

test("Spritesheet - angle 0 takes precedence", () => {
	const sheet = new Spritesheet(
		"TEST" as CharacterCode,
		{
			...mockAtlas,
			sprites: [
				{
					frame: "A",
					angle: 0,
					x: 20,
					y: 0,
					width: 20,
					height: 20,
					contributions: [],
					state: "new",
					spriteUrl: "",
				},
				{
					frame: "A",
					angle: 1,
					x: 0,
					y: 0,
					width: 20,
					height: 20,
					contributions: [],
					state: "new",
					spriteUrl: "",
				},
			],
		},
		getMeta,
	);

	// Frame A has both angle 0 and angle 1. Angle 0 should take precedence.
	const gen = sheet.play("idling" as AnimationName, 1);
	const result = gen.next().value;
	expect(result.source.frame).toBe("A");
	expect(result.source.angle).toBe(0);
});

test("Spritesheet - play generator timing", () => {
	const sheet = new Spritesheet("TEST" as CharacterCode, mockAtlas, getMeta);

	const gen = sheet.play("idling" as AnimationName, 1);

	// Tick 1: Frame A
	let result = gen.next().value;
	expect(result.source.frame).toBe("A");

	// Tick 2: Still Frame A (delay 2)
	result = gen.next().value;
	expect(result.source.frame).toBe("A");

	// Tick 3: Frame B (delay 1)
	result = gen.next().value;
	expect(result.source.frame).toBe("B");

	// Tick 4: Back to Frame A (looping)
	result = gen.next().value;
	expect(result.source.frame).toBe("A");
});

test("Spritesheet - angle fallback", () => {
	const sheet = new Spritesheet("TEST" as CharacterCode, mockAtlas, getMeta);

	// Angle 2 doesn't exist for A, should fallback to 0 or 1
	const gen = sheet.play("idling" as AnimationName, 2);
	const result = gen.next().value;
	expect(result.source.frame).toBe("A");
	expect([0, 1]).toContain(result.source.angle);
});

test("Spritesheet - invalid animation throws", () => {
	const sheet = new Spritesheet("TEST" as CharacterCode, mockAtlas, getMeta);

	expect(() => sheet.play("non-existent" as AnimationName, 1).next()).toThrow();
});

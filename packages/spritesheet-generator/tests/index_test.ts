import { expect, test } from "bun:test";
import { join } from "node:path";
import {
	defaultConfig,
	loadCollection,
	readInputTargets,
	runWithConfig,
	type InputTarget,
	type RuntimeConfig,
} from "../src/index.ts";
import type { Version } from "../src/types.ts";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

// Load a valid 16x16 PNG from disk for testing.
const TINY_PNG = readFileSync(
	join(import.meta.dirname!, "test-data/test.png"),
);

function git(args: string[], cwd?: string): string {
	const result = spawnSync("git", args, {
		cwd,
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "t@e.st",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "t@e.st",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_SYSTEM: "/dev/null",
		},
	});
	
	if (result.status !== 0) {
		const errText = result.stderr.toString();
		const outText = result.stdout.toString();
		throw new Error(
			`git ${args[0]} failed (code=${result.status}): stderr=${errText || "(empty)"} | stdout=${outText || "(empty)"}`,
		);
	}
	return result.stdout.toString().trim();
}

interface TestRepo {
	bareDir: string;
	blobSha: string;
}

function addCommit(
	bareDir: string,
	tmpRoot: string,
	name: string,
	extraSpriteNames: string[],
): string {
	// Reuse the existing work dir, add more sprites, commit, fetch into the
	// bare clone. Returns the new commit sha.
	const workDir = join(tmpRoot, `${name}-work`);
	for (const n of extraSpriteNames) {
		writeFileSync(join(workDir, "sprites", n), TINY_PNG);
	}
	git(["add", "."], workDir);
	git(["commit", "-q", "-m", "more"], workDir);
	const sha = git(["rev-parse", "HEAD"], workDir);
	// Push the new commit into the bare clone.
	git(["push", "-q", bareDir, "main"], workDir);
	return sha;
}

function makeBareRepoWithSprites(
	tmpRoot: string,
	name: string,
	spriteNames: string[],
): TestRepo {
	// Create a working repo, commit each requested sprite under `sprites/`,
	// matching the path layout the production input JSONs reference.
	const workDir = join(tmpRoot, `${name}-work`);
	const bareDir = join(tmpRoot, `${name}.git`);
	mkdirSync(join(workDir, "sprites"), { recursive: true });
	git(["init", "-q", "-b", "main"], workDir);
	for (const n of spriteNames) {
		writeFileSync(join(workDir, "sprites", n), TINY_PNG);
	}
	git(["add", "."], workDir);
	git(["commit", "-q", "-m", "init"], workDir);

	mkdirSync(bareDir, { recursive: true });
	git(["clone", "-q", "--bare", workDir, bareDir]);

	const fullSha = git(["rev-parse", "HEAD"], workDir);
	return { bareDir, blobSha: fullSha };
}

function makeVersion(
	blobSha: string,
	repo: "freedoom" | "attic",
	files: Array<{ name: string; angle: number; mirror: boolean }>,
): Version {
	const urlBase = `https://github.com/freedoom/${repo}/blob/${blobSha}/sprites`;
	return {
		date: "2023-01-01T00:00:00Z",
		sha: blobSha,
		url: `https://github.com/freedoom/${repo}/commit/${blobSha}`,
		author: "tester",
		message: "test",
		files: files.map((f) => ({
			name: f.name,
			url: `${urlBase}/${f.name}`,
		})),
	};
}

function configFor(
	tmpRoot: string,
	bareRepos: Record<string, string>,
): RuntimeConfig {
	return {
		...defaultConfig(),
		repoRoot: tmpRoot,
		versionsDir: join(tmpRoot, "versions"),
		outputDir: join(tmpRoot, "out"),
		bareRepos,
	};
}

function makeInputFile(
	versionsDir: string,
	code: string,
	versions: Version[],
): string {
	mkdirSync(versionsDir, { recursive: true });
	const path = join(versionsDir, `${code}.json`);
	// historical-parser format uses spriteVersions key
	writeFileSync(path, JSON.stringify({ spriteVersions: versions.map(v => ({
		...v,
		sprites: v.files.map(f => ({
			name: f.name,
			url: f.url,
			spriteState: "new" // ensures it passes the filter
		}))
	})) }));
	return path;
}

test("main - appends entries for unseen shas", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const bare = makeBareRepoWithSprites(tmp, "freedoom", [
			"possa1.png",
			"possa2.png",
		]);
		const cfg = configFor(tmp, {
			"freedoom/freedoom": bare.bareDir,
			"freedoom/attic": bare.bareDir,
		});
		const v = makeVersion(bare.blobSha, "freedoom", [
			{ name: "possa1.png", angle: 1, mirror: false },
			{ name: "possa2.png", angle: 2, mirror: false },
		]);
		const targets: InputTarget[] = [
			{
				versions: [v],
				code: "POSS",
				path: "POSS.json",
			},
		];

		const { collection, appended } = await runWithConfig(cfg, targets);

		expect(appended).toEqual(1);
		const poss = collection["POSS"]!;
		expect(poss.length).toEqual(1);
		expect(poss[0].sha).toEqual(bare.blobSha);
		expect(poss[0].source).toEqual("freedoom");

		// Sheet must exist on disk.
		const sheetPath = join(cfg.outputDir, poss[0].spritesheetPath);
		const stat = statSync(sheetPath);
		expect(stat).toBeDefined();

		// Index file must be written.
		const fromDisk = await loadCollection(cfg);
		expect(fromDisk["POSS"]!.length).toEqual(1);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - skips already-indexed shas", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const bare = makeBareRepoWithSprites(tmp, "freedoom", ["possa1.png"]);
		const cfg = configFor(tmp, {
			"freedoom/freedoom": bare.bareDir,
			"freedoom/attic": bare.bareDir,
		});
		const v = makeVersion(bare.blobSha, "freedoom", [
			{ name: "possa1.png", angle: 1, mirror: false },
		]);
		const targets: InputTarget[] = [
			{
				versions: [v],
				code: "POSS",
				path: "POSS.json",
			},
		];

		const first = await runWithConfig(cfg, targets);
		expect(first.appended).toEqual(1);
		const second = await runWithConfig(cfg, targets);
		expect(second.appended).toEqual(0);
		expect(second.collection["POSS"]!.length).toEqual(1);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - uses bare clone when present", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const bare = makeBareRepoWithSprites(tmp, "freedoom", ["possa1.png"]);
		const cfg = configFor(tmp, {
			"freedoom/freedoom": bare.bareDir,
			"freedoom/attic": bare.bareDir,
		});
		const v = makeVersion(bare.blobSha, "freedoom", [
			{ name: "possa1.png", angle: 1, mirror: false },
		]);
		const targets: InputTarget[] = [
			{
				versions: [v],
				code: "POSS",
				path: "POSS.json",
			},
		];

		// Stub fetch: must never be called because the bare clone is sufficient.
		const realFetch = globalThis.fetch;
		let fetchCalls = 0;
		globalThis.fetch = ((..._args) => {
			fetchCalls++;
			throw new Error("fetch should not be called when bare clone is present");
		}) as typeof fetch;
		try {
			const { appended } = await runWithConfig(cfg, targets);
			expect(appended).toEqual(1);
			expect(fetchCalls).toEqual(0);
		} finally {
			globalThis.fetch = realFetch;
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - emits source field per entry", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const bareFreedoom = makeBareRepoWithSprites(tmp, "freedoom", [
			"possa1.png",
		]);
		const bareAttic = makeBareRepoWithSprites(tmp, "attic", [
			"skula1.png",
		]);
		const cfg = configFor(tmp, {
			"freedoom/freedoom": bareFreedoom.bareDir,
			"freedoom/attic": bareAttic.bareDir,
		});
		const targets: InputTarget[] = [
			{
				versions: [
					makeVersion(bareFreedoom.blobSha, "freedoom", [
						{ name: "possa1.png", angle: 1, mirror: false },
					]),
				],
				code: "POSS",
				path: "POSS.json",
			},
			{
				versions: [
					makeVersion(bareAttic.blobSha, "attic", [
						{ name: "skula1.png", angle: 1, mirror: false },
					]),
				],
				code: "SKUL",
				path: "SKUL.json",
			},
		];

		const { collection } = await runWithConfig(cfg, targets);
		expect(collection["POSS"]![0].source).toEqual("freedoom");
		expect(collection["SKUL"]![0].source).toEqual("attic");
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - accepts a single JSON file path", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const bare = makeBareRepoWithSprites(tmp, "freedoom", ["possa1.png"]);
		const sha2 = addCommit(bare.bareDir, tmp, "freedoom", ["possa2.png"]);
		const versionsDir = join(tmp, "versions");
		const v1 = makeVersion(bare.blobSha, "freedoom", [
			{ name: "possa1.png", angle: 1, mirror: false },
		]);
		const v2 = makeVersion(sha2, "freedoom", [
			{ name: "possa2.png", angle: 2, mirror: false },
		]);
		const path = makeInputFile(versionsDir, "POSS", [v1, v2]);

		const cfg = configFor(tmp, {
			"freedoom/freedoom": bare.bareDir,
			"freedoom/attic": bare.bareDir,
		});

		const targets = await readInputTargets(cfg, [path]);
		expect(targets.length).toEqual(1);
		expect(targets[0].code).toEqual("POSS");
		expect(targets[0].versions.length).toEqual(2);

		const { collection } = await runWithConfig(cfg, targets);
		expect(collection["POSS"]!.length).toEqual(2);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - accepts a directory path", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const possBare = makeBareRepoWithSprites(tmp, "poss", ["possa1.png"]);
		const sposBare = makeBareRepoWithSprites(tmp, "spos", ["sposa1.png"]);
		const versionsDir = join(tmp, "versions");
		makeInputFile(versionsDir, "POSS", [
			makeVersion(possBare.blobSha, "freedoom", [
				{ name: "possa1.png", angle: 1, mirror: false },
			]),
		]);
		makeInputFile(versionsDir, "SPOS", [
			makeVersion(sposBare.blobSha, "attic", [
				{ name: "sposa1.png", angle: 1, mirror: false },
			]),
		]);

		const cfg = configFor(tmp, {
			"freedoom/freedoom": possBare.bareDir,
			"freedoom/attic": sposBare.bareDir,
		});

		const targets = await readInputTargets(cfg, [versionsDir]);
		expect(targets.length).toEqual(2);
		const codes = targets.map((t) => t.code).sort();
		expect(codes).toEqual(["POSS", "SPOS"]);

		const { collection } = await runWithConfig(cfg, targets);
		expect(collection["POSS"]!.length).toEqual(1);
		expect(collection["SPOS"]!.length).toEqual(1);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - errors clearly on a missing path", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const cfg = configFor(tmp, {});
		const missing = join(tmp, "does-not-exist.json");
		await expect(readInputTargets(cfg, [missing])).rejects.toThrow(`Input path ${missing} does not exist`);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});

test("main - errors on a non-json file path", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "ssg-"));
	try {
		const cfg = configFor(tmp, {});
		const txtPath = join(tmp, "readme.txt");
		writeFileSync(txtPath, "hi");
		await expect(readInputTargets(cfg, [txtPath])).rejects.toThrow(`Input path ${txtPath} is not a .json file or directory`);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
});
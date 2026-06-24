import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
	defaultConfig,
	loadCollection,
	readInputTargets,
	runWithConfig,
	type InputTarget,
	type RuntimeConfig,
} from "../src/index.ts";
import type { Version } from "../src/types.ts";

// Load a valid 16x16 PNG from disk for testing.
const TINY_PNG = await Deno.readFile(
	join(import.meta.dirname!, "test-data/test.png"),
);

async function git(args: string[], cwd?: string): Promise<string> {
	const cmd = new Deno.Command("git", {
		args,
		cwd,
		stdout: "piped",
		stderr: "piped",
		env: {
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "t@e.st",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "t@e.st",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_SYSTEM: "/dev/null",
		},
	});
	const output = await cmd.output();
	const { success, stdout, stderr, code } = output;
	if (!success) {
		const errText = new TextDecoder().decode(stderr);
		const outText = new TextDecoder().decode(stdout);
		throw new Error(
			`git ${args[0]} failed (code=${code}): stderr=${errText || "(empty)"} | stdout=${outText || "(empty)"}`,
		);
	}
	return new TextDecoder().decode(stdout).trim();
}

interface TestRepo {
	bareDir: string;
	blobSha: string;
}

async function addCommit(
	bareDir: string,
	tmpRoot: string,
	name: string,
	extraSpriteNames: string[],
): Promise<string> {
	// Reuse the existing work dir, add more sprites, commit, fetch into the
	// bare clone. Returns the new commit sha.
	const workDir = join(tmpRoot, `${name}-work`);
	for (const n of extraSpriteNames) {
		await Deno.writeFile(join(workDir, "sprites", n), TINY_PNG);
	}
	await git(["add", "."], workDir);
	await git(["commit", "-q", "-m", "more"], workDir);
	const sha = await git(["rev-parse", "HEAD"], workDir);
	// Push the new commit into the bare clone.
	await git(["push", "-q", bareDir, "main"], workDir);
	return sha;
}

async function makeBareRepoWithSprites(
	tmpRoot: string,
	name: string,
	spriteNames: string[],
): Promise<TestRepo> {
	// Create a working repo, commit each requested sprite under `sprites/`,
	// matching the path layout the production input JSONs reference.
	const workDir = join(tmpRoot, `${name}-work`);
	const bareDir = join(tmpRoot, `${name}.git`);
	await Deno.mkdir(join(workDir, "sprites"), { recursive: true });
	await git(["init", "-q", "-b", "main"], workDir);
	for (const n of spriteNames) {
		await Deno.writeFile(join(workDir, "sprites", n), TINY_PNG);
	}
	await git(["add", "."], workDir);
	await git(["commit", "-q", "-m", "init"], workDir);

	await Deno.mkdir(bareDir, { recursive: true });
	await git(["clone", "-q", "--bare", workDir, bareDir]);

	const fullSha = await git(["rev-parse", "HEAD"], workDir);
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

async function makeInputFile(
	versionsDir: string,
	code: string,
	versions: Version[],
): Promise<string> {
	await Deno.mkdir(versionsDir, { recursive: true });
	const path = join(versionsDir, `${code}.json`);
	// historical-parser format uses spriteVersions key
	await Deno.writeTextFile(path, JSON.stringify({ spriteVersions: versions.map(v => ({
		...v,
		sprites: v.files.map(f => ({
			name: f.name,
			url: f.url,
			spriteState: "new" // ensures it passes the filter
		}))
	})) }));
	return path;
}

Deno.test("main - appends entries for unseen shas", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const bare = await makeBareRepoWithSprites(tmp, "freedoom", [
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

		assertEquals(appended, 1);
		const poss = collection["POSS"]!;
		assertEquals(poss.length, 1);
		assertEquals(poss[0].sha, bare.blobSha);
		assertEquals(poss[0].source, "freedoom");

		// Sheet must exist on disk.
		const sheetPath = join(cfg.outputDir, poss[0].spritesheetPath);
		const stat = await Deno.stat(sheetPath);
		assertExists(stat);

		// Index file must be written.
		const fromDisk = await loadCollection(cfg);
		assertEquals(fromDisk["POSS"]!.length, 1);
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - skips already-indexed shas", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const bare = await makeBareRepoWithSprites(tmp, "freedoom", ["possa1.png"]);
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
		assertEquals(first.appended, 1);
		const second = await runWithConfig(cfg, targets);
		assertEquals(second.appended, 0);
		assertEquals(second.collection["POSS"]!.length, 1);
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - uses bare clone when present", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const bare = await makeBareRepoWithSprites(tmp, "freedoom", ["possa1.png"]);
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
			assertEquals(appended, 1);
			assertEquals(fetchCalls, 0);
		} finally {
			globalThis.fetch = realFetch;
		}
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - emits source field per entry", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const bareFreedoom = await makeBareRepoWithSprites(tmp, "freedoom", [
			"possa1.png",
		]);
		const bareAttic = await makeBareRepoWithSprites(tmp, "attic", [
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
		assertEquals(collection["POSS"]![0].source, "freedoom");
		assertEquals(collection["SKUL"]![0].source, "attic");
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - accepts a single JSON file path", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const bare = await makeBareRepoWithSprites(tmp, "freedoom", ["possa1.png"]);
		const sha2 = await addCommit(bare.bareDir, tmp, "freedoom", ["possa2.png"]);
		const versionsDir = join(tmp, "versions");
		const v1 = makeVersion(bare.blobSha, "freedoom", [
			{ name: "possa1.png", angle: 1, mirror: false },
		]);
		const v2 = makeVersion(sha2, "freedoom", [
			{ name: "possa2.png", angle: 2, mirror: false },
		]);
		const path = await makeInputFile(versionsDir, "POSS", [v1, v2]);

		const cfg = configFor(tmp, {
			"freedoom/freedoom": bare.bareDir,
			"freedoom/attic": bare.bareDir,
		});

		const targets = await readInputTargets(cfg, [path]);
		assertEquals(targets.length, 1);
		assertEquals(targets[0].code, "POSS");
		assertEquals(targets[0].versions.length, 2);

		const { collection } = await runWithConfig(cfg, targets);
		assertEquals(collection["POSS"]!.length, 2);
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - accepts a directory path", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const possBare = await makeBareRepoWithSprites(tmp, "poss", ["possa1.png"]);
		const sposBare = await makeBareRepoWithSprites(tmp, "spos", ["sposa1.png"]);
		const versionsDir = join(tmp, "versions");
		await makeInputFile(versionsDir, "POSS", [
			makeVersion(possBare.blobSha, "freedoom", [
				{ name: "possa1.png", angle: 1, mirror: false },
			]),
		]);
		await makeInputFile(versionsDir, "SPOS", [
			makeVersion(sposBare.blobSha, "attic", [
				{ name: "sposa1.png", angle: 1, mirror: false },
			]),
		]);

		const cfg = configFor(tmp, {
			"freedoom/freedoom": possBare.bareDir,
			"freedoom/attic": sposBare.bareDir,
		});

		const targets = await readInputTargets(cfg, [versionsDir]);
		assertEquals(targets.length, 2);
		const codes = targets.map((t) => t.code).sort();
		assertEquals(codes, ["POSS", "SPOS"]);

		const { collection } = await runWithConfig(cfg, targets);
		assertEquals(collection["POSS"]!.length, 1);
		assertEquals(collection["SPOS"]!.length, 1);
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - errors clearly on a missing path", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const cfg = configFor(tmp, {});
		const missing = join(tmp, "does-not-exist.json");
		await assertRejects(
			() => readInputTargets(cfg, [missing]),
			Error,
			`Input path ${missing} does not exist`,
		);
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

Deno.test("main - errors on a non-json file path", async () => {
	const tmp = await Deno.makeTempDir({ prefix: "ssg-" });
	try {
		const cfg = configFor(tmp, {});
		const txtPath = join(tmp, "readme.txt");
		await Deno.writeTextFile(txtPath, "hi");
		await assertRejects(
			() => readInputTargets(cfg, [txtPath]),
			Error,
			`Input path ${txtPath} is not a .json file or directory`,
		);
	} finally {
		await Deno.remove(tmp, { recursive: true });
	}
});

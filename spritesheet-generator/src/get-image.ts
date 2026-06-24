import { join } from "@std/path";
import type { BlobRef } from "./types.ts";

const BLOB_URL_RE =
	/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([0-9a-f]+)\/(.+)$/i;

/**
 * Parses a GitHub blob URL into its component parts.
 * 
 * @param url - The GitHub blob URL to parse
 * @returns A BlobRef object if the URL matches the expected format, null otherwise
 */
export function parseBlobUrl(url: string): BlobRef | null {
	const m = url.match(BLOB_URL_RE);
	if (!m) return null;
	const [, owner, repoName, sha, path] = m;
	return { repo: `${owner}/${repoName}`, sha, path };
}

/**
 * Converts a GitHub blob URL to a raw content URL.
 * 
 * @param blobUrl - The GitHub blob URL to convert
 * @returns The corresponding raw content URL
 */
export function buildRawUrl(blobUrl: string): string {
	return blobUrl
		.replace("github.com", "raw.githubusercontent.com")
		.replace("/blob/", "/");
}

/**
 * Runs a Git command in a specified directory.
 * 
 * @param args - The arguments to pass to the Git command
 * @param cwd - The current working directory for the command
 * @returns A promise that resolves to the command output or null if it fails
 */
async function runGit(args: string[], cwd: string): Promise<Uint8Array | null> {
	try {
		const cmd = new Deno.Command("git", {
			args,
			cwd,
			stdout: "piped",
			stderr: "piped",
		});
		const { success, stdout } = await cmd.output();
		if (!success) return null;
		return new Uint8Array(stdout);
	} catch {
		return null;
	}
}

/**
 * Reads a blob from a Git repository.
 * 
 * @param bareRepoPath - The path to the bare Git repository
 * @param sha - The commit SHA
 * @param path - The path to the file within the repository
 * @returns A promise that resolves to the file content or null if it fails
 */
export async function readGitBlob(
	bareRepoPath: string,
	sha: string,
	path: string,
): Promise<Uint8Array | null> {
	return await runGit(["show", `${sha}:${path}`], bareRepoPath);
}

/**
 * Maps repository names to their local bare repository paths.
 */
export interface BareRepoMap {
	/** Repository name mapped to its local path */
	readonly [repo: string]: string;
}

/**
 * Loads a sprite image from either a local Git repository or a remote URL.
 * 
 * @param url - The URL of the image to load
 * @param bareRepos - A map of repository names to their local paths
 * @returns A promise that resolves to an object containing the image data and extension, or null if it fails
 */
export async function loadSpriteImage(
  url: string,
  bareRepos: BareRepoMap,
): Promise<{ data: Uint8Array; ext: string } | null> {
	const extMatch = url.match(/\.(png|gif)$/i);
	const ext = extMatch ? extMatch[1].toLowerCase() : "png";

	const parsed = parseBlobUrl(url);
	if (parsed) {
		const bareRepoPath = bareRepos[parsed.repo];
		if (bareRepoPath) {
			const data = await readGitBlob(bareRepoPath, parsed.sha, parsed.path);
			if (data && data.length > 0) return { data, ext };
		}
	}

  try {
    const res = await fetch(buildRawUrl(url));
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    // Basic guard: require an image content-type when possible
    if (!contentType.startsWith("image/")) {
      // still try to read, but log and return null to avoid writing HTML error pages
      console.warn(`Skipping non-image content for ${url}: ${contentType}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    const data = new Uint8Array(buf);
    // Additional sanity check using magic bytes for PNG/GIF
    if (ext === "png") {
      if (!(data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47)) {
        console.warn(`Downloaded file for ${url} is not valid PNG (magic bytes mismatch)`);
        return null;
      }
    } else if (ext === "gif") {
      if (!(data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38)) {
        console.warn(`Downloaded file for ${url} is not valid GIF (magic bytes mismatch)`);
        return null;
      }
    }
    return { data, ext };
  } catch {
    return null;
  }
}

/**
 * Creates a map of repository names to their local bare repository paths.
 * 
 * @param repoRoot - The root directory of the repository
 * @returns A BareRepoMap object
 */
export function bareRepoMap(repoRoot: string): BareRepoMap {
	return {
		"freedoom/freedoom": join(repoRoot, "src", "freedoom.git"),
		"freedoom/attic": join(repoRoot, "src", "attic.git"),
	};
}

/**
 * All Deno.Command git calls live here. No other class calls git directly.
 *
 * This class is the I/O boundary for all git operations, making it easy to mock
 * for testing and ensuring consistent error handling across the codebase.
 *
 * @example
 * const reader = new GitReader("/path/to/freedoom.git");
 * for await (const line of reader.streamLog()) {
 *   console.log(line);
 * }
 */
export class GitReader {
  /** Absolute path to the bare git repository */
  readonly repoPath: string;
  // Long-lived git cat-file --batch process and helpers
  private batchChild: Deno.ChildProcess | null = null;
  private batchStdoutReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private batchStdinWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private batchDecoder = new TextDecoder();
  private batchLeftover = "";
  // Serializes concurrent fetchViaBatch calls so they don't race on the shared stdout reader
  private batchQueue: Promise<unknown> = Promise.resolve();
  private symlinkCache = new Map<string, string>();

  /**
   * Creates a new GitReader for the given repository.
   *
   * @param repoPath - Absolute path to bare .git directory
   */
  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Streams git log output with name-status format.
   *
   * @yields Each line of git log output
   */
  async *streamLog(): AsyncIterable<string> {
    // Use a more standard format for git log
    const args = [
      "log",
      "--name-status",
      "--pretty=format:%H|%ad|%an|%s",
      "--date=iso-strict",
    ];

    console.debug("GitReader.streamLog: running git with args:", args);
    const output = await this.run(args);
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.trim() !== "") {
        yield line;
      }
    }
  }

  /**
   * Gets tree entries for a specific commit SHA.
   *
   * @param sha - The commit SHA
   * @param folderPath - Optional folder path to filter entries
   * @returns Array of tree entries
   */
  async getTreeEntries(sha: string, folderPath?: string): Promise<TreeEntry[]> {
    const args = ["ls-tree", "-r", sha];

    console.debug("GitReader.getTreeEntries: running git ls-tree for", sha, "folderPath=", folderPath);
    const output = await this.run(args);
    const lines = output.split("\n");
    const entries: TreeEntry[] = [];

    for (const line of lines) {
      if (line.trim() === "") continue;

      // Parse git ls-tree output: mode type objectHash\tfilePath
      const tabSplit = line.split("\t");
      if (tabSplit.length < 2) continue;

      const [info, path] = tabSplit;
      const infoParts = info.split(" ");
      if (infoParts.length < 3) continue;

      const [mode, type, objectHash] = infoParts;

      // If folderPath is provided, filter entries that match the path
      if (folderPath && !path.startsWith(folderPath)) {
        continue;
      }

      entries.push({
        mode,
        type,
        objectHash,
        path,
        isSymlink: mode.startsWith("12"), // Git symlink mode starts with 12
      });
    }

    return entries;
  }

  /**
   * Resolves a symlink target from its object hash.
   *
   * @param objectHash - The object hash of the symlink
   * @returns The target path of the symlink
   */
  async resolveSymlinkTarget(objectHash: string): Promise<string> {
    // Check cache first
    if (this.symlinkCache.has(objectHash)) {
      return this.symlinkCache.get(objectHash)!;
    }

    console.debug("GitReader.resolveSymlinkTarget: resolving", objectHash);
    const result = await this.fetchViaBatch(objectHash);
    this.symlinkCache.set(objectHash, result);
    return result;
  }

  /**
   * Starts the git cat-file --batch subprocess lazily.
   */
  private async lazyInitBatch(): Promise<void> {
    if (this.batchChild) return;

    const command = new Deno.Command("git", {
      args: ["-C", this.repoPath, "cat-file", "--batch"],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const child = command.spawn();
    this.batchChild = child;
    if (child.stdout) this.batchStdoutReader = child.stdout.getReader();
    if (child.stdin) this.batchStdinWriter = child.stdin.getWriter();
  }

  /**
   * Fetches a blob's content using the long-lived --batch process.
   * Serialized via batchQueue so concurrent callers don't race on stdout.
   */
  private fetchViaBatch(objectHash: string): Promise<string> {
    const result = this.batchQueue.then(() => this.doFetchViaBatch(objectHash));
    // Swallow errors on the queue tail so a failure doesn't permanently stall it
    this.batchQueue = result.catch(() => {});
    return result;
  }

  private async doFetchViaBatch(objectHash: string): Promise<string> {
    await this.lazyInitBatch();
    if (!this.batchStdinWriter || !this.batchStdoutReader) {
      throw new Error("Batch process not available");
    }

    const encoder = new TextEncoder();
    await this.batchStdinWriter.write(encoder.encode(objectHash + "\n"));

    // Start from any bytes left over from the previous call
    let buf = this.batchLeftover;
    this.batchLeftover = "";

    const readMore = async () => {
      const { value, done } = await this.batchStdoutReader!.read();
      if (done) throw new Error("git cat-file --batch closed unexpectedly");
      buf += this.batchDecoder.decode(value, { stream: true });
    };

    // Read until we have a complete header line
    while (!buf.includes("\n")) await readMore();

    const nlIdx = buf.indexOf("\n");
    const line = buf.slice(0, nlIdx);
    buf = buf.slice(nlIdx + 1);

    // Parse header: <hash> <type> <size>
    const parts = line.split(" ");
    if (parts.length < 3) throw new Error("Unexpected cat-file header: " + line);
    const size = parseInt(parts[2], 10);

    // Read until we have size bytes + 1 trailing newline separator
    while (buf.length < size + 1) await readMore();

    const blob = buf.slice(0, size);
    // Save everything after size + trailing newline for the next call
    this.batchLeftover = buf.slice(size + 1);
    return blob;
  }

  /**
   * Close the batch process if running.
   */
  async close(): Promise<void> {
    try {
      if (this.batchStdinWriter) {
        await this.batchStdinWriter.close();
      }
      if (this.batchStdoutReader) {
        await this.batchStdoutReader.cancel();
      }
      if (this.batchChild) {
        try {
          this.batchChild.kill();
        } catch {
          // ignore
        }
      }
    } finally {
      this.batchChild = null;
      this.batchStdoutReader = null;
      this.batchStdinWriter = null;
      this.batchLeftover = "";
      this.batchDecoder = new TextDecoder();
      this.batchQueue = Promise.resolve();
    }
  }

  /**
   * Internal method to run git commands.
   *
   * @param args - Git command arguments
   * @returns The command output as string
   */
  private async run(args: string[]): Promise<string> {
    console.debug("GitReader.run: git -C", this.repoPath, args.join(" "));
    const command = new Deno.Command("git", {
      args: ["-C", this.repoPath, ...args],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
      const errorMessage = new TextDecoder().decode(stderr);
      console.error("GitReader.run: git command failed:", errorMessage);
      throw new Error(
        `Git command failed: git ${args.join(" ")}\n${errorMessage}`,
      );
    }

    const out = new TextDecoder().decode(stdout);
    console.debug("GitReader.run: command completed, output length=", out.length);
    return out;
  }
}

/**
 * Represents an entry in a git tree.
 * Contains metadata about a file or directory in a specific commit.
 */
export type TreeEntry = {
  /** File mode (permissions) */
  mode: string;
  /** Object type (blob, tree, commit, tag) */
  type: string;
  /** Git object hash */
  objectHash: string;
  /** File path relative to repository root */
  path: string;
  /** Whether this entry is a symlink */
  isSymlink: boolean;
};

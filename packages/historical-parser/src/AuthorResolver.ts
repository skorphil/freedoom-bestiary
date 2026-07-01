import { GitReader } from "./GitReader.ts";
import type { AuthorInfo } from "./types.ts";

export type AuthorResolverOptions = {
  aiToken?: string;
  gatewayUrl?: string;
  noAi?: boolean;
  cachePath?: string;
  freedoomRepoPath?: string;
};

/**
 * Resolves authors for sprites using local cache and OpenAI/Kilo Gateway.
 */
export class AuthorResolver {
  private cache: Record<string, AuthorInfo[]> = {};
  private readonly cachePath: string;
  private credits: string = "";

  constructor(private options: AuthorResolverOptions = {}) {
    // In Bun, import.meta.path or import.meta.url are available.
    // For local file paths in Bun, import.meta.dir is also available if using bun types properly.
    // @ts-ignore
    const currentDir = import.meta.dir || ".";
    // @ts-ignore
    this.cachePath = options.cachePath ?? `${currentDir}/authors.json`;
  }

  /**
   * Initializes the resolver by loading the cache and CREDITS file.
   */
  async init() {
    try {
      const file = Bun.file(this.cachePath);
      if (await file.exists()) {
        this.cache = await file.json();
      } else {
        this.cache = {};
      }
    } catch (e: any) {
      console.error("Failed to load author cache:", e);
      this.cache = {};
    }

    // Load CREDITS file if repo path is provided
    if (this.options.freedoomRepoPath) {
      try {
        const gitReader = new GitReader(this.options.freedoomRepoPath);
        const entries = await gitReader.getTreeEntries("HEAD");
        const creditsEntry = entries.find(e => e.path === "CREDITS");
        if (creditsEntry) {
          // fetchViaBatch is private, but GitReader.run is also private.
          // I'll add a getFileContent to GitReader or just use show.
          // Wait, GitReader doesn't have a public getFileContent.
          // I'll use git show directly via Bun.spawnSync for simplicity here.
          const { stdout, success } = Bun.spawnSync([
            "git", "-C", this.options.freedoomRepoPath, "show", "HEAD:CREDITS"
          ]);
          if (success) {
            this.credits = new TextDecoder().decode(stdout);
          }
        }
      } catch (e) {
        console.error("Failed to load CREDITS file:", e);
      }
    }
  }

  /**
   * Resolves authors for a batch of sprites in a commit.
   * @param context Commit context (author, message)
   * @param sprites List of sprite URLs and paths to resolve
   */
  async resolveAuthorsBatch(
    context: { author: string; message: string; sha: string },
    sprites: Array<{ url: string; path: string }>
  ): Promise<Record<string, AuthorInfo[]>> {
    const results: Record<string, AuthorInfo[]> = {};
    const missing: Array<{ url: string; path: string }> = [];

    // 1. Check cache first
    for (const sprite of sprites) {
      if (this.cache[sprite.url]) {
        results[sprite.url] = this.cache[sprite.url];
      } else {
        missing.push(sprite);
      }
    }

    if (missing.length === 0) return results;

    // 2. If missing and noAi is true, throw error
    if (this.options.noAi) {
      throw new Error(
        `Authors missing for ${missing.length} sprites in commit ${context.sha} and AI is disabled (--no-ai). Missing paths: ${missing.map(m => m.path).join(", ")}`
      );
    }

    // 3. AI Call
    if (!this.options.aiToken || !this.options.gatewayUrl) {
      console.error("AI Context:", {
        hasToken: !!this.options.aiToken,
        gatewayUrl: this.options.gatewayUrl
      });
      throw new Error("AI Token or Gateway URL missing for author resolution.");
    }

    console.debug(`Calling AI Gateway for ${missing.length} missing sprites: ${this.options.gatewayUrl}`);
    
    // Ensure the URL is trimmed and valid
    const url = this.options.gatewayUrl!.trim();
    
    // Process granularly
    await this.fetchAuthorsGranularly(context, missing, url, results);
    
    return results;
  }

  private async fetchAuthorsGranularly(
    context: { author: string; message: string; sha: string },
    missing: Array<{ url: string; path: string }>,
    gatewayUrl: string,
    results: Record<string, AuthorInfo[]>
  ): Promise<void> {
    // Truncate credits if too long
    const truncatedCredits = this.credits.length > 5000 
      ? this.credits.slice(0, 5000) + "\n... (truncated)"
      : this.credits;

    const systemPrompt = "You are a specialized tool that returns authorship data for the Freedoom project in strict JSON format.";
    
    const contextPrompt = `
You are a git history analyzer for the Freedoom project. 
Your task is to identify the authors of specific sprite files and concisely explain their relation to the sprite based on the commit information and project records.

Project Contributors (from CREDITS file):
${truncatedCredits || "No CREDITS file available."}

Commit Information:
- SHA: ${context.sha}
- Author: ${context.author}
- Message: ${context.message}

Guidelines:
1. Identify the persons who relate to the sprite I will provide in next messages. Use full names from the CREDITS file if handles/emails match.
2. IMPORTANT: Each sprite MUST have at least one author. If no other contributors are identified via the message or folder structure, use the commit author (${context.author}) as the fallback with relation "Committer (<details>)".
3. The commit author is often the one who performed the change, but they might be committing someone else's work (check for "By: ..." "From: ...", "Thanks to: ...", or mentions in the message or in CREDITS content).
4. The author of a sprite can often be identified from a folder name (e.g., for "raymoohawk/sprites/old-zombieman/possa1.png", one author is "raymoohawk").
5. Relation should be concise, but meaningful (e.g., "Original artist", "Updated offsets", "Palette fix", "Conversion", "Committer (<details>)").
6. If multiple people are involved, include all of them.
7. IMPORTANT: In your JSON response, you MUST use the EXACT URL provided in the request as the "url" property.

Examples:
"https://github.com/freedoom/freedoom/blob/e1a73c3528b831d6754fc6ab7e686d3e6e714bb7/sprites/possa1.png": [
    {
      "name": "MothraMaster",
      "relation": "Remaining angles"
    },
    {
      "name": "Korp",
      "relation": "Boots"
    },
    {
      "name": "Xindage",
      "relation": "Committer"
    }
     "https://github.com/freedoom/freedoom/blob/27aca39126c0f021e543516119c9d3b2500575ac/sprites/pov/posst0.gif": [
    {
      "name": "pov",
      "relation": "Artist (from path)"
    },
    {
      "name": "Simon Howard",
      "relation": "Importer"
    }
  ],
Use this alias mapping for contributors/authors:
[
  {
    "name": "Andrew Stine",
    "aliases": [
      "Andrew Stine (Linguica)",
      "Linguica",
      "Linguica (Andrew Stine)",
      "N: Andrew Stine"
    ]
  },
  {
    "name": "Archfile",
    "aliases": [
      "archvile46"
    ]
  },
  {
    "name": "Cascade",
    "aliases": [
      "cascade"
    ]
  },
  {
    "name": "Catoptromancy",
    "aliases": [
      "Cato"
    ]
  },
  {
    "name": "CheapAlert",
    "aliases": [
      "cheapalert"
    ]
  },
  {
    "name": "Craneo",
    "aliases": [
      "craneo"
    ]
  },
  {
    "name": "Fernando Carmona Varo",
    "aliases": [
      "ferk"
    ]
  },
  {
    "name": "GeekMarine",
    "aliases": [
      "geekmarine"
    ]
  },
  {
    "name": "Georgy Samoilov",
    "aliases": [
      "georgy_samoilov"
    ]
  },
  {
    "name": "HorrorMovieRei",
    "aliases": [
      "HorrorMovieGuy",
      "HorroMovieGuy",
      "horrormovierei",
      "Horrormovierei",
      "Rei"
    ]
  },
  {
    "name": "Jonathan Dowland",
    "aliases": [
      "Jon Dowland"
    ]
  },
  {
    "name": "Korp",
    "aliases": [
      "korp"
    ]
  },
  {
    "name": "Lokito",
    "aliases": [
      "loki",
      "lokito"
    ]
  },
  {
    "name": "Michael Swanson",
    "aliases": [
      "Mike Swanson"
    ]
  },
  {
    "name": "Ola Bjorling",
    "aliases": [
      "Ola Bjorling (Citrus)"
    ]
  },
  {
    "name": "Raymoohawk",
    "aliases": [
      "Raymohawk",
      "raymoohawk"
    ]
  },
  {
    "name": "RjY",
    "aliases": [
      "RJY"
    ]
  },
  {
    "name": "Ulises Lozano",
    "aliases": [
      "Ulises \"Urric Hammersong\" Lozano",
      "Urri",
      "Urric",
      "urric",
      "Urric Hammersong"
    ]
  },
  {
    "name": "Wesley Johnson",
    "aliases": [
      "wesley",
      "Wesley",
      "Wesley D. Johnson"
    ]
  }
]


    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextPrompt },
      { role: "assistant", content: "I understand the context and guidelines. Please provide the sprite information to resolve." }
    ];

    const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "author_resolution",
        strict: true,
        schema: {
          type: "object",
          properties: {
            url: { type: "string" },
            authors: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  relation: { type: "string" }
                },
                required: ["name", "relation"],
                additionalProperties: false
              }
            }
          },
          required: ["url", "authors"],
          additionalProperties: false
        }
      }
    };

    for (const sprite of missing) {
      console.debug(`Resolving author for: ${sprite.path}`);
      
      const spriteMessage = {
        role: "user",
        content: `Resolve authors for sprite:\n- Path: ${sprite.path}\n- EXACT URL: ${sprite.url}\n- Full File URL: https://github.com/freedoom/freedoom/blob/${context.sha}/${sprite.path}`
      };

      let resolution: any = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const response = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.options.aiToken}`
            },
            body: JSON.stringify({
              model: "qwen/qwen3-coder-next",
              messages: [...messages, spriteMessage],
              response_format: responseFormat
            })
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`AI Gateway error: ${response.status} ${error}`);
          }

          const data = await response.json();
          resolution = JSON.parse(data.choices[0].message.content);
          break;
        } catch (e: any) {
          console.error(`Attempt ${attempts} failed for ${sprite.path}: ${e.message}`);
          if (attempts >= maxAttempts) throw e;
          const delay = Math.pow(2, attempts) * 1000;
          console.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Use exact URL from sprite object to ensure consistency as requested
      const targetUrl = sprite.url;
      const authors = resolution.authors;

      // Update local state and results
      this.cache[targetUrl] = authors;
      results[targetUrl] = authors;

      // Persist immediately after each sprite resolution
      await this.saveCache();
      
      // Note: We don't need to manually "delete messages" from the 'messages' array 
      // because we are passing a new spread of the base messages + current spriteMessage 
      // in each iteration, effectively not accumulating sprite-specific history.
    }
  }

  private async fetchAuthorsFromAi(
    context: { author: string; message: string; sha: string },
    missing: Array<{ url: string; path: string }>,
    gatewayUrl: string
  ): Promise<Record<string, AuthorInfo[]>> {
    // This method is now replaced by fetchAuthorsGranularly but kept for compatibility 
    // if other parts of the system call it, though it was private.
    // Actually, I'll just remove it if it's private and I've updated the caller.
    const results: Record<string, AuthorInfo[]> = {};
    await this.fetchAuthorsGranularly(context, missing, gatewayUrl, results);
    return results;
  }


  /**
   * Persists the cache to disk.
   */
  async saveCache() {
    await Bun.write(this.cachePath, JSON.stringify(this.cache, null, 2));
    console.debug(`Author cache saved to ${this.cachePath}`);
  }
}

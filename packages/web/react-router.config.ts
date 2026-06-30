import type { Config } from "@react-router/dev/config";
import * as fs from "node:fs";
import * as path from "node:path";

export default {
  ssr: false,
  basename: "/freedoom-bestiary/",
  async prerender() {
    const dataPath = path.resolve(process.cwd(), "../../sprite-collection/spritesheets.json");
    const rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    const characterCodes = Object.keys(rawData);
    
    const authors = new Set<string>();
    for (const code of characterCodes) {
      for (const version of rawData[code]) {
        // Collect from version authors
        if (version.authors) {
          for (const author of version.authors) {
            if (author.name) authors.add(author.name);
          }
        }
        // Collect from sprite authors
        if (version.sprites) {
          for (const sprite of version.sprites) {
            if (sprite.authors) {
              for (const author of sprite.authors) {
                if (author.name) authors.add(author.name);
              }
            }
          }
        }
      }
    }

    return [
      "/", 
      ...characterCodes.map((code) => `/character/${code}`),
      // Authors are served as SPA routes to avoid prerendering issues with special characters in paths
    ];
  },
} satisfies Config;

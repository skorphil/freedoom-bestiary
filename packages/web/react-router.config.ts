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
    return ["/", ...characterCodes.map((code) => `/character/${code}`)];
  },
} satisfies Config;

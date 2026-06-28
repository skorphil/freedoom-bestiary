import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  basename: "/freedoom-bestiary/",
  async prerender() {
    return ["/"];
  },
} satisfies Config;

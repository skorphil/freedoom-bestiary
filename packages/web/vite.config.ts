import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [reactRouter()],
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		minify: false,
		sourcemap: true,
	},
	server: {
		fs: {
			allow: ["../../"],
		},
	},
	// Use the repository name as the base for GitHub Pages subpath deployment
	base: "/freedoom-bestiary/",
});

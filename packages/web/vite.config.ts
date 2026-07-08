import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
	plugins: [reactRouter()],
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		minify: command === "build",
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development"),
	},
	server: {
		fs: {
			allow: ["../../"],
		},
	},
	// Use the repository name as the base for GitHub Pages subpath deployment
	base: "/freedoom-bestiary/",
}));

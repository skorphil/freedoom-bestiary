import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		layout("routes/index.tsx", [
			index("routes/home.tsx"),
			route(":id", "routes/spritesheets.$id.tsx"),
		]),
	]),
] satisfies RouteConfig;

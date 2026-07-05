import {
	type RouteConfig,
	index,
	layout,
	route,
} from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		index("routes/index.tsx"),
		route("character/:code", "routes/character.$code.tsx"),
		route("authors/:name", "routes/authors.$name.tsx"),
	]),
] satisfies RouteConfig;

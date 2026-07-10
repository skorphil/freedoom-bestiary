import {
	index,
	layout,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		layout("routes/main-layout.tsx", [
			index("routes/home.tsx"),
			route(":slug", "routes/$slug.tsx"),
			route(":code/:id", "routes/character.$code.$id.tsx"),
			route("authors/:authorId", "routes/authors.$authorId.tsx"),
			route("authors/:authorId/:id", "routes/authors.$authorId.$id.tsx"),
		]),
	]),
] satisfies RouteConfig;

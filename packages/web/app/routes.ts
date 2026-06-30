import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("character/:code", "routes/character.$code.tsx"),
  route("authors/:name", "routes/authors.$name.tsx"),
] satisfies RouteConfig;

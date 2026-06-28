import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("character/:code", "routes/character.$code.tsx"),
] satisfies RouteConfig;

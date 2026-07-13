declare module "*.css?url" {
  const src: string;
  export default src;
}

declare module "~/routeTree.gen" {
  import { routeTree } from "@tanstack/react-router";
  export { routeTree };
}

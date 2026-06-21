import lume from "lume/mod.ts";
import jsx from "lume/plugins/jsx.ts";

const site = lume({
  src: "./",
  dest: "./_site",
});
site.use(jsx());
site.add("styles.css");
site.copy("animations");

export default site;

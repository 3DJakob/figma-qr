import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  platform: "browser",
  target: ["es2018"]
});

if (watch) {
  await ctx.watch();
  console.log("Watching…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Built.");
}
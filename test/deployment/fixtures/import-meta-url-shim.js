// esbuild `inject` file: gives the CJS bundle a real value for `import.meta.url` (esbuild
// otherwise emits an empty `{}` for `import.meta` in CJS output, which silently breaks any
// code branching on `typeof import.meta !== "undefined"` - see `src/package.ts`). This is
// esbuild's own documented workaround for bundling ESM-authored code to CJS.
// https://github.com/evanw/esbuild/issues/1921
export const import_meta_url = require("url").pathToFileURL(__filename).href;

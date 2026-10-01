export default {
  vitePlugin: {
    dynamicCompileOptions({ filename }) {
      if (!filename.includes("node_modules")) return { runes: true };
    },
  },
};

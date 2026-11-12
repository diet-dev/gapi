import gts from "gts";

export default [
  {ignores: ["**/dist/**", "**/node_modules/**"]},
  ...gts,
  {rules: {quotes: ["warn", "double", {avoidEscape: true}]}},
  {
    files: ["example-game/src/**/*.ts"],
    languageOptions: {parserOptions: {project: "./example-game/tsconfig.json"}},
  },
  {
    files: ["test/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        {allowForKnownSafeCalls: [{from: "package", package: "node:test", name: ["test", "describe", "it"]}]},
      ],
    },
  },
  {
    rules: {"@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_", varsIgnorePattern: "^_"}]},
  },
];

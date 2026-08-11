import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default tseslint.config(
  // `.claude/` ist die Scratch- und Worktree-Ablage der Agenten und enthält
  // fremde Arbeitskopien samt Build-Artefakten — nichts davon gehört ins Linting.
  { ignores: ["dist", "workspace", ".local", ".claude"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.bun },
    },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);

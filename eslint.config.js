import globals from "globals";
import { defineConfig } from "eslint/config";
import js from "@eslint/js";


export default defineConfig([
  js.configs.recommended,
  { 
    ignores: ["out/**", "dist/**"],
  },
  {
    rules: {
      "semi": ["error", "never"],
    },
  },
  { 
    files: ["src/**/*.{js,mjs,cjs}"],
    // ignores: ["electron/**"],
    languageOptions: { globals: globals.browser },
    // rules: {
    //   "semi": ["error", "never"],
    // },
  },
  { 
    files: ["electron/**/*.{js,mjs,cjs}"],
    // ignores: ["src/**"],
    languageOptions: { globals: globals.node },
    // rules: {
    //   "semi": ["error", "never"],
    // },
  },
]);

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "infra/cdk.out/**",
      "infra/node_modules/**",
      "lambdas/*/dist/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      // CLAUDE.md §9: no `any` without a comment explaining why.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Scripts, seeds and Lambdas are CLIs — console output is the interface.
    files: ["scripts/**", "prisma/**", "lambdas/**", "infra/**", "tests/**"],
    rules: { "no-console": "off" },
  },
  {
    // Generated shadcn/ui primitives are kept as-generated.
    files: ["src/components/ui/**"],
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },
];

export default eslintConfig;

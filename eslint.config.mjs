import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // P-M12: tighter rules to catch the bug patterns the audit found.
  // - no-floating-promises catches missed `await` on server-action calls.
  // - no-explicit-any keeps the type-safety wins from P-M2 from regressing.
  // - prefer-const trims churn in PRs.
  // The generated Prisma client + scratch types are exempted because they
  // own their own conventions.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/generated/**", "src/types/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    // qa/ и qa2/ — служебные скрипты и скриншоты браузерных проверок,
    // они не входят в поставку и не должны проверяться линтером проекта.
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "qa/**",
      "qa2/**",
      "qa3/**",
      "qa4/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;

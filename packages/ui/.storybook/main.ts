import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const getAbsolutePath = (packageName: string) =>
  dirname(fileURLToPath(import.meta.resolve(`${packageName}/package.json`)));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)", "../src/**/*.mdx"],
  addons: [getAbsolutePath("@storybook/addon-docs"), getAbsolutePath("@storybook/addon-a11y")],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  typescript: {
    check: true,
    // TypeScript 7 intentionally removed the compiler API used by
    // react-docgen-typescript. Storybook's Babel-based docgen keeps Controls
    // and autodocs available while the workspace typecheck remains authoritative.
    reactDocgen: "react-docgen",
  },
};

export default config;

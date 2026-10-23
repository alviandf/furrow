import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite can't resolve `extends: "expo/tsconfig.base"`. Unit tests only cover
  // plain TypeScript modules, so the repo's base config is enough.
  tsconfig: '../../tsconfig.base.json',
});

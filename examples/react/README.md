# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and Biome for linting and formatting.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Biome Configuration

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Biome provides a fast and unified toolchain that combines the functionality of ESLint, Prettier, and more.

The configuration is managed through `biome.json` in the workspace root. Biome offers:

- **Fast linting**: Much faster than ESLint with similar rule coverage
- **Built-in formatting**: No need for separate Prettier configuration
- **TypeScript support**: Native TypeScript support without additional plugins
- **React support**: Built-in React and JSX linting rules

Common Biome commands:

```bash
# Check code (lint + format check)
pnpm biome check .

# Apply safe fixes and formatting
pnpm biome check --write .

# Format code only
pnpm biome format --write .

# Lint code only
pnpm biome lint .
```

For more configuration options, see the [Biome documentation](https://biomejs.dev/reference/configuration/).

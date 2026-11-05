<div align="center">

# MockDash Monorepo

**Single source of truth for the MockDash library and example integrations.**

[![npm version](https://badge.fury.io/js/mock-dash.svg)](https://badge.fury.io/js/mock-dash)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## Packages

| Package              | Description                                                                          | Location             |
| -------------------- | ------------------------------------------------------------------------------------ | -------------------- |
| `mock-dash`          | Core library: define endpoints once, get a typed client + Hono mock server generator | `packages/mock-dash` |
| `examples/react`     | React + Vite example using the generated client and dev mock server                  | `examples/react`     |
| `examples/sveltekit` | SvelteKit example showcasing server hooks + mock API usage                           | `examples/sveltekit` |

## What is MockDash?

MockDash is a TypeScript toolkit to accelerate frontend development by letting you:

1. Define your API contract once using Zod
2. Instantly get a strongly-typed API client for the frontend
3. Spin up a fully validated Hono mock server with realistic fake data
4. Evolve endpoints in one place while keeping mocks and client in sync

If you're looking for usage docs, head straight to the package README:

➡️ [`packages/mock-dash/README.md`](packages/mock-dash/README.md)

## Monorepo Layout

```
.
├── packages/
│   └── mock-dash/           # Core library source & tests
├── examples/
│   ├── react/               # React + Vite integration example
│   └── sveltekit/           # SvelteKit integration example
├── pnpm-workspace.yaml      # Workspace definition
├── README.md                # This file
└── LICENSE
```

## Getting Started (Contributors)

```bash
git clone https://github.com/MrPorky/mock-dash.git
cd mock-dash
pnpm install
pnpm -r test      # Run tests for all workspaces
```

Useful script ideas (add as needed):

- `pnpm -F mock-dash test` – run library tests only
- `pnpm -F react dev` – run React example with mock server
- `pnpm -F sveltekit dev` – run SvelteKit example with mock server

## Vision & Goals

- Frontend-first workflows without waiting for backend
- Strong typing everywhere (compile-time + runtime validation)
- Zero-config defaults, escape hatches for customization
- Simple, readable endpoint definitions

## Contributing

Contributions are welcome! Please read `CONTRIBUTING.md` before opening a PR. Focus areas:

- Docs clarity & examples
- Additional endpoint helpers
- Performance / DX improvements
- Mock generation strategies (faker integrations, presets)

If proposing significant changes, open a Discussion first.

## License

MIT © [MrPorky](https://github.com/MrPorky)

---

For full feature docs, detailed examples, advanced usage (interceptors, error handling, void/text responses, custom mocks) see: [`packages/mock-dash/README.md`](packages/mock-dash/README.md)

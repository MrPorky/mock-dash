# Contributing to MockDash

Thank you for your interest in contributing to MockDash! This guide will help you get started with development and understand our contribution process.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (preferred package manager)

### Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run tests to ensure everything works:
   ```bash
   pnpm test
   ```

## Development Workflow

### Common Commands

```bash
# Development
pnpm dev              # Watch mode compilation
pnpm build            # Production build

# Testing
pnpm test             # Run tests in watch mode
pnpm test         # Single test run
pnpm test:coverage    # Generate coverage reports

# Code Quality
pnpm lint             # Check code style
pnpm lint:fix         # Auto-fix linting issues
```

### Making Changes

1. Create a feature branch from `main`
2. Make your changes following our coding standards
3. Add tests for new functionality
4. Ensure all tests pass and linting is clean
5. Update documentation if needed
6. Submit a pull request

## Project Structure

```
src/
├── index.ts                    # Main library exports
├── api-schema-types.ts         # Core type definitions and schema builders
├── create-api-client.ts        # Type-safe API client implementation
├── generate-mock-api.ts        # Mock server generation logic
├── errors.ts                   # Custom error classes
├── request-utils.ts            # HTTP request utilities
├── type-utils.ts               # TypeScript utility types
└── tests/                      # Test files
```

## Coding Standards

### File Naming

- **kebab-case** for file names
- **PascalCase** for classes and types
- **camelCase** for functions and variables
- Test files use `.test.ts` suffix
- Functional tests use `-functional.test.ts` suffix

### Code Style

- TypeScript with strict type checking enabled
- Biome for formatting and linting
- Named exports preferred over default exports
- Type-only imports where applicable (`import type`)

### Architecture Patterns

- **Schema-First Design**: All API contracts defined using Zod schemas
- **Endpoint Key Convention**: Format `@{method}/{path}` (e.g., `@get/users/:id`)
- **Error Handling**: Custom error classes for different failure modes
- **Interceptor Pattern**: Functional approach with cleanup callbacks

## Testing Guidelines

### Test Organization

- Unit tests for each module in `src/tests/`
- Integration tests use `-functional.test.ts` suffix
- Aim for high test coverage (check with `pnpm test:coverage`)

### Writing Tests

- Use Vitest testing framework
- Test both happy path and error scenarios
- Mock external dependencies appropriately
- Include type-level tests for TypeScript utilities

## Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass (`pnpm test`)
   - Run linting (`pnpm lint`)
   - Build successfully (`pnpm build`)
   - Update documentation if needed

2. **PR Description:**
   - Clearly describe the changes and motivation
   - Reference any related issues
   - Include breaking changes in the description

3. **Review Process:**
   - All PRs require review before merging
   - Address feedback promptly
   - Keep PRs focused and reasonably sized

## Technology Stack

- **TypeScript** - Primary language with strict type checking
- **Zod** - Schema validation and type inference
- **Hono** - Lightweight web framework for mock servers
- **Vitest** - Testing framework
- **Biome** - Code linting and formatting
- **pnpm** - Package manager

## Release Process

The project uses semantic versioning:

- **Patch** (1.0.1): Bug fixes and minor improvements
- **Minor** (1.1.0): New features that are backward compatible
- **Major** (2.0.0): Breaking changes

## Getting Help

- Check existing issues and discussions
- Review the README.md for usage examples
- Look at existing tests for implementation patterns
- Ask questions in issue comments or discussions

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment for all contributors

Thank you for contributing to MockDash! 🚀

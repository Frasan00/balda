# Contributing to Balda

First off, thank you for considering contributing to Balda!

## ⚠️ Development Status

This project is under active development. APIs and features may change, and breaking changes can occur between releases. Please keep this in mind when contributing.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples** (code snippets, test cases)
* **Describe the behavior you observed** and what you expected
* **Include your environment details** (Node.js/Bun/Deno version, OS)
* **Include error messages and stack traces**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

* **Use a clear and descriptive title**
* **Provide a detailed description** of the proposed enhancement
* **Explain why this enhancement would be useful** to most users
* **Include code examples** if applicable
* **Specify which runtime(s)** the enhancement should support (Node.js, Bun, Deno, or all)

### Pull Requests

* **Fork the repository** and create your branch from `main`
* **Follow the existing code style** (see Code Style Guide below)
* **Write tests** for your changes
* **Ensure all tests pass** across all supported runtimes
* **Update documentation** if needed
* **Write a clear commit message** describing your changes

## Development Setup

### Prerequisites

* Node.js 22.x (check `.nvmrc`)
* Yarn package manager
* Optionally: Bun and Deno for cross-runtime testing

### Setup Steps

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/balda.git
cd balda
```

2. Use the correct Node.js version:
```bash
nvm use
```

3. Install dependencies:
```bash
yarn install
```

4. Run tests:
```bash
# Node.js tests
yarn test

# Bun tests
yarn test:bun

# Deno tests
yarn test:deno

# All runtimes
yarn test:all
```

5. Start development server:
```bash
# Node.js
yarn dev

# Bun
yarn dev:bun

# Deno
yarn dev:deno
```

## Code Style Guide

Balda follows strict TypeScript coding standards defined in the user rules:

### General Principles

* **Use meaningful, pronounceable variable names**
  * camelCase for variables/functions
  * PascalCase for classes/types
  * SNAKE_CASE for constants

* **Prefer functional programming** over classes where possible

* **Functions should do one thing** with 2 or fewer parameters
  * Use object destructuring for more parameters

* **Always use `const` and not `function`** for declared functions

* **Never use `else` statements** - create standalone functions or early returns instead

### TypeScript Guidelines

* Use `type` over `interface` for unions/intersections
* Use `interface` for extends/implements
* Avoid type checking - leverage TypeScript's static typing
* Always use Error types for throwing/rejecting, never throw raw strings

### Async/Await

* Prefer async/await over callbacks and promise chains
* Use `Promise.all()` for parallel independent operations
* Implement proper error handling with try-catch blocks
* Never block the event loop with synchronous operations

### Error Handling

* Always use Error class for throwing/rejecting
* Include relevant context in error messages
* Never expose internal implementation details in error responses

## Testing

* Write unit tests for new features
* Ensure all existing tests pass
* Test against all supported runtimes (Node.js, Bun, Deno) when applicable
* Use meaningful test descriptions

Run specific test suites:
```bash
yarn test          # Node.js with Vitest
yarn test:bun      # Bun native test runner
yarn test:deno     # Deno native test runner
yarn test:all      # All runtimes
yarn test:watch    # Watch mode
yarn test:coverage # Coverage report
```

## Building

```bash
yarn build         # Development build
yarn build:prod    # Production build with minification
yarn build:test    # Test build (builds then removes)
```

## Documentation

Documentation is built with Docusaurus and located in the `/docs` folder:

```bash
yarn docs:dev      # Start dev server
yarn docs:build    # Build static site
yarn docs:serve    # Serve built site
```

When adding new features:
* Update relevant documentation in `/docs/docs`
* Add JSDoc comments to public APIs
* Update README.md if needed

## Commit Message Guidelines

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests after the first line

Examples:
```
Add WebSocket support for all runtimes
Fix middleware execution order in Bun runtime
Update documentation for plugin system
```

## Cross-Runtime Compatibility

When contributing, ensure your changes work across all supported runtimes:

* **Node.js**: Primary runtime
* **Bun**: Uses `Bun.serve` for performance
* **Deno**: Uses `Deno.serve` with appropriate imports

Test your changes on all runtimes before submitting:
```bash
yarn test:all
```

## Plugin Development

If you're creating a new plugin:

1. Follow the plugin architecture in `/src/plugins`
2. Ensure cross-runtime compatibility
3. Add comprehensive tests
4. Document usage in `/docs/docs/plugins/your-plugin.md`

## Questions?

Feel free to open an issue with your question or reach out to the maintainers directly.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.


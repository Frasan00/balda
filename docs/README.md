# Balda Documentation

This directory contains the documentation for Balda.

## Getting Started

### Prerequisites

- Node.js 18+, Bun or Deno
- Yarn, npm or pnpm

### Installation

```bash
# Install dependencies
yarn install

# Start development server
yarn start
```

### Available Scripts

- `yarn start` - Start the development server
- `yarn build` - Build the documentation for production
- `yarn serve` - Serve the built documentation locally

## Documentation Structure

```
docs/
├── intro.md                    # Main introduction page
├── getting-started/            # Getting started guides
│   ├── installation.md
│   ├── quick-start.md
│   └── configuration.md
├── core-concepts/              # Core framework concepts
│   ├── server.md
│   ├── controllers.md
│   ├── routing.md
│   ├── middleware.md
│   └── request-response.md
├── api/                        # API reference
│   ├── server.md
│   ├── controllers.md
│   ├── decorators.md
│   ├── plugins.md
│   ├── cli.md
│   └── cron.md
├── plugins/                    # Plugin documentation
│   ├── overview.md
│   ├── body-parser.md
│   ├── cors.md
│   ├── static.md
│   ├── cookie.md
│   ├── helmet.md
│   ├── rate-limiter.md
│   ├── log.md
│   └── swagger.md
├── advanced/                   # Advanced topics
│   ├── validation.md
│   ├── serialization.md
│   ├── error-handling.md
│   ├── testing.md
│   └── deployment.md
├── examples/                   # Example applications
│   ├── rest-api.md
│   ├── file-upload.md
│   ├── authentication.md
│   ├── cron-jobs.md
│   └── cli-commands.md
└── runtime/                    # Runtime-specific guides
    ├── node.md
    ├── bun.md
    └── deno.md
```

## Contributing

When adding or updating documentation:

1. Follow the existing structure and naming conventions
2. Use TypeScript code examples
3. Include practical examples and use cases
4. Keep content clear and concise
5. Test all code examples

## Building for Production

```bash
# Build the documentation
yarn build

# The built files will be in the `build` directory
```

## Deployment

The documentation can be deployed to various platforms:

- **GitHub Pages**: Use the `yarn deploy` command
- **Netlify**: Connect your repository and set build command to `yarn build`
- **Vercel**: Connect your repository and set build command to `yarn build`

## Configuration

The documentation is configured with:

- Site title and description
- Navigation and sidebar structure
- Theme customization
- Plugin configuration

## Customization

### Styling

Custom CSS can be added to `src/css/custom.css`.

### Components

Custom React components can be added to `src/components/`.

### Pages

Custom pages can be added to `src/pages/`.

## Support

For questions about the documentation or Balda:

- [GitHub Issues](https://github.com/Frasan00/balda/issues)
- [GitHub Discussions](https://github.com/Frasan00/balda/discussions)

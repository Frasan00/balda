---
sidebar_position: 1
---

# Welcome to Balda

Balda is a modern, lightweight backend framework designed for Node.js, Bun, and Deno. It provides a simple and intuitive API for building fast, scalable web applications with TypeScript support.

## Key Features

- **Multi-Runtime Support**: Run on Node.js, Bun, or Deno with the same codebase
- **Decorator-Based API**: Clean and intuitive decorators for defining routes and controllers
- **Built-in Plugins**: Comprehensive set of plugins for common web development needs
- **TypeScript First**: Full TypeScript support with excellent type inference
- **CLI Tools**: Built-in command-line interface for scaffolding and development
- **Cron Jobs**: Easy scheduling of background tasks
- **Validation & Serialization**: Built-in request validation and response serialization
- **Testing Support**: Mock server for easy testing

## Modular Packages

Balda ships as a modular monorepo: [`@balda/core`](./getting-started/packages) gives you the HTTP server, decorators and base plugins, while MQTT, cron, queues, storage, mailer, GraphQL and cache are optional packages you install only when you need them — each with only the third‑party driver(s) you actually use. See [Installation](./getting-started/installation).

## Quick Example

```typescript
import { Server, controller, get, post } from '@balda/core';

const server = new Server({
  port: 3000,
  plugins: {
    cors: { origin: '*' },
    bodyParser: {
      json: {
        sizeLimit: '1mb'
      }
    }
  }
});

@controller('/users')
export class UsersController {
  @get('/')
  async getUsers(req, res) {
    res.json([{ id: 1, name: 'John' }]);
  }

  @post('/')
  async createUser(req, res) {
    const user = req.body;
    res.created(user);
  }
}

server.listen();
```

## Why Balda?

- **Simple**: Minimal boilerplate, maximum productivity
- **Fast**: Built for performance with modern JavaScript engines
- **Flexible**: Plugin architecture allows you to use only what you need
- **Modern**: Leverages the latest JavaScript features and best practices
- **Cross-Platform**: Write once, run anywhere with Node.js, Bun, or Deno

## Getting Started

Ready to build your first Balda application? Check out our [Quick Start Guide](./getting-started/quick-start) to get up and running in minutes.

## Runtime Support

Balda supports multiple JavaScript runtimes:

- **Node.js**: Full support with all features
- **Bun**: Optimized for Bun's performance benefits
- **Deno**: Native Deno support with security features

## Community

- [GitHub Repository](https://github.com/Frasan00/balda)
- [Issues & Bug Reports](https://github.com/Frasan00/balda/issues)
- [Discussions](https://github.com/Frasan00/balda/discussions)

## License

Balda is licensed under the MIT License.

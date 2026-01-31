# Balda

A **cross-runtime, FastAPI-inspired Node.js backend framework** that aims to work seamlessly across **Node.js**, **Bun**, and **Deno** runtimes. Built with TypeScript and designed for modern web development.

## Key Features

- **Cross-Runtime Compatibility**: Single codebase that runs on Node.js, Bun, and Deno. It uses the native runtime apis for maximum performance (es. `Bun.serve`, `Deno.serve`, etc).
- **Decorator-Based Architecture**: Balda is inspired by FastAPI, NestJS and ExpressJS syntax with type-safe request/response handling
- **Advanced Validation**: Supports both Zod and Ajv schema based validation for best developer experience
- **Rich Plugin Ecosystem**: Rate limiting, CORS, file uploads, structured logging, GraphQL, and more
- **Built-in CLI & Code Generation**: Scaffolding commands for controllers, plugins, cron jobs and more!
- **Cron Job Support**: Decorator-based scheduling with cross-runtime execution
- **Swagger Support**: Built-in Swagger support and JSON specification

## Quick Start

```bash
npm install balda
# or
yarn add balda
# or
pnpm add balda
```

```typescript
import { Server, controller, get } from "balda";

@controller("/api")
class ApiController {
  @get("/health")
  async health(req: Request, res: Response) {
    return res.json({ status: "ok" });
  }
}

const server = new Server({
  port: 3000,
  host: "0.0.0.0",
  plugins: {
    bodyParser: {
      json: {
        sizeLimit: "10mb",
      },
    },
  },
});

server.listen();
```

## Documentation

Visit the comprehensive documentation: **[https://frasan00.github.io/balda/](https://frasan00.github.io/balda/)**

## ⚠️ Development Status

**This project is under active development. APIs and features may change, and breaking changes can occur between releases. Do not use in production**

## License

MIT License - see [LICENSE](LICENSE) file for details.

# Balda.js

A **cross-runtime, FastAPI-inspired Node.js backend framework** that aims to work seamlessly across **Node.js**, **Bun**, and **Deno** runtimes. Built with TypeScript and designed for modern web development.

## Key Features

- **Cross-Runtime Compatibility**: Single codebase that runs on Node.js, Bun, and Deno. It uses the native runtime apis for maximum performance (es. `Bun.serve`, `Deno.serve`, etc).
- **Decorator-Based Architecture**: Balda-js is inspired by FastAPI, NestJS and ExpressJS syntax with type-safe request/response handling
- **Advanced Validation**: TypeBox schema validation with AJV for high-performance validation
- **Rich Plugin Ecosystem**: Rate limiting, CORS, file uploads, structured logging, and more
- **Built-in CLI & Code Generation**: Scaffolding commands for controllers, plugins, and cron jobs
- **Cron Job Support**: Decorator-based scheduling with cross-runtime execution
- **Swagger Support**: Built-in Swagger UI and JSON specification

## Quick Start

```bash
npm install balda-js
```

```typescript
import { Server, controller, get } from 'balda-js';

@controller('/api')
class ApiController {
  @get('/health')
  async health(req: Request, res: Response) {
    return res.json({ status: 'ok' });
  }
}

const server = new Server();
server.listen();
```

## Documentation

Visit the comprehensive documentation: **[https://frasan00.github.io/balda-js/](https://frasan00.github.io/balda-js/)**

## ⚠️ Development Status

**This project is under active development. APIs and features may change, and breaking changes can occur between releases. Do not use in production**

## License

MIT License - see [LICENSE](LICENSE) file for details.

---
title: init-mailer
description: Initialize mailer configuration with template engines like Handlebars, EJS, or Mustache. Setup SMTP for emails.
keywords: [balda, init mailer, email, smtp, handlebars, ejs, template]
sidebar_position: 2.5
---

# init-mailer

Initialize mailer configuration with required dependencies.

```bash
npx balda init-mailer -t handlebars
npx balda init-mailer -t ejs -o src/email
npx balda init-mailer -t none
```

## Flags

- `-t, --template <engine>`: Template engine (`handlebars`, `ejs`, `edge`, `mustache`, `custom`, `none`) - default: `none`
- `-o, --output <path>`: Output directory (default `src/mailer`)

## Template Engine Dependencies

- **Base (always installed)**: `nodemailer`, `@types/nodemailer`
- **Handlebars**: `handlebars`, `@types/handlebars`
- **EJS**: `ejs`, `@types/ejs`
- **Edge.js**: `edge.js`
- **Mustache**: `mustache`, `@types/mustache`
- **Custom**: No additional dependencies (uses built-in adapter)
- **None**: No template engine (plain text/HTML emails only)

## What it does

1. Checks if dependencies are installed (skips if present)
2. Installs required packages based on template engine choice
3. Creates `mailer.config.ts` with:
   - SMTP transporter configuration
   - Template adapter setup (if selected)
   - Multiple provider examples
   - Environment variable templates
   - Comprehensive usage examples

## Generated Configuration

The command creates a complete mailer configuration file that includes:

- **SMTP Configuration**: Ready to use with environment variables
- **Template Adapter Setup**: Configured for your chosen engine with helper/partial examples
- **Multi-Provider Support**: Examples for switching between different mail providers
- **Usage Examples**: Code snippets for sending emails, using templates, and more

### Example with Handlebars

```typescript
import { createTransport } from "nodemailer";
import { Mailer, HandlebarsAdapter } from "balda";

const transporter = createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
});

const adapter = new HandlebarsAdapter();

export const mailer = new Mailer(
  {
    default: {
      transporter,
      templateAdapter: adapter,
      from: process.env.DEFAULT_FROM_EMAIL || "noreply@example.com",
    },
  },
  {
    defaultProvider: "default",
  },
);
```

## Development Setup

For local development, the project includes MailCatcher in `docker-compose.yml`:

```bash
docker-compose up mailcatcher
```

This starts MailCatcher on:

- **SMTP**: `localhost:1025`
- **Web UI**: `http://localhost:1080`

Update your `.env`:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
```

## Template Engine Comparison

| Engine     | Syntax       | Helpers | Partials | Use Case                     |
| ---------- | ------------ | ------- | -------- | ---------------------------- |
| Handlebars | `{{var}}`    | ✅      | ✅       | Complex templates with logic |
| EJS        | `<%= var %>` | ❌      | ❌       | JavaScript-based templating  |
| Edge.js    | `{{ var }}`  | ✅      | ✅       | Laravel Blade-like syntax    |
| Mustache   | `{{var}}`    | ❌      | ✅       | Logic-less templates         |
| Custom     | `{{var}}`    | ✅      | ❌       | Simple interpolation         |
| None       | N/A          | N/A     | N/A      | Plain HTML/text only         |

:::tip
Start with `none` for simple transactional emails, or choose Handlebars for maximum flexibility with complex templates.
:::

:::info
See [Mailer documentation](/docs/mailer/overview) for detailed usage examples and best practices.
:::

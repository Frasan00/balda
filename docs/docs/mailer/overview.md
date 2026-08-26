---
title: Mailer
description: Flexible email system with SMTP, template engines, and multiple providers. Handlebars, EJS, Mustache support.
keywords: [balda, mailer, email, smtp, handlebars, templates]
sidebar_position: 1
---

# Mailer

Balda provides a flexible mailer system with support for multiple email providers and template engines. Install `nodemailer` plus one template engine of your choice (e.g. `pnpm add nodemailer handlebars`). The mailer is self‑contained and does not depend on the queue feature.

## Quick Setup with CLI

The fastest way to get started is using the init-mailer command:

```bash
# Initialize with Handlebars template engine
npx balda init-mailer -t handlebars

# Initialize without a template engine
npx balda init-mailer -t none

# Initialize with custom output directory
npx balda init-mailer -t ejs -o src/email
```

This command will:

- Install all required dependencies
- Create a ready-to-use mailer configuration file
- Set up your chosen template engine
- Include environment variable templates
- Provide usage examples

See the [init-mailer command documentation](/docs/commands/built-ins/init-mailer) for more details.

## Manual Installation

If you prefer manual setup, install Nodemailer (required):

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

Install template engines (optional, only what you need):

```bash
# Handlebars
npm install handlebars
npm install --save-dev @types/handlebars

# Edge.js
npm install edge.js

# Mustache
npm install mustache
npm install --save-dev @types/mustache

# EJS
npm install ejs
npm install --save-dev @types/ejs
```

## Quick Start

```ts
import { Mailer, HandlebarsAdapter } from "balda";
import nodemailer from "nodemailer";

const mailer = new Mailer(
  {
    smtp: {
      transporter: nodemailer.createTransport({
        host: "smtp.example.com",
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
      templateAdapter: new HandlebarsAdapter(),
      from: "noreply@example.com",
    },
  },
  { defaultProvider: "smtp" },
);

// Send email using builder callback
await mailer.send((builder) =>
  builder
    .to("user@example.com")
    .subject("Welcome!")
    .html("<h1>Hello World</h1>"),
);
```

## Sending Emails

### Send Immediately

```ts
await mailer.send((builder) =>
  builder
    .to("user@example.com")
    .subject("Welcome!")
    .html("<h1>Hello</h1>")
    .attachment({ filename: "invoice.pdf", content: pdfBuffer }),
);
```

### Queue for Later

Queue emails for background processing with 1-second delays between sends. Useful for bulk sending, rate limiting, and reducing server load.

```ts
await mailer.later((builder) =>
  builder.to("user@example.com").subject("Newsletter").html("<h1>Update</h1>"),
);
```

## Templates

### Inline Template

```ts
await mailer.send((builder) =>
  builder
    .to("user@example.com")
    .subject("Order #{{orderId}}")
    .template("<h1>Order #{{orderId}}</h1><p>Total: ${{total}}</p>", {
      orderId: "12345",
      total: 99.99,
    }),
);
```

### Template File

```ts
await mailer.send((builder) =>
  builder
    .to("user@example.com")
    .subject("Welcome")
    .templateFile("./templates/welcome.hbs", {
      name: "John",
      verificationUrl: "https://example.com/verify",
    }),
);
```

### Supported Template Engines

Configure with your preferred adapter:

```ts
import {
  HandlebarsAdapter,
  EdgeAdapter,
  MustacheAdapter,
  EjsAdapter,
  CustomAdapter,
} from "balda";

// In mailer config
templateAdapter: new HandlebarsAdapter(), // or EdgeAdapter, etc.
```

**Custom Adapter** allows registering custom helpers:

```ts
const adapter = new CustomAdapter();
adapter.registerHelper("uppercase", (value) => String(value).toUpperCase());
```

## Multiple Providers

```ts
const mailer = new Mailer(
  {
    smtp: {
      transporter: nodemailer.createTransport({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "user", pass: "pass" },
      }),
      from: "noreply@example.com",
    },
    sendgrid: {
      transporter: nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        auth: { user: "apikey", pass: process.env.SENDGRID_API_KEY },
      }),
      from: "marketing@example.com",
    },
  },
  { defaultProvider: "smtp" },
);

// Use default provider
await mailer.send((builder) =>
  builder.to("user@example.com").subject("Test").text("Hello"),
);

// Switch provider
await mailer
  .use("sendgrid")
  .send((builder) =>
    builder.to("user@example.com").subject("Newsletter").html("<h1>News</h1>"),
  );
```

## Attachments

```ts
await mailer.send((builder) =>
  builder
    .to("user@example.com")
    .subject("Invoice")
    .html("<p>See attached</p>")
    .attachment({ filename: "invoice.pdf", content: pdfBuffer })
    .attachments([
      { filename: "file1.pdf", content: buffer1 },
      { filename: "file2.pdf", path: "/path/to/file2.pdf" },
    ]),
);
```

## API Reference

### Builder Methods

```ts
builder
  .from(email: string)
  .to(email: string | string[]) // required
  .cc(email: string | string[])
  .bcc(email: string | string[])
  .subject(text: string) // required
  .text(content: string)
  .html(content: string)
  .template(template: string, data: object)
  .templateFile(path: string, data: object)
  .attachment(attachment: Attachment)
  .attachments(attachments: Attachment[]);
```

### Mailer Methods

```ts
await mailer.send(builderFn); // Send immediately
await mailer.later(builderFn); // Queue for background processing
await mailer.verify(); // Verify connection
mailer.use(provider); // Switch provider
```

## Testing with MailCatcher

For local development, use MailCatcher:

```yaml
# docker-compose.yml
mailcatcher:
  image: schickling/mailcatcher
  ports:
    - "1025:1025" # SMTP
    - "1080:1080" # Web UI
```

```ts
const mailer = new Mailer(
  {
    mailcatcher: {
      transporter: nodemailer.createTransport({
        host: "localhost",
        port: 1025,
        ignoreTLS: true,
      }),
      from: "test@example.com",
    },
  },
  { defaultProvider: "mailcatcher" },
);
```

Visit `http://localhost:1080` to view sent emails.

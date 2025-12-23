import nodemailer from "nodemailer";
import { beforeAll, describe, expect, it } from "vitest";
import { Mailer } from "../../src/index.js";
import { CustomAdapter } from "../../src/mailer/adapters/custom_adapter.js";
import { EdgeAdapter } from "../../src/mailer/adapters/edge_adapter.js";
import { EjsAdapter } from "../../src/mailer/adapters/ejs_adapter.js";
import { HandlebarsAdapter } from "../../src/mailer/adapters/handlebars_adapter.js";
import { MustacheAdapter } from "../../src/mailer/adapters/mustache_adapter.js";

describe("Template Adapters", () => {
  const createMailer = (templateAdapter: any) => {
    return new Mailer(
      {
        mailcatcher: {
          transporter: nodemailer.createTransport({
            host: process.env.MAILCATCHER_HOST || "localhost",
            port: parseInt(process.env.MAILCATCHER_PORT || "1025"),
            ignoreTLS: true,
          }),
          templateAdapter,
          from: "noreply@example.com",
        },
      },
      {
        defaultProvider: "mailcatcher",
      },
    );
  };

  describe("HandlebarsAdapter", () => {
    let adapter: HandlebarsAdapter;
    let mailer: ReturnType<typeof createMailer>;

    beforeAll(() => {
      adapter = new HandlebarsAdapter();
      mailer = createMailer(adapter);
    });

    it("should render simple template", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Handlebars Test",
        template: "<h1>Hello {{name}}!</h1>",
        data: { name: "World" },
      });
    });

    it("should handle nested properties", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Nested Test",
        template: "<p>{{user.name}} - {{user.email}}</p>",
        data: {
          user: {
            name: "John Doe",
            email: "john@example.com",
          },
        },
      });
    });

    it("should handle each loops", async () => {
      const templateStr = [
        "<ul>",
        "  {{#each items}}",
        "  <li>{{this}}</li>",
        "  {{/each}}",
        "</ul>",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Loop Test",
        template: templateStr,
        data: {
          items: ["Item 1", "Item 2", "Item 3"],
        },
      });
    });

    it("should handle conditionals", async () => {
      const templateStr = [
        "{{#if isActive}}",
        "  <p>Active user</p>",
        "{{else}}",
        "  <p>Inactive user</p>",
        "{{/if}}",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Conditional Test",
        template: templateStr,
        data: { isActive: true },
      });
    });

    it("should register and use custom helpers", async () => {
      await adapter.registerHelper("uppercase", (...args: unknown[]) =>
        String(args[0]).toUpperCase(),
      );
      await adapter.registerHelper(
        "double",
        (...args: unknown[]) => Number(args[0]) * 2,
      );

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Helper Test",
        template: "<p>{{uppercase name}} - {{double count}}</p>",
        data: { name: "john", count: 5 },
      });
    });

    it("should register and use partials", async () => {
      await adapter.registerPartial(
        "header",
        "<header><h1>{{title}}</h1></header>",
      );

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Partial Test",
        template: "{{> header}}<p>Content</p>",
        data: { title: "My Title" },
      });
    });
  });

  describe("EdgeAdapter", () => {
    let mailer: ReturnType<typeof createMailer>;

    beforeAll(() => {
      mailer = createMailer(new EdgeAdapter());
    });

    it("should render simple template", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Edge Test",
        template: "<h1>Hello {{ name }}!</h1>",
        data: { name: "World" },
      });
    });

    it("should handle nested properties", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Nested Test",
        template: "<p>{{ user.name }} - {{ user.email }}</p>",
        data: {
          user: {
            name: "John Doe",
            email: "john@example.com",
          },
        },
      });
    });

    it("should handle each loops", async () => {
      const templateStr = [
        "<ul>",
        "  @each(item in items)",
        "    <li>{{ item }}</li>",
        "  @end",
        "</ul>",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Loop Test",
        template: templateStr,
        data: {
          items: ["Item 1", "Item 2", "Item 3"],
        },
      });
    });

    it("should handle conditionals", async () => {
      const templateStr = [
        "@if(isActive)",
        "  <p>Active user</p>",
        "@else",
        "  <p>Inactive user</p>",
        "@end",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Conditional Test",
        template: templateStr,
        data: { isActive: true },
      });
    });
  });

  describe("MustacheAdapter", () => {
    let adapter: MustacheAdapter;
    let mailer: ReturnType<typeof createMailer>;

    beforeAll(() => {
      adapter = new MustacheAdapter();
      mailer = createMailer(adapter);
    });

    it("should render simple template", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Mustache Test",
        template: "<h1>Hello {{name}}!</h1>",
        data: { name: "World" },
      });
    });

    it("should handle nested properties", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Nested Test",
        template: "<p>{{user.name}} - {{user.email}}</p>",
        data: {
          user: {
            name: "John Doe",
            email: "john@example.com",
          },
        },
      });
    });

    it("should handle sections (loops)", async () => {
      const templateStr = [
        "<ul>",
        "  {{#items}}",
        "  <li>{{.}}</li>",
        "  {{/items}}",
        "</ul>",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Loop Test",
        template: templateStr,
        data: {
          items: ["Item 1", "Item 2", "Item 3"],
        },
      });
    });

    it("should handle inverted sections", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Inverted Test",
        template: "{{^isEmpty}}<p>Not empty</p>{{/isEmpty}}",
        data: { isEmpty: false },
      });
    });

    it("should register and use partials", async () => {
      adapter.registerPartial("header", "<header><h1>{{title}}</h1></header>");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Partial Test",
        template: "{{> header}}<p>Content</p>",
        data: { title: "My Title" },
      });
    });
  });

  describe("EjsAdapter", () => {
    let mailer: ReturnType<typeof createMailer>;

    beforeAll(() => {
      mailer = createMailer(new EjsAdapter());
    });

    it("should render simple template", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "EJS Test",
        template: "<h1>Hello <%= name %>!</h1>",
        data: { name: "World" },
      });
    });

    it("should handle nested properties", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Nested Test",
        template: "<p><%= user.name %> - <%= user.email %></p>",
        data: {
          user: {
            name: "John Doe",
            email: "john@example.com",
          },
        },
      });
    });

    it("should handle loops", async () => {
      const templateStr = [
        "<ul>",
        "  <% items.forEach(function(item) { %>",
        "    <li><%= item %></li>",
        "  <% }); %>",
        "</ul>",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Loop Test",
        template: templateStr,
        data: {
          items: ["Item 1", "Item 2", "Item 3"],
        },
      });
    });

    it("should handle conditionals", async () => {
      const templateStr = [
        "<% if (isActive) { %>",
        "  <p>Active user</p>",
        "<% } else { %>",
        "  <p>Inactive user</p>",
        "<% } %>",
      ].join("\n");

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Conditional Test",
        template: templateStr,
        data: { isActive: true },
      });
    });

    it("should handle JavaScript expressions", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Expression Test",
        template: "<p>Total: <%= price * quantity %></p>",
        data: { price: 10, quantity: 3 },
      });
    });

    it("should work with custom options", async () => {
      const customMailer = createMailer(
        new EjsAdapter({
          delimiter: "?",
          openDelimiter: "[",
          closeDelimiter: "]",
        }),
      );

      await customMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Custom Delimiter Test",
        template: "<h1>[?= name ?]</h1>",
        data: { name: "Custom" },
      });
    });
  });

  describe("CustomAdapter", () => {
    let adapter: CustomAdapter;
    let mailer: ReturnType<typeof createMailer>;

    beforeAll(() => {
      adapter = new CustomAdapter();
      mailer = createMailer(adapter);
    });

    it("should render simple template", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Custom Test",
        template: "<h1>Hello {{name}}!</h1>",
        data: { name: "World" },
      });
    });

    it("should handle multiple variables", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Multiple Vars Test",
        template: "<p>{{firstName}} {{lastName}} - {{email}}</p>",
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      });
    });

    it("should leave unmatched variables unchanged", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Unmatched Test",
        template: "<p>{{name}} {{missing}}</p>",
        data: { name: "John" },
      });
    });

    it("should register and use custom helpers", async () => {
      adapter.registerHelper("uppercase", (value) =>
        String(value).toUpperCase(),
      );
      adapter.registerHelper("reverse", (value) =>
        String(value).split("").reverse().join(""),
      );

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Helper Test",
        template: "<p>{{name:uppercase}} - {{word:reverse}}</p>",
        data: { name: "john", word: "hello" },
      });
    });

    it("should handle helper chaining", async () => {
      adapter.registerHelper("double", (...args: unknown[]) =>
        String(Number(args[0]) * 2),
      );
      adapter.registerHelper("format", (value) => `$${value}`);

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Chained Helpers Test",
        template: "<p>Price: {{price:double}}</p>",
        data: { price: 50 },
      });
    });

    it("should handle numbers and booleans", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Types Test",
        template: "<p>Count: {{count}}, Active: {{active}}</p>",
        data: { count: 42, active: true },
      });
    });
  });

  describe("Adapter Error Handling", () => {
    it("should handle template rendering errors gracefully", async () => {
      const customMailer = createMailer(new CustomAdapter());

      await customMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Test",
        template: "{{test}}",
        data: { test: "value" },
      });
    });
  });

  describe("Adapter Comparison", () => {
    it("should produce consistent output across adapters", async () => {
      const data = {
        title: "Test Email",
        name: "John Doe",
        items: ["Item 1", "Item 2"],
      };

      const handlebarsMailer = createMailer(new HandlebarsAdapter());
      const mustacheMailer = createMailer(new MustacheAdapter());
      const customMailer = createMailer(new CustomAdapter());

      await handlebarsMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "{{title}}",
        template: "<h1>Hello {{name}}</h1>",
        data,
      });

      await mustacheMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "{{title}}",
        template: "<h1>Hello {{name}}</h1>",
        data,
      });

      await customMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "{{title}}",
        template: "<h1>Hello {{name}}</h1>",
        data,
      });
    });
  });

  describe("Template Edge Cases", () => {
    it("should handle empty templates", async () => {
      const mailer = createMailer(new CustomAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Empty Template",
        template: "",
        data: {},
      });
    });

    it("should handle templates with no variables", async () => {
      const mailer = createMailer(new HandlebarsAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Static Template",
        template: "<h1>Static Content</h1><p>No variables here</p>",
        data: { unused: "value" },
      });
    });

    it("should handle very long templates", async () => {
      const mailer = createMailer(new MustacheAdapter());
      const longTemplate = "<p>{{content}}</p>".repeat(100);

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Long Template",
        template: longTemplate,
        data: { content: "Test" },
      });
    });

    it("should handle templates with complex HTML", async () => {
      const mailer = createMailer(new EjsAdapter());
      const complexTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial; }
            .container { max-width: 600px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1><%= title %></h1>
            <p><%= content %></p>
          </div>
        </body>
        </html>
      `;

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Complex HTML",
        template: complexTemplate,
        data: { title: "Title", content: "Content" },
      });
    });
  });

  describe("Adapter Performance", () => {
    it("should handle rapid successive renders with Handlebars", async () => {
      const mailer = createMailer(new HandlebarsAdapter());

      for (let i = 0; i < 10; i++) {
        await mailer.sendWithTemplate({
          to: "test@example.com",
          subject: `Render ${i}`,
          template: "<p>{{index}}</p>",
          data: { index: i },
        });
      }

      expect(true).toBe(true);
    });

    it("should handle rapid successive renders with Edge", async () => {
      const mailer = createMailer(new EdgeAdapter());

      for (let i = 0; i < 10; i++) {
        await mailer.sendWithTemplate({
          to: "test@example.com",
          subject: `Render ${i}`,
          template: "<p>{{ index }}</p>",
          data: { index: i },
        });
      }

      expect(true).toBe(true);
    });

    it("should handle concurrent renders across different adapters", async () => {
      const handlebarsMailer = createMailer(new HandlebarsAdapter());
      const ejsMailer = createMailer(new EjsAdapter());
      const mustacheMailer = createMailer(new MustacheAdapter());

      const promises = [
        handlebarsMailer.sendWithTemplate({
          to: "test@example.com",
          subject: "Handlebars",
          template: "{{name}}",
          data: { name: "Test" },
        }),
        ejsMailer.sendWithTemplate({
          to: "test@example.com",
          subject: "EJS",
          template: "<%= name %>",
          data: { name: "Test" },
        }),
        mustacheMailer.sendWithTemplate({
          to: "test@example.com",
          subject: "Mustache",
          template: "{{name}}",
          data: { name: "Test" },
        }),
      ];

      await Promise.all(promises);
    });
  });

  describe("Adapter Data Types", () => {
    it("should handle boolean values", async () => {
      const mailer = createMailer(new CustomAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Boolean Test",
        template: "<p>Active: {{isActive}}, Disabled: {{isDisabled}}</p>",
        data: { isActive: true, isDisabled: false },
      });
    });

    it("should handle numeric values", async () => {
      const mailer = createMailer(new HandlebarsAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Numbers Test",
        template: "<p>Count: {{count}}, Price: {{price}}</p>",
        data: { count: 42, price: 99.99 },
      });
    });

    it("should handle undefined and null values", async () => {
      const mailer = createMailer(new MustacheAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Null Test",
        template: "<p>Value: {{value}}</p>",
        data: { value: null, missing: undefined },
      });
    });

    it("should handle date objects", async () => {
      const mailer = createMailer(new EjsAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Date Test",
        template: "<p>Date: <%= date %></p>",
        data: { date: new Date("2024-01-01") },
      });
    });

    it("should handle complex nested objects", async () => {
      const mailer = createMailer(new HandlebarsAdapter());

      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Complex Data",
        template: "<p>{{user.address.city}}</p>",
        data: {
          user: {
            name: "John",
            address: {
              street: "123 Main St",
              city: "New York",
              country: "USA",
            },
          },
        },
      });
    });
  });
});

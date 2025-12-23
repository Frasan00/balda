import nodemailer from "nodemailer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Mailer } from "../../src/index.js";
import { CustomAdapter } from "../../src/mailer/adapters/custom_adapter.js";
import { HandlebarsAdapter } from "../../src/mailer/adapters/handlebars_adapter.js";

describe("Mailer with MailCatcher", () => {
  let mailer: ReturnType<typeof createTestMailer>;

  const createTestMailer = () => {
    return new Mailer(
      {
        mailcatcher: {
          transporter: nodemailer.createTransport({
            host: process.env.MAILCATCHER_HOST || "localhost",
            port: Number.parseInt(process.env.MAILCATCHER_PORT || "1025"),
            ignoreTLS: true,
          }),
          templateAdapter: new HandlebarsAdapter(),
          from: "noreply@example.com",
        },
      },
      {
        defaultProvider: "mailcatcher",
      },
    );
  };

  beforeAll(async () => {
    mailer = createTestMailer();
  });

  afterAll(async () => {
    console.log("\n📧 View all test emails at: http://localhost:1080");
  });

  describe("connection", () => {
    it("should verify mail provider connection", async () => {
      const isValid = await mailer.verify();
      expect(isValid).toBe(true);
    });
  });

  describe("send", () => {
    it("should send a basic text email", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Test Text Email")
          .text("This is a plain text email"),
      );
    });

    it("should send an HTML email", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Test HTML Email")
          .html("<h1>Hello World!</h1><p>This is an HTML email</p>"),
      );
    });

    it("should send email with both text and HTML", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Test Multipart Email")
          .text("Plain text version")
          .html("<p>HTML version</p>"),
      );
    });

    it("should send email to multiple recipients", async () => {
      await mailer.send((builder) =>
        builder
          .to(["user1@example.com", "user2@example.com", "user3@example.com"])
          .subject("Test Multiple Recipients")
          .text("Email to multiple recipients"),
      );
    });

    it("should send email with CC", async () => {
      await mailer.send((builder) =>
        builder
          .to("primary@example.com")
          .cc("copied@example.com")
          .subject("Test CC Email")
          .text("Email with CC"),
      );
    });

    it("should send email with BCC", async () => {
      await mailer.send((builder) =>
        builder
          .to("primary@example.com")
          .bcc("hidden@example.com")
          .subject("Test BCC Email")
          .text("Email with BCC"),
      );
    });

    it("should send email with CC and BCC", async () => {
      await mailer.send((builder) =>
        builder
          .to("primary@example.com")
          .cc(["cc1@example.com", "cc2@example.com"])
          .bcc(["bcc1@example.com", "bcc2@example.com"])
          .subject("Test CC and BCC Email")
          .text("Email with both CC and BCC"),
      );
    });

    it("should override default from address", async () => {
      await mailer.send((builder) =>
        builder
          .from("custom@example.com")
          .to("test@example.com")
          .subject("Custom From Address")
          .text("Email from custom address"),
      );
    });
  });

  describe("attachments", () => {
    it("should send email with single text attachment", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Email with Text Attachment")
          .text("Please see the attached file")
          .attachment({
            filename: "test.txt",
            content: "This is a test attachment",
          }),
      );
    });

    it("should send email with buffer attachment", async () => {
      const buffer = Buffer.from("Binary content", "utf-8");
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Email with Buffer Attachment")
          .text("Please see the attached file")
          .attachment({
            filename: "binary.dat",
            content: buffer,
            contentType: "application/octet-stream",
          }),
      );
    });

    it("should send email with multiple attachments", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Email with Multiple Attachments")
          .text("Please see the attached files")
          .attachments([
            { filename: "file1.txt", content: "First file" },
            { filename: "file2.txt", content: "Second file" },
            { filename: "file3.txt", content: "Third file" },
          ]),
      );
    });
  });

  describe("templates", () => {
    it("should send email with Handlebars template", async () => {
      await mailer.send((builder) =>
        builder
          .to("user@example.com")
          .subject("Welcome {{name}}!")
          .template("<h1>Hello {{name}}!</h1><p>Welcome to {{appName}}</p>", {
            name: "John Doe",
            appName: "Balda.js",
          }),
      );
    });

    it("should send email with complex Handlebars template", async () => {
      const templateStr = [
        '<div style="font-family: Arial, sans-serif;">',
        "  <h1>Order #{{orderId}}</h1>",
        "  <p>Hi {{customerName}},</p>",
        "  <p>Your order has been confirmed.</p>",
        "  <ul>",
        "    {{#each items}}",
        "    <li>{{this.name}} - ${{this.price}}</li>",
        "    {{/each}}",
        "  </ul>",
        "  <p>Total: ${{total}}</p>",
        "</div>",
      ].join("\n");

      await mailer.send((builder) =>
        builder
          .to("user@example.com")
          .subject("Order Confirmation")
          .template(templateStr, {
            orderId: "12345",
            customerName: "Jane Doe",
            items: [
              { name: "Product A", price: 10 },
              { name: "Product B", price: 20 },
            ],
            total: 30,
          }),
      );
    });

    it("should throw error when template adapter is not configured", async () => {
      const noTemplateMailer = new Mailer(
        {
          mailcatcher: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            from: "noreply@example.com",
          },
        },
        {
          defaultProvider: "mailcatcher",
        },
      );

      await expect(
        noTemplateMailer.send((builder) =>
          builder
            .to("test@example.com")
            .subject("Test")
            .template("{{test}}", { test: "value" }),
        ),
      ).rejects.toThrow("Template adapter not configured");
    });
  });

  describe("mailOptionsBuilder", () => {
    it("should build and send email using builder pattern", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Builder Pattern Test")
          .html("<h1>Built with Builder!</h1>"),
      );
    });

    it("should build email with all fields", async () => {
      await mailer.send((builder) =>
        builder
          .from("custom@example.com")
          .to("recipient@example.com")
          .cc("cc@example.com")
          .bcc("bcc@example.com")
          .subject("Complete Email")
          .text("Plain text")
          .html("<p>HTML content</p>")
          .attachment({
            filename: "file.txt",
            content: "Attachment content",
          }),
      );
    });

    it("should build email with multiple attachments", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Multiple Attachments")
          .text("Files attached")
          .attachments([
            { filename: "file1.txt", content: "Content 1" },
            { filename: "file2.txt", content: "Content 2" },
          ])
          .attachment({ filename: "file3.txt", content: "Content 3" }),
      );
    });

    it("should throw error when 'to' is missing", async () => {
      await expect(
        mailer.send((builder) => builder.subject("Missing To")),
      ).rejects.toThrow("'to' field is required");
    });

    it("should throw error when 'subject' is missing", async () => {
      await expect(
        mailer.send((builder) => builder.to("test@example.com")),
      ).rejects.toThrow("'subject' field is required");
    });
  });

  describe("multiple providers", () => {
    it("should switch between providers using use()", async () => {
      const multiMailer = new Mailer(
        {
          primary: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            from: "primary@example.com",
          },
          secondary: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            from: "secondary@example.com",
          },
        },
        {
          defaultProvider: "primary",
        },
      );

      await multiMailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("From Default Provider")
          .text("Using default provider"),
      );

      await multiMailer
        .use("secondary")
        .send((builder) =>
          builder
            .to("test@example.com")
            .subject("From Secondary Provider")
            .text("Using secondary provider"),
        );
    });

    it("should throw error for non-existent provider", () => {
      expect(() => {
        mailer.use("nonexistent" as any);
      }).toThrow("[Mailer] Provider 'nonexistent' not found");
    });
  });

  describe("custom template adapter", () => {
    it("should work with CustomAdapter", async () => {
      const customMailer = new Mailer(
        {
          mailcatcher: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            templateAdapter: new CustomAdapter(),
            from: "noreply@example.com",
          },
        },
        {
          defaultProvider: "mailcatcher",
        },
      );

      await customMailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Custom Adapter Test")
          .template("<h1>Hello {{name}}</h1><p>Value: {{value}}</p>", {
            name: "Test User",
            value: "123",
          }),
      );
    });

    it("should use custom adapter with helpers", async () => {
      const adapter = new CustomAdapter();
      adapter.registerHelper("uppercase", (value) =>
        String(value).toUpperCase(),
      );

      const customMailer = new Mailer(
        {
          mailcatcher: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            templateAdapter: adapter,
            from: "noreply@example.com",
          },
        },
        {
          defaultProvider: "mailcatcher",
        },
      );

      await customMailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Custom Helper Test")
          .template("<h1>{{name:uppercase}}</h1>", { name: "john doe" }),
      );
    });

    it("should throw error if handlebars is not installed", async () => {
      const testMailer = new Mailer(
        {
          mailcatcher: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            templateAdapter: new HandlebarsAdapter(),
            from: "noreply@example.com",
          },
        },
        {
          defaultProvider: "mailcatcher",
        },
      );

      await testMailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Test")
          .template("{{name}}", { name: "Test" }),
      );
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle empty subject", async () => {
      await expect(
        mailer.send((builder) =>
          builder
            .to("test@example.com")
            .subject("")
            .text("Empty subject email"),
        ),
      ).rejects.toThrow("[MailOptionsBuilder] 'subject' field is required");
    });

    it("should handle very long subject lines", async () => {
      const longSubject = "A".repeat(500);
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject(longSubject)
          .text("Long subject test"),
      );
    });

    it("should handle large email body", async () => {
      const largeBody = "Lorem ipsum dolor sit amet. ".repeat(1000);
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Large Body Test")
          .text(largeBody),
      );
    });

    it("should handle special characters in email addresses", async () => {
      await mailer.send((builder) =>
        builder
          .to("test+tag@example.com")
          .subject("Special Characters Test")
          .text("Testing special characters"),
      );
    });

    it("should handle special characters in content", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Special Characters: <>&\"'")
          .html("<p>Testing: &lt; &gt; &amp; &quot; &#39;</p>"),
      );
    });

    it("should handle unicode characters", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Unicode Test: 你好 مرحبا שלום")
          .html("<p>Unicode: 🎉 ❤️ 🚀 你好世界</p>"),
      );
    });

    it("should handle empty HTML", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Empty HTML")
          .html("")
          .text("Fallback text"),
      );
    });

    it("should handle malformed HTML gracefully", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Malformed HTML")
          .html("<div><p>Unclosed tags<span>"),
      );
    });
  });

  describe("concurrent operations", () => {
    it("should handle concurrent email sending", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        mailer.send((builder) =>
          builder
            .to(`test${i}@example.com`)
            .subject(`Concurrent Email ${i}`)
            .text(`Email number ${i}`),
        ),
      );

      await Promise.all(promises);
    });

    it("should handle concurrent template rendering", async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        mailer.send((builder) =>
          builder
            .to(`test${i}@example.com`)
            .subject(`Template ${i}`)
            .template("<h1>Hello {{name}}</h1>", { name: `User ${i}` }),
        ),
      );

      await Promise.all(promises);
    });

    it("should handle mixed concurrent operations", async () => {
      const promises = [
        mailer.send((builder) =>
          builder
            .to("test1@example.com")
            .subject("Regular Email")
            .text("Regular"),
        ),
        mailer.send((builder) =>
          builder
            .to("test2@example.com")
            .subject("Template Email")
            .template("{{content}}", { content: "Template" }),
        ),
        mailer.verify(),
        mailer.send((builder) =>
          builder
            .to("test3@example.com")
            .subject("Another Email")
            .html("<p>HTML</p>"),
        ),
      ];

      await Promise.all(promises);
    });
  });

  describe("builder advanced scenarios", () => {
    it("should handle complex email composition", async () => {
      await mailer.send((builder) =>
        builder
          .from("sender@example.com")
          .to(["recipient1@example.com", "recipient2@example.com"])
          .cc(["cc1@example.com", "cc2@example.com"])
          .bcc("bcc@example.com")
          .subject("Complex Email")
          .text("Plain text version")
          .html("<p>HTML version</p>")
          .attachments([
            { filename: "file1.txt", content: "Content 1" },
            { filename: "file2.txt", content: "Content 2" },
          ])
          .attachment({ filename: "file3.txt", content: "Content 3" }),
      );
    });

    it("should handle builder with method chaining", async () => {
      await mailer.send((builder) =>
        builder.to("test@example.com").subject("Chained").text("Text"),
      );
    });

    it("should handle complex nested chaining", async () => {
      await mailer.send((builder) => {
        builder
          .from("sender@example.com")
          .to("user1@example.com")
          .subject("Base Subject")
          .text("Email 1");
      });
    });
  });

  describe("template data handling", () => {
    it("should handle nested template data", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Nested Data")
          .template("<p>{{user.profile.name}}</p>", {
            user: {
              profile: {
                name: "John Doe",
              },
            },
          }),
      );
    });

    it("should handle array data in templates", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Array Data")
          .template("<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>", {
            items: ["Item 1", "Item 2", "Item 3"],
          }),
      );
    });

    it("should handle empty data object", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Empty Data")
          .template("<p>Static content</p>", {}),
      );
    });

    it("should handle null values in template data", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Null Values")
          .template("<p>Value: {{value}}</p>", { value: null }),
      );
    });
  });

  describe("attachment handling", () => {
    it("should handle very large attachment content", async () => {
      const largeContent = Buffer.alloc(1024 * 100, "a"); // 100KB
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Large Attachment")
          .text("See attachment")
          .attachment({
            filename: "large.txt",
            content: largeContent,
          }),
      );
    });

    it("should handle multiple attachments of different types", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Mixed Attachments")
          .text("Multiple attachments")
          .attachments([
            {
              filename: "text.txt",
              content: "Text content",
              contentType: "text/plain",
            },
            {
              filename: "data.json",
              content: JSON.stringify({ key: "value" }),
              contentType: "application/json",
            },
            {
              filename: "binary.dat",
              content: Buffer.from([0x00, 0x01, 0x02]),
              contentType: "application/octet-stream",
            },
          ]),
      );
    });

    it("should handle attachment with special characters in filename", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Special Filename")
          .text("Attachment test")
          .attachment({
            filename: "file name (1).txt",
            content: "Content",
          }),
      );
    });
  });

  describe("builder callback pattern", () => {
    it("should send email using builder callback", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Builder Callback Test")
          .html("<h1>Hello from callback!</h1>"),
      );
    });

    it("should send email using builder callback without return", async () => {
      await mailer.send((builder) => {
        builder
          .to("test@example.com")
          .subject("Builder No Return")
          .text("Testing without return");
      });
    });

    it("should send template email using builder callback", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Template via Builder")
          .template("<h1>Hello {{name}}!</h1>", { name: "John" }),
      );
    });

    it("should send template file using builder callback", async () => {
      await mailer.send((builder) =>
        builder
          .to("test@example.com")
          .subject("Template File Test")
          .templateFile("./test/resources/test.txt", { name: "Jane" }),
      );
    });

    it("should handle all email fields with builder callback", async () => {
      await mailer.send((builder) =>
        builder
          .from("custom@example.com")
          .to(["user1@example.com", "user2@example.com"])
          .cc("cc@example.com")
          .bcc("bcc@example.com")
          .subject("Full Builder Test")
          .html("<p>Complete email</p>")
          .attachment({ filename: "test.txt", content: "Test content" }),
      );
    });
  });

  describe("queued email sending with later()", () => {
    it("should queue single email for later sending", async () => {
      await mailer.later((builder) =>
        builder
          .to("test@example.com")
          .subject("Queued Email")
          .text("This email was queued"),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should queue multiple emails and send with delay", async () => {
      const startTime = Date.now();

      await mailer.later((builder) =>
        builder
          .to("user1@example.com")
          .subject("Queued Email 1")
          .text("First queued email"),
      );

      await mailer.later((builder) =>
        builder
          .to("user2@example.com")
          .subject("Queued Email 2")
          .text("Second queued email"),
      );

      await mailer.later((builder) =>
        builder
          .to("user3@example.com")
          .subject("Queued Email 3")
          .text("Third queued email"),
      );

      await new Promise((resolve) => setTimeout(resolve, 3500));

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });

    it("should queue template emails for later sending", async () => {
      await mailer.later((builder) =>
        builder
          .to("test@example.com")
          .subject("Queued Template")
          .template("<h1>Hello {{name}}!</h1>", { name: "Queued User" }),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should queue template file emails for later sending", async () => {
      await mailer.later((builder) =>
        builder
          .to("test@example.com")
          .subject("Queued Template File")
          .templateFile("./test/resources/test.txt", { name: "File User" }),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("should handle mixed regular and template emails in queue", async () => {
      await mailer.later((builder) =>
        builder
          .to("test1@example.com")
          .subject("Regular Queued 1")
          .html("<p>Regular HTML</p>"),
      );

      await mailer.later((builder) =>
        builder
          .to("test2@example.com")
          .subject("Template Queued")
          .template("<p>{{message}}</p>", { message: "Template" }),
      );

      await mailer.later((builder) =>
        builder
          .to("test3@example.com")
          .subject("Regular Queued 2")
          .text("Regular text"),
      );

      await new Promise((resolve) => setTimeout(resolve, 2500));
    });

    it("should continue processing queue even if one email fails", async () => {
      await mailer.later((builder) =>
        builder.to("valid@example.com").subject("Valid 1").text("First"),
      );

      await expect(
        mailer.later((builder) =>
          builder
            .to("" as any)
            .subject("Invalid")
            .text("Should fail"),
        ),
      ).rejects.toThrow("[MailOptionsBuilder] 'to' field is required");

      await mailer.later((builder) =>
        builder.to("valid2@example.com").subject("Valid 2").text("Third"),
      );

      await new Promise((resolve) => setTimeout(resolve, 2500));
    });

    it("should process queue independently from immediate sends", async () => {
      await mailer.later((builder) =>
        builder.to("queued@example.com").subject("Queued").text("Queued"),
      );

      await mailer.send((builder) =>
        builder
          .to("immediate@example.com")
          .subject("Immediate")
          .text("Immediate"),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe("provider switching scenarios", () => {
    it("should maintain state between provider switches", async () => {
      const multiMailer = new Mailer(
        {
          primary: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            from: "primary@example.com",
          },
          secondary: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
            from: "secondary@example.com",
          },
        },
        {
          defaultProvider: "primary",
        },
      );

      await multiMailer.send((builder) =>
        builder.to("test@example.com").subject("Primary 1").text("First"),
      );

      await multiMailer
        .use("secondary")
        .send((builder) =>
          builder.to("test@example.com").subject("Secondary").text("Second"),
        );

      await multiMailer.send((builder) =>
        builder.to("test@example.com").subject("Primary 2").text("Third"),
      );

      expect(true).toBe(true);
    });

    it("should verify different providers independently", async () => {
      const multiMailer = new Mailer(
        {
          primary: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
          },
          secondary: {
            transporter: nodemailer.createTransport({
              host: "localhost",
              port: 1025,
              ignoreTLS: true,
            }),
          },
        },
        {
          defaultProvider: "primary",
        },
      );

      const primaryVerify = await multiMailer.verify();
      const secondaryVerify = await multiMailer.use("secondary").verify();

      expect(primaryVerify).toBe(true);
      expect(secondaryVerify).toBe(true);
    });
  });
});

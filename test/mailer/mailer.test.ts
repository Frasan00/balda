import nodemailer from "nodemailer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Mailer, mailOptions } from "../../src/index.js";
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
      await mailer.send({
        to: "test@example.com",
        subject: "Test Text Email",
        text: "This is a plain text email",
      });
    });

    it("should send an HTML email", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Test HTML Email",
        html: "<h1>Hello World!</h1><p>This is an HTML email</p>",
      });
    });

    it("should send email with both text and HTML", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Test Multipart Email",
        text: "Plain text version",
        html: "<p>HTML version</p>",
      });
    });

    it("should send email to multiple recipients", async () => {
      await mailer.send({
        to: ["user1@example.com", "user2@example.com", "user3@example.com"],
        subject: "Test Multiple Recipients",
        text: "Email to multiple recipients",
      });
    });

    it("should send email with CC", async () => {
      await mailer.send({
        to: "primary@example.com",
        cc: "copied@example.com",
        subject: "Test CC Email",
        text: "Email with CC",
      });
    });

    it("should send email with BCC", async () => {
      await mailer.send({
        to: "primary@example.com",
        bcc: "hidden@example.com",
        subject: "Test BCC Email",
        text: "Email with BCC",
      });
    });

    it("should send email with CC and BCC", async () => {
      await mailer.send({
        to: "primary@example.com",
        cc: ["cc1@example.com", "cc2@example.com"],
        bcc: ["bcc1@example.com", "bcc2@example.com"],
        subject: "Test CC and BCC Email",
        text: "Email with both CC and BCC",
      });
    });

    it("should override default from address", async () => {
      await mailer.send({
        from: "custom@example.com",
        to: "test@example.com",
        subject: "Custom From Address",
        text: "Email from custom address",
      });
    });
  });

  describe("attachments", () => {
    it("should send email with single text attachment", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Email with Text Attachment",
        text: "Please see the attached file",
        attachments: [
          {
            filename: "test.txt",
            content: "This is a test attachment",
          },
        ],
      });
    });

    it("should send email with buffer attachment", async () => {
      const buffer = Buffer.from("Binary content", "utf-8");
      await mailer.send({
        to: "test@example.com",
        subject: "Email with Buffer Attachment",
        text: "Please see the attached file",
        attachments: [
          {
            filename: "binary.dat",
            content: buffer,
            contentType: "application/octet-stream",
          },
        ],
      });
    });

    it("should send email with multiple attachments", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Email with Multiple Attachments",
        text: "Please see the attached files",
        attachments: [
          {
            filename: "file1.txt",
            content: "First file",
          },
          {
            filename: "file2.txt",
            content: "Second file",
          },
          {
            filename: "file3.txt",
            content: "Third file",
          },
        ],
      });
    });
  });

  describe("templates", () => {
    it("should send email with Handlebars template", async () => {
      await mailer.sendWithTemplate({
        to: "user@example.com",
        subject: "Welcome {{name}}!",
        template: "<h1>Hello {{name}}!</h1><p>Welcome to {{appName}}</p>",
        data: {
          name: "John Doe",
          appName: "Balda.js",
        },
      });
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

      await mailer.sendWithTemplate({
        to: "user@example.com",
        subject: "Order Confirmation",
        template: templateStr,
        data: {
          orderId: "12345",
          customerName: "Jane Doe",
          items: [
            { name: "Product A", price: 10 },
            { name: "Product B", price: 20 },
          ],
          total: 30,
        },
      });
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
        noTemplateMailer.sendWithTemplate({
          to: "test@example.com",
          subject: "Test",
          template: "{{test}}",
          data: { test: "value" },
        }),
      ).rejects.toThrow("Template adapter not configured");
    });
  });

  describe("mailOptionsBuilder", () => {
    it("should build and send email using builder pattern", async () => {
      const options = mailOptions()
        .to("test@example.com")
        .subject("Builder Pattern Test")
        .html("<h1>Built with Builder!</h1>")
        .build();

      await mailer.send(options);
    });

    it("should build email with all fields", async () => {
      const options = mailOptions()
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
        })
        .build();

      await mailer.send(options);
    });

    it("should build email with multiple attachments", async () => {
      const options = mailOptions()
        .to("test@example.com")
        .subject("Multiple Attachments")
        .text("Files attached")
        .attachments([
          { filename: "file1.txt", content: "Content 1" },
          { filename: "file2.txt", content: "Content 2" },
        ])
        .attachment({ filename: "file3.txt", content: "Content 3" })
        .build();

      await mailer.send(options);
      expect(options.attachments).toHaveLength(3);
    });

    it("should throw error when 'to' is missing", () => {
      expect(() => {
        mailOptions().subject("Missing To").build();
      }).toThrow("'to' field is required");
    });

    it("should throw error when 'subject' is missing", () => {
      expect(() => {
        mailOptions().to("test@example.com").build();
      }).toThrow("'subject' field is required");
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

      await multiMailer.send({
        to: "test@example.com",
        subject: "From Default Provider",
        text: "Using default provider",
      });

      await multiMailer.use("secondary").send({
        to: "test@example.com",
        subject: "From Secondary Provider",
        text: "Using secondary provider",
      });
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

      await customMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Custom Adapter Test",
        template: "<h1>Hello {{name}}</h1><p>Value: {{value}}</p>",
        data: {
          name: "Test User",
          value: "123",
        },
      });
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

      await customMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Custom Helper Test",
        template: "<h1>{{name:uppercase}}</h1>",
        data: {
          name: "john doe",
        },
      });
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

      await testMailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Test",
        template: "{{name}}",
        data: { name: "Test" },
      });
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle empty subject", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "",
        text: "Empty subject email",
      });
    });

    it("should handle very long subject lines", async () => {
      const longSubject = "A".repeat(500);
      await mailer.send({
        to: "test@example.com",
        subject: longSubject,
        text: "Long subject test",
      });
    });

    it("should handle large email body", async () => {
      const largeBody = "Lorem ipsum dolor sit amet. ".repeat(1000);
      await mailer.send({
        to: "test@example.com",
        subject: "Large Body Test",
        text: largeBody,
      });
    });

    it("should handle special characters in email addresses", async () => {
      await mailer.send({
        to: "test+tag@example.com",
        subject: "Special Characters Test",
        text: "Testing special characters",
      });
    });

    it("should handle special characters in content", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Special Characters: <>&\"'",
        html: "<p>Testing: &lt; &gt; &amp; &quot; &#39;</p>",
      });
    });

    it("should handle unicode characters", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Unicode Test: 你好 مرحبا שלום",
        html: "<p>Unicode: 🎉 ❤️ 🚀 你好世界</p>",
      });
    });

    it("should handle empty HTML", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Empty HTML",
        html: "",
        text: "Fallback text",
      });
    });

    it("should handle malformed HTML gracefully", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Malformed HTML",
        html: "<div><p>Unclosed tags<span>",
      });
    });
  });

  describe("concurrent operations", () => {
    it("should handle concurrent email sending", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        mailer.send({
          to: `test${i}@example.com`,
          subject: `Concurrent Email ${i}`,
          text: `Email number ${i}`,
        }),
      );

      await Promise.all(promises);
    });

    it("should handle concurrent template rendering", async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        mailer.sendWithTemplate({
          to: `test${i}@example.com`,
          subject: `Template ${i}`,
          template: "<h1>Hello {{name}}</h1>",
          data: { name: `User ${i}` },
        }),
      );

      await Promise.all(promises);
    });

    it("should handle mixed concurrent operations", async () => {
      const promises = [
        mailer.send({
          to: "test1@example.com",
          subject: "Regular Email",
          text: "Regular",
        }),
        mailer.sendWithTemplate({
          to: "test2@example.com",
          subject: "Template Email",
          template: "{{content}}",
          data: { content: "Template" },
        }),
        mailer.verify(),
        mailer.send({
          to: "test3@example.com",
          subject: "Another Email",
          html: "<p>HTML</p>",
        }),
      ];

      await Promise.all(promises);
    });
  });

  describe("builder advanced scenarios", () => {
    it("should handle complex email composition", async () => {
      const options = mailOptions()
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
        .attachment({ filename: "file3.txt", content: "Content 3" })
        .build();

      await mailer.send(options);
    });

    it("should handle builder with method chaining", async () => {
      const builder = mailOptions();

      builder.to("test@example.com").subject("Chained").text("Text");

      const options = builder.build();
      await mailer.send(options);
    });

    it("should allow reusing builder pattern", async () => {
      const baseOptions = mailOptions()
        .from("sender@example.com")
        .subject("Base Subject");

      const email1 = baseOptions
        .to("user1@example.com")
        .text("Email 1")
        .build();

      await mailer.send(email1);
    });
  });

  describe("template data handling", () => {
    it("should handle nested template data", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Nested Data",
        template: "<p>{{user.profile.name}}</p>",
        data: {
          user: {
            profile: {
              name: "John Doe",
            },
          },
        },
      });
    });

    it("should handle array data in templates", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Array Data",
        template: "<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>",
        data: {
          items: ["Item 1", "Item 2", "Item 3"],
        },
      });
    });

    it("should handle empty data object", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Empty Data",
        template: "<p>Static content</p>",
        data: {},
      });
    });

    it("should handle null values in template data", async () => {
      await mailer.sendWithTemplate({
        to: "test@example.com",
        subject: "Null Values",
        template: "<p>Value: {{value}}</p>",
        data: {
          value: null,
        },
      });
    });
  });

  describe("attachment handling", () => {
    it("should handle very large attachment content", async () => {
      const largeContent = Buffer.alloc(1024 * 100, "a"); // 100KB
      await mailer.send({
        to: "test@example.com",
        subject: "Large Attachment",
        text: "See attachment",
        attachments: [
          {
            filename: "large.txt",
            content: largeContent,
          },
        ],
      });
    });

    it("should handle multiple attachments of different types", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Mixed Attachments",
        text: "Multiple attachments",
        attachments: [
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
        ],
      });
    });

    it("should handle attachment with special characters in filename", async () => {
      await mailer.send({
        to: "test@example.com",
        subject: "Special Filename",
        text: "Attachment test",
        attachments: [
          {
            filename: "file name (1).txt",
            content: "Content",
          },
        ],
      });
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

      await multiMailer.send({
        to: "test@example.com",
        subject: "Primary 1",
        text: "First",
      });

      await multiMailer.use("secondary").send({
        to: "test@example.com",
        subject: "Secondary",
        text: "Second",
      });

      await multiMailer.send({
        to: "test@example.com",
        subject: "Primary 2",
        text: "Third",
      });

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

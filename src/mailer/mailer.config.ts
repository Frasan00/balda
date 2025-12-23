import { createTransport } from "nodemailer";
import { Mailer, EjsAdapter } from "balda";

/**
 * Configure your email transporter
 * For development, you can use MailCatcher (docker-compose up mailcatcher)
 * For production, use your SMTP service (Gmail, SendGrid, AWS SES, etc.)
 */
const transporter = createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
});

/**
 * Configure EJS template adapter
 * Pass custom options to the EJS compiler
 */
const adapter = new EjsAdapter({
  // Custom EJS options (optional)
  // cache: true,
  // delimiter: "%",
});

/**
 * Initialize the Mailer with multiple providers (optional)
 * You can define different providers for different purposes
 */
export const mailer = new Mailer(
  {
    default: {
      transporter,
      templateAdapter: adapter,
      from: process.env.DEFAULT_FROM_EMAIL || "noreply@example.com",
    },
    // Add more providers as needed
    // transactional: { transporter: transactionalTransporter, from: "..." },
    // marketing: { transporter: marketingTransporter, from: "..." },
  },
  {
    defaultProvider: "default",
  },
);

/**
 * Example usage:
 *
 * // Send a simple email
 * await mailer.send({
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   text: "Hello from Balda!",
 *   html: "<h1>Hello from Balda!</h1>",
 * });

 * // Send email with template
 * await mailer.sendWithTemplate({
 *   to: "user@example.com",
 *   subject: "Welcome {{name}}!",
 *   template: "<h1>Hello {{name}}</h1><p>Welcome to {{appName}}!</p>",
 *   data: {
 *     name: "John Doe",
 *     appName: "My App",
 *   },
 * });
 *
 * // Use a different provider
 * await mailer.use("transactional").send({
 *   to: "user@example.com",
 *   subject: "Transaction Complete",
 *   text: "Your order has been processed",
 * });
 *
 * // Verify connection
 * const isValid = await mailer.verify();
 * console.log("Mail provider connection:", isValid ? "OK" : "Failed");
 */

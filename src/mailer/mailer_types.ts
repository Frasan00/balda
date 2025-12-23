import type { Transporter } from "nodemailer";
import type { Email } from "./mail_options_builder.js";

export type { Email };

/**
 * Options for sending an email
 */
export type MailOptions = {
  /**
   * The sender email address (optional if set in provider config)
   */
  from?: Email;
  /**
   * Recipient email address(es)
   */
  to: Email | Email[];
  /**
   * Carbon copy recipient email address(es)
   */
  cc?: Email | Email[];
  /**
   * Blind carbon copy recipient email address(es)
   */
  bcc?: Email | Email[];
  /**
   * Email subject line
   */
  subject: string;
  /**
   * Plain text version of the email body
   */
  text?: string;
  /**
   * HTML version of the email body
   */
  html?: string;
  /**
   * Email attachments
   */
  attachments?: Attachment[];
};

/**
 * Email attachment configuration
 */
export type Attachment = {
  /**
   * Name of the attached file
   */
  filename: string;
  /**
   * Attachment content as string or Buffer
   */
  content?: string | Buffer;
  /**
   * Path to file to attach
   */
  path?: string;
  /**
   * Content type (MIME type) of the attachment
   */
  contentType?: string;
};

/**
 * Options for sending an email with a template
 * Omits html and text as they will be generated from the template
 */
export type TemplateMailOptions = Omit<MailOptions, "html" | "text"> & {
  /**
   * Template string to render or path to template file
   */
  template: string;
  /**
   * Data to pass to the template for rendering
   */
  data: Record<string, unknown>;
  /**
   * Whether the template is a file path
   */
  isFilePath?: boolean;
};

/**
 * Interface for template adapters
 * Implement this to create custom template engines
 */
export interface TemplateAdapter {
  /**
   * Render a template string with data
   * @param template - The template string to render
   * @param data - Data to interpolate into the template
   * @returns Rendered HTML string (can be sync or async)
   */
  render(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> | string;

  /**
   * Render a template from a file
   * @param templatePath - Path to the template file
   * @param data - Data to interpolate into the template
   * @returns Promise resolving to rendered HTML string
   */
  renderFromFile(
    templatePath: string,
    data: Record<string, unknown>,
  ): Promise<string>;
}

/**
 * Interface for mail provider instances
 */
export interface MailProviderInterface {
  /**
   * Send an email using builder callback
   * @param builderFn - Callback function that receives and configures the mail options builder
   */
  send(
    builderFn: (
      builder: import("./mail_options_builder.js").MailOptionsBuilder,
    ) => import("./mail_options_builder.js").MailOptionsBuilder | void,
  ): Promise<void>;

  /**
   * Verify the mail provider connection
   * @returns Promise resolving to true if connection is valid
   */
  verify(): Promise<boolean>;
}

/**
 * Configuration options for a mail provider
 */
export type MailProviderOptions = {
  /**
   * Nodemailer transporter instance
   */
  transporter: Transporter;
  /**
   * Optional template adapter for rendering email templates
   */
  templateAdapter?: TemplateAdapter;
  /**
   * Default sender email address for this provider
   */
  from?: Email;
};

/**
 * Map of provider names to their configuration options
 */
export type MailerProviderOptions = Record<string, MailProviderOptions>;

/**
 * Configuration options for the Mailer instance
 */
export type MailerOptions<T extends MailerProviderOptions> = {
  /**
   * Name of the default provider to use
   */
  defaultProvider: keyof T;
};

/**
 * Interface for the main Mailer class
 */
export interface MailerInterface {
  /**
   * Switch to a specific mail provider
   * @param provider - Name of the provider to use
   * @returns The mail provider instance
   */
  use(provider: string): MailProviderInterface;

  /**
   * Send an email using the default provider with builder pattern
   * Automatically infers whether to use template or regular send based on builder configuration
   * @param builderFn - Callback function that receives and configures the mail options builder
   */
  send(
    builderFn: (
      builder: import("./mail_options_builder.js").MailOptionsBuilder,
    ) => import("./mail_options_builder.js").MailOptionsBuilder | void,
  ): Promise<void>;

  /**
   * Defer sending an email with an internal in memory queue
   * The email will be sent in a second moment, when the queue is processed
   * @param builderFn - Callback function that receives and configures the mail options builder
   */
  later(
    builderFn: (
      builder: import("./mail_options_builder.js").MailOptionsBuilder,
    ) => import("./mail_options_builder.js").MailOptionsBuilder | void,
  ): Promise<void>;

  /**
   * Verify the default provider connection
   * @returns Promise resolving to true if connection is valid
   */
  verify(): Promise<boolean>;
}

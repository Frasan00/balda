import { BaldaError } from "../errors/balda_error.js";

export class MailerError extends BaldaError {
  constructor(message: string) {
    super(message);
    this.name = "MailerError";
  }
}

export class ProviderNotFoundError extends MailerError {
  constructor(providerName: string) {
    super(`[Mailer] Provider '${providerName}' not found`);
    this.name = "ProviderNotFoundError";
  }
}

export class TemplateAdapterNotConfiguredError extends MailerError {
  constructor() {
    super("[MailProvider] Template adapter not configured for this provider");
    this.name = "TemplateAdapterNotConfiguredError";
  }
}

export class InvalidDefaultProviderError extends MailerError {
  constructor(providerName: string) {
    super(
      `[Mailer] Default provider '${providerName}' not found in provider options`,
    );
    this.name = "InvalidDefaultProviderError";
  }
}

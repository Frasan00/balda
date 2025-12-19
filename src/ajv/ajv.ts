import { Ajv } from "ajv";

/**
 * Global state for the AJV instance used for JSON Schema validation.
 *
 * ## Custom AJV Instance
 *
 * You can provide your own AJV instance with custom configuration:
 *
 * ```typescript
 * import { Ajv } from 'ajv';
 * import { AjvStateManager } from 'balda-js';
 *
 * const customAjv = new Ajv({
 *   validateSchema: false, // Required - must be false
 *   strict: false,         // Required - must be false
 *   allErrors: true,       // Optional - your custom config
 *   // ... other custom options
 * });
 *
 * // Add custom formats, keywords, etc.
 * customAjv.addFormat('custom-format', /regex/);
 *
 * // Set as global instance
 * AjvStateManager.setGlobalInstance(customAjv);
 * ```
 *
 * **IMPORTANT:** The following options are required and must not be changed:
 * - `validateSchema: false` - Required for proper Zod schema compilation
 * - `strict: false` - Required for proper Zod schema compilation
 *
 * Changing these values will cause validation errors and break Zod schema support.
 */
export class AjvStateManager {
  static ajv: Ajv = new Ajv({
    validateSchema: false, // Required - do not change
    strict: false, // Required - do not change
  });

  static {
    this.ajv.addFormat(
      "email",
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    );

    this.ajv.addFormat(
      "url",
      /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
    );

    this.ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);

    this.ajv.addFormat(
      "datetime",
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/,
    );

    this.ajv.addFormat("time", /^\d{2}:\d{2}:\d{2}$/);
    this.ajv.addFormat("binary", /^(?:[0-9a-fA-F]{2})+$/);
    this.ajv.addFormat(
      "base64",
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    );
    this.ajv.addFormat(
      "uuid",
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  }

  /**
   * Sets the global AJV instance to use for JSON Schema validation.
   * @param ajv - The AJV instance to set as global.
   * @warning The AJV instance must be configured with the following options:
   * - `validateSchema: false` - Required for proper Zod schema compilation
   * - `strict: false` - Required for proper Zod schema compilation
   * Changing these values will cause validation errors and break Zod schema support.
   */
  static setGlobalInstance(ajv: Ajv) {
    this.ajv = ajv;
    this.ajv.opts.strict = false;
    this.ajv.opts.validateSchema = false;
  }
}

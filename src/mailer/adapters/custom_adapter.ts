import { nativeFs } from "../../runtime/native_fs.js";
import type { TemplateAdapter } from "../mailer_types.js";

/**
 * Custom template adapter example
 * Simple string interpolation with {{variable}} syntax
 *
 * Use this as a base to create your own custom adapter
 */
export class CustomAdapter implements TemplateAdapter {
  private helpers: Map<string, (value: unknown) => string> = new Map();

  render(template: string, data: Record<string, unknown>): string {
    return template.replace(
      /\{\{(\w+)(?::(\w+))?\}\}/g,
      (match, key, helper) => {
        const value = data[key];

        if (value === undefined) {
          return match;
        }

        if (helper && this.helpers.has(helper)) {
          const helperFn = this.helpers.get(helper)!;
          return helperFn(value);
        }

        return String(value);
      },
    );
  }

  async renderFromFile(
    templatePath: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const templateContent = await nativeFs.readFile(templatePath, {
      encoding: "utf8",
    });
    return this.render(templateContent as string, data);
  }

  /**
   * Register a custom helper function
   * Usage in template: {{name:uppercase}}
   */
  registerHelper(name: string, fn: (value: unknown) => string): void {
    this.helpers.set(name, fn);
  }
}

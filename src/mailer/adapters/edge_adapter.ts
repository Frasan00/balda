import { BaldaError } from "../../errors/balda_error.js";
import type { TemplateAdapter } from "../mailer_types.js";

/**
 * Edge.js template adapter
 * Requires: npm install edge.js
 */
export class EdgeAdapter implements TemplateAdapter {
  // Using any here because Edge.js has complex types (TagContract) that aren't easily imported
  // The TemplateAdapter interface ensures type safety for the public API
  declare private edge: any;

  async render(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureEdge();
    return this.edge.renderRaw(template, data);
  }

  async renderFromFile(
    templatePath: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureEdge();
    return this.edge.render(templatePath, data);
  }

  /**
   * Register a global helper
   */
  async global(name: string, value: unknown): Promise<void> {
    await this.ensureEdge();
    this.edge.global(name, value);
  }

  /**
   * Register a custom tag
   */
  async registerTag(tag: unknown): Promise<void> {
    await this.ensureEdge();
    this.edge.registerTag(tag);
  }

  private async ensureEdge(): Promise<void> {
    if (this.edge) {
      return;
    }

    const edgeModule = await import("edge.js").catch(() => {
      throw new BaldaError(
        "Library not installed: edge.js, try run npm install edge.js",
      );
    });

    const { Edge } = edgeModule;
    this.edge = new Edge();
  }
}

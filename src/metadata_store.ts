/**
 * Cross-runtime metadata store used to store metadata for the decorators without using reflect-metadata
 */
export class MetadataStore {
  private static metadata = new WeakMap<any, Map<string, any>>();

  /**
   * Set the metadata for the given target and property key
   */
  static set(target: any, propertyKey: string, value: any): void {
    if (!this.metadata.has(target)) {
      this.metadata.set(target, new Map());
    }
    this.metadata.get(target)!.set(propertyKey, value);
  }

  /**
   * Get the metadata for the given target and property key
   */
  static get(target: any, propertyKey: string): any {
    return this.metadata.get(target)?.get(propertyKey);
  }

  /**
   * Get all the metadata for the given target
   */
  static getAll(target: any): Map<string, any> {
    return this.metadata.get(target) || new Map();
  }

  /**
   * Delete the metadata for the given target and property key
   */
  static delete(target: any, propertyKey: string): void {
    this.metadata.get(target)?.delete(propertyKey);
  }

  /**
   * Clear all the metadata for the given target
   */
  static clear(target: any): void {
    this.metadata.delete(target);
  }
}

/**
 * Cross-runtime metadata store used to store metadata for the decorators without using reflect-metadata
 */
export class MetadataStore {
  private static metadata = new WeakMap<any, Map<string | symbol, any>>();

  /**
   * Set the metadata for the given target and property key
   */
  static set(target: any, propertyKey: string | symbol, value: any): void {
    if (!this.metadata.has(target)) {
      this.metadata.set(target, new Map());
    }
    this.metadata.get(target)!.set(propertyKey, value);
  }

  /**
   * Get the metadata for the given target and property key
   */
  static get(target: any, propertyKey: string | symbol): any {
    return this.metadata.get(target)?.get(propertyKey);
  }

  /**
   * Get all the metadata for the given target.
   * Returns undefined if no metadata exists for the target.
   * Use getOrCreateAll() if you want to ensure a Map is returned.
   */
  static getAll(target: any): Map<string | symbol, any> | undefined {
    return this.metadata.get(target);
  }

  /**
   * Get all the metadata for the given target, creating an empty Map if none exists.
   * This is useful when you want to iterate over metadata or add new entries.
   */
  static getOrCreateAll(target: any): Map<string | symbol, any> {
    if (!this.metadata.has(target)) {
      this.metadata.set(target, new Map());
    }
    return this.metadata.get(target)!;
  }

  /**
   * Delete the metadata for the given target and property key
   */
  static delete(target: any, propertyKey: string | symbol): void {
    this.metadata.get(target)?.delete(propertyKey);
  }

  /**
   * Clear all the metadata for the given target
   */
  static clear(target: any): void {
    this.metadata.delete(target);
  }
}

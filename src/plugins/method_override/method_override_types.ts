export type MethodOverrideOptions = {
  /**
   * HTTP methods that can be overridden
   * Default: ['POST']
   */
  methods?: string[];

  /**
   * Header name to read the override method from
   * Default: 'X-HTTP-Method-Override'
   */
  header?: string;
};

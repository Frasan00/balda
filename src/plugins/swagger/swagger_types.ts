/**
 * Type of Swagger UI to use
 */
export type SwaggerUIType =
  | "standard"
  | "rapidoc"
  | "scalar"
  | "elements"
  | "custom";

type HTMLString = string;

/**
 * Configuration for validation error response documentation.
 * Used to document validation errors in Swagger when routes have validation schemas.
 */
export type ValidationErrorResponseOptions = {
  /** HTTP status code for validation errors. Default: 422 */
  statusCode?: number;
  /** Response description. Default: "Validation error" */
  description?: string;
  /** Response schema for the error body. Default: { type: "object", properties: { message: { type: "string" }, errors: { type: "array", items: { type: "object", properties: { instancePath: { type: "string" }, schemaPath: { type: "string" }, keyword: { type: "string" }, params: { type: "object" }, message: { type: "string" } } } }, ajv: { type: "boolean" }, validation: { type: "boolean" } } } */
  schema?: JSONSchema;
};

/**
 * Custom UI generator function that takes the spec URL and global options and returns HTML
 */
export type CustomUIGenerator = (
  specUrl: string,
  globalOptions: SwaggerGlobalOptions,
) => HTMLString;

/**
 * Type of request body for a route.
 * Common MIME types are provided as literals withintellisense,
 * custom MIME types can be specified as strings.
 */
export type SwaggerBodyType =
  | "json"
  | "form-data"
  | "urlencoded"
  | "binary"
  | "text"
  | "event-stream"
  | (string & {});

/**
 * JSONSchema type for OpenAPI/AJV-compatible schemas
 */
export type JSONSchema = {
  $id?: string;
  $schema?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  enum?: any[];
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  not?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  description?: string;
  format?: string;
  default?: any;
  title?: string;
  definitions?: Record<string, JSONSchema>;
  // ... (add more as needed for OpenAPI/AJV)
  [key: string]: any;
};

/**
 * Base options shared across all Swagger UI types
 */
type SwaggerGlobalOptionsBase = {
  /** The path to the swagger documentation, defaults to /docs for the UI and /docs/json for the raw json */
  path?: string;
  /** API title */
  title?: string;
  /** API description */
  description?: string;
  /** API version */
  version?: string;
  /** Server URLs */
  servers?: string[];
  /** Components (schemas, responses, parameters, etc.) */
  components?: Record<string, any>;
  /** Security schemes (OpenAPI 3.0 style) */
  securitySchemes?: Record<string, Security>;
  /** OpenID Connect configuration (discovery document) */
  openIdConnect?: OpenIDConnectConfig;
  /** API tags */
  tags?: Record<string, any>;
  /** Global security requirements */
  security?: Security[];
  /** External documentation */
  externalDocs?: {
    description?: string;
    url: string;
  };
  /** Info object (detailed metadata) */
  info?: {
    title: string;
    description?: string;
    version: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  /**
   * OpenAPI models to be shown in the documentation. Must be valid OpenAPI/AJV JSONSchema objects.
   */
  models?: Record<string, JSONSchema> | JSONSchema[];
  /**
   * Global configuration for validation error response documentation.
   * Applied to all routes that have validation schemas (body, query, headers, or all).
   * Can be overridden per-route via swagger.validationErrorResponse.
   * Default: { statusCode: 422, description: "Validation error" }
   */
  validationErrorResponse?: ValidationErrorResponseOptions;
};

/**
 * Global documentation options for the API (OpenAPI/Swagger style)
 */
export type SwaggerGlobalOptions =
  | (SwaggerGlobalOptionsBase & {
      /** Type of Swagger UI to use, one of 'standard', 'redoc', 'rapidoc', 'scalar', or 'elements'. Defaults to 'standard'. */
      type?: Exclude<SwaggerUIType, "custom">;
    })
  | (SwaggerGlobalOptionsBase & {
      /** Type of Swagger UI to use. When set to 'custom', customUIGenerator is required. */
      type: "custom";
      /** Custom UI generator function. Required when type is 'custom'. Must return a string of HTML that uses the given specUrl. */
      customUIGenerator: CustomUIGenerator;
    });

/**
 * Route-specific documentation options for OpenAPI/Swagger generation.
 *
 * These options are for DOCUMENTATION PURPOSES ONLY and are NOT validated or enforced at runtime.
 * For validated schemas, use the route-level `body`, `query`, and `responses` options.
 *
 * @example
 * // Document route with custom body type
 * router.get("/download", { swagger: { bodyType: "binary" } }, handler);
 *
 * @example
 * // Document authentication requirements
 * router.get("/protected", { swagger: { security: { type: "bearer" } } }, handler);
 */
export type SwaggerRouteOptions = {
  /** Service category where the route belongs to */
  service?: string;
  /** Name of the route */
  name?: string;
  /** Security requirements for this route */
  security?: Security[] | Security;
  /** Description of the route */
  description?: string;
  /** Deprecated flag */
  deprecated?: boolean;
  /** Exclude from swagger */
  excludeFromSwagger?: boolean;
  /**
   * The request body type for documentation purposes.
   * Common types: 'json', 'form-data', 'urlencoded', 'binary', 'text', 'event-stream'.
   * Custom MIME types can be specified as strings (e.g., 'application/vnd.api+json').
   * Defaults to 'json'.
   */
  bodyType?: SwaggerBodyType;
  /**
   * Override the global validation error response for this route.
   * Only applies when the route has validation schemas (body, query, headers, or all).
   * Overrides swagger global validationErrorResponse configuration.
   */
  validationErrorResponse?: ValidationErrorResponseOptions;
};

export type OAuth2Flows = {
  implicit?: OAuth2Flow;
  authorizationCode?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
  password?: OAuth2Flow;
};

export type OAuth2Flow = {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
};

export type OpenIDConnectConfig = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri: string;
  endSessionEndpoint?: string;
  introspectionEndpoint?: string;
  revocationEndpoint?: string;
  scopesSupported?: string[];
  responseTypesSupported?: string[];
  grantTypesSupported?: string[];
  tokenEndpointAuthMethodsSupported?: string[];
  subjectTypesSupported?: string[];
  idTokenSigningAlgValuesSupported?: string[];
  claimsSupported?: string[];
  codeChallengeMethodsSupported?: string[];
};

export type Security =
  | BearerOptions
  | ApiKeyOptions
  | OAuth2Options
  | OpenIdConnectOptions;

type BearerOptions = {
  type: "bearer";
  bearerFormat?: string;
  description?: string;
};

type ApiKeyOptions = {
  type: "apiKey";
  name: string;
  in: "header" | "query" | "cookie";
  description?: string;
};

type OAuth2Options = {
  type: "oauth2";
  flows: OAuth2Flows;
  description?: string;
  name?: string;
};

type OpenIdConnectOptions = {
  type: "openIdConnect";
  openIdConnectUrl: string;
  description?: string;
  name?: string;
};

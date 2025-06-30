import type { TSchema } from "@sinclair/typebox/type";

/**
 * Type of Swagger UI to use
 */
export type SwaggerUIType = "standard" | "redoc" | "rapidoc";

/**
 * Global documentation options for the API (OpenAPI/Swagger style)
 */
export type SwaggerGlobalOptions = {
  /** The path to the swagger documentation, defaults to /docs for the UI and /docs/json for the raw json */
  path?: string;
  /** Type of Swagger UI to use, one of 'standard', 'redoc', or 'rapidoc'. Defaults to 'standard'. */
  type?: SwaggerUIType;
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
  securitySchemes?: Record<string, SecurityScheme>;
  /** OpenID Connect configuration (discovery document) */
  openIdConnect?: OpenIDConnectConfig;
  /** API tags */
  tags?: Record<string, any>;
  /** Global security requirements */
  security?: Array<Record<string, string[]>>;
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
};

/**
 * Route-specific documentation options (for individual endpoints)
 */
export type SwaggerRouteOptions = {
  /** Service category where the route belongs to */
  service?: string;
  /** Name of the route */
  name?: string;
  /** Query parameters schema */
  query?: TSchema;
  /** Request body schema */
  requestBody?: TSchema;
  /** Responses for this route */
  responses?: Record<number, TSchema>;
  /** Errors for this route */
  errors?: Record<number, TSchema>;
  /** Security requirements for this route */
  security?: Array<Security>;
  /** Description of the route */
  description?: string;
  /** Deprecated flag */
  deprecated?: boolean;
};

export type Security =
  | "apiKey"
  | "none"
  | "bearer"
  | "oauth2"
  | "openIdConnect";

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

export type SecurityScheme = {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect" | "mutualTLS";
  description?: string;
  name?: string;
  in?: "header" | "query" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuth2Flows;
  openIdConnectUrl?: string;
};

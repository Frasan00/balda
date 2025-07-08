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
  security?: Security[] | Security;
  /** Description of the route */
  description?: string;
  /** Deprecated flag */
  deprecated?: boolean;
  /** Exclude from swagger */
  excludeFromSwagger?: boolean;
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

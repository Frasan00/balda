import type { ZodObject, ZodType } from "zod";
import { AjvCompileReturnType } from "../../ajv/ajv_types.js";
import type {
  SwaggerGlobalOptions,
  SwaggerRouteOptions,
} from "../../plugins/swagger/swagger_types.js";
import { router } from "../../server/router/router.js";

/**
 * Swagger plugin that serves the swagger UI and JSON specification, by default the UI will be available at /docs and the JSON specification at /docs/json
 * @warning The json specification is always available at /${globalOptions.path}/json
 * @internal
 */
export const swagger = (
  globalOptions?: SwaggerGlobalOptions | boolean,
): void => {
  let swaggerOptions: SwaggerGlobalOptions = {
    type: "standard",
    path: "/docs",
    title: "Balda API Documentation",
    description: "API Documentation from the Balda Framework",
    version: "1.0.0",
    servers: ["http://localhost"],
    security: [],
    tags: [],
    components: {},
    securitySchemes: {},
    models: {},
  };

  if (globalOptions && typeof globalOptions !== "boolean") {
    swaggerOptions = {
      ...swaggerOptions,
      ...globalOptions,
    };
  }

  const spec = generateOpenAPISpec(swaggerOptions);
  const uiPath = `${swaggerOptions.path}`;
  const jsonPath = `${uiPath}/json`;

  let uiContent: string;
  if (swaggerOptions.type === "rapidoc") {
    uiContent = generateRapiDocUI(jsonPath, swaggerOptions);
  } else if (swaggerOptions.type === "scalar") {
    uiContent = generateScalarUI(jsonPath, swaggerOptions);
  } else if (swaggerOptions.type === "elements") {
    uiContent = generateElementsUI(jsonPath, swaggerOptions);
  } else if (swaggerOptions.type === "custom") {
    uiContent = swaggerOptions.customUIGenerator(jsonPath, swaggerOptions);
  } else {
    uiContent = generateSwaggerUI(jsonPath, swaggerOptions);
  }

  router.addOrUpdate("GET", uiPath, [], (_req, res) => {
    res.html(uiContent);
  });

  router.addOrUpdate("GET", jsonPath, [], (_req, res) => {
    res.json(spec);
  });
};

/**
 * Escape HTML to prevent XSS attacks
 */
const escapeHtml = (str?: string): string => {
  if (!str) {
    return "";
  }

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

function safeToJSONSchema(
  schema: ZodType | AjvCompileReturnType | Record<string, unknown>,
): Record<string, any> {
  if (!schema || typeof schema !== "object") {
    return { type: "string" };
  }

  return schema as Record<string, unknown>;
}

function generateOpenAPISpec(globalOptions: SwaggerGlobalOptions) {
  const routes = router.getRoutes();
  const paths: Record<string, any> = {};

  // Process models - normalize to Record
  let processedModels: Record<string, Record<string, unknown>> | undefined;
  if (globalOptions.models) {
    if (Array.isArray(globalOptions.models)) {
      // Array of models: extract name from $id/title or use index
      processedModels = globalOptions.models.reduce(
        (acc, model, index) => {
          const jsonSchema = safeToJSONSchema(model);
          const schemaName =
            (jsonSchema as Record<string, string>).$id ||
            (jsonSchema as Record<string, string>).title ||
            `Model${index}`;
          acc[schemaName] = jsonSchema;
          return acc;
        },
        {} as Record<string, Record<string, unknown>>,
      );
    } else {
      // Record of models: use the key as name
      processedModels = {};
      for (const [name, model] of Object.entries(globalOptions.models)) {
        processedModels[name] = safeToJSONSchema(model);
      }
    }
  }

  const components = {
    ...globalOptions.components,
    securitySchemes: globalOptions.securitySchemes || {},
    schemas: processedModels
      ? {
          ...(globalOptions.components?.schemas || {}),
          ...processedModels,
        }
      : globalOptions.components?.schemas
        ? { ...globalOptions.components.schemas }
        : undefined,
  };

  for (const route of routes) {
    const swaggerOptions: SwaggerRouteOptions | undefined =
      route.swaggerOptions;
    if (swaggerOptions?.excludeFromSwagger) continue;

    if (!paths[route.path]) paths[route.path] = {};
    const method = route.method.toLowerCase();
    const operation: Record<string, any> = {
      summary: swaggerOptions?.name || `${method.toUpperCase()} ${route.path}`,
      description: swaggerOptions?.description || "",
      tags: swaggerOptions?.service ? [swaggerOptions.service] : [],
      deprecated: swaggerOptions?.deprecated || false,
    };

    let parameters: any[] = [];
    if (swaggerOptions?.query) {
      if (
        swaggerOptions.query.type === "object" &&
        (swaggerOptions.query as ZodObject).shape
      ) {
        for (const [name, schema] of Object.entries(
          (swaggerOptions.query as ZodObject).shape,
        )) {
          // Skip if schema is invalid
          if (!schema || typeof schema !== "object") {
            continue;
          }

          parameters.push({
            name,
            in: "query",
            required: Array.isArray(
              (swaggerOptions.query as ZodObject).shape[name].required,
            )
              ? (swaggerOptions.query as ZodObject).shape[
                  name
                ].required.includes(name)
              : false,
            schema: safeToJSONSchema(schema as ZodType),
          });
        }
      }
    }
    if (swaggerOptions && (swaggerOptions as Record<string, unknown>).params) {
      parameters = parameters.concat(
        extractPathParams(
          route.path,
          (swaggerOptions as { params?: ZodType }).params,
        ),
      );
    } else {
      parameters = parameters.concat(extractPathParams(route.path));
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (swaggerOptions?.requestBody) {
      let routeBodyContentType = "application/json";
      if (swaggerOptions.bodyType === "form-data") {
        routeBodyContentType = "multipart/form-data";
      } else if (swaggerOptions.bodyType === "urlencoded") {
        routeBodyContentType = "application/x-www-form-urlencoded";
      }
      operation.requestBody = {
        content: {
          [routeBodyContentType]: {
            schema: safeToJSONSchema(swaggerOptions.requestBody as ZodType),
          },
        },
        required: true,
      };
    } else if (
      swaggerOptions?.bodyType &&
      (swaggerOptions.bodyType.includes("form-data") ||
        swaggerOptions.bodyType.includes("urlencoded"))
    ) {
      operation.requestBody = {
        content: {
          [swaggerOptions.bodyType]: {
            schema: { type: "object" },
          },
        },
        required: true,
      };
    }

    operation.responses = {};
    if (swaggerOptions?.responses) {
      for (const [statusCode, schema] of Object.entries(
        swaggerOptions.responses,
      )) {
        operation.responses[statusCode] = {
          description: `Response for ${statusCode}`,
          content: {
            "application/json": {
              schema: safeToJSONSchema(schema),
            },
          },
        };
      }
    }
    if (swaggerOptions?.errors) {
      for (const [statusCode, schema] of Object.entries(
        swaggerOptions.errors,
      )) {
        operation.responses[statusCode] = {
          description: `Error response for ${statusCode}`,
          content: {
            "application/json": {
              schema: safeToJSONSchema(schema),
            },
          },
        };
      }
    }

    if (Object.keys(operation.responses).length === 0) {
      operation.responses["200"] = {
        description: "Successful response",
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      };
    }

    // First we try route specific security
    if (swaggerOptions?.security) {
      const securityArr: any[] = [];
      if (!Array.isArray(swaggerOptions.security)) {
        swaggerOptions.security = [swaggerOptions.security];
      }

      for (const sec of swaggerOptions.security) {
        if (sec.type === "bearer") {
          if (!components.securitySchemes.bearer) {
            components.securitySchemes.bearer = {
              type: "http",
              scheme: "bearer",
              bearerFormat: sec.bearerFormat || "JWT",
              description: sec.description,
            } as any;
          }
          securityArr.push({ bearer: [] });
        } else if (sec.type === "apiKey") {
          // Use sec.name as the scheme name
          if (!components.securitySchemes[sec.name]) {
            components.securitySchemes[sec.name] = {
              type: "apiKey",
              name: sec.name,
              in: sec.in,
              description: sec.description,
            };
          }
          securityArr.push({ [sec.name]: [] });
        } else if (sec.type === "oauth2") {
          const schemeName = sec.name || "oauth2";
          if (!components.securitySchemes[schemeName]) {
            components.securitySchemes[schemeName] = {
              type: "oauth2",
              flows: sec.flows,
              description: sec.description,
            };
          }
          securityArr.push({ [schemeName]: [] });
        } else if (sec.type === "openIdConnect") {
          const schemeName = sec.name || "openIdConnect";
          if (!components.securitySchemes[schemeName]) {
            components.securitySchemes[schemeName] = {
              type: "openIdConnect",
              openIdConnectUrl: sec.openIdConnectUrl,
              description: sec.description,
            };
          }
          securityArr.push({ [schemeName]: [] });
        }
      }
      if (securityArr.length) operation.security = securityArr;
    } else if (globalOptions.security) {
      // If no route specific security, we use the global security
      operation.security = globalOptions.security;
    }

    paths[route.path][method] = operation;
  }

  return {
    openapi: "3.0.0",
    info: {
      title: globalOptions.title,
      description: globalOptions.description,
      version: globalOptions.version,
      ...globalOptions.info,
    },
    servers: globalOptions.servers?.map((url) => ({ url })) || [{ url: "/" }],
    paths,
    components,
    security: globalOptions.security || [],
    tags: globalOptions.tags
      ? Object.entries(globalOptions.tags).map(([name, config]) => ({
          name,
          ...config,
        }))
      : [],
  };
}

function generateSwaggerUI(
  specUrl: string,
  globalOptions: SwaggerGlobalOptions,
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(globalOptions.description)}" />
    <title>${escapeHtml(globalOptions.title)}</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '${specUrl}',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                oauth2RedirectUrl: window.location.origin + '/swagger-ui/oauth2-redirect.html'
            });
        };
    </script>
</body>
</html>`;
}

function generateRapiDocUI(
  specUrl: string,
  globalOptions: SwaggerGlobalOptions,
) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(globalOptions.title)}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(globalOptions.description)}" />
    <link rel="icon" type="image/png" href="https://mrin9.github.io/RapiDoc/images/favicon.png">
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <rapi-doc
      spec-url="${specUrl}"
      render-style="read"
      layout="column"
      show-header="true"
      allow-server-selection="true"
      allow-authentication="true"
      allow-server-variables="true"
      theme="light"
      primary-color="#009688"
      regular-font="Open Sans, sans-serif"
      mono-font="Fira Mono, monospace"
      >
    </rapi-doc>
    <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
  </body>
</html>
  `;
}

function generateScalarUI(
  specUrl: string,
  globalOptions: SwaggerGlobalOptions,
) {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(globalOptions.description)}" />
    <title>${escapeHtml(globalOptions.title)}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
      data-configuration='{"spec":{"url":"${specUrl}"},"theme":"default"}'
    ></script>
    <script src="https://unpkg.com/@scalar/api-reference@latest/dist/browser/standalone.js"></script>
  </body>
</html>
  `;
}

function generateElementsUI(
  specUrl: string,
  globalOptions: SwaggerGlobalOptions,
) {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(globalOptions.description)}" />
    <title>${escapeHtml(globalOptions.title)}</title>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements@7.7.9/styles.min.css">
    <style>
      body {
        margin: 0;
        padding: 0;
        height: 100vh;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <elements-api
      apiDescriptionUrl="${specUrl}"
      router="hash"
      layout="sidebar"
    />
    <script src="https://unpkg.com/@stoplight/elements@7.7.9/web-components.min.js"></script>
  </body>
</html>
  `;
}

/**
 * Extract path parameters from a route path (e.g., /users/:id -> [{ name: "id", in: "path", required: true }])
 */
function extractPathParams(path: string, paramSchema?: ZodType): any[] {
  const params: any[] = [];
  const regex = /:([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    const name = match[1];
    let schema: Record<string, unknown> = { type: "string" };
    if (
      paramSchema &&
      (paramSchema as ZodObject).shape &&
      (paramSchema as ZodObject).shape[name]
    ) {
      schema = safeToJSONSchema(
        (paramSchema as ZodObject).shape[name] as ZodType,
      ) || {
        type: "string",
      };
    }
    params.push({
      name,
      in: "path",
      required: true,
      schema,
    });
  }
  return params;
}

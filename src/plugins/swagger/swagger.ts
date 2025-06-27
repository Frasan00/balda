import { TSchema } from "@sinclair/typebox/type";
import type {
  SwaggerGlobalOptions,
  SwaggerRouteOptions,
} from "../../plugins/swagger/swagger_types";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import { router } from "../../server/router/router";

/**
 * Swagger plugin that serves the swagger UI and JSON specification, by default the UI will be available at /docs and the JSON specification at /docs/json
 * @warning The json specification is always available at /${globalOptions.path}/json
 * @warning MUST be called after the listen method of the server or it will not work since routes from controller based routes are not added to the router until the listen method is called
 */
export const swagger = (
  globalOptions?: SwaggerGlobalOptions
): ServerRouteMiddleware => {
  globalOptions = {
    path: "/docs",
    title: "Balda API Documentation",
    description: "API Documentation from the Balda Framework",
    version: "1.0.0",
    servers: ["http://localhost"],
    security: [],
    tags: [],
    components: {},
    securitySchemes: {},
    ...globalOptions,
  };

  const spec = generateOpenAPISpec(globalOptions);
  const uiPath = `${globalOptions.path}`;
  const jsonPath = `${uiPath}/json`;
  const uiContent = generateSwaggerUI(jsonPath, globalOptions);

  router.addOrUpdate("GET", uiPath, [], (_req, res) => {
    res.html(uiContent);
  });

  router.addOrUpdate("GET", jsonPath, [], (_req, res) => {
    res.json(spec);
  });

  return (_req: Request, _res: Response, next: NextFunction) => {
    return next();
  };
};

function generateOpenAPISpec(globalOptions: SwaggerGlobalOptions) {
  const routes = router.getRoutes();
  const paths: Record<string, any> = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    const method = route.method.toLowerCase();
    const swaggerOptions: SwaggerRouteOptions | undefined =
      route.swaggerOptions;
    const operation: any = {
      summary: swaggerOptions?.name || `${method.toUpperCase()} ${route.path}`,
      description: swaggerOptions?.description || "",
      tags: swaggerOptions?.service ? [swaggerOptions.service] : [],
      deprecated: swaggerOptions?.deprecated || false,
    };

    let parameters: any[] = [];
    if (swaggerOptions?.query) {
      if (
        swaggerOptions.query.type === "object" &&
        swaggerOptions.query.properties
      ) {
        for (const [name, schema] of Object.entries(
          swaggerOptions.query.properties
        )) {
          parameters.push({
            name,
            in: "query",
            required: Array.isArray(swaggerOptions.query.required)
              ? swaggerOptions.query.required.includes(name)
              : false,
            schema: typeboxToOpenAPI(schema as TSchema),
          });
        }
      }
    }
    if (swaggerOptions && (swaggerOptions as any).params) {
      parameters = parameters.concat(
        extractPathParams(route.path, (swaggerOptions as any).params)
      );
    } else {
      parameters = parameters.concat(extractPathParams(route.path));
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (swaggerOptions?.requestBody) {
      operation.requestBody = {
        content: {
          "application/json": {
            schema: typeboxToOpenAPI(swaggerOptions.requestBody),
          },
        },
        required: true,
      };
    }

    // Responses (success)
    operation.responses = {};
    if (swaggerOptions?.responses) {
      for (const [statusCode, schema] of Object.entries(
        swaggerOptions.responses
      )) {
        operation.responses[statusCode] = {
          description: `Response for ${statusCode}`,
          content: {
            "application/json": {
              schema: typeboxToOpenAPI(schema as TSchema),
            },
          },
        };
      }
    }
    if (swaggerOptions?.errors) {
      for (const [statusCode, schema] of Object.entries(
        swaggerOptions.errors
      )) {
        operation.responses[statusCode] = {
          description: `Error response for ${statusCode}`,
          content: {
            "application/json": {
              schema: typeboxToOpenAPI(schema as TSchema),
            },
          },
        };
      }
    }
    // Default response if none provided
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

    if (swaggerOptions?.security) {
      if (swaggerOptions.security.includes("none")) {
        operation.security = [];
      } else {
        operation.security = swaggerOptions.security.map((sec) => {
          if (sec === "apiKey") {
            return { apiKey: [] };
          }
          if (sec === "bearer") {
            return { bearer: [] };
          }
          if (sec === "oauth2") {
            return { oauth2: [] };
          }
          if (sec === "openIdConnect") {
            return { openIdConnect: [] };
          }
          return {};
        });
      }
    }

    // Attach to path/method
    paths[route.path][method] = operation;
  }

  // Compose OpenAPI root object
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
    components: globalOptions.components || {},
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
  globalOptions: SwaggerGlobalOptions
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/png" href="https://fastly.jsdelivr.net/npm/@redocly/openapi-cli@1.0.2/dist/assets/favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${globalOptions.description}" />
    <title>${globalOptions.title}</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
        window.onload = () => {
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
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`;
}

/**
 * Convert a TypeBox TSchema to an OpenAPI 3.0 compatible schema (AJV compliant)
 * This is a shallow conversion, as TypeBox is already mostly JSON Schema compatible
 */
function typeboxToOpenAPI(
  schema: TSchema
): Omit<TSchema, "$id" | "$schema"> | undefined {
  if (!schema) {
    return undefined;
  }

  const { $id, $schema, ...rest } = schema;
  return rest;
}

/**
 * Extract path parameters from a route path (e.g., /users/:id -> [{ name: "id", in: "path", required: true }])
 */
function extractPathParams(path: string, paramSchema?: TSchema): any[] {
  const params: any[] = [];
  const regex = /:([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    const name = match[1];
    let schema: Record<string, unknown> = { type: "string" };
    if (
      paramSchema &&
      paramSchema.type === "object" &&
      paramSchema.properties &&
      paramSchema.properties[name]
    ) {
      schema = typeboxToOpenAPI(paramSchema.properties[name]) || {
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

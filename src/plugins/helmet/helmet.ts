import { HelmetOptions } from "./helmet_types.js";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";

/**
 * Sets common HTTP security headers
 * @param options Helmet options (all optional)
 */
export const helmet = (options?: HelmetOptions): ServerRouteMiddleware => {
  const opts = {
    dnsPrefetchControl: true,
    frameguard: { action: "SAMEORIGIN" } as boolean | { action: string },
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: false } as
      | boolean
      | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean },
    contentTypeOptions: true,
    ieNoOpen: true,
    xssLegacyHeader: false,
    xssFilter: undefined as boolean | undefined,
    referrerPolicy: "no-referrer" as false | string,
    crossOriginResourcePolicy: "same-origin" as false | string,
    crossOriginOpenerPolicy: "same-origin" as false | string,
    crossOriginEmbedderPolicy: "require-corp" as false | string,
    contentSecurityPolicy: "default-src 'self'" as false | string,
    permissionsPolicy: "camera=(), microphone=(), geolocation=()" as
      | false
      | string,
    originAgentCluster: true,
    ...options,
  };

  // xssLegacyHeader takes precedence; xssFilter is the deprecated alias
  const emitXssHeader =
    opts.xssLegacyHeader !== undefined
      ? opts.xssLegacyHeader
      : (opts.xssFilter ?? false);

  return async (_req: Request, res: Response, next: NextFunction) => {
    // X-DNS-Prefetch-Control
    if (opts.dnsPrefetchControl) {
      res.setHeader("X-DNS-Prefetch-Control", "off");
    }
    // X-Frame-Options
    if (opts.frameguard) {
      let action = "SAMEORIGIN";
      if (typeof opts.frameguard === "object") {
        action = opts.frameguard.action;
      }
      res.setHeader("X-Frame-Options", action);
    }
    // Strict-Transport-Security
    if (opts.hsts) {
      let hstsRaw: Partial<{
        maxAge: number;
        includeSubDomains: boolean;
        preload: boolean;
      }> = {};
      if (typeof opts.hsts === "object") {
        hstsRaw = opts.hsts;
      }
      const maxAge = hstsRaw.maxAge !== undefined ? hstsRaw.maxAge : 15552000;
      const includeSubDomains =
        hstsRaw.includeSubDomains !== undefined
          ? hstsRaw.includeSubDomains
          : true;
      const preload = hstsRaw.preload !== undefined ? hstsRaw.preload : false;
      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains !== false) {
        hstsValue += "; includeSubDomains";
      }
      if (preload) {
        hstsValue += "; preload";
      }
      res.setHeader("Strict-Transport-Security", hstsValue);
    }
    // X-Content-Type-Options
    if (opts.contentTypeOptions) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
    // X-Download-Options
    if (opts.ieNoOpen) {
      res.setHeader("X-Download-Options", "noopen");
    }
    // X-XSS-Protection (legacy header — disabled by default; modern CSP supersedes it)
    if (emitXssHeader) {
      res.setHeader("X-XSS-Protection", "0");
    }
    // Referrer-Policy
    if (opts.referrerPolicy) {
      res.setHeader("Referrer-Policy", opts.referrerPolicy);
    }
    // Cross-Origin-Resource-Policy
    if (opts.crossOriginResourcePolicy) {
      res.setHeader(
        "Cross-Origin-Resource-Policy",
        opts.crossOriginResourcePolicy,
      );
    }
    // Cross-Origin-Opener-Policy
    if (opts.crossOriginOpenerPolicy) {
      res.setHeader("Cross-Origin-Opener-Policy", opts.crossOriginOpenerPolicy);
    }
    // Cross-Origin-Embedder-Policy
    if (opts.crossOriginEmbedderPolicy) {
      res.setHeader(
        "Cross-Origin-Embedder-Policy",
        opts.crossOriginEmbedderPolicy,
      );
    }
    // Content-Security-Policy
    if (opts.contentSecurityPolicy) {
      res.setHeader("Content-Security-Policy", opts.contentSecurityPolicy);
    }
    // Permissions-Policy
    if (opts.permissionsPolicy) {
      res.setHeader("Permissions-Policy", opts.permissionsPolicy);
    }
    // Origin-Agent-Cluster
    if (opts.originAgentCluster) {
      res.setHeader("Origin-Agent-Cluster", "?1");
    }

    await next();
  };
};

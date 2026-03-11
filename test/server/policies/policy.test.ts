import { afterEach, describe, expect, it } from "vitest";
import { policyManager } from "../instance.js";
import { MetadataStore } from "../../../src/metadata_store.js";
import { createPolicyMiddleware } from "../../../src/server/policy/policy_middleware.js";
import type { PolicyMetadata } from "../../../src/server/policy/policy_types.js";
import {
  setPolicyErrorHandler,
  resetPolicyErrorHandler,
} from "../../../src/server/policy/policy_error_handler_registry.js";
import {
  setValidationErrorHandler,
  resetValidationErrorHandler,
} from "../../../src/server/router/validation_error_handler_registry.js";
import { wrapHandlerWithValidation } from "../../../src/server/router/validation_wrapper.js";

describe("Test Policy", () => {
  it("should return true if the user is an admin", async () => {
    expect(
      await policyManager.canAccess("test", "adminRoute", {
        id: "1",
        name: "John",
        role: "admin",
      }),
    ).toBe(true);
  });

  it("should return false if the user is not an admin", async () => {
    expect(
      await policyManager.canAccess("test", "adminRoute", {
        id: "1",
        name: "John",
        role: "user",
      }),
    ).toBe(false);
  });
});

describe("Test Policy Decorator", () => {
  const policy = policyManager.createDecorator();

  it("should store policy metadata on a class", () => {
    @policy("test", "adminRoute")
    class TestController {}

    const meta = MetadataStore.get(TestController.prototype, "__class__");
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(1);
    expect(meta.policies[0]).toEqual({
      scope: "test",
      handler: "adminRoute",
      manager: policyManager,
    });
  });

  it("should store policy metadata on a method", () => {
    class TestController {
      @policy("test", "adminRoute")
      getUser() {
        return { id: "1" };
      }
    }

    const meta = MetadataStore.get(TestController.prototype, "getUser");
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(1);
    expect(meta.policies[0]).toEqual({
      scope: "test",
      handler: "adminRoute",
      manager: policyManager,
    });
  });

  it("should accumulate multiple policies on a class", () => {
    @policy("test", "adminRoute")
    @policy("test", "adminRoute")
    class MultiPolicyController {}

    const meta = MetadataStore.get(
      MultiPolicyController.prototype,
      "__class__",
    );
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(2);
  });

  it("should accumulate multiple policies on a method", () => {
    class MultiPolicyMethodController {
      @policy("test", "adminRoute")
      @policy("test", "adminRoute")
      getUser() {
        return { id: "1" };
      }
    }

    const meta = MetadataStore.get(
      MultiPolicyMethodController.prototype,
      "getUser",
    );
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(2);
  });
});

describe("Policy Middleware", () => {
  afterEach(() => {
    resetPolicyErrorHandler();
  });

  const createMockReqRes = (role: string) => {
    const req = { user: { id: "1", name: "John", role } } as any;
    let statusCode: number | undefined;
    let sentBody: any;
    const res = {
      unauthorized: (body: any) => {
        statusCode = 401;
        sentBody = body;
      },
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            sentBody = body;
          },
        };
      },
    } as any;
    const next = () => {
      statusCode = 200;
    };
    return {
      req,
      res,
      next,
      getStatus: () => statusCode,
      getBody: () => sentBody,
    };
  };

  it("should call next when policy passes", async () => {
    const policyMeta: PolicyMetadata[] = [
      { scope: "test", handler: "adminRoute", manager: policyManager },
    ];
    const middleware = createPolicyMiddleware(policyMeta);
    const { req, res, next, getStatus } = createMockReqRes("admin");
    // Policy expects user directly, not req — mock canAccess
    const testManager = {
      canAccess: async () => true,
    };
    const mw = createPolicyMiddleware([
      { scope: "test", handler: "adminRoute", manager: testManager as any },
    ]);
    await mw(req, res, next);
    expect(getStatus()).toBe(200);
  });

  it("should return unauthorized when policy fails (default handler)", async () => {
    const testManager = {
      canAccess: async () => false,
    };
    const mw = createPolicyMiddleware([
      { scope: "test", handler: "adminRoute", manager: testManager as any },
    ]);
    const { req, res, next, getStatus, getBody } = createMockReqRes("user");
    await mw(req, res, next);
    expect(getStatus()).toBe(401);
    expect(getBody()).toEqual({ error: "Unauthorized" });
  });

  it("should use custom policy error handler when set", async () => {
    setPolicyErrorHandler((req, res) => {
      res.status(403).json({ code: "FORBIDDEN" });
    });

    const testManager = {
      canAccess: async () => false,
    };
    const mw = createPolicyMiddleware([
      { scope: "test", handler: "adminRoute", manager: testManager as any },
    ]);
    const { req, res, next, getStatus, getBody } = createMockReqRes("user");
    await mw(req, res, next);
    expect(getStatus()).toBe(403);
    expect(getBody()).toEqual({ code: "FORBIDDEN" });
  });

  it("should enforce multiple policies in order", async () => {
    const callOrder: string[] = [];
    const manager1 = {
      canAccess: async () => {
        callOrder.push("policy1");
        return true;
      },
    };
    const manager2 = {
      canAccess: async () => {
        callOrder.push("policy2");
        return true;
      },
    };
    const mw = createPolicyMiddleware([
      { scope: "a", handler: "h1", manager: manager1 as any },
      { scope: "b", handler: "h2", manager: manager2 as any },
    ]);
    const { req, res, next, getStatus } = createMockReqRes("admin");
    await mw(req, res, next);
    expect(getStatus()).toBe(200);
    expect(callOrder).toEqual(["policy1", "policy2"]);
  });

  it("should short-circuit on first failing policy", async () => {
    const callOrder: string[] = [];
    const manager1 = {
      canAccess: async () => {
        callOrder.push("policy1");
        return false;
      },
    };
    const manager2 = {
      canAccess: async () => {
        callOrder.push("policy2");
        return true;
      },
    };
    const mw = createPolicyMiddleware([
      { scope: "a", handler: "h1", manager: manager1 as any },
      { scope: "b", handler: "h2", manager: manager2 as any },
    ]);
    const { req, res, next, getStatus } = createMockReqRes("user");
    await mw(req, res, next);
    expect(getStatus()).toBe(401);
    expect(callOrder).toEqual(["policy1"]);
  });
});

describe("Validation Error Handler", () => {
  afterEach(() => {
    resetValidationErrorHandler();
  });

  it("should use default badRequest when no custom handler is set", async () => {
    let statusCode: number | undefined;
    let sentBody: any;
    const req = {
      validate: () => {
        throw new Error("validation failed");
      },
    } as any;
    const res = {
      badRequest: (body: any) => {
        statusCode = 400;
        sentBody = body;
      },
    } as any;

    const handler = wrapHandlerWithValidation(() => {}, {
      body: {} as any,
    });
    await handler(req, res);
    expect(statusCode).toBe(400);
    expect(sentBody).toBeInstanceOf(Error);
  });

  it("should use custom validation error handler when set", async () => {
    let statusCode: number | undefined;
    let sentBody: any;
    setValidationErrorHandler((req, res, error) => {
      res.status(422).json({ code: "CUSTOM_VALIDATION", error: String(error) });
    });

    const req = {
      validate: () => {
        throw new Error("bad input");
      },
    } as any;
    const res = {
      badRequest: () => {},
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            sentBody = body;
          },
        };
      },
    } as any;

    const handler = wrapHandlerWithValidation(() => {}, {
      body: {} as any,
    });
    await handler(req, res);
    expect(statusCode).toBe(422);
    expect(sentBody).toEqual({
      code: "CUSTOM_VALIDATION",
      error: "Error: bad input",
    });
  });
});

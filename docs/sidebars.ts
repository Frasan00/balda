import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    "ai-agent-guide",
    {
      type: "category",
      label: "Getting Started",
      items: [
        "getting-started/installation",
        "getting-started/packages",
        "getting-started/quick-start",
        "getting-started/configuration",
        "getting-started/development",
      ],
    },
    {
      type: "category",
      label: "Commands",
      items: [
        "commands/overview",
        {
          type: "category",
          label: "Built-in Commands",
          items: [
            "commands/built-ins/init",
            "commands/built-ins/init-queue",
            "commands/built-ins/init-mailer",
            "commands/built-ins/list",
            "commands/built-ins/setup-storage",
            "commands/built-ins/serve",
            "commands/built-ins/generate-command",
            "commands/built-ins/generate-plugin",
            "commands/built-ins/generate-cron",
            "commands/built-ins/generate-queue",
            "commands/built-ins/generate-controller",
            "commands/built-ins/generate-middleware",
            "commands/built-ins/generate-sdk",
            "commands/built-ins/build",
            "commands/built-ins/cron-start",
            "commands/built-ins/queue-start",
            "commands/built-ins/key-generate",
          ],
        },
        "commands/custom",
      ],
    },
    {
      type: "category",
      label: "Core Concepts",
      items: [
        "core-concepts/server",
        "core-concepts/controllers",
        "core-concepts/routing",
        "core-concepts/api-styles",
        "core-concepts/middleware",
        "core-concepts/request-response",
        "core-concepts/streaming",
        "core-concepts/hashing",
        "core-concepts/logger",
        "core-concepts/policies",
        "core-concepts/error-handling",
        "core-concepts/serializer",
      ],
    },
    {
      type: "category",
      label: "Performance & Monitoring",
      items: ["performance/cache-monitoring"],
    },
    {
      type: "category",
      label: "Caching",
      items: [
        "cache/overview",
        "cache/providers",
        "cache/cache-keys",
        "cache/invalidation",
        "cache/advanced",
      ],
    },
    {
      type: "category",
      label: "WebSockets",
      items: ["websockets/overview"],
    },
    {
      type: "category",
      label: "GraphQL",
      items: ["graphql/overview"],
    },
    {
      type: "category",
      label: "Plugins",
      items: [
        "plugins/overview",
        "plugins/body-parser",
        {
          type: "category",
          label: "Security",
          items: [
            "plugins/cors",
            "plugins/helmet",
            "plugins/rate-limiter",
            "plugins/trust-proxy",
          ],
        },
        {
          type: "category",
          label: "Utilities",
          items: [
            "plugins/compression",
            "plugins/method-override",
            "plugins/static",
            "plugins/cookie",
            "plugins/log",
            "plugins/async-local-storage",
          ],
        },
        "plugins/swagger",
      ],
    },
    {
      type: "category",
      label: "Examples",
      items: ["examples/rest-api"],
    },
    {
      type: "category",
      label: "Testing",
      items: ["testing/overview", "testing/mock-server", "testing/examples"],
    },
    {
      type: "category",
      label: "Deployment",
      items: [
        "deployment/overview",
        "deployment/fetch-handler",
        "deployment/aws-lambda",
      ],
    },
    {
      type: "category",
      label: "Cron",
      items: ["cron/overview", "cron/programmatic", "cron/ui"],
    },
    {
      type: "category",
      label: "Queues",
      items: [
        "queues/overview",
        "queues/programmatic",
        "queues/publishing",
        "queues/providers",
      ],
    },
    {
      type: "category",
      label: "MQTT",
      items: ["mqtt/overview", "mqtt/programmatic"],
    },
    {
      type: "category",
      label: "Storage",
      items: ["storage/overview"],
    },
    {
      type: "category",
      label: "Mailer",
      items: ["mailer/overview"],
    },
    {
      type: "category",
      label: "Express Compatibility",
      items: ["express/overview"],
    },
    {
      type: "category",
      label: "Better Auth",
      items: ["better-auth/overview"],
    },
  ],
};

export default sidebars;

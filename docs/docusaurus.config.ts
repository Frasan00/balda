import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Balda",
  tagline:
    "Simple cross-runtime, fastapi-inspired Node.js backend framework for Node.js, Bun, and Deno",
  favicon: "img/logo.svg",

  future: {
    v4: true,
  },

  // Set the production url of your site here
  url: "https://frasan00.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/balda/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "Frasan00", // Usually your GitHub org/user name.
  projectName: "balda", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  headTags: [
    // Standard meta tags
    {
      tagName: "meta",
      attributes: {
        name: "description",
        content:
          "Balda - A cross-runtime backend framework for Node.js, Bun, and Deno. Build fast APIs with decorators, validation, WebSocket, GraphQL, queues, and cron jobs.",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "keywords",
        content:
          "balda, node.js, bun, deno, backend framework, api, typescript, decorators, rest api, graphql, websocket",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "author",
        content: "Francesco Sangiovanni",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "robots",
        content: "index, follow",
      },
    },
    // Open Graph / Facebook
    {
      tagName: "meta",
      attributes: {
        property: "og:type",
        content: "website",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:title",
        content: "Balda - Cross-Runtime Backend Framework",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:description",
        content:
          "Build fast APIs with decorators, validation, WebSocket, GraphQL, queues, and cron jobs. Runs on Node.js, Bun, and Deno.",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:image",
        content: "/balda/img/logo.svg",
      },
    },
    {
      tagName: "meta",
      attributes: {
        property: "og:url",
        content: "https://frasan00.github.io/balda/",
      },
    },
    // Twitter
    {
      tagName: "meta",
      attributes: {
        name: "twitter:card",
        content: "summary_large_image",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:title",
        content: "Balda - Cross-Runtime Backend Framework",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:description",
        content:
          "Build fast APIs with decorators, validation, WebSocket, GraphQL, queues, and cron jobs. Runs on Node.js, Bun, and Deno.",
      },
    },
    {
      tagName: "meta",
      attributes: {
        name: "twitter:image",
        content: "/balda/img/logo.svg",
      },
    },
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/Frasan00/balda/tree/main/docs/",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          editUrl: "https://github.com/Frasan00/balda/tree/main/docs/blog",
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
          blogSidebarCount: "ALL",
          blogTitle: "Balda Blog",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
        sitemap: {
          changefreq: "weekly",
          priority: 0.5,
          ignorePatterns: ["/tags/**"],
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        indexDocs: true,
        indexBlog: false,
        indexPages: true,
        hashed: true,
        language: ["en"],
        searchResultLimits: 10,
        searchResultContextMaxLength: 80,
        explicitSearchResultPath: true,
      },
    ],
  ],

  themeConfig: {
    image: "img/logo.svg",
    navbar: {
      title: "Balda",
      logo: {
        alt: "Balda Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Documentation",
        },
        // { to: "/blog", label: "Blog", position: "left" },
        {
          type: "html",
          position: "right",
          value: '<span class="badge badge--secondary">Beta</span>',
        },
        {
          href: "https://github.com/Frasan00/balda",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      logo: {
        alt: "Balda Logo",
        src: "img/logo.svg",
        width: 100,
        height: 100,
      },
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "Getting Started",
              to: "/docs/getting-started/installation",
            },
            {
              label: "Core Concepts",
              to: "/docs/core-concepts/server",
            },
            {
              label: "Plugins",
              to: "/docs/plugins/overview",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/Frasan00/balda",
            },
            {
              label: "Issues",
              href: "https://github.com/Frasan00/balda/issues",
            },
            {
              label: "Discussions",
              href: "https://github.com/Frasan00/balda/discussions",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Balda. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["typescript", "bash", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

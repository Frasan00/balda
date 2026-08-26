---
title: Static Plugin
description: Serve static files with automatic MIME type detection, caching, and security. Configure directories and paths.
keywords: [balda, static files, serve, assets, images, css, javascript]
sidebar_position: 4
---

# Static Plugin

Serves static files from a specified directory. Automatically handles MIME type detection, file serving, and security.

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    static: {
      source: "public", // File system directory
      path: "/public", // URL path
    },
  },
});
```

## Configuration

Both `source` and `path` are **required**:

```typescript
static: {
  source: string,  // File system directory path
  path: string     // URL path where files are served
}
```

### Examples

```typescript
// Serve from 'public' at '/public'
static: {
  source: 'public',
  path: '/public'
}

// Serve from 'tmp/assets' at '/assets'
static: {
  source: 'tmp/assets',
  path: '/assets'
}

// Serve uploads from storage
static: {
  source: 'storage/uploads',
  path: '/uploads'
}

// Serve build output
static: {
  source: 'dist/client',
  path: '/app'
}
```

## Usage

### Directory Structure

```
public/
  ├── index.html
  ├── css/
  │   └── style.css
  ├── js/
  │   └── app.js
  └── images/
      └── logo.png
```

```typescript
const server = new Server({
  plugins: {
    static: {
      source: "public",
      path: "/public",
    },
  },
});

// Files available at:
// http://localhost:3000/public/index.html
// http://localhost:3000/public/css/style.css
// http://localhost:3000/public/js/app.js
// http://localhost:3000/public/images/logo.png
```

### Separate Source and Path

```typescript
static: {
  source: 'tmp/assets',  // File system: ./tmp/assets/test.pdf
  path: '/assets'        // URL: http://localhost:3000/assets/test.pdf
}
```

## MIME Type Detection

Automatically detects content types for common file extensions:

| Extension         | MIME Type                 | Description      |
| ----------------- | ------------------------- | ---------------- |
| `.html`           | `text/html`               | HTML files       |
| `.css`            | `text/css`                | CSS stylesheets  |
| `.js`             | `application/javascript`  | JavaScript files |
| `.png`            | `image/png`               | PNG images       |
| `.jpg`, `.jpeg`   | `image/jpeg`              | JPEG images      |
| `.gif`            | `image/gif`               | GIF images       |
| `.svg`            | `image/svg+xml`           | SVG images       |
| `.json`           | `application/json`        | JSON files       |
| `.txt`            | `text/plain`              | Text files       |
| `.pdf`            | `application/pdf`         | PDF files        |
| `.mp4`            | `video/mp4`               | MP4 videos       |
| `.webp`           | `image/webp`              | WebP images      |
| `.woff`, `.woff2` | `font/woff`, `font/woff2` | Font files       |

And many more common file types...

## Security

- Only serves files from the specified `source` directory
- Prevents directory traversal attacks
- Returns 404 for files outside source directory

## Error Handling

### File Not Found

```typescript
// Request: GET /public/nonexistent.jpg
// Response: 404 Not Found
{
  "error": "File not found"
}
```

### Directory Access

```typescript
// Request: GET /public/../../../etc/passwd
// Response: 404 Not Found
{
  "error": "File not found"
}
```

## Common Patterns

### Frontend Assets

```typescript
static: {
  source: 'public',
  path: '/assets'
}
```

### User Uploads

```typescript
static: {
  source: 'storage/uploads',
  path: '/uploads'
}
```

### Build Output

```typescript
static: {
  source: 'dist/client',
  path: '/app'
}
```

### Multiple Static Directories

Use multiple server instances or mount paths:

```typescript
const server = new Server({
  plugins: {
    static: {
      source: "public",
      path: "/public",
    },
  },
});

// For uploads, create a separate configuration or use dynamic routes
```

## Performance Tips

- Serve static files through a CDN in production
- Use a reverse proxy (nginx, Caddy) for better performance
- Enable caching headers for static assets
- Consider using object storage (S3) for user uploads

---
title: Body Parser Plugin
description: Parse JSON, URL-encoded, and multipart/form-data request bodies. Web API compatibility for streaming and file uploads.
keywords: [balda, body parser, json, multipart, form data, upload]
sidebar_position: 3
---

# Body Parser

Balda includes a unified body parser middleware that automatically handles multiple content types. When enabled, it populates `req.body` with the parsed request data based on the `Content-Type` header.

:::info Web API Compatibility Layer
Balda's Request and Response classes provide compatibility layers for seamless interoperability with Web API objects:

- **`Request.fromRequest(webRequest)`**: Converts Web API Request to Balda Request
- **`req.toWebApi()`**: Converts Balda Request back to Web API Request
- **`Response.toWebResponse(baldaRes)`**: Converts Balda Response to Web API Response
- **`req.body`**: The parsed body set by body parser middleware (default: `undefined`). **Use this in your route handlers**.
- **`req.bodyUsed`**: Boolean flag indicating if the body has been read (prevents double-reading errors)
  :::

## Supported Content Types

The body parser middleware automatically detects and parses three content types:

| Content Type                        | Plugin Setting | Parses To                                      |
| ----------------------------------- | -------------- | ---------------------------------------------- |
| `application/json`                  | `json`         | JavaScript object                              |
| `application/x-www-form-urlencoded` | `urlencoded`   | JavaScript object                              |
| `multipart/form-data`               | `file`         | Files available via `req.file` and `req.files` |

## Body Parser Behavior

### Without Body Parser Plugin

When **no body parser plugins are enabled**, `req.body` remains `undefined` for all requests. This is the default behavior:

```typescript
const server = new Server({
  // No body parser plugins configured
});

// In your route handler:
@post('/users')
async createUser(req: Request, res: Response) {
  console.log(req.body); // undefined

  // To read the raw body, use:
  const rawBody = await req.toWebApi().arrayBuffer();
}
```

### With Body Parser Plugin

When **body parser plugins are enabled**, `req.body` is automatically populated based on the request's `Content-Type` header.

:::note Method Restrictions
Body parsing is **only applied** to methods that can have a request body:

- ✅ `POST`, `PUT`, `PATCH`
- ❌ `GET`, `DELETE`, `OPTIONS` (body remains `undefined`)

This is by design to follow HTTP semantics and optimize performance.
:::

| Content Type                        | Behavior            | `req.body` Value                                |
| ----------------------------------- | ------------------- | ----------------------------------------------- |
| `application/json`                  | Parsed as JSON      | JavaScript object                               |
| `application/x-www-form-urlencoded` | Parsed as form data | JavaScript object                               |
| `multipart/form-data`               | Files extracted     | Files in `req.files`, form fields in `req.body` |
| `text/*` (e.g., `text/plain`)       | Decoded as string   | String                                          |
| **All other types**                 | Raw binary data     | `ArrayBuffer`                                   |

:::tip Fallback Behavior
For **unhandled content types** (like `application/octet-stream`, `application/pdf`, custom MIME types, etc.), the body parser automatically provides the raw body as an `ArrayBuffer`. This allows you to implement custom parsers for specialized content types.

```typescript
@post('/upload')
async handleCustomFormat(req: Request, res: Response) {
  // For content type "application/custom"
  const buffer = req.body as ArrayBuffer; // Raw binary data

  // Implement your custom parsing logic
  const customData = parseCustomFormat(buffer);

  res.json({ success: true });
}
```

:::

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    json: { sizeLimit: "10mb" },
    urlencoded: { limit: 2 * 1024 * 1024 },
    file: { maxFileSize: "5mb" },
  },
});
```

---

## JSON Parsing

Parses `application/json` request bodies and populates `req.body` with the parsed JavaScript object.

### Configuration

```typescript
plugins: {
  json: {
    sizeLimit: "100kb",              // Maximum body size (default: "100kb")
    parseEmptyBodyAsObject: false,   // Parse empty body as {} (default: false)
    encoding: 'utf-8',               // Text encoding (default: 'utf-8')
    customErrorMessage: {            // Custom error response (optional)
      status: 413,
      message: 'Payload too large'
    }
  }
}
```

### Usage Example

```typescript
@controller("/api")
export class ApiController {
  @post("/users")
  async createUser(req: Request, res: Response) {
    const { name, email } = req.body; // Automatically parsed when using body parser middleware with json setting
    res.created({ name, email });
  }
}
```

### JSON Configuration Options

| Option                   | Type    | Default   | Description                                     |
| ------------------------ | ------- | --------- | ----------------------------------------------- |
| `sizeLimit`              | string  | `"100kb"` | Maximum request body size (`kb` or `mb`)        |
| `parseEmptyBodyAsObject` | boolean | `false`   | Parse empty body as `{}` instead of `undefined` |
| `encoding`               | string  | `'utf-8'` | Text encoding for decoding                      |
| `customErrorMessage`     | object  | -         | Custom error response for size limit            |

### JSON Error Responses

#### Size Limit Exceeded

```json
// Response: 413 Payload Too Large
{
  "error": "ERR_REQUEST_BODY_TOO_LARGE"
}
```

#### Invalid JSON

```json
// Response: 400 Bad Request
{
  "error": "Invalid JSON syntax"
}
```

### JSON Content-Type Detection

Automatically parses requests with:

- `application/json`
- `application/json; charset=utf-8`

### Supported HTTP Methods

- **Parsed**: POST, PUT, PATCH
- **Ignored**: GET, DELETE, HEAD, OPTIONS

---

## URL-Encoded Form Parsing

Parses `application/x-www-form-urlencoded` request bodies (HTML form submissions) and populates `req.body` with the parsed data.

### Configuration

```typescript
plugins: {
  urlencoded: {
    limit: 1048576,           // Maximum body size in bytes (default: 1MB)
    extended: false,          // Parse rich objects and arrays (default: false)
    charset: 'utf8',          // Character encoding (default: 'utf8')
    allowEmpty: true,         // Allow empty values (default: true)
    parameterLimit: 1000      // Maximum number of parameters (default: 1000)
  }
}
```

Or enable with defaults:

```typescript
plugins: {
  urlencoded: true; // Use default settings
}
```

### Usage Example

```typescript
@controller("/api")
export class FormController {
  @post("/submit")
  async handleSubmit(req: Request, res: Response) {
    const { name, email, message } = req.body; // Automatically parsed when using body parser middleware with urlencoded setting

    res.json({
      received: { name, email, message },
    });
  }
}
```

### HTML Form Example

```html
<form action="/api/submit" method="POST">
  <input type="text" name="name" value="John" />
  <input type="email" name="email" value="john@example.com" />
  <textarea name="message">Hello!</textarea>
  <button type="submit">Submit</button>
</form>

<!-- Body sent: name=John&email=john@example.com&message=Hello! -->
```

### Extended Parsing

With `extended: true`, parse nested objects and arrays:

```html
<form action="/api/user" method="POST">
  <input name="user[name]" value="John" />
  <input name="user[email]" value="john@example.com" />
  <input name="tags[]" value="developer" />
  <input name="tags[]" value="designer" />
</form>
```

```typescript
@post('/user')
async createUser(req: Request, res: Response) {
  console.log(req.body);  // Automatically parsed when using body parser middleware with urlencoded setting
  // {
  //   user: { name: 'John', email: 'john@example.com' },
  //   tags: ['developer', 'designer']
  // }
}
```

### URL-Encoded Configuration Options

| Option           | Type    | Default         | Description                   |
| ---------------- | ------- | --------------- | ----------------------------- |
| `limit`          | number  | `1048576` (1MB) | Maximum body size in bytes    |
| `extended`       | boolean | `false`         | Parse rich objects and arrays |
| `charset`        | string  | `'utf8'`        | Character encoding            |
| `allowEmpty`     | boolean | `true`          | Allow empty values            |
| `parameterLimit` | number  | `1000`          | Maximum parameters to parse   |

### URL-Encoded Error Responses

#### Body Too Large

```json
// Response: 413 Payload Too Large
{
  "error": "Request body exceeds limit"
}
```

#### Too Many Parameters

```json
// Response: 400 Bad Request
{
  "error": "Too many parameters"
}
```

---

## File Upload Parsing

Handles `multipart/form-data` file uploads with comprehensive security features. Automatically parses uploaded files and provides access through `req.file` and `req.files`.

### Configuration

```typescript
plugins: {
  file: {
    maxFileSize: '5mb',       // Maximum size per file (default: '1mb')
    maxFiles: 10,             // Maximum number of files (default: 10)
    allowedMimeTypes: [       // Whitelist of allowed MIME types (default: [] - all allowed)
      'image/jpeg',
      'image/png',
      'application/pdf'
    ]
  }
}
```

### Usage Example

#### Single File Upload

```typescript
@controller("/api")
export class UploadController {
  @post("/upload")
  async uploadFile(req: Request, res: Response) {
    const file = req.file; // Single file

    if (!file) {
      return res.badRequest({ error: "No file uploaded" });
    }

    res.json({
      filename: file.filename,
      originalFilename: file.originalFilename,
      size: file.size,
      mimeType: file.mimeType,
      path: file.path,
    });
  }
}
```

#### Multiple Files Upload

```typescript
@post('/upload/multiple')
async uploadMultiple(req: Request, res: Response) {
  const files = req.files;  // Array of files

  if (!files || files.length === 0) {
    return res.badRequest({ error: 'No files uploaded' });
  }

  const fileInfos = files.map(f => ({
    filename: f.filename,
    size: f.size,
    mimeType: f.mimeType
  }));

  res.json({ files: fileInfos });
}
```

### HTML File Upload Form

```html
<!-- Single file -->
<form action="/api/upload" method="POST" enctype="multipart/form-data">
  <input type="file" name="file" />
  <button type="submit">Upload</button>
</form>

<!-- Multiple files -->
<form action="/api/upload/multiple" method="POST" enctype="multipart/form-data">
  <input type="file" name="files" multiple />
  <button type="submit">Upload Files</button>
</form>
```

### File Object

Each uploaded file contains:

```typescript
{
  filename: string; // Sanitized filename (e.g., "avatar.png")
  originalFilename: string; // Original uploaded filename
  path: string; // Temporary file path
  size: number; // File size in bytes
  mimeType: string; // MIME type (e.g., "image/png")
}
```

### File Configuration Options

| Option             | Type     | Default | Description                                   |
| ------------------ | -------- | ------- | --------------------------------------------- |
| `maxFileSize`      | string   | `'1mb'` | Maximum size per file (`kb` or `mb`)          |
| `maxFiles`         | number   | `10`    | Maximum number of files per request           |
| `allowedMimeTypes` | string[] | `[]`    | Whitelist of allowed MIME types (empty = all) |

### Security Features

#### Filename Sanitization

Automatically removes:

- Path traversal (`../`)
- Directory separators (`/`, `\`)
- Null bytes
- Control characters

```typescript
// Input: "../../../etc/passwd"
// Sanitized: "etcpasswd"

// Input: "file\x00.txt"
// Sanitized: "file.txt"
```

#### Cryptographically Secure Temporary Files

Temporary files use UUID-based filenames to prevent:

- Filename collisions
- Predictable paths
- Overwriting attacks

#### Automatic Cleanup

Temporary files are automatically deleted after request completion, even if errors occur.

### File Error Responses

#### File Too Large

```json
// Response: 413 Payload Too Large
{
  "error": "File size exceeds limit"
}
```

#### Too Many Files

```json
// Response: 400 Bad Request
{
  "error": "Too many files. Maximum 10 allowed"
}
```

#### Invalid MIME Type

```json
// Response: 400 Bad Request
{
  "error": "Invalid file type. Allowed: image/jpeg, image/png"
}
```

#### Missing Content-Type

```json
// Response: 400 Bad Request
{
  "error": "Content-Type must be multipart/form-data"
}
```

---

## Complete Configuration Example

```typescript
import { Server } from "balda";

const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  port: 3000,
  plugins: {
    // JSON parsing
    json: {
      sizeLimit: isProduction ? "1mb" : "10mb",
      parseEmptyBodyAsObject: false,
      encoding: "utf-8",
    },

    // URL-encoded form parsing
    urlencoded: {
      limit: 2 * 1024 * 1024, // 2MB
      extended: true, // Support nested objects
      charset: "utf8",
    },

    // File upload parsing
    file: {
      maxFileSize: "10mb",
      maxFiles: 5,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
      ],
    },
  },
});
```

---

## Common Use Cases

### API Endpoint (JSON)

```typescript
plugins: {
  json: {
    sizeLimit: "10mb";
  }
}
```

### Contact Form (URL-encoded)

```typescript
plugins: {
  urlencoded: {
    limit: 1 * 1024 * 1024,  // 1MB
    extended: false
  }
}
```

### User Registration with Profile Picture

```typescript
plugins: {
  json: { sizeLimit: "1mb" },
  file: {
    maxFileSize: '2mb',
    maxFiles: 1,
    allowedMimeTypes: ['image/jpeg', 'image/png']
  }
}
```

### Document Upload API

```typescript
plugins: {
  json: { sizeLimit: "1mb" },
  file: {
    maxFileSize: '10mb',
    maxFiles: 3,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  }
}
```

---

## Best Practices

### 1. Set Appropriate Size Limits

```typescript
plugins: {
  json: { sizeLimit: "10mb" },        // For API payloads
  urlencoded: { limit: 1048576 },     // For HTML forms (1MB)
  file: { maxFileSize: "50mb" }       // For file uploads
}
```

### 2. Use Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

plugins: {
  json: {
    sizeLimit: isProduction ? "1mb" : "10mb";
  }
}
```

### 3. Validate MIME Types for File Uploads

```typescript
plugins: {
  file: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif"];
  }
}
```

### 4. Handle Empty Bodies Explicitly

```typescript
@post('/health')
async healthCheck(req: Request, res: Response) {
  if (req.body === undefined) {
    // Handle empty body case
    res.json({ status: 'ok', body: 'empty' });
  }
}
```

### 5. Store Uploaded Files Securely

```typescript
@post('/upload')
async handleUpload(req: Request, res: Response) {
  const file = req.file;

  // Move to permanent storage (e.g., S3, cloud storage)
  await moveFile(file.path, `uploads/${file.filename}`);

  res.json({ success: true, filename: file.filename });
}
```

---

## Performance Tips

- Set reasonable size limits to prevent memory issues
- Use file uploads for large payloads instead of JSON
- Enable `extended: false` for URL-encoded parsing if you don't need nested objects
- Use `allowedMimeTypes` to prevent unwanted file uploads
- Store files in object storage (S3, etc.) for production
- Validate file contents, not just MIME types

---

## Disabling Body Parsers

You can disable any of the body parsers by setting them to `false`:

```typescript
plugins: {
  json: false,        // Disable JSON parsing
  urlencoded: false,  // Disable URL-encoded parsing
  file: false         // Disable file uploads
}
```

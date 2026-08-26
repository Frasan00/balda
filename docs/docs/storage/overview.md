---
title: Storage
description: Unified file storage interface for S3, Azure Blob, and local filesystem. Upload, download, and manage files.
keywords: [balda, storage, s3, azure blob, files, upload]
sidebar_position: 1
---

# Storage

Balda provides a unified storage interface for managing files across different storage providers (S3, Azure Blob, Local). Install only the driver for the provider you use (e.g. `pnpm add @aws-sdk/client-s3` for S3 on Node/Deno, or `pnpm add @azure/storage-blob` for Azure). The local provider needs no extra driver. On Bun, the S3 provider uses Bun's native `Bun.S3Client` and needs no AWS SDK for puts/gets/presigned URLs.

## Quick Setup

Use the `init-storage` command to install dependencies and create configuration:

```bash
npx balda init-storage -t s3
npx balda init-storage -t azure
npx balda init-storage -t local
```

**Flags:**

- `-t, --type <provider>`: Storage provider (`s3`, `azure`, `local`) - **required**
- `-o, --output <path>`: Output directory (default: `src/storage/`)

**Example with custom output:**

```bash
npx balda init-storage -t s3 -o src/config/
```

## What It Does

1. **Checks dependencies** - Skips installation if already present
2. **Installs required packages:**
   - **S3 (Node.js / Deno)**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/cloudfront-signer` (only if you use CloudFront)
   - **S3 (Bun)**: No AWS SDK needed — uses Bun's native `Bun.S3Client`. Only install `@aws-sdk/cloudfront-signer` if you use CloudFront, and `@aws-sdk/client-s3` if you call `listObjects`.
   - **Azure**: `@azure/storage-blob`
   - **Local**: No dependencies
3. **Creates config file** - Generates `{type}.config.ts` with templates

## Generated Configuration

### S3 Example

```ts
import { S3StorageProvider } from "balda";

export const s3Provider = new S3StorageProvider({
  s3ClientConfig: {
    bucketName: process.env.S3_BUCKET || "your-bucket-name",
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  },
  // Optional CloudFront signed URLs
  cloudfrontOptions: {
    domainName: process.env.CLOUDFRONT_DOMAIN || "",
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID || "",
    privateKey: process.env.CLOUDFRONT_PRIVATE_KEY || "",
  },
});
```

:::note Bun runtime
On **Bun**, `S3StorageProvider` uses Bun's native `Bun.S3Client` automatically — no `@aws-sdk/client-s3` or `@aws-sdk/s3-request-presigner` needed. Balda detects the runtime at construction time, so the **exact same config** above works unchanged.

- **Bun-native** (no AWS SDK): `putObject`, `getObject`, `deleteObject`, `getUploadUrl` and `getDownloadUrl` (presigned URLs via `Bun.S3Client.presign()`).
- **Still requires the AWS SDK**: `listObjects` (needs `@aws-sdk/client-s3`), and CloudFront signed URLs (needs `@aws-sdk/cloudfront-signer` when `cloudfrontOptions` is set).
:::

### Azure Example

```ts
import { AzureBlobStorageProvider } from "balda";

export const azureProvider = new AzureBlobStorageProvider({
  containerName: process.env.AZURE_CONTAINER_NAME || "your-container-name",
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || "",
  storageAccountName: process.env.AZURE_STORAGE_ACCOUNT || "",
  storageAccountKey: process.env.AZURE_STORAGE_KEY || "",
});
```

### Local Example

```ts
import { LocalStorageProvider } from "balda";

export const localProvider = new LocalStorageProvider({
  directory: process.env.LOCAL_STORAGE_DIR || "./storage",
});
```

:::warning
LocalStorageProvider does not support signed URLs (`getDownloadUrl`/`getUploadUrl`). Use S3 or Azure Blob storage for presigned URL functionality.
:::

## Usage

### Basic Operations

```ts
import { Storage } from "balda";
import { s3Provider } from "./storage/s3.config";

const storage = new Storage({ s3: s3Provider }, { defaultProvider: "s3" });

// Upload file
await storage.putObject("uploads/file.pdf", fileBuffer);

// Get download URL (expires in 3600 seconds by default)
// Note: Not supported with LocalStorageProvider
const url = await storage.getDownloadUrl("uploads/file.pdf", 7200);

// List files
const files = await storage.listObjects("uploads/");

// Download file (raw bytes)
const fileData = await storage.getObject("uploads/file.pdf");

// Delete file
await storage.deleteObject("uploads/file.pdf");
```

### Return Types

The `getObject` method supports different return types via a second parameter:

```ts
// Raw bytes (default) - returns Uint8Array
const rawData = await storage.getObject("file.pdf", "raw");
const rawData2 = await storage.getObject("file.pdf"); // same as "raw"

// Text string - returns string
const textContent = await storage.getObject("document.txt", "text");
console.log(textContent); // "Hello, World!"

// ReadableStream - for large files or streaming
const stream = await storage.getObject("video.mp4", "stream");
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process chunk
}
```

**When to use each:**

- **`"raw"`** (default): Small to medium files, need binary data
- **`"text"`**: Text files, need string content directly
- **`"stream"`**: Large files, need to process data incrementally

````

### Multiple Providers

```ts
import { Storage } from "balda";
import { s3Provider } from "./storage/s3.config";
import { localProvider } from "./storage/local.config";

const storage = new Storage(
  {
    s3: s3Provider,
    local: localProvider,
  },
  { defaultProvider: "local" }
);

// Use default provider (local)
await storage.putObject("file.txt", buffer);

// Switch to S3
await storage.use("s3").putObject("file.txt", buffer);
````

## Provider Capabilities

Different storage providers have varying levels of support for certain features:

| Feature          | Local | S3  | Azure Blob |
| ---------------- | ----- | --- | ---------- |
| `putObject`      | ✅    | ✅  | ✅         |
| `getObject`      | ✅    | ✅  | ✅         |
| `listObjects`    | ✅    | ✅  | ✅         |
| `deleteObject`   | ✅    | ✅  | ✅         |
| `getDownloadUrl` | ❌    | ✅  | ✅         |
| `getUploadUrl`   | ❌    | ✅  | ✅         |

:::tip
For production applications requiring presigned URLs for direct client uploads/downloads, use **S3** or **Azure Blob** storage. Local storage is best suited for development or applications where files are accessed only through your server.
:::

:::note Runtime differences
The S3 presigned-URL methods (`getDownloadUrl` / `getUploadUrl`) work on every runtime, but the underlying mechanism differs:
- **Bun**: produced natively by `Bun.S3Client.presign()` — no AWS SDK needed.
- **Node.js / Deno**: produced by `@aws-sdk/s3-request-presigner`, which you must install.

Similarly, `listObjects` on Bun requires `@aws-sdk/client-s3` (it always uses the AWS SDK). CloudFront signed URLs always require `@aws-sdk/cloudfront-signer` on every runtime.
:::

## Interface

All storage providers implement these methods:

```ts
interface StorageInterface {
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getUploadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  listObjects(prefix?: string): Promise<string[]>;
  getObject<T>(
    key: string,
    returnType?: "raw" | "text" | "stream",
  ): Promise<T | undefined>;
  putObject<T>(key: string, value: T, contentType?: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
}
```

**Return type mapping:**

- `"raw"` → `Uint8Array` (default)
- `"text"` → `string`
- `"stream"` → `ReadableStream`

## Environment Variables

### S3

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name

# Optional for CloudFront
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=your-key-pair-id
CLOUDFRONT_PRIVATE_KEY=your-private-key
```

### Azure

```bash
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=your-container-name
AZURE_STORAGE_ACCOUNT=your-account-name
AZURE_STORAGE_KEY=your-account-key
```

### Local

```bash
LOCAL_STORAGE_DIR=./storage
```

:::info
Local storage does not require environment variables for signed URLs since this functionality is not supported. For presigned URLs, use S3 or Azure Blob storage providers.
:::

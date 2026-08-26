---
title: init-storage
description: Setup storage provider with S3, Azure Blob, or local filesystem dependencies and configuration.
keywords: [balda, init storage, s3, azure blob, filesystem, setup]
sidebar_position: 4
---

# init-storage

Setup storage provider with required dependencies and configuration.

```bash
npx balda init-storage -t s3
npx balda init-storage -t azure -o src/config/
```

## Flags

- `-t, --type <provider>`: Storage provider (`s3`, `azure`, `local`) - **required**
- `-o, --output <path>`: Output directory (default `src/storage/`)

## Provider Dependencies

- **S3**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/cloudfront-signer`
- **Azure**: `@azure/storage-blob`
- **Local**: No additional dependencies

## What it does

1. Checks if dependencies are installed
2. Installs required packages for the provider
3. Creates configuration file with environment variable templates

See [Storage documentation](/docs/storage/overview) for usage examples.

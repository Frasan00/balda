# Security Policy

## Supported Versions

⚠️ **Important**: This project is currently under active development and is **not recommended for production use**.

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :warning: Development |

## Reporting a Vulnerability

We take the security of Balda.js seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Open a Public Issue

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### 2. Report Privately

Report security vulnerabilities by:

* Opening a private security advisory on GitHub: https://github.com/Frasan00/balda-js/security/advisories/new
* Or by emailing the maintainers directly at: francesco.sangiovanni.7@gmail.com

### 3. Include Relevant Information

When reporting a vulnerability, please include:

* **Type of vulnerability** (e.g., injection, authentication bypass, etc.)
* **Full paths of source file(s)** related to the vulnerability
* **Location of the affected source code** (tag/branch/commit or direct URL)
* **Step-by-step instructions** to reproduce the issue
* **Proof-of-concept or exploit code** (if possible)
* **Impact of the vulnerability** and how it can be exploited
* **Which runtime(s) are affected** (Node.js, Bun, Deno, or all)
* **Your suggested fix** (if you have one)

### 4. Response Timeline

* We will acknowledge receipt of your vulnerability report within 48 hours
* We will provide a more detailed response within 7 days
* We will keep you informed about the progress toward a fix

## Security Best Practices

When using Balda.js, follow these security best practices:

### 1. Input Validation

* Always use **Zod schemas** for request validation
* Never trust user input without validation
* Validate both request body and query parameters

Example of safe validation:
```typescript
import { z } from 'zod';
import { post, body } from 'balda-js';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

@post('/users')
@body(userSchema)
async createUser(req: Request, res: Response) {
  // req.body is now validated and type-safe
}
```

### 2. Environment Variables

* **Never commit credentials** to version control
* Use environment variables for sensitive configuration
* Use proper access controls on your `.env` files
* Add `.env` to `.gitignore`

### 3. CORS Configuration

* Configure CORS properly for your use case
* Don't use wildcard (`*`) origins in production
* Use the built-in CORS plugin with specific origins:

```typescript
import { CorsPlugin } from 'balda-js';

server.use(new CorsPlugin({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

### 4. Rate Limiting

* Always implement rate limiting in production
* Use the built-in rate limiting plugin
* Configure appropriate limits for your endpoints

```typescript
import { RateLimitPlugin } from 'balda-js';

server.use(new RateLimitPlugin({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

### 5. File Uploads

* Validate file types and sizes
* Never trust file extensions
* Store uploaded files outside the web root
* Use the file upload plugin with proper configuration

### 6. Error Handling

* Don't expose sensitive information in error messages
* Log errors securely without exposing credentials
* Use structured logging with appropriate redaction
* Never expose stack traces in production

### 7. Dependency Security

* Keep Balda.js and all dependencies up to date
* Regularly run `yarn audit` to check for known vulnerabilities
* Review security advisories for dependencies
* Use `yarn audit fix` to automatically fix vulnerabilities when possible

### 8. Middleware Order

* Apply security middleware early in the chain
* Authentication should come before authorization
* Validation should come before business logic

### 9. Cross-Runtime Considerations

* Be aware of runtime-specific security implications
* Test security measures on all target runtimes (Node.js, Bun, Deno)
* Some native APIs may have different security characteristics

## Known Security Considerations

### Development Status

* This project is in active development
* Breaking changes may occur between releases
* APIs are not yet stable
* **Not recommended for production use**

### Runtime Security

Balda.js runs on multiple runtimes with different security models:

* **Node.js**: Standard Node.js security considerations apply
* **Bun**: Native speed but newer runtime with evolving security
* **Deno**: Secure by default with explicit permissions
* Always test security features on your target runtime(s)

### Plugin Security

* Only use trusted plugins
* Review plugin source code before use
* Be cautious with third-party plugins
* Custom plugins should follow security best practices

### Decorator-Based Architecture

* Decorators execute at class definition time
* Ensure decorator logic doesn't expose sensitive data
* Validate decorator parameters

## Security Updates

Security updates will be released as patch versions and announced through:
* GitHub Security Advisories
* Release notes
* CHANGELOG.md (if present)
* GitHub releases

## Acknowledgments

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities. Contributors who report valid security issues will be acknowledged in the release notes (unless they prefer to remain anonymous).

## Questions?

If you have questions about security that are not sensitive in nature, feel free to open a public issue or discussion on GitHub.

## Security Resources

* [OWASP Top 10](https://owasp.org/www-project-top-ten/)
* [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
* [Deno Security](https://deno.land/manual/runtime/permission_apis)
* [TypeScript Security](https://www.typescriptlang.org/docs/handbook/security.html)


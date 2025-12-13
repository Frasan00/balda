## Description

Please include a summary of the changes and the related issue. Include relevant motivation and context.

Fixes # (issue)

## Type of Change

Please delete options that are not relevant:

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Test improvements
- [ ] Plugin addition/improvement
- [ ] CLI improvement

## Changes Made

-
-
-

## Testing

Please describe the tests you ran to verify your changes:

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

### Test Configuration

- **Runtime(s) tested**: [e.g., Node.js 22.0.0, Bun 1.0.0, Deno 2.0.0]
- **Operating System**: [e.g., macOS, Ubuntu, Windows]

### Test Evidence

```bash
# Paste relevant test output here
yarn test
yarn test:bun
yarn test:deno
```

## Cross-Runtime Compatibility

Have you tested this change on all supported runtimes?

- [ ] Node.js - Tested and working
- [ ] Bun - Tested and working
- [ ] Deno - Tested and working
- [ ] N/A - Change is runtime-agnostic

If not tested on all runtimes, explain why:

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or linter errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I followed the code style rules (no `else` statements, `const` for functions, etc.)
- [ ] I used async/await properly and Promise.all() for parallel operations

## Breaking Changes

If this PR introduces breaking changes, please describe:

- What breaks?
- How to migrate from the old behavior to the new?
- Is there a deprecation path?

## Performance Impact

Does this change affect performance?

- [ ] No performance impact
- [ ] Performance improvement (please provide benchmarks)
- [ ] Potential performance regression (please explain why it's necessary)

If performance is affected, provide benchmark results:
```bash
# Paste benchmark results here
yarn benchmark
```

## Documentation

- [ ] Documentation has been updated in `/docs/docs`
- [ ] JSDoc comments added/updated
- [ ] README updated (if needed)
- [ ] Code examples provided
- [ ] Migration guide added (if breaking change)

## Additional Notes

Add any other context or screenshots about the pull request here.

## Screenshots (if applicable)

Add screenshots to help explain your changes.


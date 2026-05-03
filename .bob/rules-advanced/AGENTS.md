# Advanced Mode Rules

## Project-Specific Patterns

**Module structure**: Each module (analyzer, slicer, graph, utils) exports through `index.ts` - always import from module root:
```typescript
// Correct
import { MonolithAnalyzer } from './analyzer';
// Wrong
import { MonolithAnalyzer } from './analyzer/MonolithAnalyzer';
```

**CLI executable**: `src/cli/index.ts` has shebang `#!/usr/bin/env node` and is the bin entry point

**Import order enforcement**: ESLint enforces specific import order - external packages first, then internal modules (analyzer, slicer, graph, utils), then types

**Strict type requirements**:
- No `any` type allowed (ESLint error)
- All functions must have explicit return types (ESLint warning)
- Unused parameters must be prefixed with `_` (ESLint error)

**Promise handling**: No floating promises allowed - all async operations must be awaited or explicitly handled (ESLint error)

**Console restrictions**: Only `console.warn()` and `console.error()` allowed in src/ - use for errors only, not debugging (ESLint warning)

## Testing

**Test location requirement**: Jest config only recognizes tests in `tests/unit/` or `tests/integration/` - tests elsewhere won't run

**Test file naming**: Must use `.test.ts` suffix - `.spec.ts` files won't be recognized by Jest

**Running single test**: Use `npm run test:single <pattern>` not `jest <file>` directly

## Advanced Mode Features

This mode has access to MCP servers and browser tools for enhanced capabilities.
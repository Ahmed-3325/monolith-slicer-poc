# Plan Mode Rules

## Project Architecture

**Module organization**: Four core modules with clear separation of concerns:
- `analyzer/` - AST parsing and code analysis (uses @babel/parser)
- `slicer/` - Slicing algorithms and logic
- `graph/` - Dependency graph data structures and algorithms
- `utils/` - Shared utilities and helpers

**Module coupling**: All modules export through `index.ts` to enforce clean boundaries - internal implementation details are hidden

**CLI design**: `src/cli/index.ts` is the executable entry point with Commander.js for command parsing

**Testing strategy**: 
- Unit tests in `tests/unit/` for individual module testing
- Integration tests in `tests/integration/` for cross-module workflows
- Jest configuration enforces this structure

**Build system**: TypeScript compilation to `dist/` directory, no bundler needed for CLI tool

**Type safety approach**: Strict TypeScript mode with ESLint enforcement:
- No `any` types allowed
- Explicit return types required
- Unused parameters must be prefixed with `_`
- No floating promises

**Development workflow**: 
- `npm run build:watch` for continuous compilation during development
- `npm run test:single <pattern>` for focused testing
- ESLint enforces import order and code style automatically
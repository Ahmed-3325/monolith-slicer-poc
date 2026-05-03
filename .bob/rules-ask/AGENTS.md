# Ask Mode Rules

## Project Documentation Context

**Project structure**: Monolith-slicer POC is organized into four main modules:
- `src/analyzer/` - Code analysis and AST parsing
- `src/slicer/` - Slicing logic for breaking monoliths
- `src/graph/` - Dependency graph construction
- `src/utils/` - Shared utilities

**CLI interface**: `src/cli/index.ts` provides the command-line interface with `analyze` and `slice` commands

**Module exports**: Each module exports through `index.ts` - documentation should reference module roots, not internal files

**Testing structure**: Tests are organized in `tests/unit/` and `tests/integration/` - Jest only recognizes tests in these directories

**Configuration files**:
- `tsconfig.json` - TypeScript strict mode enabled
- `.eslintrc.json` - Enforces import order, type safety, and promise handling
- `jest.config.js` - Test configuration with ts-jest preset
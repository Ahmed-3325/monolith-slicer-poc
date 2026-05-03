# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

**Run single test**: `npm run test:single <test-file-pattern>`
- Example: `npm run test:single analyzer.test`

**Build and watch**: `npm run build:watch` (useful during development)

## Code Style

**Import order** (enforced by ESLint):
1. External packages
2. Internal modules (analyzer, slicer, graph, utils)
3. Types/interfaces

**Error handling**: All async functions must handle promises (no floating promises - enforced by ESLint)

**Console usage**: Only `console.warn()` and `console.error()` allowed in production code (enforced by ESLint)

**Type safety**: 
- `any` type is forbidden (enforced by ESLint)
- All functions must have explicit return types (enforced by ESLint)
- Unused parameters must be prefixed with `_` (enforced by ESLint)

## Testing

**Test location**: Tests must be in `tests/unit/` or `tests/integration/` directories (Jest config requirement)

**Test file naming**: Use `.test.ts` suffix (not `.spec.ts`)

## Architecture Notes

**CLI entry point**: `src/cli/index.ts` is the executable entry point (configured in package.json bin field)

**Module exports**: All modules export through their `index.ts` files - import from module root, not individual files
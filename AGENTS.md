# AGENTS.md

## 🤖 Welcome, Agent

This document is your primary guide to navigating, understanding, and contributing to the **CAFFeiNE** repository. Read this carefully to ensure your contributions align with the project's architecture and standards.

## 🌍 Project Overview

**CAFFeiNE** is a fork of [AFFiNE](https://affine.pro) designed to enhance the self-hosted experience with a focus on **AI interoperability** and **Headless CMS** capabilities.

### Key Differences from AFFiNE

- **Headless Focus**: Rewrites the backend to support automated workflows and API-driven content management.
- **Deterministic IDs**: Uses hashing for document IDs to enable idempotent imports.
- **Server-Side Parsing**: Moves parsing logic to the server.

## 📂 Codebase Architecture

This is a **monorepo** managed with **Yarn Workspaces**.

### Directory Structure

- **`packages/`**: Contains the core application packages.
  - **`frontend/core`** (`@affine/core`): The main React application. This is where most UI/UX logic resides.
  - **`frontend/apps`**: Entry points for different platforms (web, electron, etc.).
  - **`backend/native`**: Rust bindings for high-performance tasks.
  - **`common`**: Shared utilities and types.
- **`tests/`**: End-to-End (E2E) tests using Playwright, organized by scenario (e.g., `affine-local`, `affine-cloud`).
- **`tools/`**: CLI tools and scripts for repo management.
- **`scripts/`**: Shell scripts for building and deployment (e.g., `caffeine-build.sh`).

### Frontend Architecture (`@affine/core`)

The frontend uses a **modular architecture** based on a dependency injection `Framework`.

- **Modules**: Features are encapsulated in modules located in `packages/frontend/core/src/modules`.
- **Registration**: Modules are configured and registered in `packages/frontend/core/src/modules/index.ts`.
- **State Management**: Uses a combination of local state and module-based state. Avoid adding global state outside this system.

### Backend Note

The original `@affine/server` code is **not included** in this repository due to its closed-source licensing. Rebuilding the self-hosting capability as a truly FOSS offering is the primary goal of the CAFFeiNE project.

## 🛠️ Important Commands

Run these commands from the **root** of the repository.

| Command                       | Description                                 |
| :---------------------------- | :------------------------------------------ |
| `yarn`                        | Install dependencies.                       |
| `yarn dev`                    | Start the development server.               |
| `yarn build`                  | Build the project.                          |
| `yarn lint`                   | Run all linters (ESLint, Prettier, Oxlint). |
| `yarn test`                   | Run unit tests using Vitest.                |
| `yarn typecheck`              | Run TypeScript type checking.               |
| `./scripts/caffeine-build.sh` | Build the CAFFeiNE server artifacts.        |

## 🧪 Testing & Debugging

### Unit Tests

- **Runner**: Vitest
- **Location**: Co-located with source files (e.g., `__tests__` directories or `*.test.ts` files).
- **Command**: `yarn test`

### E2E Tests

- **Runner**: Playwright
- **Location**: `tests/` directory.
- **Configs**: Specific configs for different environments (e.g., `tests/affine-local/playwright.config.ts`).
- **Running**: Navigate to the specific test directory and run the playwright command (check `package.json` in those dirs if available, or use `yarn playwright test -c <config>`).

## ✅ Code Quality Standards

### DOs

- **Use the Module System**: When adding features to the core, create a new module in `packages/frontend/core/src/modules` and register it.
- **Follow Naming Conventions**: Use `kebab-case` for files and directories, `PascalCase` for React components and classes, and `camelCase` for variables and functions.
- **Type Everything**: Strict TypeScript usage is enforced. Avoid `any`.
- **Run Linters**: Always run `yarn lint` and `yarn typecheck` before submitting changes.

### DON'Ts

- **No Direct DOM Manipulation**: Use React refs and state.
- **No Circular Dependencies**: Be careful with imports between modules.
- **No Hardcoded Paths**: Use path aliases (e.g., `@affine/core/...`) defined in `tsconfig.json`.
- **Don't Modify Generated Files**: Avoid editing files in `dist/` or other build output directories.

## 🤖 Tips & Tricks

1.  **Context is Key**: When working on a specific feature, check `packages/frontend/core/src/modules` first to see if a related module exists.
2.  **Search Smart**: Use grep or search to find relevant code. The codebase is large, so broad searches might return too many results. Narrow by package.
3.  **Respect the Monorepo**: Remember that you are in a monorepo. Imports between packages must be handled correctly.

Good luck, Agent. ☕️

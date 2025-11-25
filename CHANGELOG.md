# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - Unreleased

### Added

- **Headless Import API**: New REST endpoint `POST /api/caffeine/workspaces/:id/docs` to import Markdown documents programmatically.
- **Server-Side Markdown Parser**:
  - Implemented a custom `remark`-based parser to convert Markdown AST to BlockSuite-compatible Yjs updates.
  - Supports Paragraphs, Headings (H1-H6), Lists (Bulleted, Numbered, Todo), Code Blocks, and Horizontal Rules.
  - Handles `affine:page`, `affine:note`, and `affine:surface` block hierarchy correctly.
- **Automatic Collection Management**:
  - `POST /docs` accepts a `collectionName` parameter.
  - Automatically creates collections if they don't exist.
  - Updates existing collections with new document IDs.
  - Implemented robust `YMap` metadata handling to prevent indexer crashes.
- **Deterministic Document IDs**:
  - Document IDs are now generated using `md5(workspaceId + title)`.
  - Enables idempotent imports: re-importing a document with the same title updates the existing one instead of creating a duplicate.
- **Read API**: New endpoint `GET /api/caffeine/workspaces/:id/docs/:docId` to retrieve document content as Markdown.
- **List Collections API**: New endpoint `GET /api/caffeine/workspaces/:id/collections` to list all collections and their contents.
- **Authentication**: Implemented `CaffeineAuthGuard` using `X-CAFFEINE-SECRET` header for API protection.
- **Infrastructure**:
  - `Dockerfile.caffeine`: A lightweight Dockerfile optimized for server-side deployment (skips heavy frontend build).
  - `scripts/caffeine-build.sh`: Build script for the server-only artifact.

### Fixed

- Resolved "Invalid access: Add Yjs type to a document before reading data" error by correcting Yjs type integration order.
- Fixed empty markdown return in `readDoc` by ensuring correct `affine:note` block hierarchy in YDoc structure.
- Fixed server crashes caused by invalid metadata types in `CollectionService` (replaced plain objects with `YMap`).

### Security

- Added `CaffeineAuthGuard` to protect all `/api/caffeine/*` endpoints.

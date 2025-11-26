# ☕️ CAFFeiNE

![a cup o' joe](https://github.com/plasticbeachllc/CAFFeiNE/blob/main/dev/assets/BANNER.png?raw=true)

**CAFFeiNE** is a fork of [AFFiNE](https://affine.pro) designed to enrich the self-hosted experience with a primary focus on **AI interoperability**.

AFFiNE provides a fantastic local-first workspace, and CAFFeiNE extends it to be more friendly to AI agents, automated workflows, and headless operations while preserving user control, privacy, and flexibility.

## ⚡️ CAFFeiNE vs. AFFiNE

While AFFiNE focuses on a rich, local-first UI experience, CAFFeiNE extends the backend to serve as a robust **Headless CMS** for automated workflows.

| Feature           | AFFiNE (Original)                | CAFFeiNE (Enhanced)                            |
| :---------------- | :------------------------------- | :--------------------------------------------- |
| **Import Method** | Manual UI (Drag & Drop)          | **Headless REST API** (`POST /docs`)           |
| **Automation**    | None (Requires User Interaction) | **Partially Automatable** (CI/CD, Scripts)     |
| **Doc IDs**       | Random UUIDs                     | **Deterministic Hashing** (Idempotent Imports) |
| **Collections**   | Manual Organization              | **Auto-Collection Assignment** via API         |
| **Parsing**       | Client-Side (Browser)            | **Server-Side** (Node.js/Remark)               |
| **Deployment**    | Full Stack (Heavy Frontend)      | **Lean Server** (Optimized Dockerfile)         |

## 🚀 Core Features

### 1. Headless Markdown Import API

The original idea behind CAFFeiNE. You can push content directly from your terminal, CI/CD pipeline, or other tools without ever opening a browser.

- **Endpoint**: `POST /api/caffeine/workspaces/:id/docs`
- **Payload**: `{ "title": "...", "markdown": "...", "collectionName": "..." }`
- **Benefit**: Enables "Docs as Code" workflows where content lives in Git and syncs to your knowledge base automatically.
- **Architecture**: Enabled by server-side parsing logic that converts Markdown to AFFiNE's internal data format.

### 2. Collection Assignment API

Organize your content as you import it.

- **Logic**: Automatically creates collections if they don't exist and adds documents to them.
- **Benefit**: Keeps your workspace structured without manual cleanup.

### 4. Deterministic Document IDs

We implemented a hashing algorithm (`md5(workspaceId + title)`) to generate Document IDs.

- **Behavior**: Importing a document with the same title _overwrites_ the existing document instead of creating a duplicate.
- **Benefit**: True idempotency. You can re-run your import scripts safely.

## 📦 Installation & Deployment

CAFFeiNE is designed to be a drop-in replacement for your existing AFFiNE server.

👉 **[Read the Deployment Guide](docs/DEPLOY_CAFFeiNE.md)**

## 🏗 Building from Source

```bash
# Build artifacts
./scripts/caffeine-build.sh

# Build Docker image
docker build -f Dockerfile.caffeine -t caffeine-server .
```

## 📄 Licensing & Acknowledgments

CAFFeiNE is free and open-source software ("FOSS").

- **CAFFeiNE**: MIT License (Copyright Plastic Beach, LLC)
- **AFFiNE Community Edition**: MIT License (Copyright TOEVERYTHING PTE. LTD.)

See [LICENSE.md](LICENSE.md) for full details.

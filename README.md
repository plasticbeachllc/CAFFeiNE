# ☕️ CAFFeiNE

![a cup o' joe](https://github.com/plasticbeachllc/CAFFeiNE/blob/main/dev/assets/BANNER.png?raw=true)

**CAFFeiNE** is a fork of [AFFiNE](https://affine.pro) designed to enrich the self-hosted experience with a primary focus on **AI interoperability**.

AFFiNE provides a fantastic knowledge management application; CAFFeiNE will be a 100% compatible self-hosted server backend that is friendly to AI agents, automated workflows, and headless operations while preserving user control, privacy, and flexibility.

## ⚡️ CAFFeiNE vs. AFFiNE

While AFFiNE delivers a rich UI experience, CAFFeiNE will provide a self-hosted AFFiNE-compatible backend that also enables automated and AI-driven workflows.

## 👍🏽 What makes CAFFeiNE different

1. **A proper public API for everything you store**  
   Your workspace is queryable and writable through GraphQL and REST APIs.

2. **Self-hosted, no compromises**  
   Easy to deploy and runs comfortably on a Raspberry Pi or a small VPS.

## 📦 Installation & Deployment

CAFFeiNE is designed to be trivial to deploy and configure. It will work as a drop-in replacement for your existing self-hosted AFFiNE server. For more information, see the [Deployment Guide](docs/DEPLOY_CAFFeiNE.md)

## 🏗 Building from Source

```bash
# Build artifacts
./scripts/caffeine-build.sh

# Build Docker image
docker build -f Dockerfile.caffeine -t caffeine-server .
```

## 📄 Licensing & Acknowledgments

CAFFeiNE is free and open-source software that begins its life as a fork of AFFiNE's "Community Edition."

- **CAFFeiNE**: MIT License (Copyright Plastic Beach, LLC)
- **AFFiNE Community Edition**: MIT License (Copyright TOEVERYTHING PTE. LTD.)

See [LICENSE.md](LICENSE.md) for full details.

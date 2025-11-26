# CAFFeiNE Clean‑Room Process

> Purpose: Document how CAFFeiNE’s new backend server is specified and implemented without reusing or infringing on the proprietary AFFiNE server code.

---

## 1. Roles & Repositories

- **Dirty team (this agent)**:
  - May inspect the AFFiNE repository at `~/worktable/AFFiNE` to understand **what** the existing server does from:
    - Public documentation and schemas.
    - Network behavior as observed from clients.
    - Publicly visible data formats and exports.
  - Must **not** share any information about **how** the proprietary server is implemented internally:
    - No code snippets.
    - No internal data structures, algorithms, or comments.
    - No references to private files or implementation details.
- **Clean team (you, the human developer)**:
  - Implements the new CAFFEiNE server in this repository.
  - Only sees:
    - This plan (`dev/plans/SERVER_PLAN.md`).
    - Derived specifications and behavior descriptions.
    - High‑level functional requirements.
  - Does not read or copy any code from the proprietary AFFiNE server.

**Repositories**

- Proprietary upstream: `~/worktable/AFFiNE` (contains `packages/backend/server`, closed source).
- FOSS fork: `~/worktable/CAFFeiNE` (this repo; contains the new implementation).

---

## 2. Allowed vs Forbidden Inputs

### 2.1 Allowed

The dirty team may use the following kinds of information from the AFFiNE ecosystem to inform specifications:

- Public APIs and endpoints exposed by servers that you control.
- Network traffic captured between existing AFFiNE clients and their server:
  - URLs, HTTP methods, headers, status codes.
  - JSON payload shapes and field names.
  - Timing and high‑level error behavior.
- Public documentation and marketing descriptions.
- Public file formats and exports (e.g., `.affine` exports, JSON configs) as black boxes.
- High‑level workflows as experienced by an end user:
  - “When I click X in the UI, Y happens in the data.”

### 2.2 Forbidden

The dirty team must **never**:

- Copy or paraphrase proprietary source code from `packages/backend/server` or any other closed module.
- Duplicate internal algorithms that are not observable from outside (e.g., specific OT implementation details, index layouts) beyond what can be inferred from behavior.
- Leak internal naming, file paths, or comments.
- Describe implementation details of upstream beyond what is strictly visible “on the wire”.

---

## 3. Classification of Requirements

Every behavior described for the CAFFEiNE server should be classified as one of:

1. **Independent Design**

   - Behavior or API shape designed from first principles in this repo (e.g., BLAKE3 ID scheme, plugin model).

2. **Observed Behavior (Black‑Box)**

   - Derived from observing existing AFFiNE clients and servers:
     - Example: endpoint path, HTTP method, general JSON structure, status codes.
   - Only the **what** is documented, never the internal **how**.

3. **Public Documentation**
   - Behavior taken from official public docs/specs (if/when available).

The dirty team is responsible for tagging requirements in internal notes; the clean team can then implement them without needing to know the source of inspiration.

---

## 4. Artifacts in `dev/cleanroom/`

The `dev/cleanroom` directory will hold:

- `CLEANROOM.md` (this file): high‑level process and rules.
- `DERIVATION_LOG.md` (planned):
  - Append‑only log capturing:
    - Date.
    - Feature/behavior.
    - Classification: Independent Design / Observed / Public Docs.
    - Short description of how the behavior was inferred (e.g., “observed by intercepting traffic from AFFiNE desktop 0.x.y when creating a new page”).
- `ENDPOINTS_OBSERVED.md` (planned):
  - Catalog of external behavior of upstream server:
    - Endpoint paths, methods, basic payload shapes, status codes.
    - No internal code or implementation details.

These artifacts are designed to provide **legal defensibility** and a clear paper trail.

---

## 5. Implementation Rules for the Clean Team

When you implement the new Rust server in CAFFeiNE:

- Only use:
  - The high‑level specifications in `dev/plans/SERVER_PLAN.md`.
  - Any additional specs that clearly describe behavior but not upstream implementations.
- Do **not**:
  - Open or copy code from `~/worktable/AFFiNE/packages/backend/server` or other proprietary modules.
  - Reproduce file structure, naming, or code patterns that are unique to upstream internals.
- You **may**:
  - Implement behaviorally compatible APIs (same URLs/fields/semantics) if they were derived as “Observed Behavior” or “Public Docs”.
  - Make improvements or changes as specified in CAFFeiNE plans, even when deviating from upstream behavior.

---

## 6. Review & Updates

- This clean‑room process should be:
  - Reviewed when major new features are planned.
  - Updated when:
    - New types of artifacts are added under `dev/cleanroom`.
    - The project’s legal or licensing constraints change.
- Whenever new behavior is derived from observing AFFiNE:
  - Add a short entry to `DERIVATION_LOG.md` (once created).
  - Ensure the corresponding public spec in `dev/plans` carries enough detail for implementation without referencing upstream.

---

## 7. Summary

- The dirty team (this agent) can help specify **what** the server does in great detail, using only allowable inputs.
- The clean team (you) writes all new code from scratch, in Rust/TS, based solely on these specs and independent design decisions.
- All work on CAFFeiNE’s backend must remain **strictly FOSS**, with no proprietary code or internal algorithms from AFFiNE copied over.

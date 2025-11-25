# AFFiNE Internal API Research Notes

## Objective

Analyze AFFiNE's internal APIs via browser dev tools to determine feasibility of custom markdown import.

## Findings

### Global Objects

- [x] `window.blockSuite`: **Not Found**
- [x] `window.affine`: **Not Found**
- [x] `window.workspace`: **Not Found**
- [x] `window.__BLOCKSUITE_EDITOR__`: **Not Found**

### DOM & Application Structure

- The application is a React app (`div#app`).
- It uses `npm-blocksuite` but bundles it, likely via Webpack/Vite.
- No obvious global entry points were found in the source code or runtime.
- The "Open in App" modal appears but the app is editable (verified by "New doc" button).

### React Fiber Inspection

- Attempted to traverse React Fiber tree from `#app`.
- Failed to locate a stable `Workspace` or `Editor` instance accessible from the console.
- This suggests the state is deeply encapsulated or requires a specific context to access.

### Conclusion

- **Direct Console API Access is not feasible** without significant reverse engineering or unstable hacks.
- **Recommended Approach**: Develop a custom AFFiNE Plugin that exposes the necessary import functionality, OR use UI Automation (Puppeteer) to simulate user actions.

### C3PM Manipulation

- Results of simple tests:

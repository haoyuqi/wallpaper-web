# Code standards

- Use strict TypeScript and explicit boundary types. Validate unknown network
  data before rendering. Never hide missing validation behind casts or `any`.
- Keep components about presentation and user events; composables own lifecycle
  state and services own I/O. Avoid generic repositories, event buses or factories
  for this one-page application.
- Use source calendar strings directly, stable opaque IDs for keys, and shared
  CSS tokens. Preserve nullable contract fields and failure semantics.
- Vue text interpolation is mandatory for metadata. External links need HTTPS
  validation and noopener/noreferrer; credentials never enter VITE_* variables.
- Verify user-visible behavior, cancellation/error paths and boundary conditions
  across unit/component tests (`tests/unit/`), Playwright E2E flows (`tests/e2e/`)
  and focused browser checks. Keep automated tests self-contained without live
  external network or demo data in production source. Do not replace real
  integration evidence with fixture-only screenshots.
- Format with project-local Vite+; retain vue-tsc for .vue template type checking.
  Use the project-local commands declared in package.json.

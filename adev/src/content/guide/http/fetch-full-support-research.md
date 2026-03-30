# Research: full Fetch capability support in Angular

This document summarizes current Angular HTTP behavior, open capability gaps, and a staged architecture for adding advanced Fetch features (streaming upload/download, NDJSON/SSE/JSON streaming, Navigation API integration, and future transport primitives) while preserving backward compatibility and tree-shakability.

## Current state in Angular (as of this branch)

- `HttpClient` is stable and uses backend abstractions (`XhrBackend` and `FetchBackend`).
- `FetchBackend` currently buffers download chunks and emits a final parsed body response.
- `FetchBackend` emits download progress events, but upload progress events are not supported.
- `httpResource` is implemented on top of `HttpClient` and is reactive through signals.

## Questions from prior discussion, answered against current code

### 1) Does Angular already expose all modern Fetch capabilities?
Not yet. Angular exposes many request options and uses Fetch when configured, but does not expose raw stream-first primitives for request/response bodies.

### 2) Why not, if Fetch is already used internally?
Angular’s stable APIs prioritize:
- compatibility with interceptors and testing tools,
- predictable body parsing contracts,
- existing observable/signal semantics,
- SSR and transfer-cache safety.

A stream-first API needs explicit contracts for cancellation, replay/retry, interceptor behavior, and SSR fallbacks.

### 3) Can streaming downloads be added safely?
Yes, as an additive API. Existing behavior can remain buffered by default while new APIs expose stream chunks/events.

### 4) Can streaming uploads (`ReadableStream`, duplex) be added?
Potentially, but this needs stricter capability gating and explicit constraints (browser support, retry semantics, interceptor compatibility).

### 5) Should this be added directly to `HttpClient`/`httpResource`?
Recommendation: keep existing APIs stable and add opt-in primitives, then optional helpers layered on top.

## Related Angular work and issue signals

- PR: `angular/angular#67044` (debounce resource) indicates ongoing investment in composable resource primitives.
- Issue: `angular/angular#52494` requests chunk access for Fetch responses.
- Issue: `angular/angular#53321` requests router support for the Navigation API.
- Issue: `angular/angular#38559` highlights demand for stronger router typing.

## External ecosystem patterns to borrow (high level)

- **Vue Suspense / async component**: first-class async UI boundaries.
- **TanStack Router**: typed route params/data and route-level data APIs.
- **TanStack Query**: stale/revalidate caching and background refresh patterns.
- **TanStack DB**: typed query/data modeling mindset for state + transport boundaries.

Angular direction can preserve Angular ergonomics by combining signals/resources, SSR, router data, and optional transport adapters.

## Proposed layered architecture (backward compatible)

### Layer 0: Stable APIs remain unchanged
- Keep `HttpClient` and `httpResource` behavior stable by default.
- No breaking semantic changes for existing apps.

### Layer 1: low-level Fetch stream primitive (new, opt-in)
Introduce an experimental, tree-shakable primitive (name TBD) that exposes:
- `Request`/`Response` handles,
- `ReadableStream` access,
- `AbortSignal` cancellation,
- capability metadata (supports duplex/upload streaming/etc).

Design goals:
- zero impact unless imported,
- no hidden global behavior changes,
- explicit feature detection for unsupported environments.

### Layer 2: optional stream helpers (additive)
Helpers built on Layer 1:
- `streamText()` / `streamBytes()`
- `streamNdjson()`
- `streamSse()`
- `streamJsonSequence()` (progressive JSON payloads)
- `uploadStream()` (where supported)

Each helper should provide:
- observable stream output,
- signal-based status/progress,
- cancellation and teardown wiring.

### Layer 3: `httpResource` integration points (optional)
Extend resource ergonomics without changing defaults:
- allow stream-backed loaders via optional adapters,
- preserve existing parse/value/error semantics for non-stream calls,
- support debounce/composition patterns with `resource` primitives.

### Layer 4: router + Navigation API + typed data loading
- Add optional Navigation API integration for supported browsers.
- Keep existing router API as compatibility baseline.
- Consider side-by-side typed router enhancements (params/data) with migration tooling.
- Integrate route loaders/resources with SSR/hydration contracts.

## SSR, hydration, and transfer-cache constraints

Any stream-capable API needs explicit SSR behavior:
- deterministic fallback for non-streamable server contexts,
- transfer-cache policy declarations (buffered-only vs stream-disabled vs partial),
- hydration-safe reattachment semantics,
- clear client/server parity guarantees.

## Future transport integration: WebTransport and WebSocket

Treat these as transport adapters, not `HttpClient` replacements:
- separate transport modules with explicit opt-in,
- shared cancellation/error/status interfaces,
- resource/router integration through common async data contracts.

## Tree-shakability requirements

- All new capabilities must be opt-in via dedicated entry points/providers.
- No extra runtime cost for apps using only current `HttpClient` APIs.
- Ensure provider-level and symbol-level tree shaking.

## Migration and compatibility strategy

1. **Phase 1 (experimental)**: add low-level stream primitive + docs + examples.
2. **Phase 2 (opt-in helpers)**: NDJSON/SSE/stream helpers with test coverage.
3. **Phase 3 (resource/router integration)**: typed loaders, navigation integration, SSR-hardening.
4. **Phase 4 (stabilization)**: promote selected APIs after ecosystem validation.

Migration principles:
- no required migration for existing apps,
- codemods only for optional adoption paths,
- compatibility layer for legacy router patterns where new typed APIs are introduced.

## Testing strategy (minimum matrix)

- Unit tests: parser/chunk boundaries, cancellation, retries, backpressure behavior.
- Integration tests: interceptors + stream primitives, resource composition, router loaders.
- SSR tests: render/hydrate parity and transfer-cache behavior.
- Browser capability tests: feature detection and fallback semantics.
- Security tests: stream parser hardening, denial-of-service boundaries, safe defaults.

## Open architectural questions

- What is the stable contract for interceptors on stream bodies?
- Which progressive formats are first-class vs helper-level (`multipart/mixed`, NDJSON, SSE)?
- What is Angular’s official SSR policy for partial stream transfer?
- Should typed router APIs be introduced as additive APIs or as a parallel router package with migration tooling?

## Recommendation

Start with additive, experimental primitives and keep `HttpClient`/`httpResource` stable by default. This aligns with Angular’s priorities (signals, SSR/hydration correctness, and tree-shakable opt-in features) while enabling progressive Fetch capabilities without breaking existing applications.

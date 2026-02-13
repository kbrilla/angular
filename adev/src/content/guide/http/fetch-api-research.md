# Research: full Fetch capability support in Angular HTTP stack

IMPORTANT: This document is a forward-looking architecture research note. It does **not** change current Angular public APIs.

## Problem statement

Angular has `HttpClient`, `FetchBackend`, and `httpResource`, but browser and platform APIs are moving toward richer networking and UX primitives (streaming request/response bodies, incremental JSON delivery, Navigation API, View Transitions, WebTransport/WebRTC, scoped custom element registries, etc.).

The goal is to define a direction that:

- unlocks modern Fetch capabilities,
- stays compatible with existing Angular apps,
- aligns with Angular's signals + SSR direction,
- preserves tree-shakability.

## Current behavior in Angular (as of this repository)

### `HttpClient`

- Stable, interceptor-driven API with strong testing support.
- Can use `FetchBackend` via `withFetch` (and there is active work to make Fetch the default in <https://github.com/angular/angular/pull/58212>).
- Upload streaming (`ReadableStream` request body + `duplex`) is not exposed through `HttpClient`.
- `FetchBackend` currently reads response streams to completion and emits buffered responses.

### `FetchBackend`

- Internally uses `fetch` and `ReadableStream` reader for download progress.
- Still buffers chunks and parses after completion (`packages/common/http/src/fetch.ts`).
- Does not expose per-chunk streaming values to consumers.

### `httpResource`

- `httpResource` currently uses `HttpClient` (see `packages/common/http/src/resource.ts`), including interceptors and testing behavior.
- It is reactive and eager; suitable for read-oriented flows.
- It does not expose chunk-level streaming response primitives today.

### Related active design work

- `resource` composition via snapshots was added in <https://github.com/angular/angular/pull/66328> (merged).
- Experimental debounce resource work exists in <https://github.com/angular/angular/pull/67044> (open draft).
- Open issue for chunk-level Fetch streaming in Angular HTTP: <https://github.com/angular/angular/issues/52494>.
- Open issue for Navigation API support in router: <https://github.com/angular/angular/issues/53321>.
- Ongoing router typing demand: <https://github.com/angular/angular/issues/38559>.

## Answers to the prior conversation questions

1. **Does Angular support all newer Fetch features directly?**
   - Not fully. Angular supports many request options, but does not expose full streaming request/response control as first-class APIs.
2. **Does `HttpClient` support streaming uploads/downloads as full streams?**
   - No full stream API. It supports progress events and buffered final responses.
3. **If `HttpClient` uses Fetch, why no full streaming?**
   - `HttpClient` prioritizes stable semantics (interceptors, retryability expectations, broad compatibility, serializable request contracts).
4. **Does `httpResource` use `HttpClient`?**
   - Yes, in current source.
5. **Why are `ReadableStream` request bodies constrained?**
   - They are single-consumption and complicate retry/interception/serialization guarantees expected by higher-level APIs.
6. **What changes are needed for streaming uploads?**
   - A lower-level API that explicitly models one-shot bodies and duplex semantics rather than retrofitting `HttpClient`.
7. **Should streaming JSON be built directly into `httpResource`?**
   - Prefer composable primitives first, then optional helpers built on top.
8. **How should `httpResource` reuse streaming primitives?**
   - Through opt-in adapters that map stream chunks/events to `resource` snapshots/signals without changing default behavior.

## Proposed architecture

### Layer A: stable existing APIs stay stable

- Keep `HttpClient` semantics intact.
- Keep `httpResource` default behavior intact.
- Preserve current migration paths (`withXhr`, etc.).

### Layer B: new low-level fetch primitive (opt-in)

Introduce an **experimental** primitive (working name: `fetchCore`) under `@angular/common/http` (or a dedicated experimental entrypoint):

- Accepts native `RequestInit`-class options, including stream bodies and abort signals.
- Returns explicit stream handles for response body.
- Clearly documented as one-shot for stream-body requests.
- No implicit retries for non-replayable bodies.

This isolates advanced transport behavior from `HttpClient` compatibility constraints.

### Layer C: optional streaming helpers

Build tree-shakable helpers atop Layer B:

- `streamText()` / `streamBytes()`
- `streamNdjson()`
- `streamSse()`
- `uploadStream()` (duplex capable where supported)

Each helper can expose both:

- RxJS observable surface (`Observable<Chunk/Event>`), and
- signal-oriented surface (status/progress/current value) for template ergonomics.

### Layer D: `resource` integration adapters

Provide adapters from stream helpers to `ResourceSnapshot` + `resourceFromSnapshots`:

- Enables `httpResource`-style UI state handling.
- Leverages recent composition primitives from <https://github.com/angular/angular/pull/66328>.
- Integrates with debounce strategies (`debounceResource` direction from <https://github.com/angular/angular/pull/67044>) for UX smoothing.

### Layer E: transport-extensible future

Model transport as a capability layer so Fetch is not the final boundary:

- `fetch` (default web transport)
- `websocket` adapters for event streams
- `webtransport` adapters for bidirectional/low-latency streams

High-level APIs (`resource`/router/data APIs) should depend on capability contracts, not a single transport type.

### Layer F: transition-aware navigation UX

To align with Interop 2026 direction, router and data-loading integration should treat transitions as a first-class concern:

- same-document view transitions for in-app state and route outlet changes,
- cross-document view transitions for full-document navigations where supported,
- explicit hooks to coordinate data readiness with transition start/commit.

This should integrate with ongoing router Navigation API work and degrade gracefully on unsupported browsers.

## Router, SSR, and signals integration direction

### Router data + navigation state

- Align route data fetching with resource snapshots/signals.
- Add first-class pending states for route transitions (integrates naturally with Navigation API work in <https://github.com/angular/angular/issues/53321>).
- Keep blocking/non-blocking SSR hydration strategies explicit.

### SSR and transfer cache

- Preserve current transfer cache behavior for buffered reads.
- Introduce explicit non-transferable modes for live streams (SSE/NDJSON/chunked responses).
- Ensure server-side cancellation is wired through `AbortSignal`.

### Typed router trajectory

Borrow lessons from typed-router ecosystems:

- typed route params/query/data contracts,
- typed loader outputs,
- typed injection of route state into components,
- compile-time-safe navigation commands.

This aligns with long-standing community demand in <https://github.com/angular/angular/issues/38559>.

### Web components and scoped registries

For microfrontends and mixed component ecosystems, Angular should account for scoped custom element registries in rendering/integration stories:

- ensure Angular-hosted Web Components interoperate in scoped registries,
- avoid assumptions that the global `customElements` registry is the only registry,
- document testing patterns for component libraries embedded in shadow roots with scoped registries.

## Backward compatibility and migration

- No breaking changes to `HttpClient`/`httpResource` defaults.
- New capabilities are opt-in and additive.
- If future router/data APIs evolve significantly, prefer side-by-side API with compatibility bridge + migrator over hard replacement.

## Tree-shakability requirements

- Streaming helpers in separate entrypoints.
- Transport adapters split by feature.
- No stream parser or transport polyfill included unless imported.
- Keep existing `HttpClient` bundle footprint unchanged when advanced APIs are unused.
- Keep view-transition, WebRTC, and scoped-registry helpers in optional entrypoints so baseline apps do not pay for unused capabilities.

## Implementation plan (phased, additive)

1. **Phase 1: Experimental fetch core + stream helpers**
   - Add low-level fetch primitive and chunk/event helpers.
   - Add explicit `Range` request/resume helper utilities.
2. **Phase 2: Resource adapters + UX transitions**
   - Add adapters to `ResourceSnapshot`.
   - Add optional router hooks for same-document view transitions.
3. **Phase 3: Navigation + cross-document transitions**
   - Integrate with Navigation API efforts and cross-document transition hooks where supported.
4. **Phase 4: Advanced transport + component interop**
   - Add optional WebRTC/WebTransport-oriented adapters for real-time and bidirectional use cases.
   - Add guidance/utilities for scoped custom element registries in microfrontend/shadow-root scenarios.

## Testing strategy (for future implementation)

1. **Unit tests**
   - stream parser correctness (SSE, NDJSON, chunk boundaries, UTF-8 split code points)
   - abort/cancel race conditions
   - one-shot body behavior for upload streams
2. **Integration tests**
   - with interceptors
   - with `resource` snapshots and debounce behavior
   - with router transitions and pending UI
   - with same-document and cross-document view transition hooks
   - with `Range` requests and resume/partial-content flows
3. **SSR tests**
   - transfer cache opt-in/out
   - hydration + cancellation
4. **Migration tests**
   - ensure existing `HttpClient`/`httpResource` apps are behaviorally unchanged.

## Open design questions

- Should stream-capable request APIs use separate request types to make replayability explicit?
- Where should chunk parsers live (`@angular/common/http` vs separate experimental package)?
- How should router loaders expose partially available data in templates?
- What is the minimal typed-router surface that provides high value without large breakage risk?
- Which parts of Navigation API should degrade gracefully on unsupported browsers?
- What should the default Angular ergonomics be for same-document vs cross-document view transitions?
- Should Angular provide a first-class abstraction for `Range` and resumable transfers, or just lower-level request helpers?
- Where should WebRTC data/media integration live relative to HTTP/resource/router APIs?
- How should scoped custom element registry support interact with hydration and router outlet composition?

## External research notes

This environment could not fetch MDN/Vue/TanStack pages directly at runtime, but this proposal is shaped by the same themes those ecosystems emphasize:

- explicit async boundaries,
- first-class pending/error states,
- typed route/data contracts,
- composable caching and invalidation,
- transport-agnostic data orchestration.

Additional reference topics requested for this research:

- View Transition API: <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>
- WebRTC API: <https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API>
- Cross-document transitions article: <https://webkit.org/blog/16967/two-lines-of-cross-document-view-transitions-code-you-can-use-on-every-website-today/>
- HTTP `Range` header: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range>

## Conclusion

Angular can achieve full modern Fetch capability **without destabilizing** `HttpClient` or `httpResource` by introducing a composable, opt-in streaming foundation and layering integration utilities around signals, SSR, and router state. This preserves compatibility while enabling a long-term networking architecture that can evolve beyond classic request/response.

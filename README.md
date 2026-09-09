# API Health Checker

A small API that checks whether HTTP(S) endpoints are up, built as a focused backend
portfolio project — not a full monitoring platform.

## What it does

You give it a URL, it makes a GET request to that URL and reports back:

- `UP` / `DOWN` status
- HTTP status code
- response time in milliseconds
- a distinguished error reason when the check itself fails (`TIMEOUT`, `CONNECTION_ERROR`)

It also supports checking a batch of URLs concurrently in a single request.

## Stack

- Node.js + TypeScript (ESM, strict mode)
- [Fastify](https://fastify.dev/) — HTTP framework, request validation via JSON Schema
- Native `fetch` (undici, bundled with Node) — no HTTP client library
- [Vitest](https://vitest.dev/) — unit and route-level tests, no real network calls

Deliberately **not** used: a database, a queue, a frontend, or a container orchestrator.
The scope is a single stateless API.

## Running locally

Requires Node.js 20+.

```bash
npm install
npm run dev     # tsx watch, restarts on file changes
```

The server listens on `http://localhost:3000` (override with the `PORT` env var).

```bash
npm run build   # compiles to dist/
npm start       # runs the compiled build
```

## Running tests

```bash
npm test
```

Tests mock `fetch` and the internal HTTP client — no real network access is required or
performed during the test run.

## API

### `GET /health`

Liveness check for the API itself.

```json
{ "status": "ok" }
```

### `POST /checks`

Checks a single URL.

```json
// request
{ "url": "https://example.com", "timeout": 5000 }
```

```json
// response — healthy target
{ "status": "UP", "statusCode": 200, "responseTimeMs": 143 }
```

```json
// response — target returned an error status
{ "status": "DOWN", "statusCode": 500, "responseTimeMs": 89 }
```

```json
// response — target didn't respond in time
{ "status": "DOWN", "error": "TIMEOUT", "responseTimeMs": 5000 }
```

`timeout` is optional (default `5000`ms, allowed range `100`–`30000`ms). A malformed URL
or a non-`http(s)` protocol is rejected with `400 VALIDATION_ERROR` before any request is
made.

### `POST /checks/batch`

Checks up to 20 URLs concurrently (`Promise.all`, one failing URL never blocks the others).

```json
// request
{ "urls": ["https://example.com", "https://example.org", "not-a-url"] }
```

```json
// response
{
  "results": [
    { "url": "https://example.com", "status": "UP", "statusCode": 200, "responseTimeMs": 143 },
    { "url": "https://example.org", "status": "UP", "statusCode": 200, "responseTimeMs": 98 },
    { "url": "not-a-url", "status": "DOWN", "error": "INVALID_URL", "responseTimeMs": 0 }
  ]
}
```

## Architectural decisions

- **Native `fetch` over an HTTP library.** Node's built-in `fetch` (undici) already covers
  everything this project needs: timeouts (`AbortSignal.timeout`), status codes, and
  connection-error surfacing. Adding `axios` or a similar library wouldn't buy anything.
- **`client → service` separation.** `clients/httpClient.ts` only knows how to make a
  request and measure its duration; `services/healthCheckService.ts` owns the UP/DOWN
  business rule. This keeps the "did the network call work" tests independent from the
  "is 404 considered healthy" tests.
- **Two-layer validation.** Structural validation (types, string length, timeout bounds)
  is expressed as a Fastify/AJV JSON Schema — no extra validation library. Semantic
  validation (is this actually a parseable URL, is the protocol `http`/`https`) uses the
  native `URL` class directly, since JSON Schema can't express that check well.
  Errors from either layer are normalized to the same `400 { error, message }` shape by a
  single `setErrorHandler`.
  See [src/schemas/checkSchema.ts](src/schemas/checkSchema.ts) and
  [src/schemas/url.ts](src/schemas/url.ts).
- **Timeout vs. connection errors are a domain outcome, not an API error.** A target that
  times out or refuses the connection still yields a `200` from *this* API, with
  `status: "DOWN"` — the request to the health checker succeeded; it's the target that
  didn't. Only invalid input to the health checker itself (bad URL, bad protocol,
  out-of-range timeout) returns a `4xx`.
- **Batch concurrency without a worker pool.** `POST /checks/batch` fires all checks via
  a single `Promise.all`, with each item wrapped in its own `try/catch` so a validation
  failure or a network error for one URL becomes a normal result instead of rejecting the
  whole batch. The batch size is capped (`maxItems: 20`) instead of adding a concurrency
  limiter — the array is small and bounded by design, so a limiter would add complexity
  without a real problem to solve.

## Limitations

- **SSRF is only partially mitigated.** The API accepts an arbitrary user-supplied URL by
  design, which is a classic SSRF vector: a target could point at `http://localhost`,
  `169.254.169.254` (cloud metadata endpoints), or another internal service. Currently
  only the URL's *protocol* is restricted to `http`/`https` — there is no blocking of
  private/loopback IP ranges, and no protection against DNS rebinding (resolving a
  public-looking hostname to a private IP after validation). This is a conscious gap for
  a local portfolio project, not an oversight, and is the next thing planned (see below).
- No persistence: results are never stored, there's no history of past checks.
- No authentication/rate limiting — anyone who can reach the API can trigger checks.
- No redirect-target validation: `fetch` follows redirects by default, so a validated
  URL could still redirect to a disallowed protocol or an internal address.

## Possible future improvements

- Block requests to private/loopback/link-local IP ranges and re-check the *resolved* IP
  (not just the hostname) to close the SSRF gap above.
- Dockerfile for containerized runs.
- Persist check results (would be the first justification for adding a database).
- Rate limiting per client.

# ADR 0001: Fastify API + separate worker + Next.js web

- Status: accepted (2026-09-26)
- Source: SRS §2.7

## Context

Checks must run on a schedule regardless of web traffic, and outbound probing must be isolated from request handling.

## Decision

Three processes from one repo: `apps/api` (Fastify), `apps/worker` (scheduler + probe pool), `apps/web` (Next.js).
Shared code in `packages/domain` (pure) and `packages/db` (persistence). Compose runs `api`, `worker`, `web`, `db`, `redis`, `mock-target`.

## Consequences

- The worker scales independently and is safe to run as N replicas thanks to `FOR UPDATE SKIP LOCKED`.
- The API never makes outbound probe calls, so a slow target cannot exhaust API resources.
- More moving parts than a single Next.js app; accepted for correctness and a clear backend story.

## Rejected

A single Next.js app with `setInterval` in the server: fragile under serverless, runs once per instance, and hides worker concerns.

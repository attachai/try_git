# Security Review — Phase 9

## Implemented controls

- Authorization is enforced server-side for protected routes.
- Parent point mutations require the PARENT role and family ownership.
- Child shop/evolution mutations require the CHILD role and resolve the child from the authenticated session.
- Mutation input is validated with Zod.
- D1 prepared statements are used for user-controlled values.
- Point history is append-only in application flows.
- D1 triggers reject negative balances.
- Purchase and evolution use D1 batch transactions.
- Session identifiers are random UUIDs and stored server-side.
- Session cookies are HttpOnly and SameSite=Lax; production cookies add Secure.
- Cross-site mutation requests are rejected using Origin/Sec-Fetch-Site checks.
- Security response headers disable framing and sensitive browser capabilities.
- Demo login is disabled in production.

## Remaining production gates

Before public deployment:

1. Implement real authentication (passkey/password/magic link).
2. Add abuse/rate-limit protection to production authentication endpoints.
3. Configure production D1 binding and environment variables.
4. Use owned/licensed character artwork rather than prototype third-party assets.
5. Review CSP after final image/asset hosts are known.
6. Add session cleanup/rotation and account recovery.
7. Add monitoring for repeated authentication/authorization failures.

## Automated tests

Workers tests use Cloudflare's Vitest plugin with local D1 migrations.

Critical cases:
- parent award updates ledger and balance
- child cannot self-award points
- over-deduction is rejected
- cross-site mutation is rejected
- purchase is atomic
- duplicate purchase cannot double-debit
- evolution preserves lineage and correct balance

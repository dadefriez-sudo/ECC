# Accountability partners: API tests

Runs the real route code against an in-memory Postgres (pglite) with the real
migrations. Sign-in is stubbed: `Authorization: Bearer test:<email>` is that user,
so no Clerk account or database is needed.

    cd backend && bash test/accountability/run.sh

Covers: invite without an email, the preview, accepting (including a double tap),
used / expired / revoked / own invites, the free-plan limit on both sides, removing
and re-pairing, progress both ways, size and format limits, and invites from
accounts that were deleted. It also covers cloud sync's `/api/data`: a write that names the
version it started from (`baseUpdatedAt`), the 409 with the current copy when that version is
stale, the cheap `?since=` poll, and two simultaneous writes from the same version.

Not covered here: the five-way simultaneous accept. pglite serves one query at a
time over its socket and mixes up concurrent responses, so that needs a real
Postgres.

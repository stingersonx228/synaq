# Decisions

- Next.js 16 (current create-next-app); `/play` page reads `?case`/`?offline` on the server and renders the game client-only (`ssr: false`) because it uses localStorage and random case order.
- Added `bug.correct_answer` to the case schema: needed for the debrief and for filtering intern replies that reveal the answer.
- Added `attempts.lives_lost` column: the dashboard metric "lost a life" counts wrong-line clicks inside rounds that were later solved.
- Outcome mapping: clean case declared clean = `solved`; "no errors" on a buggy case = `missed_clean`; lives run out on wrong-line clicks = `wrong_line`.
- An empty or non-numeric proof input does not consume one of the 3 proof attempts.
- Proof failures: 1st → intern stage 1 (LLM or `defense[1]`), 2nd → fixed reason-specific line; 3rd → round lost.
- Number input also accepts digit-group spaces ("20 000") and the Unicode minus; still digits only, no expressions.
- The scripted judge fallback needs one keyword root; keywords are normalized (lowercase, ё→е, unified minus).
- Judge majority needs ≥2 valid votes and a strict majority; only LLM verdicts are cached.
- LLM budget counts one unit per `/api/judge` or `/api/intern` request that reaches the provider (cache hits are free). Anonymous players are limited per IP in memory.
- The 401 rule for unknown `student_id` applies to `/api/attempt`; LLM routes accept an optional id only for rate limiting.
- The attempt score is recomputed on the server; the client never sends it.
- Joining with an existing nickname in the same class returns the same student (lets a student continue on another device).
- "Запасной стажёр" swaps to an unused case of the same kind (clean/buggy) when available, without penalty.
- System font stack instead of next/font to keep builds working without network access.
- Supabase migration was not applied: the connected project's DB timed out and the other projects in the account are unrelated.

# Backend plan (Supabase)

DEEPER runs fully offline today. All competitive rules live in `src/game/` as pure functions, so the
same code can run inside a Supabase Edge Function (Deno) to make scores server-authoritative.

## What exists
- `supabase/migrations/0001_init.sql`: draft schema + row level security. **Not yet applied or tested.**
- `.env.example`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only, never a service key).
- `src/game/storage.ts`: the local save shape, designed to sync as plain JSON.

## What is still to build
1. **`submit-answer` Edge Function.** Input: attempt id, question id, typed text. It must: check the
   caller's JWT, load the current question for that attempt, reject late or repeated submissions
   (timer measured server-side from when the question was served), run `validateAnswer` and
   `computeRarity` with `answer_stats`, write the `answer_submissions` row and update the attempt total.
   The client only ever receives the result, never the answer list.
2. **`start-attempt` function** that creates the attempt (the unique index blocks a second ranked one)
   and returns the day's questions one at a time.
3. **Stats aggregation.** Count each attempt at most once per question (see `recordObservation`), ignore
   brand-new or flagged accounts when computing observed rarity, and keep the smoothing in `rarity.ts`.
4. **Rate limiting** on both functions (per user and per IP).
5. **Realtime rooms** for Friend Challenge, Live Dig Duel and Squad Expedition (Supabase Realtime
   channels plus a `rooms` table with server-validated membership).
6. **Admin tools** behind `profiles.is_admin`: question CRUD, the unknown-answer review queue, scheduling
   `daily_challenges`, and rarity settings.

Until these exist the app must keep presenting online features as unavailable.

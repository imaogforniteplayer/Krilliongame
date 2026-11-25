# Accounts: Google sign-in, email sign-up and cloud backup

DEEPER works fully as a guest. Accounts are optional and only add **cloud backup / restore** of your progress.
They do not change scoring, rarity or any gameplay.

## What is built

- **Continue with Google** (OAuth with PKCE, through Supabase Auth). The first Google sign-in creates the account.
- **Create account / Sign in with email and password**, with confirmation email, password reset and "choose a new password".
- **Cloud backup:** back up, restore and delete your save. Every overwrite shows both saves side by side and asks first.
- No SDK: `src/auth/client.ts` talks to Supabase over plain `fetch`, and is covered by 28 unit tests.

Until the two environment variables below are set, the Account page says "not connected" and the buttons are disabled.

## What is tested, and what is not

- Unit tests and a browser run against a **small stand-in server I wrote** that follows the documented Supabase HTTP shapes.
  That proves the game's own logic: PKCE, session storage and refresh, error messages, backup/restore flows, link handling.
- It has **not** been run against a real Supabase project or real Google. Expect to spend a few minutes on the setup below, and check
  the redirect URLs first if sign-in bounces back to the home page.

## Setup (about 15 minutes, all free tier)

### 1. Supabase project
1. Create a project at https://supabase.com.
2. SQL editor: run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_accounts.sql`.
   (`0002` adds the automatic profile row and the private `player_saves` table with row level security.)
3. Settings > API: copy the **Project URL** and the **anon public** key. Never use the service-role key in the browser.

### 2. Google OAuth client
1. https://console.cloud.google.com > APIs & Services > OAuth consent screen: set an app name and your support email.
2. Credentials > Create credentials > OAuth client ID > **Web application**.
3. Under *Authorized redirect URIs* add Supabase's callback: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Copy the client ID and client secret.
5. In Supabase: Authentication > Providers > **Google**: enable it and paste the client ID and secret.

### 3. Tell Supabase where the game lives
Authentication > URL Configuration:
- **Site URL:** your game address, e.g. `https://imaogforniteplayer.github.io/Krilliongame/`
- **Redirect URLs:** add the same address (with the trailing slash) and `http://localhost:5173/` for local development.

The game sends players back to its base address, then reads `?code=` and finishes sign-in. If the redirect URL is not on this
list Supabase sends players to the Site URL instead, which is the most common reason sign-in appears to do nothing.

### 4. Give the game the two values
- Local: copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- GitHub Pages: repository Settings > Secrets and variables > Actions > **Variables**, add both names with the same values, then re-run the deploy workflow.

### 5. Email confirmation (optional)
Authentication > Providers > Email: leave "Confirm email" on if you want people to verify addresses (the game handles both
settings). For real email volume set up custom SMTP, since Supabase's built-in sender is heavily rate limited.

## Privacy and safety notes
- Google sign-in shares name, email and profile picture with your Supabase project. The Account page says so.
- Tokens live in this browser's localStorage, like most single-page apps. Codes and tokens are removed from the address bar immediately.
- Backups are written by the browser, so they are **convenience only** and must never feed scoring or leaderboards.
  Those need the server-validated attempts described in `docs/BACKEND.md`.
- Players can delete their cloud backup in the game. **Deleting the account itself is not self-service yet**; it currently needs you to
  remove the user in Supabase (Authentication > Users). Add a server function if you want it in-game.

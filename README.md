# WatchFinder

Legal OTT/movie discovery website for movies, web series, anime, trailers, official platform links, blogs, promotions, clean ad slots, favorites, watch history, feedback, and protected admin management.

Tagline: **Find Movies, Web Series and OTT Updates in One Place**

## Tech Stack

- Next.js App Router
- Supabase Auth, Database and Storage
- Vercel deployment
- GitHub repository: `watchfinder`
- Vercel project: `watchfinder`
- Supabase project: `watchfinder-prod`

## Project Structure

The repository root is the main WatchFinder project folder. Keep `package.json` at the repository root and keep Vercel Root Directory set to the default/root.

```text
watchfinder/
  app/                  Next.js routes, layouts, metadata and global CSS
  components/           Reusable UI, admin, PWA, analytics and auth components
  lib/                  Supabase clients, data helpers, analytics and utilities
  public/
    brand/              WatchFinder logo and wordmark source assets
    platforms/          Local platform logo SVG assets
    posters/            Optional local poster assets only
    banners/            Optional local banner assets only
  scripts/              One-off asset/build helper scripts
  supabase/migrations/  Project migrations, including analytics
  types/                Shared TypeScript types
  package.json
  next.config.mjs
  tsconfig.json
  README.md
  .env.example
  .gitignore
```

Future WatchFinder code, UI, assets, and feature updates should stay inside this same structure. Do not create separate random folders or nested projects such as `watchfinder/WatchFinder/app`.

## Asset Locations

- Brand logos and wordmarks belong in `public/brand/`.
- Browser/PWA entry icons also keep root copies such as `public/icon-192-v3.png`, `public/icon-512-v3.png`, `public/apple-touch-icon-v3.png`, and `public/favicon-v3.ico` because browsers and manifests read those public paths directly.
- Platform logo SVGs belong in `public/platforms/`.
- Local poster files, if ever used, belong in `public/posters/`.
- Local banner files, if ever used, belong in `public/banners/`.
- Supabase-hosted poster/banner URLs stored in the database should not be moved or rewritten.

## Future Updates

Make future changes inside the existing root project. Add new routes in `app/`, reusable UI in `components/`, shared helpers in `lib/`, shared types in `types/`, and static assets under the correct `public/` subfolder.

For each production update:

1. Make code/assets changes in this repo root.
2. Run `npm run build`.
3. Commit and push to `main`.
4. Let Vercel deploy from the root project.
5. If the PWA version changes, update `public/version.json` and keep manifest/icon references current.

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Security note: `SUPABASE_SERVICE_ROLE_KEY` is never imported by client-side code. Browser code uses only the anon key.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production check:

```bash
npm run build
```

## PWA App Icon Refresh

WatchFinder uses versioned PWA icons in `manifest.json` so new installs receive the latest W app icon.

The installed PWA also checks `public/version.json` for website updates. When that version changes, users can refresh from the in-app update banner.

If an already installed Android/iPhone home screen app still shows an older icon:

1. Remove/uninstall the installed WatchFinder app from the home screen.
2. Clear browser site data for WatchFinder if the old icon still appears.
3. Reopen WatchFinder in the browser and install/add it to the home screen again.

## GitHub Repo Setup

1. Create a new GitHub repository named `watchfinder`.
2. In this folder, run:

```bash
git init
git add .
git commit -m "Initial WatchFinder build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/watchfinder.git
git push -u origin main
```

## Connect To Vercel

1. Go to Vercel.
2. Add New Project.
3. Import the GitHub repo `watchfinder`.
4. Set project name to `watchfinder`.
5. Framework preset should be Next.js.
6. Add the environment variables below.
7. Deploy.

## Vercel Environment Variables

Add these in Vercel Project Settings, Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Use the same values from your Supabase project. Redeploy after adding them.

## Supabase Setup

Use the safe migrations in `supabase/migrations/` for current schema changes. This project expects these existing tables:

`profiles`, `genres`, `platforms`, `cast_members`, `movies`, `movie_genres`, `movie_cast`, `movie_platform_links`, `promotions`, `ad_slots`, `blog_posts`, `favorites`, `watch_history`, `feedback_messages`, `license_documents`, `site_settings`.

Use your existing buckets:

`movie-posters`, `movie-banners`, `promotion-banners`, `blog-images`, `avatars`, `license-documents`, `licensed-videos-small`.

New schema changes must be safe migrations only: `create table if not exists`, `alter table ... add column if not exists`, `create index if not exists`, or admin-only RLS fixes. Never use destructive reset scripts on production.

## Sign Up

1. Configure Supabase Auth.
2. Enable email/password signups and email confirmation in Supabase Auth.
3. Visit `/signup` to create an account with email and password.
4. After signup, WatchFinder redirects to `/verify-email?email=user@example.com`.
5. Enter the 6 digit verification code from email to finish account verification.
6. Visit `/login` to sign in with email and password.

Email/password login works directly with Supabase Auth. The main auth flow uses password plus verification code only.

## Make Your User Admin

Run this in Supabase SQL editor after your profile row exists:

```sql
update public.profiles set role = 'admin' where email = 'my-email@example.com';
```

Replace `my-email@example.com` with your real login email.

## Add First Movie

1. Login as admin.
2. Open `/admin`.
3. Go to **Add Movie**.
4. Fill title, slug, type, description, poster, banner, year, duration, rating, language, director and status.
5. Choose `published` when ready.
6. Save.

## Add Trailer

In the admin movie form:

1. Paste the official YouTube trailer URL in `Trailer URL`.
2. Set `Trailer Provider` to `youtube`.
3. Save.

Only trailer embeds are shown unless the licensed video checks pass.

## Add Official Watch Link

In the admin movie form:

1. Choose an official platform.
2. Paste the official `watch_url`.
3. Choose the `link_type` and `open_mode`.
4. Save.

The public movie detail page shows these under **Watch Legally**. OTT platforms such as JioHotstar, Netflix, Prime Video, Zee5 and SonyLIV should normally use `open_mode = in_app_browser` with external fallback. WatchFinder opens the official page inside a legal in-app browser shell when possible, but many OTT sites block iframe/webview playback with CSP or DRM rules. When blocked, WatchFinder shows an **Open Official Site** fallback.

Never scrape OTT videos, bypass DRM, download videos, inject scripts into platform pages, hide the official platform identity, or create fake login pages. User login must happen directly on the official platform.

For future Android/native app work, use a trusted browser surface such as Capacitor Browser or the platform's official app intent/deep link. DRM playback may still require the official app/browser, and platform terms must be respected.

## Add Licensed Video

Full video playback is legal-only:

Allowed license types:

- `self_owned`
- `creator_permission`
- `public_domain`
- `purchased_license`

Steps:

1. In `/admin`, enable `Has licensed video`.
2. Choose provider: `cloudflare_stream`, `vimeo`, `youtube_embed`, `supabase_storage_small_video`, or `external_legal_embed`.
3. Add `video_embed_url` or `video_id`.
4. Fill license owner, dates, notes and territory.
5. Upload proof to `license-documents`.
6. Save.

The movie page shows **Licensed / Permission Verified** and the licensed player only when `movies.has_licensed_video = true`, a playable video URL/ID exists, and a license document exists.

Do not host full movie files on Vercel. Use Cloudflare Stream, Vimeo, YouTube embed, or another legal embed provider. The Supabase `licensed-videos-small` bucket should only be used for small self-owned videos.

## Add Promotion

1. Open `/admin`.
2. Go to **Promotions**.
3. Add title, description, image, placement, URL, dates, priority and active state.
4. Save.

Useful placements:

- `home_hero`
- `home_middle`
- `offers`
- `movie_detail_top`
- `movie_detail_middle`

## Enable Ad Slot Later

1. Open `/admin`.
2. Go to **Ad Slots**.
3. Add `slot_name`, `placement`, approved `ad_code`, and notes.
4. Keep inactive until ready.
5. Turn on `is_active` only for brand-safe legal ad inventory.

Do not use forced popup ads, betting ads, adult ads, fake download ads, redirects, piracy ads, or deceptive ad formats.

## Production Data Safety

Never run destructive seed/reset scripts on production Supabase. Do not run SQL that truncates, drops, deletes, or bulk-archives `movies`, `movie_platform_links`, `movie_genres`, `movie_cast`, `content_channels`, `content_channel_items`, analytics, users, profiles, or storage data unless you have a verified backup and intentionally want that result.

Before major schema or admin changes, export a backup from Supabase or use the Admin Movies **Export JSON Backup** button. Public pages show movies with `status = published`; draft, hidden, and archived movies remain visible in Admin so uploaded content is not lost.

## Main Routes

- `/`
- `/movies`
- `/tv-shows`
- `/anime`
- `/categories`
- `/platforms`
- `/platform/[slug]`
- `/search`
- `/movie/[slug]`
- `/blog`
- `/blog/[slug]`
- `/profile`
- `/favorites`
- `/history`
- `/feedback`
- `/settings`
- `/offers`
- `/admin`

## Legal Guardrails

WatchFinder is a legal discovery platform. It has no torrents, piracy features, scrapers, illegal download buttons, fake play buttons, forced popup ads, or unauthorized streaming flows.

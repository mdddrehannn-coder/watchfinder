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

Use your existing final migration only. This project expects these existing tables:

`profiles`, `genres`, `platforms`, `cast_members`, `movies`, `movie_genres`, `movie_cast`, `movie_platform_links`, `promotions`, `ad_slots`, `blog_posts`, `favorites`, `watch_history`, `feedback_messages`, `license_documents`, `site_settings`.

Use your existing buckets:

`movie-posters`, `movie-banners`, `promotion-banners`, `blog-images`, `avatars`, `license-documents`, `licensed-videos-small`.

No new SQL schema is generated in this repo.

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
3. Add a label like `Watch on Netflix`.
4. Save.

The public movie detail page shows these under **Where to Watch**.

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

# VideosDropper.app

A responsive React + Vite Instagram public-video downloader interface, with a serverless resolver endpoint for media URLs that Instagram exposes in public page HTML.

## Run locally

```bash
npm install
npm run dev
```

The Vite frontend runs locally, but `/api/resolve` is a Vercel serverless function. To test the full flow locally, install Vercel CLI and run `vercel dev`.

## Deploy to Vercel

1. Import `naveedkhan52u/instagram-video-downloader` into Vercel.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Deploy. No environment variables are required for this initial version.

## Important downloader limitations

Instagram frequently changes its page markup and can block automated requests. The resolver only looks for media URLs exposed in the returned HTML of public posts; it does not log in, bypass access controls, or guarantee every public link will work. Some Instagram links will fail. For dependable production coverage, use a reputable, authorized media provider/API and configure its secret key server-side. Do not put provider secrets in frontend code.

Only download content you own or have permission to save. This independent tool is not affiliated with Instagram or Meta. Review the relevant platform terms and copyright requirements before operating the service publicly.

## SEO basics

The homepage has a unique title, description, and canonical URL. Add and verify the production domain in Google Search Console after DNS and deployment are configured. Submit `/sitemap.xml` once the domain is live. Rankings are not guaranteed by indexing alone.
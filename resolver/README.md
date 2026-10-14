# VideosDropper self-hosted resolver

This worker uses the open-source `yt-dlp` project. It does not use a paid media API and does not download or store video files on the worker. It returns a direct media URL when Instagram makes one available.

## Deploy

Deploy the `resolver` directory as a Docker service on a VPS or container host that permits outbound HTTPS requests. Set these environment variables on the worker:

- `RESOLVER_SECRET`: a long random secret (at least 32 characters).
- `PORT`: usually supplied by the host; defaults to 8080.

The worker exposes `GET /health` and a secret-protected `POST /resolve` endpoint.

Then set these variables in Vercel for the VideosDropper project:

- `RESOLVER_URL`: the worker's base URL, for example `https://your-worker.example.com` (no trailing slash).
- `RESOLVER_SECRET`: exactly the same secret configured on the worker.

Redeploy Vercel after setting the variables. The Vercel function will try this worker first. The existing HTML resolver remains a fallback; SaveAPI is only used if its optional `SAVEAPI_API_KEY` is configured.

## Local test

From this directory, build and run the Docker image with `RESOLVER_SECRET` set. Check `GET /health`, then send a POST to `/resolve` with JSON `{"url":"https://www.instagram.com/reel/SHORTCODE/" }` and header `X-Resolver-Secret: your-secret`.

## Limits and safety

- Only public Instagram post/Reel URLs are accepted. Private-account access and login-cookie support are intentionally not included.
- Instagram may block automated requests or change its page format. No resolver can promise every link will work.
- This avoids per-download API charges, not all costs. The VPS/container, bandwidth, and maintenance may cost money.
- Keep the secret private. Do not commit it to GitHub or expose it in browser JavaScript.
- Use the service only for media you are authorized to save and follow Instagram's terms and applicable law.

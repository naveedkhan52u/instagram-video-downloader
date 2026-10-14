const allowedHosts = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

function decodeEscapes(value) {
  return value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0022/gi, '"');
}

function extractVideoUrl(html) {
  const patterns = [
    /"video_url"\s*:\s*"([^"]+)"/i,
    /"playable_url"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const candidate = decodeEscapes(match[1]);
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" && /(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/i.test(parsed.hostname)) return parsed.href;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST to check an Instagram link." });
  }
  const rawUrl = req.body?.url;
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) return res.status(400).json({ error: "Provide a valid Instagram URL." });
  let postUrl;
  try { postUrl = new URL(rawUrl); } catch { return res.status(400).json({ error: "That URL is not valid." }); }
  if (postUrl.protocol !== "https:" || !allowedHosts.has(postUrl.hostname.toLowerCase()) || !/^\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(postUrl.pathname)) {
    return res.status(400).json({ error: "Use a valid public Instagram Reel, video, or post URL." });
  }
  try {
    const response = await fetch(postUrl.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(9000)
    });
    if (!allowedHosts.has(new URL(response.url).hostname.toLowerCase())) return res.status(502).json({ error: "Instagram redirected to an unsupported address." });
    if (!response.ok) return res.status(502).json({ error: "Instagram could not provide this post right now. It may be private, unavailable, or temporarily blocked." });
    const html = await response.text();
    if (html.length > 5_000_000) return res.status(502).json({ error: "The Instagram response was too large to process." });
    const downloadUrl = extractVideoUrl(html);
    if (!downloadUrl) return res.status(422).json({ error: "Instagram did not expose a downloadable video for this link. Private posts, carousels without a video match, and some public posts may not work." });
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
    const title = titleMatch?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&").slice(0, 180) || "Instagram video";
    return res.status(200).json({ downloadUrl, title });
  } catch {
    return res.status(502).json({ error: "Instagram did not respond in time. Please try again later." });
  }
}
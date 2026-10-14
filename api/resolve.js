const allowedHosts = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const mediaHosts = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

function decodeHtml(value) {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#x2F;/gi, "/").replace(/&#47;/gi, "/")
    .replace(/&#x3D;/gi, "=").replace(/&#61;/gi, "=");
}

function decodeEscapes(value) {
  return decodeHtml(value).replace(/\\u0026/gi, "&").replace(/\\u002f/gi, "/")
    .replace(/\\u003d/gi, "=").replace(/\\u0022/gi, '"')
    .replace(/\\\//g, "/").replace(/\\\\/g, "\\");
}

function extractVideoUrl(html) {
  const normalized = decodeHtml(html);
  const patterns = [
    /"video_url"\s*:\s*"([^"]+)"/ig,
    /"playable_url"\s*:\s*"([^"]+)"/ig,
    /"video_versions"\s*:\s*\[\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/ig,
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/ig,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/ig
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      if (!match[1]) continue;
      try {
        const parsed = new URL(decodeEscapes(match[1]));
        if (parsed.protocol === "https:" && mediaHosts.test(parsed.hostname)) return parsed.href;
      } catch {}
    }
  }
  return null;
}

async function fetchInstagramPage(url) {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(9000)
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST to check an Instagram link." });
  }

  const rawUrl = req.body?.url;
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) {
    return res.status(400).json({ error: "Provide a valid Instagram URL." });
  }
  let postUrl;
  try { postUrl = new URL(rawUrl); } catch {
    return res.status(400).json({ error: "That URL is not valid." });
  }
  if (postUrl.protocol !== "https:" || !allowedHosts.has(postUrl.hostname.toLowerCase()) ||
      !/^\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(postUrl.pathname)) {
    return res.status(400).json({ error: "Use a valid public Instagram Reel, video, or post URL." });
  }

  const canonicalPath = postUrl.pathname.endsWith("/") ? postUrl.pathname : postUrl.pathname + "/";
  const shortcode = canonicalPath.split("/").filter(Boolean)[1];
  const candidates = [
    "https://www.instagram.com" + canonicalPath,
    "https://www.instagram.com/p/" + shortcode + "/embed/captioned/"
  ];

  try {
    let html = "";
    let lastStatus = 0;
    for (const candidateUrl of candidates) {
      let response;
      try { response = await fetchInstagramPage(candidateUrl); } catch { continue; }
      const finalUrl = new URL(response.url);
      if (!allowedHosts.has(finalUrl.hostname.toLowerCase())) continue;
      lastStatus = response.status;
      if (!response.ok) continue;
      const body = await response.text();
      if (body.length > 5_000_000) continue;
      html = body;
      const downloadUrl = extractVideoUrl(html);
      if (downloadUrl) {
        const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
        const title = titleMatch?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&").slice(0, 180) || "Instagram video";
        return res.status(200).json({ downloadUrl, title });
      }
    }

    if (lastStatus === 429 || lastStatus === 403) {
      return res.status(502).json({ error: "Instagram is temporarily blocking automated requests. Please try again later. This is an Instagram-side restriction, not an issue with your link format." });
    }
    if (/login\/|accounts\/login|Login • Instagram|Sorry, this page isn't available/i.test(html)) {
      return res.status(422).json({ error: "Instagram returned a login page or unavailable post instead of public video media. This link cannot be downloaded by the current resolver." });
    }
    return res.status(422).json({ error: "Instagram did not provide a direct video file for this post. Instagram often hides media from automated requests, so some public links still require a supported media API. This resolver does not access private posts or bypass login controls." });
  } catch {
    return res.status(502).json({ error: "Instagram did not respond in time. Please try again later." });
  }
}
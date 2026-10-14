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
    /"video_versions"\s*:\s*\[\s*\{\s*"type"\s*:\s*\d+\s*,\s*"url"\s*:\s*"([^"]+)"/ig,
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

function firstProviderVideo(payload) {
  const candidates = [
    ...(Array.isArray(payload?.medias) ? payload.medias : []),
    ...(Array.isArray(payload?.data?.medias) ? payload.data.medias : []),
    ...(Array.isArray(payload?.data?.media?.videos) ? payload.data.media.videos : []),
    ...(Array.isArray(payload?.videos) ? payload.videos : [])
  ];
  for (const item of candidates) {
    const type = String(item?.type || item?.mimeType || item?.ext || "").toLowerCase();
    const url = item?.url || item?.downloadUrl || item?.download_url;
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) continue;
    if (type.includes("video") || type.includes("mp4") || !type) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:") return parsed.href;
      } catch {}
    }
  }
  return null;
}

async function resolveWithSelfHosted(postUrl) {
  const baseUrl = process.env.RESOLVER_URL;
  const secret = process.env.RESOLVER_SECRET;
  if (!baseUrl || !secret) return null;

  const endpoint = new URL("/resolve", baseUrl);
  if (endpoint.protocol !== "https:") {
    throw new Error("RESOLVER_URL must use HTTPS.");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Resolver-Secret": secret,
      Accept: "application/json"
    },
    body: JSON.stringify({ url: postUrl.href }),
    signal: AbortSignal.timeout(14000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || "The self-hosted resolver could not process this link.");
  }
  if (typeof payload?.downloadUrl !== "string" || !/^https:\/\//i.test(payload.downloadUrl)) {
    throw new Error("The self-hosted resolver did not return a valid video URL.");
  }
  return {
    downloadUrl: payload.downloadUrl,
    title: typeof payload.title === "string" ? payload.title.slice(0, 180) : "Instagram video"
  };
}

async function resolveWithProvider(postUrl) {
  const key = process.env.SAVEAPI_API_KEY;
  if (!key) return null;
  const endpoint = new URL("https://api.saveapi.org/v1/download");
  endpoint.searchParams.set("url", postUrl.href);
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("The media API key is missing or invalid. Check SAVEAPI_API_KEY in Vercel environment variables.");
    }
    if (response.status === 429) throw new Error("The media API rate limit or credit limit was reached. Check your provider account.");
    throw new Error("The media API could not resolve this link right now. Please retry shortly.");
  }
  const payload = await response.json();
  const videoUrl = firstProviderVideo(payload);
  if (payload?.success && videoUrl) return { downloadUrl: videoUrl, title: payload?.meta?.title || payload?.title || "Instagram video" };
  throw new Error(payload?.message || payload?.error || "The media API did not return a downloadable video for this public link.");
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
    return res.status(400).json({ error: "Use a valid Instagram Reel, video, or post URL." });
  }

  try {
    if (process.env.RESOLVER_URL && process.env.RESOLVER_SECRET) {
      try {
        const result = await resolveWithSelfHosted(postUrl);
        if (result) return res.status(200).json(result);
      } catch {
        // Continue to the public-page resolver if the self-hosted worker is temporarily unavailable.
      }
    }

    if (process.env.SAVEAPI_API_KEY) {
      const result = await resolveWithProvider(postUrl);
      return res.status(200).json(result);
    }

    const canonicalPath = postUrl.pathname.endsWith("/") ? postUrl.pathname : postUrl.pathname + "/";
    const shortcode = canonicalPath.split("/").filter(Boolean)[1];
    const candidates = [
      "https://www.instagram.com" + canonicalPath,
      "https://www.instagram.com/p/" + shortcode + "/embed/captioned/"
    ];
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
      return res.status(502).json({ error: "Instagram is temporarily blocking automated requests. A self-hosted resolver may also be blocked; try again later." });
    }
    if (/login\/|accounts\/login|Login • Instagram|Sorry, this page isn't available/i.test(html)) {
      return res.status(422).json({ error: "Instagram returned a login page or unavailable post instead of public video media. Only accessible public posts are supported." });
    }
    return res.status(422).json({ error: "Instagram did not expose this video's URL. Configure RESOLVER_URL and RESOLVER_SECRET to use the self-hosted resolver, or try another public Reel. Only save media you are authorized to download." });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "The video could not be resolved right now. Please try again later." });
  }
}
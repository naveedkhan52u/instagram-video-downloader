import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, CircleHelp, Clipboard, Download, Instagram, Link2, LoaderCircle, LockKeyhole, Menu, Play, ShieldCheck, Sparkles, Video, X } from 'lucide-react';
import './styles.css';

const faqs = [
  { q: 'How do I download an Instagram Reel?', a: 'Copy the link to a publicly available Reel, paste it into the box above, and select Download. If the post is accessible and Instagram exposes its media, a download link will appear.' },
  { q: 'Can I download private Instagram videos?', a: 'No. VideosDropper does not access private accounts, bypass login walls, or get around access controls. Use it only with public content you are allowed to save.' },
  { q: 'Does it work on iPhone and Android?', a: 'The website works in modern mobile browsers. After a download starts, your browser may save the file to Downloads or ask where to store it.' },
  { q: 'Why might a link fail?', a: 'The post may be private, deleted, age-restricted, temporarily unavailable, or blocked from automated access. Instagram can also change how its pages deliver media.' },
  { q: 'Is VideosDropper affiliated with Instagram?', a: 'No. VideosDropper is an independent tool and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.' }
];

function App() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setUrl(text.trim()); setError(''); setResult(null); }
    } catch { setError('Clipboard access is unavailable. Paste your link into the box instead.'); }
  };

  const downloadVideo = async (event) => {
    event.preventDefault();
    setError(''); setResult(null);
    let parsed;
    try { parsed = new URL(url.trim()); } catch { setError('Enter a valid Instagram post or Reel URL.'); return; }
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(parsed.hostname.toLowerCase())) {
      setError('Please use a link from instagram.com.'); return;
    }
    if (!/^\/(reel|reels|p|tv)\//i.test(parsed.pathname)) {
      setError('That link does not look like an Instagram Reel, video, or post URL.'); return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.origin + parsed.pathname })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not retrieve media from that link.');
      if (!data.downloadUrl) throw new Error('Instagram did not provide a downloadable video for this post.');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Could not retrieve this media. Please try again later.');
    } finally { setBusy(false); }
  };

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="VideosDropper home"><span className="brand-mark"><ArrowDownToLine size={22} strokeWidth={2.6}/></span><span>videos<span className="brand-accent">dropper</span><small>.app</small></span></a>
      <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
      </nav>
      <a className="header-cta" href="#downloader">Download a video <ArrowRight size={16}/></a>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="hero">
        <div className="hero-glow glow-one"></div><div className="hero-glow glow-two"></div>
        <div className="hero-inner">
          <div className="eyebrow"><span className="status-dot"></span> SIMPLE. QUICK. IN YOUR BROWSER.</div>
          <h1>Your favorite moments.<br/><span>Ready to save.</span></h1>
          <p className="hero-copy">Download publicly available Instagram Reels and videos in a few simple steps. No app installation required.</p>
          <div className="trust-points"><span><ShieldCheck size={16}/> No account needed</span><span><LockKeyhole size={15}/> No login details</span><span><Video size={16}/> Reels & videos</span></div>
          <div id="downloader" className="download-card">
            <div className="card-heading"><div className="insta-icon"><Instagram size={21}/></div><div><strong>Instagram video downloader</strong><span>Paste the link to a public Reel or video</span></div></div>
            <form onSubmit={downloadVideo}>
              <div className="url-input-wrap"><Link2 size={19}/><input value={url} onChange={e => {setUrl(e.target.value); setError(''); setResult(null);}} placeholder="https://www.instagram.com/reel/..." aria-label="Instagram URL" inputMode="url"/><button className="paste-btn" type="button" onClick={pasteLink}><Clipboard size={15}/> Paste</button></div>
              <button className="download-btn" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={19}/> Checking link...</> : <><Download size={19}/> Download video <ArrowRight size={18}/></>}</button>
            </form>
            {error && <div className="message error" role="alert"><CircleHelp size={18}/><span>{error}</span></div>}
            {result && <div className="result-box"><div className="result-heading"><span className="success-icon"><Check size={17}/></span><div><strong>Video link found</strong><small>{result.title || 'Your video is ready if the media link remains available.'}</small></div></div><a className="result-download" href={result.downloadUrl} target="_blank" rel="noreferrer" download><Download size={18}/> Save video <ArrowRight size={17}/></a><p className="result-note">If it opens in a new tab, use your browser’s video menu to save it.</p></div>}
            <p className="privacy-note"><LockKeyhole size={13}/> We never ask for your Instagram password.</p>
          </div>
          <p className="permission-note">Only download content you own or have permission to save. Respect creators’ rights.</p>
        </div>
      </section>

      <section className="steps-section section-wrap" id="how-it-works">
        <div className="section-kicker">THREE SIMPLE STEPS</div><h2>From Instagram to your device.</h2><p className="section-intro">No complicated setup. Just a link and a few clicks.</p>
        <div className="steps-grid">
          <article className="step-card"><div className="step-number">01</div><div className="step-icon"><Instagram/></div><h3>Copy the link</h3><p>Open the public Instagram Reel or video, tap Share, then Copy link.</p></article>
          <article className="step-card"><div className="step-number">02</div><div className="step-icon"><Link2/></div><h3>Paste it here</h3><p>Paste the link into VideosDropper and select Download video.</p></article>
          <article className="step-card"><div className="step-number">03</div><div className="step-icon"><ArrowDownToLine/></div><h3>Save your video</h3><p>When media is available, open the result and save it on your device.</p></article>
        </div>
      </section>

      <section className="features-section" id="features"><div className="section-wrap feature-layout">
        <div><div className="section-kicker">BUILT FOR EVERYDAY USE</div><h2>A straightforward way<br/>to save public videos.</h2><p className="feature-intro">VideosDropper keeps the process focused: paste a link, check availability, and save when a downloadable file is available.</p><a href="#downloader" className="text-link">Try the downloader <ArrowRight size={17}/></a></div>
        <div className="feature-list">
          <div className="feature-item"><span className="feature-icon"><Sparkles/></span><div><h3>Simple by design</h3><p>A clean workflow without extra steps or software installation.</p></div></div>
          <div className="feature-item"><span className="feature-icon"><ShieldCheck/></span><div><h3>No Instagram login</h3><p>Never enter your password. Private posts and login-protected media are not supported.</p></div></div>
          <div className="feature-item"><span className="feature-icon"><Video/></span><div><h3>Made for mobile and desktop</h3><p>Use a modern browser on your phone, tablet, or computer.</p></div></div>
        </div>
      </div></section>

      <section className="faq-section section-wrap" id="faq"><div className="section-kicker">GOOD TO KNOW</div><h2>Frequently asked questions</h2><p className="section-intro">Clear answers, no mystery buttons.</p><div className="faq-list">{faqs.map((faq, i) => <div className={'faq-item ' + (openFaq === i ? 'faq-active' : '')} key={faq.q}><button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>{faq.q}<ChevronDown size={19}/></button>{openFaq === i && <p className="faq-answer">{faq.a}</p>}</div>)}</div></section>
    </main>
    <footer className="footer"><div className="footer-top"><a className="brand" href="/"><span className="brand-mark"><ArrowDownToLine size={21}/></span><span>videos<span className="brand-accent">dropper</span><small>.app</small></span></a><p>A simple tool for publicly available video links.</p></div><div className="footer-bottom"><span>© {new Date().getFullYear()} VideosDropper.app</span><div><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/copyright/">Copyright</a><a href="/contact/">Contact</a></div></div><p className="disclaimer">VideosDropper is an independent service and is not affiliated with Instagram or Meta. Download only content you own or are authorized to save.</p></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
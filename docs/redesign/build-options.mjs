import { writeFileSync, mkdirSync } from "node:fs";

// --- contrast maths (WCAG 2.x) ---
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const options = [
  {
    id: "warm", name: "A. Studio Warm", tag: "The current warm, wooden identity, finished properly",
    blurb: "Keeps what already feels like IDistinguishR (paper, wood, brass) but fixes the weak brass text, loads the intended serif, and tightens everything. Lowest risk; familiar to anyone who has seen the site.",
    fonts: "Fraunces (headings) + Source Sans 3 (text)", gf: "Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600;700",
    display: "'Fraunces', Georgia, serif", body: "'Source Sans 3', system-ui, sans-serif",
    c: { bg: "#FAF6EC", surface: "#FFFFFF", ink: "#231A12", soft: "#54493A", line: "#D9CFB6", header: "#33251A", headerInk: "#FFF8E8",
      primary: "#2F5A4F", onPrimary: "#FFFFFF", accent: "#E0B04A", onAccent: "#231A12", link: "#2F5A4F", accentText: "#7A5A12", error: "#9A3324", focus: "#2F5A4F" },
  },
  {
    id: "indigo", name: "B. Clear Indigo", tag: "Modern marketplace: cool, crisp, high clarity",
    blurb: "A cleaner product look: near-white surfaces, deep ink text, one confident indigo for actions and a warm amber used sparingly as a highlight. Feels most like a modern booking app; least like the current site.",
    fonts: "Bricolage Grotesque (headings) + Figtree (text)", gf: "Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700",
    display: "'Bricolage Grotesque', system-ui, sans-serif", body: "'Figtree', system-ui, sans-serif",
    c: { bg: "#F6F7FB", surface: "#FFFFFF", ink: "#151B33", soft: "#444C69", line: "#D5D9E8", header: "#151B33", headerInk: "#F6F7FB",
      primary: "#2B3A9F", onPrimary: "#FFFFFF", accent: "#F2B134", onAccent: "#151B33", link: "#2B3A9F", accentText: "#8A5A00", error: "#B3261E", focus: "#2B3A9F" },
  },
  {
    id: "terra", name: "C. Terracotta & Sage", tag: "Warm, human, distinctive: softer than A, friendlier than B",
    blurb: "A desaturated terracotta for actions with sage as the calm secondary, on a cream base. More personality and warmth than the indigo option, but a clear break from the current brown-and-brass look.",
    fonts: "DM Serif Display (headings) + DM Sans (text)", gf: "DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700",
    display: "'DM Serif Display', Georgia, serif", body: "'DM Sans', system-ui, sans-serif",
    c: { bg: "#FBF3EA", surface: "#FFFDF9", ink: "#2A1D18", soft: "#5E4B42", line: "#E3D2C2", header: "#FBF3EA", headerInk: "#2A1D18",
      primary: "#A33F25", onPrimary: "#FFFFFF", accent: "#7C9A80", onAccent: "#1D2B21", link: "#8F3720", accentText: "#3F5B45", error: "#A12A1A", focus: "#1F3D2B" },
  },
];

// pairs: [label, fg, bg, min]
const pairsFor = (c) => [
  ["Body text on page", c.ink, c.bg, 4.5],
  ["Body text on cards", c.ink, c.surface, 4.5],
  ["Secondary text on page", c.soft, c.bg, 4.5],
  ["Secondary text on cards", c.soft, c.surface, 4.5],
  ["Button label on primary", c.onPrimary, c.primary, 4.5],
  ["Links on page", c.link, c.bg, 4.5],
  ["Links on cards", c.link, c.surface, 4.5],
  ["Highlight label text on page", c.accentText, c.bg, 4.5],
  ["Text on highlight colour", c.onAccent, c.accent, 4.5],
  ["Error text on cards", c.error, c.surface, 4.5],
  ["Header text on header", c.headerInk, c.header, 4.5],
  ["Focus ring vs page (UI, 3:1)", c.focus, c.bg, 3],
  ["Primary button vs page (UI, 3:1)", c.primary, c.bg, 3],
];

let failures = [];
const sections = options.map((o) => {
  const c = o.c;
  const rows = pairsFor(c).map(([label, fg, bg, min]) => {
    const r = ratio(fg, bg); const ok = r >= min;
    if (!ok) failures.push(`${o.name}: ${label} ${r.toFixed(2)} < ${min}`);
    return `<tr><td>${label}</td><td><span class="sw" style="background:${fg}"></span>${fg} on <span class="sw" style="background:${bg}"></span>${bg}</td><td class="${ok ? "ok" : "bad"}">${r.toFixed(2)}:1</td><td>${ok ? (r >= 7 ? "AAA" : "AA") : "FAIL"}</td></tr>`;
  }).join("");
  const sw = Object.entries(c).map(([k, v]) => `<div class="chip"><span style="background:${v}"></span><b>${k}</b><code>${v}</code></div>`).join("");
  const vars = `--bg:${c.bg};--surface:${c.surface};--ink:${c.ink};--soft:${c.soft};--line:${c.line};--header:${c.header};--headerInk:${c.headerInk};--primary:${c.primary};--onPrimary:${c.onPrimary};--accent:${c.accent};--onAccent:${c.onAccent};--link:${c.link};--accentText:${c.accentText};--error:${c.error};--focus:${c.focus};--display:${o.display};--body:${o.body}`;
  return `
<section class="option" id="${o.id}">
  <div class="opt-head"><h2>${o.name}</h2><p class="tag">${o.tag}</p><p>${o.blurb}</p><p class="meta">Type: ${o.fonts}</p></div>
  <div class="mock" style="${vars}">
    <header class="m-nav"><span class="m-logo">♪ IDistinguishR</span><nav><a href="#${o.id}">Dashboard</a><a href="#${o.id}">Account</a><a href="#${o.id}" class="m-link-on-header">Log in</a></nav></header>
    <div class="m-hero">
      <div>
        <h1>Find an instructor who makes you want to practise.</h1>
        <p class="lead">Search real instructors by instrument, price and availability. Book a lesson in minutes, online or in person.</p>
        <form class="m-search" onsubmit="return false">
          <div class="f"><label for="${o.id}-i">Instrument</label><select id="${o.id}-i"><option>Choose…</option><option>Guitar</option></select></div>
          <div class="f"><label for="${o.id}-l">Location or online</label><input id="${o.id}-l" placeholder="Edinburgh, or online"></div>
          <button class="btn">Search</button>
        </form>
        <div class="m-chips"><span>Drums</span><span>Guitar</span><span>Piano</span><span>Violin</span><span>Voice</span></div>
      </div>
      <img alt="An instructor guiding a student through a guitar lesson" src="https://images.unsplash.com/photo-1758524944402-1903b38f848f?fm=jpg&q=80&w=700&auto=format&fit=crop">
    </div>
    <div class="m-row">
      <article class="m-card">
        <div class="m-card-top"><div class="av" aria-hidden="true">TW</div><div><h3>Tomasz Wiśniewski</h3><p class="soft">Guitar, Voice · Edinburgh</p></div></div>
        <p class="rate"><span class="stars" aria-label="Rated 4.8 out of 5">★★★★★</span> 4.8 <span class="soft">(32 reviews)</span></p>
        <p class="price">£40 <span class="soft">/ hour</span></p>
        <p class="tagline">Next free: <b>Thu 22 Oct</b></p>
        <a class="btn btn-ghost" href="#${o.id}">View profile</a>
      </article>
      <form class="m-card m-form" onsubmit="return false">
        <h3>Log in</h3>
        <div class="f"><label for="${o.id}-e">Email</label><input id="${o.id}-e" type="email" value="you@example.com"></div>
        <div class="f"><label for="${o.id}-p">Password</label><input id="${o.id}-p" class="demo-focus" type="password" value="••••••••"><p class="hint">This field shows the keyboard focus ring.</p></div>
        <p class="err" role="alert"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5v4.2M8 10.8v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Incorrect email or password. Check them and try again.</p>
        <button class="btn">Log in</button>
        <p class="small"><a href="#${o.id}">Forgot password?</a></p>
      </form>
    </div>
  </div>
  <details class="detail" open><summary>Colours and measured contrast (WCAG 2.2)</summary>
    <div class="chips">${sw}</div>
    <table><thead><tr><th>Pair</th><th>Colours</th><th>Ratio</th><th>Level</th></tr></thead><tbody>${rows}</tbody></table>
  </details>
</section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>IDistinguishR redesign: three directions</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${options.map((o) => o.gf).join("&family=")}&display=swap" rel="stylesheet">
<style>
:root{--pbg:#f4f4f2;--pink:#1b1b1b;--psoft:#4a4a4a;--pline:#d6d6d0}
*{box-sizing:border-box}
body{margin:0;background:var(--pbg);color:var(--pink);font:16px/1.55 system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:24px 16px 64px}
.top h1{font-size:28px;margin:8px 0}.top p{max-width:70ch;color:var(--psoft)}
.jump{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.jump a{padding:10px 14px;border:1px solid var(--pline);border-radius:8px;background:#fff;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.jump a:focus-visible{outline:3px solid #1b1b1b;outline-offset:2px}
.option{margin:48px 0;padding-top:16px;border-top:2px solid var(--pline)}
.opt-head h2{margin:0 0 4px;font-size:24px}.tag{font-weight:600;margin:0 0 6px}.meta{color:var(--psoft);font-size:14px}
.mock{margin-top:16px;border:1px solid var(--pline);border-radius:12px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--body)}
.m-nav{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:var(--header);color:var(--headerInk)}
.m-logo{font-family:var(--display);font-size:20px;font-weight:700}
.m-nav nav{display:flex;gap:20px}.m-nav a{color:var(--headerInk);text-decoration:none;font-weight:600}
.m-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:32px;padding:40px 24px;align-items:center}
.m-hero h1{font-family:var(--display);font-size:clamp(30px,4.6vw,48px);line-height:1.08;margin:0 0 14px;letter-spacing:-.01em;text-wrap:balance}
.lead{color:var(--soft);font-size:18px;max-width:52ch;margin:0 0 22px}
.m-hero img{width:100%;aspect-ratio:4/3.4;object-fit:cover;border-radius:12px;border:1px solid var(--line)}
.m-search{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px}
.f{display:flex;flex-direction:column;gap:6px;flex:1;min-width:150px}
label{font-weight:600;font-size:14px;color:var(--ink)}
input,select{font:inherit;min-height:44px;padding:8px 12px;border:1.5px solid var(--soft);border-radius:8px;background:var(--surface);color:var(--ink)}
.demo-focus{outline:3px solid var(--focus);outline-offset:2px}
.btn{font:inherit;font-weight:700;min-height:44px;padding:10px 20px;border-radius:8px;border:2px solid var(--primary);background:var(--primary);color:var(--onPrimary);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.btn-ghost{background:transparent;color:var(--link)}
.m-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.m-chips span{padding:9px 14px;border:1.5px solid var(--line);border-radius:999px;background:var(--surface);font-weight:600;min-height:44px;display:inline-flex;align-items:center}
.m-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:8px 24px 40px}
.m-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px}
.m-card h3{font-family:var(--display);font-size:20px;margin:0 0 2px}
.m-card-top{display:flex;gap:14px;align-items:center;margin-bottom:10px}
.av{width:48px;height:48px;border-radius:50%;background:var(--accent);color:var(--onAccent);display:grid;place-items:center;font-weight:700}
.soft{color:var(--soft)}.rate{margin:6px 0}.stars{color:var(--accentText);letter-spacing:2px}
.price{font-family:var(--display);font-size:24px;margin:4px 0}.tagline{color:var(--accentText);margin:6px 0 14px}
.m-form .f{margin-bottom:14px}.hint{margin:2px 0 0;font-size:13px;color:var(--soft)}
.err{display:flex;gap:8px;align-items:flex-start;color:var(--error);font-weight:600;margin:0 0 14px}.err svg{flex:none;margin-top:3px}
.small{font-size:14px}.small a,.hint a{color:var(--link);text-underline-offset:3px}
.detail{margin-top:16px;border:1px solid var(--pline);border-radius:10px;background:#fff;padding:8px 16px}
.detail summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px}.chip{display:flex;align-items:center;gap:6px;font-size:13px;border:1px solid var(--pline);border-radius:8px;padding:4px 8px}
.chip span{width:18px;height:18px;border-radius:4px;border:1px solid #0003}.chip code{color:var(--psoft)}
table{border-collapse:collapse;width:100%;font-size:14px;margin-bottom:12px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--pline)}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid #0004;margin:0 4px 0 0;vertical-align:-1px}
.ok{color:#14532d;font-weight:700}.bad{color:#9b1c1c;font-weight:700}
.note{background:#fff;border:1px solid var(--pline);border-radius:10px;padding:14px 16px;margin-top:32px}
@media (max-width:760px){.m-hero,.m-row{grid-template-columns:1fr}.m-nav nav{gap:12px}}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
</style></head>
<body><div class="wrap">
<div class="top"><h1>IDistinguishR redesign: three directions</h1>
<p>Each direction below is a live mock using your real wording: the home search, an instructor card and the log in form (with a visible keyboard focus ring and an error message that doesn't rely on colour alone). Every text colour pair is measured against WCAG 2.2 AA (4.5:1 for text, 3:1 for interface shapes); the tables below each mock show the real numbers.</p>
<nav class="jump" aria-label="Jump to a direction">${options.map((o) => `<a href="#${o.id}">${o.name}</a>`).join("")}</nav></div>
${sections}
<div class="note"><b>What every direction fixes (from the audit of the live site):</b> the intended fonts never actually load today (visitors get browser defaults); form fields lack programmatic labels (screen readers hear "edit text"); the small brass step numbers fail contrast at 3.26:1; one focus style exists for the whole site; there is no reduced-motion handling; some pages lack a main landmark or an h1. These get fixed whichever direction you pick.</div>
</div></body></html>`;

mkdirSync("docs/redesign", { recursive: true });
writeFileSync("docs/redesign/design-options.html", html);
console.log(failures.length ? "FAILURES:\n" + failures.join("\n") : "all contrast pairs pass");

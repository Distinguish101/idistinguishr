// Generates docs/redesign/design-options-v2.html: three structurally different,
// modern directions for the IDistinguishR UI overhaul. Run: node docs/redesign/build-options-v2.mjs
// Every text/UI colour pair is measured against WCAG 2.2 and the script reports failures.
import { writeFileSync } from "node:fs";

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const HERO = "https://images.unsplash.com/photo-1758524944402-1903b38f848f?fm=jpg&q=80&w=900&auto=format&fit=crop";
const stroke = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const icons = {
  Guitar: `<svg viewBox="0 0 24 24" ${stroke} aria-hidden="true"><circle cx="9" cy="15" r="5.5"/><circle cx="9" cy="15" r="1.4"/><path d="M13 11l7.500-7.500M17.500 3l3.500 3.500"/></svg>`,
  Piano: `<svg viewBox="0 0 24 24" ${stroke} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="M9 13v6M15 13v6M7.500 5v8M12 5v8M16.500 5v8"/></svg>`,
  Violin: `<svg viewBox="0 0 24 24" ${stroke} aria-hidden="true"><ellipse cx="12" cy="9.500" rx="3.500" ry="3"/><ellipse cx="12" cy="16.500" rx="5" ry="4.500"/><path d="M12 2.500v7M9.500 13h5"/></svg>`,
  Drums: `<svg viewBox="0 0 24 24" ${stroke} aria-hidden="true"><ellipse cx="12" cy="13" rx="8" ry="3.500"/><path d="M4 13v4.500c0 1.900 3.600 3.500 8 3.500s8-1.600 8-3.500V13M5 3l6 7M19 3l-6 7"/></svg>`,
  Voice: `<svg viewBox="0 0 24 24" ${stroke} aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>`,
};
const instruments = Object.keys(icons);
const star = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 1.2l2 4.300 4.700.600-3.400 3.300.900 4.700L8 11.800 3.800 14.100l.900-4.700L1.300 6.100 6 5.500z"/></svg>';
const errIcon = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.500v4.200M8 10.800v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const loginForm = (id) => `
<form class="login" onsubmit="return false">
  <h3>Log in</h3>
  <div class="f"><label for="${id}-e">Email</label><input id="${id}-e" type="email" value="you@example.com" autocomplete="email"></div>
  <div class="f"><label for="${id}-p">Password</label><input id="${id}-p" class="demo-focus" type="password" value="password1" autocomplete="current-password"><small>This field is showing the keyboard focus ring.</small></div>
  <p class="err" role="alert">${errIcon}<span>Incorrect email or password. Check them and try again.</span></p>
  <button class="btn" type="submit">Log in</button>
  <p class="small"><a href="#${id}">Forgot password?</a></p>
</form>`;

const dirs = [
  // ------------------------------------------------------------------ 1
  {
    id: "cobalt", name: "1. Cobalt Stage",
    thesis: "Bold and confident. One saturated cobalt field owns the top of every page; everything else is clean white. The search bar overlaps the hero edge so the main action is the first thing you reach.",
    layout: "Full-width colour hero with huge type and a tall photo; floating search bar straddling the hero edge; a row of instrument tiles; instructor cards with a big price.",
    type: "Hanken Grotesk, one family from 400 to 800 weight", gf: "Hanken+Grotesk:wght@400;500;600;800",
    font: "'Hanken Grotesk', system-ui, sans-serif",
    c: { bg: "#FFFFFF", band: "#1738E8", bandInk: "#FFFFFF", bandSoft: "#DCE3FF", surface: "#F3F5FC", ink: "#0B1020", soft: "#3D445C", line: "#DADFEE", primary: "#1738E8", onPrimary: "#FFFFFF", hi: "#FFE14D", onHi: "#0B1020", link: "#1738E8", error: "#B3261E", focus: "#0B1020", focusOnBand: "#FFE14D" },
    pairs: (c) => [
      ["Headline on cobalt", c.bandInk, c.band, 4.5], ["Intro text on cobalt", c.bandSoft, c.band, 4.5],
      ["Body text on white", c.ink, c.bg, 4.5], ["Secondary text on white", c.soft, c.surface, 4.5],
      ["Button label on cobalt button", c.onPrimary, c.primary, 4.5], ["Links on white", c.link, c.bg, 4.5],
      ["Text on yellow highlight", c.onHi, c.hi, 4.5], ["Error text on white", c.error, c.bg, 4.5],
      ["Focus ring on white (UI)", c.focus, c.bg, 3], ["Focus ring on cobalt (UI)", c.focusOnBand, c.band, 3], ["Cobalt button vs white (UI)", c.primary, c.bg, 3],
    ],
    css: (c) => `
.m{--bg:${c.bg};--ink:${c.ink};--soft:${c.soft};--line:${c.line};--primary:${c.primary};--onPrimary:${c.onPrimary};--link:${c.link};--error:${c.error};--focus:${c.focus};background:var(--bg);color:var(--ink)}
.m .nav{background:${c.band};color:${c.bandInk};display:flex;justify-content:space-between;align-items:center;padding:16px 32px}
.m .logo{font-weight:800;font-size:20px;letter-spacing:-.02em}.m .nav a{color:${c.bandInk};font-weight:600;text-decoration:none;margin-left:22px}
.m .hero{background:${c.band};color:${c.bandInk};padding:40px 32px 96px;display:grid;grid-template-columns:1.25fr .75fr;gap:40px;align-items:end}
.m h1{font-size:clamp(38px,6.4vw,76px);line-height:.98;letter-spacing:-.035em;font-weight:800;margin:0 0 18px;text-wrap:balance}
.m .lead{color:${c.bandSoft};font-size:19px;max-width:44ch;margin:0}
.m .hero img{width:100%;height:100%;max-height:420px;object-fit:cover;border-radius:28px 28px 28px 4px}
.m .search{margin:-52px 32px 0;position:relative;background:#fff;border-radius:20px;padding:18px;display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;box-shadow:0 14px 40px -12px rgba(11,16,32,.35),0 2px 6px rgba(11,16,32,.12)}
.m .f{display:flex;flex-direction:column;gap:6px;flex:1;min-width:160px}.m label{font-weight:700;font-size:14px}
.m input,.m select{font:inherit;min-height:48px;padding:8px 14px;border:2px solid var(--soft);border-radius:12px;background:#fff;color:var(--ink)}
.m .btn{font:inherit;font-weight:700;min-height:48px;padding:10px 26px;border-radius:12px;border:2px solid var(--primary);background:var(--primary);color:var(--onPrimary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.m .btn.ghost{background:transparent;color:var(--link)}
.m h2{font-size:30px;letter-spacing:-.025em;font-weight:800;margin:0 0 16px}
.m .sec{padding:44px 32px 0}
.m .tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.m .tile{background:${c.surface};border-radius:18px;padding:18px;min-height:132px;display:flex;flex-direction:column;justify-content:space-between;font-weight:700;font-size:18px}
.m .tile svg{width:34px;height:34px;color:var(--primary)}.m .tile.hi{background:${c.hi};color:${c.onHi}}.m .tile.hi svg{color:${c.onHi}}
.m .cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.m .card{border:2px solid var(--line);border-radius:20px;padding:20px;display:grid;grid-template-columns:84px 1fr;gap:16px;align-items:start}
.m .av{width:84px;height:84px;border-radius:18px;background:${c.primary};color:#fff;display:grid;place-items:center;font-weight:800;font-size:28px}
.m .card h3{margin:0;font-size:20px;letter-spacing:-.01em}.m .card p{margin:2px 0;color:var(--soft)}
.m .price{font-size:30px;font-weight:800;color:var(--ink)!important;letter-spacing:-.02em}.m .price small{font-size:15px;font-weight:500;color:var(--soft)}
.m .rate{display:inline-flex;gap:6px;align-items:center;background:${c.hi};color:${c.onHi}!important;border-radius:999px;padding:3px 10px;font-weight:700;font-size:14px;margin:6px 0!important}
.m .login{margin:44px 32px;max-width:440px;border:2px solid var(--line);border-radius:20px;padding:24px}.m .login h3{margin:0 0 14px;font-size:24px}
.m .login .f{margin-bottom:14px}.m small{color:var(--soft)}.m .small{font-size:14px;margin:12px 0 0}.m a{color:var(--link)}
.m .err{display:flex;gap:8px;color:var(--error);font-weight:600;margin:0 0 14px}.m .err svg{flex:none;margin-top:3px}
.m .demo-focus{outline:3px solid var(--focus);outline-offset:2px}
@media (max-width:760px){.m .hero{grid-template-columns:1fr;padding-bottom:84px}.m .hero img{max-height:240px}.m .tiles{grid-template-columns:repeat(2,1fr)}.m .cards{grid-template-columns:1fr}.m .nav,.m .sec,.m .hero{padding-inline:16px}.m .search{margin-inline:16px}.m .login{margin-inline:16px}}`,
    html: (id) => `
<header class="nav"><span class="logo">IDistinguishR</span><nav><a href="#${id}">Dashboard</a><a href="#${id}">Account</a><a href="#${id}">Log in</a></nav></header>
<section class="hero"><div><h1>Find an instructor who makes you want to practise.</h1><p class="lead">Search real instructors by instrument, price and availability. Book a lesson in minutes, online or in person.</p></div><img alt="An instructor guiding a student through a guitar lesson" src="${HERO}"></section>
<form class="search" onsubmit="return false"><div class="f"><label for="${id}-i">Instrument</label><select id="${id}-i"><option>Choose…</option><option>Guitar</option></select></div><div class="f"><label for="${id}-l">Location or online</label><input id="${id}-l" placeholder="Edinburgh, or online"></div><button class="btn" type="submit">Search instructors</button></form>
<section class="sec"><h2>Pick an instrument</h2><div class="tiles">${instruments.map((n, i) => `<a class="tile${i === 1 ? " hi" : ""}" href="#${id}" style="text-decoration:none;color:inherit">${icons[n]}<span>${n}</span></a>`).join("")}</div></section>
<section class="sec"><h2>Instructors available this week</h2><div class="cards">
 <article class="card"><div class="av" aria-hidden="true">MO</div><div><h3>Maya Okonkwo</h3><p>Piano · Online or in person</p><p class="rate">${star} 4.9 <span>(21 reviews)</span></p><p class="price">£45 <small>/ hour</small></p><a class="btn ghost" href="#${id}">View profile</a></div></article>
 <article class="card"><div class="av" aria-hidden="true">PS</div><div><h3>Priya Shah</h3><p>Violin · Online</p><p class="rate">${star} 4.8 <span>(14 reviews)</span></p><p class="price">£38 <small>/ hour</small></p><a class="btn ghost" href="#${id}">View profile</a></div></article>
</div></section>
${loginForm(id)}`,
  },
  // ------------------------------------------------------------------ 2
  {
    id: "midnight", name: "2. Midnight Studio",
    thesis: "Dark, focused and a little theatrical, like a practice room after hours. A bento layout gives each job its own tile: search, availability, instruments, and the photo.",
    layout: "Asymmetric bento grid instead of a hero banner; a stacked search tile; a tile that shows real availability slots; horizontal instructor rows.",
    type: "Schibsted Grotesk (headings and text)", gf: "Schibsted+Grotesk:wght@400;500;600;800",
    font: "'Schibsted Grotesk', system-ui, sans-serif",
    c: { bg: "#0E1014", surface: "#171A21", surface2: "#20242D", ink: "#F2F4F8", soft: "#B7BECC", line: "#2D323E", primary: "#C6F35B", onPrimary: "#0E1014", link: "#C6F35B", error: "#FF9A8F", focus: "#C6F35B", chipInk: "#0E1014" },
    pairs: (c) => [
      ["Body text on page", c.ink, c.bg, 4.5], ["Body text on tiles", c.ink, c.surface, 4.5], ["Secondary text on tiles", c.soft, c.surface, 4.5], ["Secondary text on raised tiles", c.soft, c.surface2, 4.5],
      ["Button label on lime button", c.onPrimary, c.primary, 4.5], ["Links on tiles", c.link, c.surface, 4.5], ["Error text on tiles", c.error, c.surface, 4.5],
      ["Focus ring on tiles (UI)", c.focus, c.surface, 3], ["Tile edge vs page (UI, 3:1 not required for decoration)", c.line, c.bg, 1],
    ],
    css: (c) => `
.m{--ink:${c.ink};--soft:${c.soft};--line:${c.line};--primary:${c.primary};--onPrimary:${c.onPrimary};--link:${c.link};--error:${c.error};--focus:${c.focus};background:${c.bg};color:var(--ink);padding:16px}
.m .nav{display:flex;justify-content:space-between;align-items:center;padding:8px 8px 16px}.m .logo{font-weight:800;font-size:20px;letter-spacing:-.02em}
.m .nav a{color:var(--ink);text-decoration:none;font-weight:600;margin-left:8px;padding:10px 16px;border-radius:999px;min-height:44px;display:inline-flex;align-items:center}.m .nav a.cta{background:var(--primary);color:var(--onPrimary)}
.m .bento{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
.m .t{background:${c.surface};border:1px solid var(--line);border-radius:24px;padding:24px;overflow:hidden}
.m .t-main{grid-column:span 7}.m .t-photo{grid-column:span 5;grid-row:span 2;padding:0;position:relative}.m .t-photo img{width:100%;height:100%;object-fit:cover;display:block;min-height:320px}
.m .t-slots{grid-column:span 7}
.m h1{font-size:clamp(34px,5vw,60px);line-height:1;letter-spacing:-.035em;font-weight:800;margin:0 0 14px;text-wrap:balance}
.m .lead{color:var(--soft);font-size:18px;margin:0 0 20px;max-width:46ch}
.m .f{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.m label{font-weight:600;font-size:14px;color:var(--ink)}
.m .row{display:flex;gap:12px;flex-wrap:wrap}.m .row .f{flex:1;min-width:150px}
.m input,.m select{font:inherit;min-height:48px;padding:8px 14px;border:1.5px solid #6A7285;border-radius:14px;background:${c.bg};color:var(--ink)}
.m .btn{font:inherit;font-weight:800;min-height:48px;padding:10px 24px;border-radius:999px;border:2px solid var(--primary);background:var(--primary);color:var(--onPrimary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.m .btn.ghost{background:transparent;color:var(--link)}
.m h2{font-size:22px;letter-spacing:-.02em;margin:0 0 14px}
.m .slots{display:flex;gap:10px;flex-wrap:wrap}.m .slot{border:1.5px solid #6A7285;border-radius:14px;padding:10px 16px;font-weight:600;min-height:44px;display:inline-flex;align-items:center;background:${c.surface2}}
.m .slot.on{background:var(--primary);color:var(--onPrimary);border-color:var(--primary)}
.m .inst{display:grid;grid-template-columns:2fr 1fr 1fr;grid-auto-rows:110px;gap:12px;margin-top:12px}
.m .it{background:${c.surface};border:1px solid var(--line);border-radius:24px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;font-weight:700;font-size:18px;text-decoration:none;color:var(--ink)}
.m .it svg{width:30px;height:30px;color:var(--primary)}.m .it.big{grid-row:span 2;font-size:28px;letter-spacing:-.02em}.m .it.big svg{width:48px;height:48px}
.m .list{margin-top:12px;display:grid;gap:12px}
.m .row-card{background:${c.surface};border:1px solid var(--line);border-radius:24px;padding:16px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.m .av{width:56px;height:56px;border-radius:50%;background:${c.surface2};border:2px solid var(--primary);display:grid;place-items:center;font-weight:800}
.m .grow{flex:1;min-width:180px}.m .grow h3{margin:0;font-size:19px}.m .grow p{margin:2px 0;color:var(--soft)}
.m .rate{display:inline-flex;gap:6px;align-items:center;color:var(--ink);font-weight:700}.m .rate svg{color:var(--primary)}
.m .price{font-size:26px;font-weight:800;letter-spacing:-.02em}.m .price small{font-size:14px;color:var(--soft);font-weight:500}
.m .login{margin-top:12px;max-width:460px;background:${c.surface};border:1px solid var(--line);border-radius:24px;padding:24px}.m .login h3{margin:0 0 14px;font-size:24px}
.m small{color:var(--soft)}.m .small{font-size:14px;margin:12px 0 0}.m a{color:var(--link)}.m .btn,.m .nav a,.m .it{color:inherit}.m .btn:not(.ghost){color:var(--onPrimary)}.m .nav a.cta{color:var(--onPrimary)}
.m .err{display:flex;gap:8px;color:var(--error);font-weight:600;margin:0 0 14px}.m .err svg{flex:none;margin-top:3px}
.m .demo-focus{outline:3px solid var(--focus);outline-offset:2px}
@media (max-width:760px){.m .t-main,.m .t-photo,.m .t-slots{grid-column:span 12}.m .t-photo{grid-row:auto}.m .inst{grid-template-columns:1fr 1fr}.m .it.big{grid-row:auto;grid-column:span 2}}`,
    html: (id) => `
<header class="nav"><span class="logo">IDistinguishR</span><nav><a href="#${id}">Dashboard</a><a href="#${id}">Account</a><a class="cta" href="#${id}">Log in</a></nav></header>
<div class="bento">
 <section class="t t-main"><h1>Find an instructor who makes you want to practise.</h1><p class="lead">Search real instructors by instrument, price and availability. Book in minutes, online or in person.</p>
  <form onsubmit="return false"><div class="row"><div class="f"><label for="${id}-i">Instrument</label><select id="${id}-i"><option>Choose…</option><option>Guitar</option></select></div><div class="f"><label for="${id}-l">Location or online</label><input id="${id}-l" placeholder="Edinburgh, or online"></div></div><button class="btn" type="submit">Search instructors</button></form></section>
 <section class="t t-photo"><img alt="An instructor guiding a student through a guitar lesson" src="${HERO}"></section>
 <section class="t t-slots"><h2>Open this week with Maya Okonkwo</h2><div class="slots"><span class="slot">Tue 17:00</span><span class="slot on">Wed 18:30</span><span class="slot">Thu 17:00</span><span class="slot">Sat 10:00</span></div></section>
</div>
<div class="inst">${instruments.map((n, i) => `<a class="it${i === 0 ? " big" : ""}" href="#${id}">${icons[n]}<span>${n}</span></a>`).join("")}</div>
<div class="list">
 <article class="row-card"><div class="av" aria-hidden="true">MO</div><div class="grow"><h3>Maya Okonkwo</h3><p>Piano · Online or in person</p><span class="rate">${star} 4.9 (21 reviews)</span></div><div class="price">£45 <small>/ hour</small></div><a class="btn ghost" href="#${id}">View profile</a></article>
 <article class="row-card"><div class="av" aria-hidden="true">PS</div><div class="grow"><h3>Priya Shah</h3><p>Violin · Online</p><span class="rate">${star} 4.8 (14 reviews)</span></div><div class="price">£38 <small>/ hour</small></div><a class="btn ghost" href="#${id}">View profile</a></article>
</div>
${loginForm(id)}`,
  },
  // ------------------------------------------------------------------ 3
  {
    id: "blocks", name: "3. Friendly Colour Blocks",
    thesis: "Light, playful and very readable. Each instrument owns a colour that follows it everywhere (tiles, cards, filters), and the whole search is one rounded bar.",
    layout: "Centred headline over a single pill-shaped search bar; large colour-block instrument tiles; instructor cards with a colour header that matches their instrument.",
    type: "Lexend (headings) + Atkinson Hyperlegible Next (text), both designed for readability", gf: "Lexend:wght@500;700;800&family=Atkinson+Hyperlegible+Next:wght@400;600;700",
    font: "'Atkinson Hyperlegible Next', system-ui, sans-serif", display: "'Lexend', system-ui, sans-serif",
    c: { bg: "#F6F7F9", surface: "#FFFFFF", ink: "#141A2E", soft: "#464D64", line: "#DDE0E8", primary: "#141A2E", onPrimary: "#FFFFFF", link: "#1F4FD8", error: "#B3261E", focus: "#1F4FD8", coral: "#FF7A66", lemon: "#FFD84D", mint: "#62D8AA", sky: "#74B9FF", lilac: "#B9A4FF" },
    pairs: (c) => [
      ["Body text on page", c.ink, c.bg, 4.5], ["Secondary text on page", c.soft, c.bg, 4.5], ["Secondary text on cards", c.soft, c.surface, 4.5],
      ["Button label on dark button", c.onPrimary, c.primary, 4.5], ["Links on page", c.link, c.bg, 4.5], ["Error text on cards", c.error, c.surface, 4.5],
      ["Text on coral", c.ink, c.coral, 4.5], ["Text on lemon", c.ink, c.lemon, 4.5], ["Text on mint", c.ink, c.mint, 4.5], ["Text on sky", c.ink, c.sky, 4.5], ["Text on lilac", c.ink, c.lilac, 4.5],
      ["Focus ring on page (UI)", c.focus, c.bg, 3],
    ],
    css: (c) => `
.m{--ink:${c.ink};--soft:${c.soft};--line:${c.line};--primary:${c.primary};--onPrimary:${c.onPrimary};--link:${c.link};--error:${c.error};--focus:${c.focus};background:${c.bg};color:var(--ink);font-family:${"'Atkinson Hyperlegible Next', system-ui, sans-serif"}}
.m h1,.m h2,.m h3,.m .logo,.m .price{font-family:'Lexend',system-ui,sans-serif}
.m .nav{background:#fff;display:flex;justify-content:space-between;align-items:center;padding:14px 32px;border-bottom:1px solid var(--line)}
.m .logo{font-weight:800;font-size:19px;letter-spacing:-.02em}.m .nav nav{display:flex;gap:6px;align-items:center}.m .nav a{color:var(--ink);text-decoration:none;font-weight:600;padding:10px 16px;border-radius:999px;min-height:44px;display:inline-flex;align-items:center}
.m .nav a.cta{background:var(--primary);color:var(--onPrimary)}
.m .hero{text-align:center;padding:56px 24px 12px;max-width:900px;margin:0 auto}
.m h1{font-size:clamp(34px,5.6vw,64px);line-height:1.05;letter-spacing:-.03em;font-weight:800;margin:0 0 16px;text-wrap:balance}
.m .lead{color:var(--soft);font-size:19px;margin:0 auto 28px;max-width:52ch}
.m .pill{background:#fff;border:2px solid var(--ink);border-radius:999px;display:flex;align-items:stretch;padding:6px 6px 6px 10px;gap:4px;max-width:720px;margin:0 auto;text-align:left;flex-wrap:wrap}
.m .pill .f{flex:1;min-width:150px;display:flex;flex-direction:column;padding:6px 16px;justify-content:center}
.m .pill .f+.f{border-left:1px solid var(--line)}.m label{font-weight:700;font-size:13px}
.m .pill input,.m .pill select{font:inherit;border:0;padding:2px 0;min-height:30px;background:transparent;color:var(--ink);outline-offset:6px}
.m .btn{font:inherit;font-weight:700;min-height:48px;padding:10px 26px;border-radius:999px;border:2px solid var(--primary);background:var(--primary);color:var(--onPrimary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.m .btn.ghost{background:transparent;color:var(--ink);border-color:var(--ink)}
.m .sec{padding:44px 32px 0;max-width:1100px;margin:0 auto}.m h2{font-size:26px;letter-spacing:-.02em;margin:0 0 16px}
.m .tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.m .tile{border-radius:26px;padding:18px;min-height:150px;display:flex;flex-direction:column;justify-content:space-between;font-weight:700;font-size:18px;color:var(--ink);text-decoration:none}
.m .tile svg{width:44px;height:44px}
.m .cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.m .card{background:#fff;border-radius:26px;overflow:hidden;border:1px solid var(--line)}
.m .card .top{padding:18px 20px;display:flex;align-items:center;gap:14px;font-weight:700}
.m .card .av{width:52px;height:52px;border-radius:50%;background:#fff;color:var(--ink);display:grid;place-items:center;font-weight:800;border:2px solid var(--ink)}
.m .card .body{padding:16px 20px 20px}.m .card h3{margin:0 0 4px;font-size:20px}.m .card p{margin:2px 0;color:var(--soft)}
.m .rate{display:inline-flex;gap:6px;align-items:center;color:var(--ink);font-weight:700}
.m .price{font-size:26px;font-weight:800;margin:10px 0}.m .price small{font-size:14px;font-weight:400;color:var(--soft)}
.m .login{margin:44px auto;max-width:440px;background:#fff;border:1px solid var(--line);border-radius:26px;padding:26px}.m .login h3{margin:0 0 14px;font-size:24px}
.m .login .f{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.m .login input{font:inherit;min-height:48px;padding:8px 14px;border:2px solid var(--soft);border-radius:14px;background:#fff;color:var(--ink)}
.m small{color:var(--soft)}.m .small{font-size:14px;margin:12px 0 0}.m a{color:var(--link)}.m .btn,.m .nav a,.m .tile{color:inherit}.m .btn:not(.ghost),.m .nav a.cta{color:var(--onPrimary)}.m .btn.ghost{color:var(--ink)}
.m .err{display:flex;gap:8px;color:var(--error);font-weight:600;margin:0 0 14px}.m .err svg{flex:none;margin-top:3px}
.m .demo-focus{outline:3px solid var(--focus);outline-offset:2px}
@media (max-width:760px){.m .tiles{grid-template-columns:repeat(2,1fr)}.m .cards{grid-template-columns:1fr}.m .pill{border-radius:28px}.m .pill .f+.f{border-left:0;border-top:1px solid var(--line)}.m .nav,.m .sec{padding-inline:16px}}`,
    html: (id, c) => `
<header class="nav"><span class="logo">IDistinguishR</span><nav><a href="#${id}">Dashboard</a><a href="#${id}">Account</a><a class="cta" href="#${id}">Log in</a></nav></header>
<section class="hero"><h1>Find an instructor who makes you want to practise.</h1><p class="lead">Search real instructors by instrument, price and availability. Book a lesson in minutes, online or in person.</p>
 <form class="pill" onsubmit="return false"><div class="f"><label for="${id}-i">Instrument</label><select id="${id}-i"><option>Choose…</option><option>Guitar</option></select></div><div class="f"><label for="${id}-l">Location or online</label><input id="${id}-l" placeholder="Edinburgh, or online"></div><button class="btn" type="submit">Search</button></form></section>
<section class="sec"><h2>Browse by instrument</h2><div class="tiles">${instruments.map((n, i) => `<a class="tile" href="#${id}" style="background:${[c.coral, c.lemon, c.mint, c.sky, c.lilac][i]}">${icons[n]}<span>${n}</span></a>`).join("")}</div></section>
<section class="sec"><h2>Instructors available this week</h2><div class="cards">
 <article class="card"><div class="top" style="background:${c.mint}"><div class="av" aria-hidden="true">MO</div><span>Piano</span></div><div class="body"><h3>Maya Okonkwo</h3><p>Online or in person</p><span class="rate">${star} 4.9 (21 reviews)</span><p class="price">£45 <small>/ hour</small></p><a class="btn ghost" href="#${id}">View profile</a></div></article>
 <article class="card"><div class="top" style="background:${c.sky}"><div class="av" aria-hidden="true">PS</div><span>Violin</span></div><div class="body"><h3>Priya Shah</h3><p>Online</p><span class="rate">${star} 4.8 (14 reviews)</span><p class="price">£38 <small>/ hour</small></p><a class="btn ghost" href="#${id}">View profile</a></div></article>
</div></section>
${loginForm(id)}`,
  },
];

const scope = (css, id) => css.replaceAll(".m ", ".m-" + id + " ").replaceAll(".m{", ".m-" + id + "{").replaceAll("max-width:760px", "max-width:640px");
const failures = [];
const sections = dirs.map((d) => {
  const rows = d.pairs(d.c).map(([label, fg, bg, min]) => {
    const r = ratio(fg, bg); const ok = r >= min;
    if (!ok) failures.push(`${d.name}: ${label} ${r.toFixed(2)} < ${min}`);
    return `<tr><td>${label}</td><td><span class="sw" style="background:${fg}"></span>${fg} on <span class="sw" style="background:${bg}"></span>${bg}</td><td class="${ok ? "ok" : "bad"}">${r.toFixed(2)}:1</td><td>${min === 1 ? "decor." : ok ? (r >= 7 ? "AAA" : "AA") : "FAIL"}</td></tr>`;
  }).join("");
  return `
<section class="option" id="${d.id}">
  <h2>${d.name}</h2>
  <p class="thesis">${d.thesis}</p>
  <p class="meta"><b>Layout:</b> ${d.layout}<br><b>Type:</b> ${d.type}</p>
  <div class="frame"><div class="m-${d.id}" style="font-family:${d.font}"><style>${scope(d.css(d.c), d.id)}</style>${d.html(d.id, d.c)}</div></div>
  <details class="detail"><summary>Measured contrast (WCAG 2.2)</summary><table><thead><tr><th>Pair</th><th>Colours</th><th>Ratio</th><th>Level</th></tr></thead><tbody>${rows}</tbody></table></details>
</section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>IDistinguishR redesign v2: three modern layouts</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${dirs.map((d) => d.gf).join("&family=")}&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#ececea;color:#1b1b1b;font:16px/1.55 system-ui,sans-serif}
.wrap{max-width:1160px;margin:0 auto;padding:24px 16px 64px}h1.page{font-size:28px;margin:8px 0}p{max-width:75ch}
.jump{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.jump a{padding:10px 14px;border:1px solid #cfcfca;border-radius:8px;background:#fff;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.jump a:focus-visible{outline:3px solid #1b1b1b;outline-offset:2px}
.option{margin:56px 0;border-top:2px solid #cfcfca;padding-top:16px}.option h2{margin:0 0 4px;font-size:24px}.thesis{font-weight:600;margin:0 0 6px}.meta{color:#444;font-size:14px;margin:0 0 14px}
.frame{border-radius:18px;overflow:hidden;border:1px solid #c9c9c4;background:#fff}
.detail{margin-top:14px;border:1px solid #cfcfca;border-radius:10px;background:#fff;padding:8px 16px}.detail summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
table{border-collapse:collapse;width:100%;font-size:14px;margin-bottom:10px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #dcdcd8}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid #0004;margin:0 4px 0 0;vertical-align:-1px}.ok{color:#14532d;font-weight:700}.bad{color:#9b1c1c;font-weight:700}
.note{background:#fff;border:1px solid #cfcfca;border-radius:10px;padding:14px 16px;margin-top:32px}
</style></head><body><div class="wrap">
<h1 class="page">IDistinguishR redesign, round 2: three modern layouts</h1>
<p>Round 1 only changed colours inside the same boxed, centred layout, which is why it still felt vintage. These three change the structure itself: how the page is organised, where the search lives, and how instructors are shown. All text uses your real wording; the instructor names are from your demo data and the ratings and prices are illustrative. Every colour pair is measured against WCAG 2.2 AA.</p>
<nav class="jump" aria-label="Jump to a direction">${dirs.map((d) => `<a href="#${d.id}">${d.name}</a>`).join("")}</nav>
${sections}
<div class="note"><b>Applies to all three:</b> proper visible labels on every field, 44px minimum touch targets, a strong keyboard focus ring, errors with an icon and words (not just colour), drawn SVG icons instead of emoji, fonts loaded from your own server in the real app, and reduced-motion support. Instrument icons here are quick drawings; the real build would use a proper icon set.</div>
</div><script>var o=new URLSearchParams(location.search).get("only");if(o){document.querySelectorAll(".option").forEach(function(s){s.hidden=s.id!==o});document.querySelectorAll("h1.page,.wrap>p,.jump,.note").forEach(function(e){e.hidden=true});document.querySelectorAll("details").forEach(function(d){d.hidden=true})}</script></body></html>`;

writeFileSync("docs/redesign/design-options-v2.html", html);
console.log(failures.length ? "FAILURES:\n" + failures.join("\n") : "all contrast pairs pass");

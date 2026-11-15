/* ==========================================================================
   Hong Kong Urban Explorer — shared shell & helpers
   ========================================================================== */
(function () {
  "use strict";

  const NAV = [
    { href: "index.html", label: "Home", en: "首页" },
    { href: "map.html", label: "Map", en: "探索地图" },
    { href: "explore.html", label: "Listings", en: "房源" },
    { href: "campus.html", label: "Campuses", en: "校区" },
    { href: "insights.html", label: "Rental Insights", en: "租金洞察" },
    { href: "guide.html", label: "Living Guide", en: "生活指南" },
    { href: "about.html", label: "About", en: "方法" },
  ];

  const LOGO = `<svg class="brand__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="23" fill="#244C61"/>
    <path d="M4 33c4.5-1.6 8 1.2 12.4-.4 4.3-1.6 7.6 1.3 11.8-.3 4.2-1.6 7.6 1.2 11.8-.4 1.7-.7 3.3-.6 4 0" stroke="#6F9E8B" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
    <path d="M31 33V14.5l-9 9.5h4.4" stroke="#F7F7F2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="31" cy="33" r="2.6" fill="#F2C94C"/>
    <path d="M12 18.5c2.6-3 4.4-4.6 6.6-4.6 2.3 0 3.6 1.7 2.2 4.6" stroke="#DCE9EA" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

  function currentPage() {
    const p = location.pathname.split("/").pop() || "index.html";
    return p.toLowerCase();
  }

  function renderNav() {
    const host = document.querySelector("[data-nav]");
    if (!host) return;
    const cur = currentPage();
    host.className = "nav";
    host.innerHTML = `
      <div class="nav__inner">
        <a class="brand" href="index.html" aria-label="Hong Kong Urban Explorer">
          ${LOGO}
          <span class="brand__text">
            <span class="brand__name">Hong Kong Urban Explorer</span>
            <span class="brand__sub">港八大 · 租房图鉴</span>
          </span>
        </a>
        <nav class="nav__links" aria-label="Main">
          ${NAV.map((n) => `<a class="nav__link" href="${n.href}" ${n.href === cur ? 'aria-current="page"' : ""} title="${n.en}">${n.label}</a>`).join("")}
        </nav>
        <a class="nav__cta" href="map.html">打开地图 <span aria-hidden="true">↗</span></a>
        <button class="nav__burger" aria-label="Menu"><span></span></button>
      </div>`;
  }

  function renderFooter() {
    const host = document.querySelector("[data-footer]");
    if (!host) return;
    host.className = "footer";
    host.innerHTML = `
      <div class="wrap">
        <div class="footer__grid">
          <div>
            <div class="footer__brand">Hong Kong Urban Explorer</div>
            <p class="footer__note">Explore Hong Kong. Find Your Home.<br>
            面向港八大硕士生的租房信息可视化平台，用一张地图解释租金、通勤与生活便利。</p>
            <p class="footer__note" style="margin-top:16px;opacity:.6">数据快照 2026-11-05 · 9,127 条在租挂牌 · 18 个生活圈</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><a href="map.html">探索地图</a></li>
              <li><a href="explore.html">房源浏览</a></li>
              <li><a href="insights.html">租金报告</a></li>
            </ul>
          </div>
          <div>
            <h4>Campus</h4>
            <ul>
              <li><a href="campus.html?c=HKU">香港大学</a></li>
              <li><a href="campus.html?c=CUHK">香港中文大学</a></li>
              <li><a href="campus.html?c=CityU%2FHKBU">城大 / 浸大</a></li>
              <li><a href="campus.html?c=PolyU">理工大学</a></li>
            </ul>
          </div>
          <div>
            <h4>Method</h4>
            <ul>
              <li><a href="about.html">数据来源与口径</a></li>
              <li><a href="about.html#caveats">四条局限</a></li>
              <li><a href="guide.html">生活指南</a></li>
            </ul>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© 2026 Hong Kong Urban Explorer · 学生租房可视化研究</span>
          <span>数字取自 28Hse 清洗版交付包，不重新估算 · 地图底图 © OpenStreetMap contributors © CARTO</span>
        </div>
      </div>`;
  }

  /* ---------------- formatting ---------------- */
  const fmt = {
    money(v, withHK) {
      const n = Math.round(v).toLocaleString("en-US");
      return (withHK ? "HK$" : "") + n;
    },
    k(v) {
      const n = v >= 10000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "K" : (v / 1000).toFixed(1) + "K";
      return n;
    },
    pct(v, d) {
      return (v * 1).toFixed(d === undefined ? 1 : d) + "%";
    },
    area(name) {
      return String(name).replace(/\|/g, " / ");
    },
  };

  /* ---------------- data helpers ---------------- */
  const LEVELS = (window.HKUE_META && window.HKUE_META.levels) || [];

  function levelColor(l) {
    const f = LEVELS.find((x) => x.level === l);
    return f ? f.color : "#6F9E8B";
  }
  function levelMeta(l) {
    return LEVELS.find((x) => x.level === l) || LEVELS[0];
  }
  function levelOf(rent) {
    if (rent < 13000) return 1;
    if (rent < 16000) return 2;
    if (rent < 20000) return 3;
    if (rent < 28000) return 4;
    return 5;
  }

  /* ---------------- tiny svg chart kit ---------------- */
  function el(tag, attrs) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    return n;
  }

  function sparkline(values, opts) {
    const o = Object.assign({ w: 120, h: 34, color: "#244C61", fill: true, strokeWidth: 2 }, opts);
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [
      (i / (values.length - 1)) * o.w,
      o.h - 3 - ((v - min) / span) * (o.h - 6),
    ]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${o.w} ${o.h}" width="${o.w}" height="${o.h}" fill="none" aria-hidden="true">
      ${o.fill ? `<path d="${d} L${o.w},${o.h} L0,${o.h} Z" fill="${o.color}" opacity=".1"/>` : ""}
      <path d="${d}" stroke="${o.color}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ---------------- misc ui ---------------- */
  function reveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((i) => i.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach((i) => io.observe(i));
  }

  function countUp(scope) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (scope || document).querySelectorAll("[data-count]").forEach((node) => {
      const target = parseFloat(node.dataset.count);
      const dec = parseInt(node.dataset.dec || "0", 10);
      const prefix = node.dataset.prefix || "";
      const suffix = node.dataset.suffix || "";
      const write = (v) => {
        node.textContent = prefix + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      };
      if (reduce) { write(target); return; }
      let start = null;
      const dur = 1100;
      function tick(t) {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        write(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  const qs = (s, r) => (r || document).querySelector(s);
  const qsa = (s, r) => Array.from((r || document).querySelectorAll(s));

  window.HKUE = {
    fmt, LEVELS, levelColor, levelMeta, levelOf, el, sparkline, reveal, countUp, qs, qsa,
    data: {
      get meta() { return window.HKUE_META || {}; },
      get areas() { return window.HKUE_AREAS || []; },
      get campuses() { return window.HKUE_CAMPUSES || []; },
      get listings() { return window.HKUE_LISTINGS || []; },
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderNav();
    renderFooter();
    reveal();
    countUp();
    const burger = qs(".nav__burger");
    if (burger) burger.addEventListener("click", () => {
      const links = qs(".nav__links");
      if (!links) return;
      const open = links.dataset.open === "1";
      links.dataset.open = open ? "0" : "1";
      links.style.display = open ? "" : "flex";
      links.style.position = "absolute";
      links.style.top = "100%";
      links.style.left = "0";
      links.style.right = "0";
      links.style.flexDirection = "column";
      links.style.background = "#fff";
      links.style.padding = "16px 24px";
      links.style.gap = "4px";
      links.style.boxShadow = "0 24px 40px -28px rgba(22,50,63,.6)";
    });
  });
})();

/* ==========================================================================
   Illustrated Hong Kong map poster (pure SVG, deterministic)
   Used as the hero visual — 港式城市插画风 + 港铁线路骨架
   ========================================================================== */
(function () {
  "use strict";

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Catmull-Rom resampling — smooth coastlines that stay point-testable */
  function densify(pts, step) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const seg = step || 8;
      for (let t = 0; t < 1; t += 1 / seg) {
        const t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }

  function toPath(pts, close) {
    let d = "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
    return close ? d + "Z" : d;
  }

  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------------- geography (stylised, 1000 × 760) ---------------- */
  const KOWLOON = [
    [-40, 300], [110, 288], [210, 306], [300, 296], [390, 316], [470, 306],
    [560, 292], [650, 310], [760, 326], [880, 306], [1000, 300],
    [1040, -40], [-40, -40],
  ];
  const ISLAND = [
    [-40, 476], [80, 456], [170, 486], [260, 470], [350, 500], [450, 488],
    [540, 462], [610, 438], [700, 452], [800, 462], [880, 430], [1000, 444],
    [1040, 800], [-40, 800],
  ];
  const LAMMA = [[-40, 690], [40, 676], [130, 700], [90, 760], [-40, 760]];

  const kow = densify(KOWLOON, 9);
  const isl = densify(ISLAND, 9);
  const lam = densify(LAMMA, 9);

  /* ---------------- blocks ---------------- */
  const BLOCK_COLORS = ["#EFE7D5", "#E8DFC9", "#F6F2E6", "#EBE2CE", "#E2D8C1", "#F2ECDD", "#F9F6EC"];
  const MIX = ["#CFE2D1", "#D6E9EA", "#F7F3E8", "#E4D9C4"];

  function blocksFor(poly, seed, sc) {
    const r = rng(seed);
    const out = [];
    const cell = 26 * (sc || 1);
    for (let y = -30; y < 790; y += cell) {
      for (let x = -30; x < 1030; x += cell) {
        const jx = x + (r() - 0.5) * 4, jy = y + (r() - 0.5) * 4;
        if (!inPoly(jx + cell / 2, jy + cell / 2, poly)) continue;
        if (r() < 0.1) continue;
        const w = cell * (0.56 + r() * 0.3);
        const h = cell * (0.54 + r() * 0.32);
        const pal = r() < 0.13 ? MIX[(r() * MIX.length) | 0] : BLOCK_COLORS[(r() * BLOCK_COLORS.length) | 0];
        const rot = (r() - 0.5) * 3;
        out.push({
          x: jx + (cell - w) / 2, y: jy + (cell - h) / 2, w, h, rot,
          fill: pal, op: 0.92 + r() * 0.08,
          tall: r() < 0.3,
        });
      }
    }
    return out;
  }

  function blocksSvg(list) {
    return list
      .map((b) => {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        let s = `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}"
          rx="2" fill="${b.fill}" opacity="${b.op.toFixed(2)}"
          transform="rotate(${b.rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
        if (b.tall) {
          s += `<rect x="${(b.x + b.w * 0.24).toFixed(1)}" y="${(b.y + b.h * 0.26).toFixed(1)}" width="${(b.w * 0.5).toFixed(1)}" height="${(b.h * 0.34).toFixed(1)}" rx="1.2" fill="#FFFFFF" opacity=".6" transform="rotate(${b.rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
        }
        return s;
      })
      .join("");
  }

  /* ---------------- parks ---------------- */
  function park(cx, cy, rr, r, fill) {
    let d = "";
    const n = 14;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = rr * (0.78 + r() * 0.42);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.72]);
    }
    d = toPath(densify(pts.concat([pts[0], pts[1]]), 6), true);
    let trees = "";
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2, rr2 = r() * rr * 0.55;
      trees += `<circle cx="${(cx + Math.cos(a) * rr2).toFixed(1)}" cy="${(cy + Math.sin(a) * rr2 * 0.7).toFixed(1)}" r="${(2.2 + r() * 2).toFixed(1)}" fill="#7FB287" opacity=".55"/>`;
    }
    return `<path d="${d}" fill="${fill || "#C4DCBF"}"/><path d="${d}" fill="none" stroke="#A9CDA5" stroke-width="1.2" opacity=".8"/>${trees}`;
  }

  /* ---------------- MTR skeleton ---------------- */
  const LINES = [
    {
      name: "Island Line", color: "#5C9EC9",
      pts: [[-20, 560], [90, 552], [180, 532], [270, 522], [360, 538], [450, 524], [540, 496], [620, 470], [700, 486], [800, 494], [900, 464], [1020, 470]],
      stations: [[90, 552], [270, 522], [450, 524], [620, 470], [800, 494]],
    },
    {
      name: "Tsuen Wan Line", color: "#C86A63",
      pts: [[250, -20], [262, 90], [246, 180], [262, 262], [300, 330], [352, 402], [420, 470], [500, 500]],
      stations: [[262, 120], [258, 226], [300, 330], [420, 470]],
    },
    {
      name: "Kwun Tong Line", color: "#6FAF72",
      pts: [[520, -20], [548, 80], [566, 168], [600, 246], [640, 312], [672, 372], [700, 486]],
      stations: [[548, 80], [566, 168], [640, 312]],
    },
    {
      name: "East Rail Line", color: "#C9A93F",
      pts: [[760, -20], [742, 96], [720, 186], [690, 250], [640, 312], [560, 372], [470, 420]],
      stations: [[742, 96], [690, 250], [560, 372]],
    },
    {
      name: "Tung Chung Line", color: "#B98CB0",
      pts: [[-20, 470], [60, 470], [130, 500], [200, 520], [270, 522]],
      stations: [[130, 500]],
    },
  ];

  function linesSvg() {
    return LINES.map((l) => {
      const d = toPath(densify(l.pts, 12));
      const st = l.stations
        .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.6" fill="#FFFFFF" stroke="${l.color}" stroke-width="2.4"/>`)
        .join("");
      return `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".85"/>
        <path d="${d}" fill="none" stroke="${l.color}" stroke-width="3.4" stroke-linecap="round" opacity=".95"/>${st}`;
    }).join("");
  }

  /* ---------------- boats ---------------- */
  function ferry(x, y, s, rot) {
    return `<g transform="translate(${x} ${y}) rotate(${rot || 0}) scale(${s || 1})">
      <ellipse cx="0" cy="12" rx="26" ry="4" fill="#244C61" opacity=".10"/>
      <path d="M-20 2h40l-5 7h-30z" fill="#FFFFFF"/>
      <rect x="-11" y="-6" width="22" height="8" rx="2" fill="#6F9E8B"/>
      <rect x="-6" y="-11" width="12" height="6" rx="1.5" fill="#244C61"/>
      <rect x="-15" y="-2" width="30" height="2" rx="1" fill="#DCE9EA"/>
    </g>`;
  }
  function junk(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s || 1})">
      <path d="M-18 0h36l-6 6h-24z" fill="#C4703F"/>
      <path d="M-8 -2 V-18 M-8 -18l10 6-10 4" fill="#FFFFFF" stroke="#C4703F" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M4 -2 V-14 M4 -14l8 5-8 3" fill="#F7F7F2" stroke="#C4703F" stroke-width="1.4" stroke-linejoin="round"/>
    </g>`;
  }

  /* ---------------- poster ---------------- */
  function poster(opts) {
    const o = Object.assign({ w: 1000, h: 760, id: "p1" }, opts || {});
    const r = rng(20261105);
    const kowB = blocksFor(kow, 7, 1);
    const islB = blocksFor(isl, 11, 0.92);

    const water = `
      <rect x="0" y="0" width="1000" height="760" fill="#FAFAF5"/>
      <rect x="0" y="240" width="1000" height="300" fill="#C7E1E4"/>
      <rect x="0" y="240" width="1000" height="300" fill="url(#wgrad)"/>
      <g opacity=".55" stroke="#EAF5F5" stroke-width="1.6" fill="none" stroke-linecap="round">
        ${Array.from({ length: 15 })
          .map((_, i) => {
            const y = 330 + i * 17.5;
            const x = -40 + ((i * 71) % 260);
            return `<path d="M${x} ${y} q12 -5 24 0 t24 0"/>`;
          })
          .join("")}
      </g>`;

    const boats = [
      ferry(300, 392, 1.15, -4),
      ferry(760, 372, 0.9, 3),
      junk(560, 424, 1.1),
      ferry(120, 424, 0.8, 5),
      junk(880, 428, 0.85),
    ].join("");

    const campusPins = [
      { x: 250, y: 520, label: "HKU" },
      { x: 640, y: 196, label: "CUHK" },
      { x: 884, y: 330, label: "HKUST" },
      { x: 330, y: 242, label: "CityU" },
      { x: 432, y: 286, label: "PolyU" },
      { x: 800, y: 112, label: "EdUHK" },
      { x: 170, y: 150, label: "LU" },
    ]
      .map(
        (p) => `<g class="pin" transform="translate(${p.x} ${p.y})">
        <ellipse cx="0" cy="19" rx="13" ry="3.4" fill="#244C61" opacity=".14"/>
        <circle r="17" fill="#FFFFFF"/>
        <circle r="17" fill="none" stroke="#244C61" stroke-width="1.6" opacity=".22"/>
        <circle r="11.5" fill="#244C61"/>
        <text y="3.4" text-anchor="middle" font-size="7.4" font-weight="700" fill="#FFFFFF" font-family="Inter, sans-serif">${p.label}</text>
      </g>`
      )
      .join("");

    return `<svg viewBox="0 0 ${o.w} ${o.h}" class="poster" preserveAspectRatio="xMidYMid slice" role="img" aria-label="香港维多利亚港城市插画地图">
      <defs>
        <linearGradient id="${o.id}-wgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#D6EBEC"/><stop offset="1" stop-color="#BEDCE0"/>
        </linearGradient>
        <linearGradient id="${o.id}-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FBFBF6"/><stop offset="1" stop-color="#F1F3EC"/>
        </linearGradient>
        <filter id="${o.id}-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#16323F" flood-opacity=".10"/>
        </filter>
        <clipPath id="${o.id}-cl-k"><path d="${toPath(kow, true)}"/></clipPath>
        <clipPath id="${o.id}-cl-i"><path d="${toPath(isl, true)}"/></clipPath>
      </defs>

      <rect width="${o.w}" height="${o.h}" fill="url(#${o.id}-sky)"/>

      <!-- water -->
      <rect x="0" y="230" width="1000" height="330" fill="url(#${o.id}-wgrad)"/>
      <g opacity=".45" stroke="#EAF5F5" stroke-width="1.5" fill="none" stroke-linecap="round">
        ${Array.from({ length: 18 })
          .map((_, i) => {
            const y = 306 + i * 16;
            const x = -30 + ((i * 83) % 220);
            return `<path d="M${x} ${y} q13 -5 26 0 t26 0"/>`;
          })
          .join("")}
      </g>

      <!-- land -->
      <path d="${toPath(kow, true)}" fill="#F4EFE2"/>
      <path d="${toPath(isl, true)}" fill="#F0EADA"/>
      <path d="${toPath(lam, true)}" fill="#E7E2D0"/>

      <g clip-path="url(#${o.id}-cl-k)">
        ${blocksSvg(kowB)}
        ${park(660, 130, 70, r)}
        ${park(300, 186, 56, r)}
        ${park(880, 214, 46, r)}
        <g stroke="#FAFAF5" stroke-width="4.5" opacity=".8">
          <path d="M0 120H1000M0 236H1000M0 60H1000"/>
          <path d="M240 0V330M470 0V330M700 0V330M900 0V330"/>
        </g>
        <path d="M0 20 L1000 250" stroke="#FAFAF5" stroke-width="7" opacity=".55"/>
      </g>

      <g clip-path="url(#${o.id}-cl-i)">
        ${blocksSvg(islB)}
        ${park(250, 610, 60, r, "#BCD8B9")}
        <path d="M680 636 q70 -48 150 -30 t170 12 l0 140 -320 0z" fill="#C4DCBF"/>
        <g stroke="#FAFAF5" stroke-width="4.5" opacity=".8">
          <path d="M0 624H1000M0 706H1000"/>
          <path d="M160 430V780M420 430V780M660 430V780"/>
        </g>
      </g>

      <!-- shoreline definition -->
      <path d="${toPath(kow, false)}" fill="none" stroke="#DFD5BE" stroke-width="2.4" opacity=".9"/>
      <path d="${toPath(isl, false)}" fill="none" stroke="#DED4BC" stroke-width="2.4" opacity=".9"/>

      <!-- harbour reflections + boats -->
      <g opacity=".9">${boats}</g>

      <!-- MTR skeleton -->
      ${linesSvg()}

      <!-- hill silhouettes -->
      <path d="M540 300 q70 -54 150 -30 q60 20 120 6 l0 26 -270 8z" fill="#B7CFA9" opacity=".55"/>
      <path d="M60 470 q60 -44 128 -26 q44 12 88 4 l0 20 -216 6z" fill="#B7CFA9" opacity=".45"/>

      ${campusPins}

      <!-- compass + scale -->
      <g transform="translate(70 690)" opacity=".8">
        <circle r="17" fill="#FFFFFF" opacity=".8"/>
        <path d="M0 -10 L5 6 L0 2 L-5 6 Z" fill="#244C61"/>
        <text y="26" text-anchor="middle" font-size="8" letter-spacing="1.6" fill="#244C61" font-family="Inter, sans-serif">N</text>
      </g>
      <g transform="translate(640 704)" opacity=".75">
        <path d="M0 0h70" stroke="#244C61" stroke-width="1.4"/>
        <path d="M0 -3v6M35 -2v4M70 -3v6" stroke="#244C61" stroke-width="1.4"/>
        <text x="35" y="-8" text-anchor="middle" font-size="7.5" fill="#244C61" font-family="Inter, sans-serif" letter-spacing=".6">VICTORIA HARBOUR</text>
      </g>

      <!-- label chips -->
      <g font-family="Inter, 'Noto Sans HK', sans-serif">
        <g transform="translate(196 262)">
          <rect x="-8" y="-11" width="86" height="22" rx="11" fill="#FFFFFF" opacity=".92"/>
          <text x="35" y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#244C61" letter-spacing="1.2">KOWLOON</text>
        </g>
        <g transform="translate(430 606)">
          <rect x="-8" y="-11" width="118" height="22" rx="11" fill="#FFFFFF" opacity=".92"/>
          <text x="51" y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#244C61" letter-spacing="1.2">HONG KONG IS.</text>
        </g>
        <text x="470" y="404" text-anchor="middle" font-size="9" letter-spacing="4" fill="#FFFFFF" opacity=".9" font-weight="600">VICTORIA HARBOUR</text>
      </g>
    </svg>`;
  }

  window.HKUE_ART = { poster };
})();

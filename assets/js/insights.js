/* Rental Insights */
(function () {
  "use strict";
  const { fmt, levelColor, levelOf, levelMeta, data, qs } = window.HKUE;
  const areas = data.areas.slice().sort((a, b) => a.rent - b.rent);
  const campuses = data.campuses.slice().sort((a, b) => a.rent - b.rent);
  const listings = data.listings;

  /* ---------- tiles ---------- */
  const prices = listings.map((r) => r[4]);
  const medianAll = (() => {
    const s = prices.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  })();
  const under15 = listings.filter((r) => r[4] <= 15000).length;
  const psfVals = listings.filter((r) => r[6]).map((r) => r[6]).sort((a, b) => a - b);
  const medianPsf = psfVals[Math.floor(psfVals.length / 2)];
  const gap = (areas[areas.length - 1].rent / areas[0].rent).toFixed(1);

  qs("#tiles").innerHTML = [
    { label: "全样本中位月租", value: `<span class="hk">HK$</span>${fmt.money(medianAll)}`, note: "9,127 条挂牌" },
    { label: "中位呎租（實用）", value: `<span class="hk">HK$</span>${medianPsf}`, note: "数据方已按實用面积计算" },
    { label: `≤ HK$15,000 挂牌占比`, value: `${((under15 / listings.length) * 100).toFixed(1)}<small>%</small>`, note: `${under15.toLocaleString()} 条可负担单位` },
    { label: "最贵 / 最便宜生活圈", value: `${gap}<small>×</small>`, note: "九龍塘 HK$46,000 vs 深水埗 HK$12,800" },
  ]
    .map((t) => `<div class="tile"><div class="tile__label">${t.label}</div><div class="tile__value">${t.value}</div><div class="tile__note">${t.note}</div></div>`)
    .join("");

  /* ---------- rank bars ---------- */
  const maxRent = areas[areas.length - 1].rent;
  qs("#rankBars").innerHTML = areas
    .slice()
    .reverse()
    .map((a) => {
      const w = (a.rent / maxRent) * 100;
      return `<div class="rank__row" title="${fmt.area(a.name)} · HK$${fmt.money(a.rent)} · ${a.listings} 条">
        <div class="rank__name"><i style="background:${levelColor(a.level)}"></i>${fmt.area(a.name)}</div>
        <div class="rank__track"><div class="rank__fill" style="width:${w}%;background:${levelColor(a.level)}"></div></div>
        <div class="rank__val">${fmt.money(a.rent)} <small>· ${a.listings} 条</small></div>
      </div>`;
    })
    .join("");

  /* ---------- scatter ---------- */
  const W = 460, H = 330, P = 38;
  const xMin = 11000, xMax = 48000, yMin = 26, yMax = 68;
  const X = (v) => P + ((v - xMin) / (xMax - xMin)) * (W - P * 1.3);
  const Y = (v) => H - P + -((v - yMin) / (yMax - yMin)) * (H - P * 1.4);
  const dots = areas
    .map((a) => {
      const cx = X(a.rent), cy = Y(a.psf);
      return `<g class="sc-dot-group">
        <circle class="sc-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="${levelColor(a.level)}" stroke="#fff" stroke-width="2.2">
          <title>${fmt.area(a.name)} · 中位月租 HK$${fmt.money(a.rent)} · 呎租 ${a.psf}</title>
        </circle>
        <text x="${(cx + 10).toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" font-size="9" fill="#54666D">${a.short.length > 4 ? a.short.slice(0, 4) : a.short}</text>
      </g>`;
    })
    .join("");

  const xTicks = [12000, 18000, 24000, 30000, 36000, 42000];
  const yTicks = [30, 40, 50, 60];
  qs("#scatter").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="租金与呎租散点图">
    <g class="axis">
      ${xTicks.map((t) => `<line x1="${X(t)}" y1="${P - 12}" x2="${X(t)}" y2="${H - P + 6}" class="grid"/>
        <text x="${X(t)}" y="${H - P + 20}" text-anchor="middle">${t / 1000}K</text>`).join("")}
      ${yTicks.map((t) => `<line x1="${P - 8}" y1="${Y(t)}" x2="${W - 6}" y2="${Y(t)}" class="grid"/>
        <text x="${P - 14}" y="${Y(t) + 3}" text-anchor="end">${t}</text>`).join("")}
      <text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#7B8888">中位月租（HK$）→</text>
      <text x="10" y="${H / 2}" text-anchor="middle" font-size="10" fill="#7B8888" transform="rotate(-90 10 ${H / 2})">中位呎租 ↑</text>
    </g>
    ${dots}
  </svg>`;

  /* ---------- histogram ---------- */
  const bins = [
    { label: "≤5K", min: 0, max: 5000, lv: 1 },
    { label: "5–8K", min: 5000, max: 8000, lv: 1 },
    { label: "8–12K", min: 8000, max: 12000, lv: 1 },
    { label: "12–16K", min: 12000, max: 16000, lv: 2 },
    { label: "16–20K", min: 16000, max: 20000, lv: 3 },
    { label: "20–28K", min: 20000, max: 28000, lv: 4 },
    { label: "28K+", min: 28000, max: Infinity, lv: 5 },
  ].map((b) => Object.assign(b, { n: prices.filter((p) => p > b.min && p <= b.max).length }));
  const maxN = Math.max(...bins.map((b) => b.n));
  qs("#hist").innerHTML = bins
    .map(
      (b) => `<div class="hist__col" title="${b.label}: ${b.n} 条">
      <span class="hist__val">${b.n.toLocaleString()}</span>
      <div class="hist__bar" style="height:${Math.max(3, (b.n / maxN) * 130)}px;background:${levelColor(b.lv)}"></div>
      <span class="hist__label">${b.label}</span>
    </div>`
    )
    .join("");

  /* ---------- room type ---------- */
  const whole = listings.filter((r) => r[9] === 0);
  const bed = listings.filter((r) => r[9] === 1);
  const med = (arr) => {
    const s = arr.map((r) => r[4]).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const wholeMed = med(whole), bedMed = med(bed);
  qs("#typeCompare").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:var(--paper);border-radius:14px;padding:20px">
        <div class="tile__label">整租 · Whole flat</div>
        <div class="tile__value" style="font-size:26px"><span class="hk">HK$</span>${fmt.money(wholeMed)}</div>
        <div class="tile__note" style="color:var(--muted)">${whole.length.toLocaleString()} 条 · 占比 ${((whole.length / listings.length) * 100).toFixed(1)}%</div>
        <div style="height:6px;border-radius:3px;background:var(--pale);margin-top:14px"><i style="display:block;height:100%;width:100%;border-radius:3px;background:var(--ink)"></i></div>
      </div>
      <div style="background:var(--paper);border-radius:14px;padding:20px">
        <div class="tile__label">床位 / 太空舱 · Bedspace</div>
        <div class="tile__value" style="font-size:26px"><span class="hk">HK$</span>${fmt.money(bedMed)}</div>
        <div class="tile__note" style="color:var(--muted)">${bed.length.toLocaleString()} 条 · 占比 ${((bed.length / listings.length) * 100).toFixed(1)}%</div>
        <div style="height:6px;border-radius:3px;background:var(--pale);margin-top:14px"><i style="display:block;height:100%;width:${(bedMed / wholeMed) * 100}%;border-radius:3px;background:var(--sage)"></i></div>
      </div>
    </div>
    <p style="font-size:12.5px;color:#55666d;line-height:1.8;margin-top:18px">
      整租中位 <b>HK$${fmt.money(wholeMed)}</b>，是床位中位的 <b>${(wholeMed / bedMed).toFixed(1)} 倍</b>。
      任何「平均租金」都必须先锁定房型，否则排名会失真。
    </p>`;

  /* ---------- commute bars ---------- */
  qs("#commuteBars").innerHTML = campuses
    .map((c) => {
      const near = c.stations.filter((s) => s.area).slice(0, 4);
      const maxMin = 45;
      return `<div style="display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:center;padding:11px 0;border-top:1px dashed var(--line)">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--ink-deep)">${c.zh}</div>
        <div style="font-size:10.5px;color:var(--muted)">中位 HK$${fmt.money(c.rent)}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${near
          .map(
            (s) => `<div style="display:flex;align-items:center;gap:8px;background:var(--paper);border-radius:999px;padding:6px 12px 6px 8px">
            <span style="font-size:10.5px;color:var(--ink);font-weight:500">${fmt.area(s.area)}</span>
            <span style="width:${Math.max(22, (s.minutes / maxMin) * 70)}px;height:4px;border-radius:2px;background:${s.minutes <= 10 ? "#6F9E8B" : s.minutes <= 20 ? "#F2C94C" : "#EB5757"}"></span>
            <span style="font-size:10.5px;font-weight:700;color:var(--ink-deep)">${s.minutes}′</span>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
    })
    .join("");
})();

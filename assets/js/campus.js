/* Campus page */
(function () {
  "use strict";
  const { fmt, levelColor, levelMeta, data, qs } = window.HKUE;
  const areas = data.areas.slice();
  const campuses = data.campuses.slice();
  const listings = data.listings;

  const ORDER = ["HKU", "CUHK", "HKUST", "CityU/HKBU", "PolyU", "LU", "EdUHK"];
  const SHORT = { HKU: "港大", CUHK: "中大", HKUST: "科大", "CityU/HKBU": "城大 / 浸大", PolyU: "理大", LU: "岭南", EdUHK: "教大" };

  const state = {
    id: (new URLSearchParams(location.search).get("c")) || "HKU",
  };
  if (!campuses.find((c) => c.id === state.id)) state.id = "HKU";

  /* ---------- scoring for radar ---------- */
  const mins = (c) => {
    const m = c.stations.filter((s) => s.area).slice(0, 4).map((s) => s.minutes);
    return m.reduce((a, b) => a + b, 0) / (m.length || 1);
  };
  const rents = campuses.map((c) => c.rent);
  const psfs = campuses.map((c) => c.psf);
  const minRent = Math.min(...rents), maxRent = Math.max(...rents);
  const minPsf = Math.min(...psfs), maxPsf = Math.max(...psfs);
  const dens = campuses.filter((c) => c.diningOk).map((c) => c.density);
  const minD = Math.min(...dens), maxD = Math.max(...dens);
  const avgMins = campuses.map((c) => mins(c));
  const minM = Math.min(...avgMins), maxM = Math.max(...avgMins);

  function scores(c) {
    return [
      (maxRent - c.rent) / (maxRent - minRent),          // 租金可负担
      (maxPsf - c.psf) / (maxPsf - minPsf),              // 呎租便宜
      (maxM - mins(c)) / (maxM - minM || 1),             // 通勤
      c.diningOk ? (c.density - minD) / (maxD - minD) : 0, // 餐饮
    ];
  }

  function areaOf(name) {
    return areas.find((a) => a.name === name);
  }

  /* ---------- radar svg ---------- */
  function radar(c) {
    const S = 190, cx = 100, cy = 100, R = 62;
    const axes = ["租金可负担", "呎租便宜", "通勤时间", "餐饮密度"];
    const sc = scores(c);
    const pt = (i, r) => {
      const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    const rings = [0.33, 0.66, 1]
      .map((k) => `<polygon points="${[0, 1, 2, 3].map((i) => pt(i, R * k).join(",")).join(" ")}" fill="none" stroke="rgba(36,76,97,.12)" stroke-width="1"/>`)
      .join("");
    const spokes = [0, 1, 2, 3].map((i) => {
      const p = pt(i, R);
      return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="rgba(36,76,97,.12)"/>`;
    }).join("");
    const poly = sc.map((v, i) => pt(i, (0.16 + v * 0.84) * R).join(",")).join(" ");
    const labels = axes.map((t, i) => {
      const p = pt(i, R + 20);
      const anchor = Math.abs(p[0] - cx) < 6 ? "middle" : p[0] > cx ? "start" : "end";
      return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 3).toFixed(1)}" text-anchor="${anchor}" font-size="9" fill="#7B8888">${t}</text>`;
    }).join("");
    const nodes = sc.map((v, i) => {
      const p = pt(i, (0.16 + v * 0.84) * R);
      return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="#244C61"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${S} ${S}" width="100%" height="${S}" role="img" aria-label="${c.zh} 四维雷达">
      ${rings}${spokes}
      <polygon points="${poly}" fill="rgba(111,158,139,.28)" stroke="#6F9E8B" stroke-width="1.8" stroke-linejoin="round"/>
      ${nodes}${labels}
    </svg>`;
  }

  function summary(c) {
    const seen = new Map();
    c.stations
      .filter((s) => s.area)
      .sort((a, b) => a.minutes - b.minutes)
      .forEach((s) => { if (!seen.has(s.area)) seen.set(s.area, s); });
    const near = Array.from(seen.values());
    const cheapest = near.map((s) => areaOf(s.area)).filter(Boolean).sort((a, b) => a.rent - b.rent)[0];
    const fastest = near[0];
    const bits = [];
    if (fastest) {
      const a = areaOf(fastest.area);
      bits.push(`最近的租房圈是 ${fmt.area(fastest.area)}（${fastest.minutes} 分钟，中位 HK$${a ? fmt.money(a.rent) : "—"}）`);
    }
    if (cheapest && (!fastest || cheapest.name !== fastest.area)) {
      bits.push(`其中 ${fmt.area(cheapest.name)} 的中位月租最低，为 HK$${fmt.money(cheapest.rent)}`);
    }
    bits.push(`全校区样本 ${c.listings.toLocaleString()} 条，${c.share15k}% 的挂牌月租在 HK$15,000 以内`);
    return bits.join("；") + "。";
  }

  /* ---------- render ---------- */
  function render() {
    const c = campuses.find((x) => x.id === state.id);
    const lv = levelMeta(c.level);
    const seen = new Map();
    c.stations
      .filter((s) => s.area)
      .sort((a, b) => a.minutes - b.minutes)
      .forEach((s) => { if (!seen.has(s.area)) seen.set(s.area, s); });
    const near = Array.from(seen.values()).sort((a, b) => a.minutes - b.minutes);

    qs("#campusTabs").innerHTML = ORDER.map((id) => {
      const cc = campuses.find((x) => x.id === id);
      return `<button class="tab ${id === state.id ? "is-on" : ""}" data-id="${id}">${SHORT[id]}<span style="opacity:.55;margin-left:6px">HK$${(cc.rent / 1000).toFixed(1)}K</span></button>`;
    }).join("");
    qs("#campusTabs").querySelectorAll(".tab").forEach((b) =>
      b.addEventListener("click", () => {
        state.id = b.dataset.id;
        history.replaceState(null, "", "?c=" + encodeURIComponent(state.id));
        render();
      })
    );

    qs("#campusMain").innerHTML = `
      <div class="campus-main__kicker">Campus · ${c.short}</div>
      <h2>${c.zh}</h2>
      <div class="campus-main__en">${c.en}</div>
      <div class="campus-main__rent">
        <b><span class="hk">HK$</span>${fmt.money(c.rent)}</b>
        <span>校区周边中位月租 / 月<br>${c.rent !== c.rentInclLux ? `含豪宅区口径为 HK$${fmt.money(c.rentInclLux)}` : "含 / 剔除豪宅区口径一致"}</span>
      </div>
      <div class="ph__tags" style="margin-top:0">
        <span class="tag" style="background:${lv.color}22;color:${lv.ink}"><i class="pill-dot" style="background:${lv.color}"></i>${lv.range}</span>
        <span class="tag tag--sage">覆盖 ${c.areas} 个生活圈</span>
        <span class="tag">${c.listings.toLocaleString()} 条挂牌</span>
        ${c.id === "HKUST" ? `<span class="tag tag--warn">餐饮数据低样本 · 不排名</span>` : ""}
      </div>
      <p style="font-size:13px;color:#55666d;line-height:1.8;margin-top:18px;max-width:520px">
        ${summary(c)}
      </p>
      <div class="campus-main__grid">
        <div class="stat"><span class="stat__label">中位呎租（實用）</span><span class="stat__value" style="font-size:22px"><span class="hk">HK$</span>${c.psf}</span></div>
        <div class="stat"><span class="stat__label">≤ HK$15,000 占比</span><span class="stat__value" style="font-size:22px">${c.share15k}<small>%</small></span></div>
        <div class="stat"><span class="stat__label">餐饮密度 / km²</span><span class="stat__value" style="font-size:22px">${c.diningOk ? c.density : "—"}</span></div>
      </div>`;

    qs("#campusSide").innerHTML = `
      <div class="side-card">
        <h4>四维相对位置</h4>
        ${radar(c)}
        <p style="font-size:10.5px;color:var(--muted);line-height:1.6;margin-top:4px">在 7 所校区中的相对排位，越靠外越有利。</p>
      </div>
      <div class="side-card">
        <h4>餐饮便利</h4>
        ${c.diningOk
          ? `<div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:26px;letter-spacing:-.03em;color:var(--ink-deep)">${c.density}</b><span style="font-size:11px;color:var(--muted)">POI / km²</span></div>
             <p style="font-size:12px;color:#55666d;margin-top:8px;line-height:1.7">平价餐饮占比 ${(c.cheapShare * 100).toFixed(1)}%，统计范围 ${c.areas} 个港铁站周边 800m 联合面积。</p>`
          : `<p style="font-size:12px;color:#8a6b3a;line-height:1.7">科大仅 24 个 OSM POI（新界郊野覆盖不足），<b>不参与餐饮排名</b>。仅作参考：${c.density} POI/km²。</p>`}
      </div>`;

    qs("#campusAreas").innerHTML = near
      .map((s) => {
        const a = areaOf(s.area);
        if (!a) return "";
        return `<a class="pc-row" href="map.html?area=${encodeURIComponent(a.name)}">
          <span class="pc-row__name"><i style="background:${levelColor(a.level)}"></i>${fmt.area(a.name)}</span>
          <span class="pc-row__min">${s.minutes}′ · ${s.transfers ? s.transfers + " 次换乘" : "直达"}</span>
          <span class="pc-row__rent">HK$${fmt.money(a.rent)}</span>
        </a>`;
      })
      .join("");

    /* budget curve over the campus area listings */
    const names = new Set(near.map((s) => s.area));
    const idx = new Set(areas.map((a, i) => (names.has(a.name) ? i : -1)).filter((i) => i >= 0));
    const ps = listings.filter((r) => idx.has(r[2])).map((r) => r[4]).sort((a, b) => a - b);
    const budgets = [];
    for (let b = 4000; b <= 40000; b += 2000) budgets.push(b);
    const pct = budgets.map((b) => {
      let i = 0;
      while (i < ps.length && ps[i] <= b) i++;
      return ps.length ? (i / ps.length) * 100 : 0;
    });
    const W = 420, H = 220, PAD = 34;
    const px = (i) => PAD + (i / (budgets.length - 1)) * (W - PAD - 10);
    const py = (v) => H - PAD + 8 - (v / 100) * (H - PAD - 18);
    const line = pct.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
    qs("#budgetCurve").innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="预算累计曲线">
      ${[0, 25, 50, 75, 100].map((t) => `<line x1="${PAD}" y1="${py(t)}" x2="${W - 8}" y2="${py(t)}" stroke="var(--line)" stroke-dasharray="2 4"/>
        <text x="${PAD - 6}" y="${py(t) + 3}" text-anchor="end" font-size="9" fill="#7B8888">${t}%</text>`).join("")}
      ${budgets.map((b, i) => (i % 4 === 0 ? `<text x="${px(i)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="#7B8888">${b / 1000}K</text>` : "")).join("")}
      <path d="${line} L${px(budgets.length - 1)},${py(0)} L${PAD},${py(0)} Z" fill="rgba(111,158,139,.14)"/>
      <path d="${line}" fill="none" stroke="#6F9E8B" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      ${pct.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="2.6" fill="#fff" stroke="#6F9E8B" stroke-width="1.6"><title>≤ HK$${budgets[i].toLocaleString()}：${v.toFixed(1)}%</title></circle>`).join("")}
    </svg>
    <p style="font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.7">
      例：预算 HK$${fmt.money(budgets[6])} 时，本校区覆盖的生活圈中约 <b style="color:var(--ink)">${pct[6].toFixed(0)}%</b> 的挂牌在预算内。
    </p>`;

    /* compare table */
    qs("#compareTable").innerHTML = `
      <thead><tr>
        <th>校区</th><th>中位月租</th><th>中位呎租</th><th>≤15K 占比</th><th>餐饮密度</th><th>最近生活圈通勤</th>
      </tr></thead>
      <tbody>
        ${campuses
          .slice()
          .sort((a, b) => a.rent - b.rent)
          .map((x) => `<tr style="${x.id === state.id ? "background:rgba(220,233,234,.35)" : ""}">
          <td><span class="dish" style="background:${levelColor(x.level)}"></span><b>${SHORT[x.id]}</b></td>
          <td>HK$${fmt.money(x.rent)}</td>
          <td>${x.psf}</td>
          <td>${x.share15k}%</td>
          <td>${x.diningOk ? x.density : `<span style="color:#a8863a">—</span>`}</td>
          <td>${x.stations.filter((s) => s.area).slice(0, 1).map((s) => `${s.minutes}′`)[0] || "—"}</td>
        </tr>`)
          .join("")}
      </tbody>`;
  }

  render();
})();

/* Home page wiring */
(function () {
  "use strict";
  const { fmt, levelColor, data, qs } = window.HKUE;
  const areas = data.areas.slice();
  const campuses = data.campuses.slice();

  /* posters */
  qs("#posterHost").innerHTML = window.HKUE_ART.poster({ id: "hero" });
  qs("#ctaPoster").innerHTML = window.HKUE_ART.poster({ id: "cta" });

  /* ---------- five-level scale rail ---------- */
  const rail = qs("#scaleRail");
  rail.innerHTML = data.meta.levels
    .map((l) => {
      const n = data.meta.levelsCount[String(l.level)];
      const names = areas.filter((a) => a.level === l.level).map((a) => a.short).join(" · ");
      return `<div class="scale__item" style="background:${l.color};color:${l.ink}">
        <div>
          <div class="scale__lvl">Level ${l.level} · ${l.label}</div>
          <div class="scale__range">${l.range}</div>
        </div>
        <div>
          <div class="scale__count"><b>${n}</b> 个生活圈</div>
          <div class="scale__count" style="opacity:.72;margin-top:2px">${names}</div>
        </div>
        <div class="scale__swatch"></div>
      </div>`;
    })
    .join("");

  /* ---------- one-line footnote under the scale rail ---------- */
  const foot = qs("#scaleFoot");
  if (foot) {
    const under16 = areas.filter((a) => a.rent < 16000);
    const lvl5 = areas.filter((a) => a.level === 5);
    const lvl5Share = ((lvl5.reduce((sum, a) => sum + a.listings, 0) / data.meta.listings) * 100).toFixed(1);
    foot.innerHTML = `<p><b>${under16.length} 个</b>生活圈中位月租低于 HK$16,000，集中在九龙四区与新界西；最高档只有 <b>${lvl5.length} 个</b>（${lvl5.map((a) => a.short).join("、")}），房源量占 ${lvl5Share}%。</p>
      <a class="link-arrow" href="map.html">在地图上按色阶筛选 <span aria-hidden="true">→</span></a>`;
  }

  /* ---------- universities ---------- */
  const BADGE = { HKU: "HKU", CUHK: "CUHK", HKUST: "HKUST", "CityU/HKBU": "CityU", PolyU: "PolyU", LU: "LU", EdUHK: "EdUHK" };
  const FULLNAME = {
    HKU: "香港大学", CUHK: "香港中文大学", HKUST: "香港科技大学",
    "CityU/HKBU": "城大 / 浸大", PolyU: "香港理工大学", LU: "岭南大学", EdUHK: "香港教育大学",
  };
  qs("#uniGrid").innerHTML =
    campuses
      .map(
        (c) => `<a class="uni" href="campus.html?c=${encodeURIComponent(c.id)}">
        <span class="uni__badge" style="background:${levelColor(c.level)}1f;color:${window.HKUE.levelMeta(c.level).ink}">${BADGE[c.id] || c.id}</span>
        <span class="uni__name">${FULLNAME[c.id] || c.zh}</span>
        <span class="uni__en">${c.en}</span>
        <span class="uni__rent"><span class="hk">HK$</span>${fmt.money(c.rent)}<span class="unit">中位月租</span></span>
        <span class="uni__meta"><span>呎租 ${c.psf}</span><span>${c.listings.toLocaleString()} 条</span></span>
        <span class="uni__bar"><i style="width:${c.share15k}%;background:${levelColor(c.level)}"></i></span>
        <span class="uni__bar-label"><span>≤ HK$15,000 占比</span><b style="color:var(--ink)">${c.share15k}%</b></span>
      </a>`
      )
      .join("") +
    `<a class="uni uni--cta" href="campus.html" style="background:var(--ink-deep);color:#fff">
      <span class="uni__badge" style="background:rgba(255,255,255,.12);color:#fff">7 / 7</span>
      <span class="uni__name" style="color:#fff">校区对比</span>
      <span class="uni__en" style="color:rgba(255,255,255,.55)">Compare all campuses</span>
      <span class="uni__rent" style="color:#fff">雷达图<span class="unit" style="color:rgba(255,255,255,.6)">租金 · 通勤 · 餐饮</span></span>
      <span class="uni__meta" style="color:rgba(255,255,255,.62)"><span>三维对照</span><span>含 4 条口径说明</span></span>
      <span class="uni__cta" style="color:#A8C4B6;margin-top:auto;padding-top:18px">进入对比页 →</span>
    </a>`;

  /* caption numbers stay honest */
  const cap = qs(".hero__caption");
  if (cap) cap.innerHTML = `维多利亚港 · 港铁线路与港八大校区分布示意　<span class="muted">真实坐标见 Map</span>`;
})();

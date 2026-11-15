/* Explore Map */
(function () {
  "use strict";
  const { fmt, levelColor, levelMeta, data, qs, qsa } = window.HKUE;
  const areas = data.areas.slice();
  const campuses = data.campuses.slice();
  const listings = data.listings;

  const state = {
    campus: null,
    maxCommute: 0,
    maxRent: 50000,
    type: "all",
    view: "rent",
    points: false,
    hidden: new Set(),
    selected: areas[0].name,
  };

  /* ---------- map ---------- */
  const map = L.map("map", {
    center: [22.325, 114.172],
    zoom: 12,
    minZoom: 10.5,
    maxZoom: 15,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    zoomControl: false,
    attributionControl: true,
    maxBounds: [[22.12, 113.78], [22.62, 114.5]],
    maxBoundsViscosity: 0.9,
  });
  L.control.zoom({ position: "bottomright" }).addTo(map);

  /* ---------- 底图：多家瓦片源 + 自动降级 ----------
     OSM 志愿者服务器会按 usage policy 封禁「不带可识别来源 / 高频抓取」的客户端
     （表现为整屏 403 "Access blocked"），因此默认用允许 keyless 访问的 Esri 浅灰底图，
     失败时依次降级到 CARTO，全部失败则切换为纯矢量示意底图，绝不留一屏 403。 */
  const TILE_PROVIDERS = [
    {
      id: "osmde",
      url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    },
    {
      id: "osm",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    },
    {
      id: "esri",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      label: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      attribution: 'Basemap &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors',
      maxZoom: 16,
    },
  ];

  let providerIndex = 0;
  let baseLayer = null;
  let labelLayer = null;
  let tileFailures = 0;
  let baseBroken = false;

  function mountBase(p) {
    if (baseLayer) map.removeLayer(baseLayer);
    if (labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
    tileFailures = 0;
    baseLayer = L.tileLayer(p.url, {
      attribution: p.attribution,
      subdomains: p.subdomains || "abc",
      maxZoom: p.maxZoom || 18,
      detectRetina: true,
    });
    baseLayer.on("tileerror", onTileError);
    baseLayer.addTo(map);
    if (p.label) {
      // 注记层单独叠一层，瓦片失败同样计入
      labelLayer = L.tileLayer(p.label, { maxZoom: p.maxZoom || 16, pane: "overlayPane", opacity: 0.9 });
      labelLayer.on("tileerror", onTileError);
      labelLayer.addTo(map);
    }
  }

  function onTileError() {
    tileFailures += 1;
    if (tileFailures < 4 || baseBroken) return;
    tileFailures = 0;
    providerIndex += 1;
    if (providerIndex < TILE_PROVIDERS.length) {
      mountBase(TILE_PROVIDERS[providerIndex]);
      showBaseNotice(`底图源受限，已切换到 ${TILE_PROVIDERS[providerIndex].id.toUpperCase()} 底图`);
    } else {
      baseBroken = true;
      if (baseLayer) map.removeLayer(baseLayer);
      if (labelLayer) map.removeLayer(labelLayer);
      document.getElementById("mapwrap").classList.add("is-vector");
      showBaseNotice("底图服务暂不可用，已切换为矢量示意底图；气泡与筛选交互不受影响");
    }
  }

  let noticeTimer = null;
  function showBaseNotice(msg) {
    let el = document.getElementById("baseNotice");
    if (!el) {
      el = document.createElement("div");
      el.id = "baseNotice";
      el.className = "base-notice";
      document.getElementById("mapwrap").appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove("is-on"), 8000);
  }

  /* ?tiles=esri|carto|osm|vector —— 手动指定底图源（某个源在用户网络里被墙时可用） */
  const tilePref = new URLSearchParams(location.search).get("tiles");
  if (tilePref === "vector") {
    baseBroken = true;
    document.getElementById("mapwrap").classList.add("is-vector");
    showBaseNotice("已按 ?tiles=vector 使用矢量示意底图；气泡与筛选交互不受影响");
  } else {
    const prefIndex = TILE_PROVIDERS.findIndex((p) => p.id === tilePref);
    providerIndex = prefIndex > 0 ? prefIndex : 0;
    mountBase(TILE_PROVIDERS[providerIndex]);
  }

  const bubbleLayer = L.layerGroup().addTo(map);
  const campusLayer = L.layerGroup().addTo(map);
  const listingLayer = L.layerGroup().addTo(map);
  const ringLayer = L.layerGroup().addTo(map);

  /* ---------- helpers ---------- */
  function areaByName(n) {
    return areas.find((a) => a.name === n);
  }
  function commuteInfo(area) {
    if (!state.campus) return null;
    const c = campuses.find((x) => x.id === state.campus);
    if (!c) return null;
    const st = c.stations.find((s) => s.area === area.name);
    return st && st.area ? st : null;
  }
  /* ---------- 编码层：租金五级 / 通勤三档 ---------- */
  const COMMUTE_BUCKETS = [
    { id: 0, label: "≤ 20 分钟", color: "#6F9E8B" },
    { id: 1, label: "20–35 分钟", color: "#F2C94C" },
    { id: 2, label: "> 35 分钟", color: "#EB5757" },
  ];
  function commuteBucket(a) {
    const ci = commuteInfo(a);
    if (!ci) return null;
    return ci.minutes <= 20 ? 0 : ci.minutes <= 35 ? 1 : 2;
  }
  function colorOf(a) {
    if (state.view !== "commute") return levelColor(a.level);
    const b = commuteBucket(a);
    return b == null ? "#CFD8D2" : COMMUTE_BUCKETS[b].color;
  }
  function keyOf(a) {
    return state.view === "commute" ? "C" + commuteBucket(a) : "L" + a.level;
  }

  function visibleAreas() {
    return areas.filter((a) => {
      if (state.view === "commute" && commuteBucket(a) == null) return false;
      if (state.hidden.has(keyOf(a))) return false;
      if (a.rent > state.maxRent) return false;
      if (state.campus) {
        const ci = commuteInfo(a);
        if (!ci) return false;
        if (state.maxCommute > 0 && ci.minutes > state.maxCommute) return false;
      }
      return true;
    });
  }

  /* ---------- bubbles ---------- */
  const maxL = Math.max(...areas.map((a) => a.listings));
  function bubbleSize(a) {
    return Math.round(30 + Math.sqrt(a.listings / maxL) * 24);
  }

  /* 九龙区生活圈密集，气泡做像素级避让；真实坐标另画小圆点 */
  const OFFSET = {
    "九龍塘": [6, -52],
    "深水埗|石硤尾": [-62, -16],
    "旺角": [-10, -28],
    "太子": [34, 4],
    "何文田": [58, 2],
    "紅磡": [72, 44],
    "土瓜灣": [96, -12],
    "尖沙咀": [16, 62],
  };

  function drawAreas() {
    bubbleLayer.clearLayers();
    visibleAreas().forEach((a) => {
      const size = bubbleSize(a);
      const isSel = a.name === state.selected;
      const off = OFFSET[a.name] || [0, 0];
      if (off[0] || off[1]) {
        L.circleMarker([a.lat, a.lng], {
          radius: 3, weight: 1.5, color: "#244C61", fillColor: "#fff", fillOpacity: 1, opacity: 0.7,
        }).addTo(bubbleLayer);
      }
      const isCommute = state.view === "commute";
      const ci = isCommute ? commuteInfo(a) : null;
      const main = isCommute
        ? `${ci ? ci.minutes : "—"}<span class="bubble__unit">分</span>`
        : (a.rent >= 10000 ? (a.rent / 1000).toFixed(1).replace(/\.0$/, "") + "K" : a.rent);
      const tip = isCommute
        ? `${fmt.area(a.name)} · 到 ${ci ? ci.zh : "校区"} ${ci ? ci.minutes : "—"} 分钟 · 中位 HK$${fmt.money(a.rent)} · ${a.listings} 条`
        : `${fmt.area(a.name)} · 中位 HK$${fmt.money(a.rent)} · ${a.listings} 条`;
      const html = `<div class="bubble ${size < 42 ? "bubble--sm" : size > 52 ? "bubble--lg" : ""}" style="background:${colorOf(a)};${isSel ? "box-shadow:0 0 0 4px rgba(36,76,97,.9),0 18px 34px -14px rgba(22,50,63,.9)" : ""}">
        <div>
          <div class="bubble__rent">${main}</div>
          <div class="bubble__name">${a.short.length > 5 ? a.short.slice(0, 5) : a.short}</div>
        </div>
      </div>`;
      const icon = L.divIcon({
        className: "area-bubble",
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2 - off[0], size / 2 - off[1]],
      });
      const m = L.marker([a.lat, a.lng], { icon, riseOnHover: true, zIndexOffset: isSel ? 500 : 0 })
        .on("click", () => selectArea(a.name, false))
        .bindTooltip(tip, { direction: "top", offset: [0, -size / 2], opacity: 0.95 });
      bubbleLayer.addLayer(m);
    });
  }

  function drawCampuses() {
    campusLayer.clearLayers();
    const shown = state.campus ? campuses.filter((c) => c.id === state.campus) : campuses;
    shown.forEach((c) => {
      const hub = areaByName(c.hub);
      if (!hub) return;
      const html = `<div class="campus-pin__dot">${c.short === "CityU/HKBU" ? "CityU" : c.short === "EdUHK" ? "EdUHK" : c.short}</div><div class="campus-pin__pulse"></div>`;
      const icon = L.divIcon({ className: "campus-pin", html, iconSize: [30, 30], iconAnchor: [15, 15] });
      L.marker([hub.lat, hub.lng], { icon, zIndexOffset: 900 }).addTo(campusLayer)
        .bindTooltip(`${c.zh} · 校区所在生活圈：${fmt.area(c.hub)}`, { direction: "top", offset: [0, -16] });
    });
  }

  /* ---------- listing dots ---------- */
  function drawListings() {
    listingLayer.clearLayers();
    const vis = new Set(visibleAreas().map((a) => a.name));
    const stride = 3;
    let n = 0;
    for (let i = 0; i < listings.length; i += 1) {
      const r = listings[i];
      if (r[7] == null) continue;
      const a = areas[r[2]];
      if (!a || !vis.has(a.name)) continue;
      if (state.type !== "all" && r[9] !== Number(state.type)) continue;
      if (++n % stride) continue;
      L.circleMarker([r[7], r[8]], {
        radius: 3, weight: 1, color: "rgba(255,255,255,.85)",
        fillColor: colorOf(a), fillOpacity: 0.72, className: "listing-dot",
      }).bindTooltip(`HK$${fmt.money(r[4])} · ${r[5]} 呎 · ${a.short}`, { direction: "top" }).addTo(listingLayer);
    }
  }

  /* ---------- 通勤视图：等时圈 ---------- */
  function haversineKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const la1 = a.lat * rad, la2 = b.lat * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /* 用全部「站点-分钟」样本拟合平均速度，画 15/30/45 分钟示意等时圈 */
  function kmPerMinute() {
    let sumDM = 0, sumMM = 0;
    campuses.forEach((c) => {
      const hub = areaByName(c.hub);
      if (!hub) return;
      c.stations.forEach((st) => {
        const a = areaByName(st.area);
        if (!a || !st.minutes) return;
        sumDM += haversineKm(hub, a) * st.minutes;
        sumMM += st.minutes * st.minutes;
      });
    });
    return sumMM ? sumDM / sumMM : 0.45;
  }

  function drawRings() {
    ringLayer.clearLayers();
    if (state.view !== "commute" || !state.campus) return;
    const c = campuses.find((x) => x.id === state.campus);
    const hub = c && areaByName(c.hub);
    if (!hub) return;
    const k = kmPerMinute();
    [15, 30, 45].forEach((m) => {
      L.circle([hub.lat, hub.lng], {
        radius: m * k * 1000, color: "#244C61", weight: 1.2, opacity: 0.34,
        dashArray: "4 8", fillColor: "#244C61", fillOpacity: 0.03, interactive: false,
      }).addTo(ringLayer);
    });
  }

  /* ---------- panel ---------- */
  function panelHTML(a) {
    if (!a) return `<div class="panel__empty">当前筛选下没有生活圈。<br>试着放宽预算或通勤时间。</div>`;
    const lv = levelMeta(a.level);
    const ci = commuteInfo(a);
    const campusRows = campuses
      .map((c) => ({ c, st: c.stations.find((s) => s.area === a.name) }))
      .filter((x) => x.st)
      .sort((x, y) => x.st.minutes - y.st.minutes);

    const rows = listings
      .filter((r) => areas[r[2]] && areas[r[2]].name === a.name)
      .filter((r) => (state.type === "all" ? true : r[9] === Number(state.type)))
      .sort((x, y) => x[4] - y[4])
      .slice(0, 4);
    const typeName = (t) => (t === 0 ? "整租" : t === 1 ? "床位" : "其他");

    return `
      <div class="ph">
        <div class="ph__kicker">Living circle · Level ${a.level}</div>
        <h2 class="ph__name">${fmt.area(a.name)}</h2>
        <div class="ph__tags">
          <span class="tag" style="background:${lv.color}22;color:${lv.ink}"><i class="pill-dot" style="background:${lv.color}"></i>${lv.range}</span>
          ${a.student ? `<span class="tag tag--sage">学生租房区</span>` : `<span class="tag tag--warn">校址 / 豪宅区</span>`}
          ${ci ? `<span class="tag">距 ${ci.name} ${ci.minutes} 分钟</span>` : ""}
        </div>
        <div class="ph__rent"><b><span class="hk">HK$</span>${fmt.money(a.rent)}</b><span>中位月租 / 月</span></div>
        <div class="ph__band">
          ${data.meta.levels.map((l) => `<i style="background:${l.level === a.level ? l.color : "#EEF0E8"}"></i>`).join("")}
        </div>
      </div>
      <div class="pgrid">
        <div class="pcell"><b>${fmt.money(a.psf, true)}</b><span>中位呎租（實用）</span></div>
        <div class="pcell"><b>${Math.round(a.area)} 呎</b><span>中位面积</span></div>
        <div class="pcell"><b>${fmt.money(a.minRent, true)}</b><span>最低月租</span></div>
        <div class="pcell"><b>${a.share15k}%</b><span>≤ HK$15,000 占比</span></div>
        <div class="pcell"><b>${a.listings}</b><span>在租挂牌</span></div>
        <div class="pcell"><b>${a.geo}</b><span>有坐标房源</span></div>
      </div>
      <div class="psec">
        <div class="psec__title">校区通勤 <b>港铁分钟</b></div>
        ${campusRows.length
          ? campusRows
              .map(
                (x) => `<div class="crow">
            <span class="crow__dot" style="background:${x.st.minutes <= 15 ? "#6F9E8B" : x.st.minutes <= 30 ? "#F2C94C" : "#EB5757"}"></span>
            <span class="crow__name">${x.c.zh}</span>
            <span class="crow__bar"><i style="width:${Math.min(100, (x.st.minutes / 45) * 100)}%;background:${x.st.minutes <= 15 ? "#6F9E8B" : x.st.minutes <= 30 ? "#F2C94C" : "#EB5757"}"></i></span>
            <span class="crow__val">${x.st.minutes}′</span>
          </div>`
              )
              .join("")
          : `<p class="muted" style="font-size:12px">该生活圈不在本数据的 37 条通勤路线里。</p>`}
      </div>
      <div class="psec">
        <div class="psec__title">在租房源 <b>${state.type === "all" ? "全部房型" : typeName(Number(state.type))}</b></div>
        ${rows.length
          ? rows
              .map(
                (r) => `<div class="lrow">
            <div style="flex:1;min-width:0">
              <div class="lrow__title">${r[1]}</div>
              <div class="lrow__meta">${r[5]} 呎 · 呎租 ${r[6]} · ${typeName(r[9])}</div>
            </div>
            <div style="text-align:right">
              <div class="lrow__price">HK$${fmt.money(r[4])}</div>
              <div class="lrow__type">${r[3]}</div>
            </div>
          </div>`
              )
              .join("")
          : `<p class="muted" style="font-size:12px">暂无该房型挂牌。</p>`}
      </div>
      <div class="panel__foot"><a href="explore.html?area=${encodeURIComponent(a.name)}">在房源页查看全部 ${a.listings} 条 →</a></div>`;
  }

  function renderPanel() {
    const a = areaByName(state.selected);
    qs("#panel").innerHTML = panelHTML(a);
  }

  /* ---------- select ---------- */
  function selectArea(name, fly) {
    state.selected = name;
    const a = areaByName(name);
    renderPanel();
    drawAreas();
    if (fly && a) map.flyTo([a.lat, a.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
  }

  /* ---------- controls ---------- */
  const CAMPUS_SHORT = { HKU: "港大", CUHK: "中大", HKUST: "科大", "CityU/HKBU": "城大/浸大", PolyU: "理大", LU: "岭南", EdUHK: "教大" };
  const CAMPUS_ORDER = ["HKU", "CUHK", "HKUST", "CityU/HKBU", "PolyU", "LU", "EdUHK"];
  qs("#campusChips").innerHTML =
    `<button class="chip is-on" data-campus="">全部</button>` +
    CAMPUS_ORDER.map((id) => `<button class="chip" data-campus="${id}">${CAMPUS_SHORT[id]}</button>`).join("");

  qsa("#campusChips .chip").forEach((b) => {
    b.addEventListener("click", () => {
      qsa("#campusChips .chip").forEach((x) => x.classList.remove("is-on"));
      b.classList.add("is-on");
      state.campus = b.dataset.campus || null;
      if (!state.campus) {
        state.maxCommute = 0;
        if (state.view === "commute") state.view = "rent";
        qsa("#viewSeg .seg__btn").forEach((x) => x.classList.toggle("is-on", x.dataset.view === state.view));
        qsa("#commuteChips .chip").forEach((c) => c.classList.remove("is-on"));
        qsa("#commuteChips .chip")[0].classList.add("is-on");
      }
      qs("#commuteHint").textContent = state.campus ? "只显示该校区可达的生活圈" : "选择校区后可限定港铁通勤时长";
      qsa("#commuteChips .chip").forEach((c) => c.classList.toggle("is-muted", !state.campus && c.dataset.min !== "0"));
      buildLegend();
      buildTimeline();
      syncViewChrome();
      refresh(true);
    });
  });

  qsa("#commuteChips .chip").forEach((b) => {
    b.addEventListener("click", () => {
      if (!state.campus && b.dataset.min !== "0") {
        qs("#commuteHint").textContent = "请先选择一所校区";
        return;
      }
      qsa("#commuteChips .chip").forEach((x) => x.classList.remove("is-on"));
      b.classList.add("is-on");
      state.maxCommute = Number(b.dataset.min);
      refresh(false);
    });
  });

  const rentRange = qs("#rentRange");
  function syncRange() {
    const v = Number(rentRange.value);
    state.maxRent = v >= 50000 ? Infinity : v;
    qs("#rentOut").textContent = v >= 50000 ? "不限" : "≤ HK$" + fmt.money(v);
    rentRange.style.setProperty("--p", ((v - 12000) / 38000) * 100 + "%");
  }
  rentRange.addEventListener("input", () => { syncRange(); refresh(false); });
  syncRange();

  qsa("#typeSeg .seg__btn").forEach((b) => {
    b.addEventListener("click", () => {
      qsa("#typeSeg .seg__btn").forEach((x) => x.classList.remove("is-on"));
      b.classList.add("is-on");
      state.type = b.dataset.type;
      renderPanel();
      if (state.points) drawListings();
    });
  });

  /* ---------- 视图切换 ---------- */
  function syncViewChrome() {
    const keepBtn = qs('#viewSeg .seg__btn[data-view="commute"]');
    const enabled = !!state.campus;
    keepBtn.classList.toggle("is-disabled", !enabled);
    keepBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
    keepBtn.title = enabled ? "" : "先在上面选择一个校区，才能按分钟着色";
    const c = campuses.find((x) => x.id === state.campus);
    qs("#viewHint").innerHTML = state.view === "commute"
      ? `颜色 = 到${c ? c.zh : "校区"}的分钟数（三档）· 虚线 = 15/30/45 分钟等时圈`
      : "颜色 = 生活圈中位月租（五级）· 圆大小 = 挂牌量";
    qs(".tl__label").textContent = state.view === "commute" ? "通勤梯度" : "租金梯度";
  }

  function setView(v) {
    if (v === "commute" && !state.campus) return;
    if (v === state.view) return;
    state.view = v;
    state.hidden = new Set();
    qsa("#viewSeg .seg__btn").forEach((x) => x.classList.toggle("is-on", x.dataset.view === v));
    buildLegend();
    buildTimeline();
    syncViewChrome();
    refresh(v === "commute");
  }

  qsa("#viewSeg .seg__btn").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.classList.contains("is-disabled")) return;
      setView(b.dataset.view);
    });
  });

  const pointsChk = qs("#pointsChk");
  pointsChk.addEventListener("change", () => {
    state.points = pointsChk.checked;
    refresh(false);
  });

  /* ---------- legend ---------- */
  function buildLegend() {
    const items = state.view === "commute"
      ? COMMUTE_BUCKETS.map((b) => {
          const n = areas.filter((a) => commuteBucket(a) === b.id).length;
          return `<button class="legend__item" data-key="C${b.id}" title="${b.label} · ${n} 个生活圈"><i style="background:${b.color}"></i>${b.label}</button>`;
        }).join("")
      : data.meta.levels
          .map((l) => `<button class="legend__item" data-key="L${l.level}" title="${l.range}"><i style="background:${l.color}"></i>${l.level}</button>`)
          .join("");
    qs("#legend").innerHTML = items;
    qsa("#legend .legend__item").forEach((b) => {
      b.classList.toggle("is-off", state.hidden.has(b.dataset.key));
      b.addEventListener("click", () => {
        const k = b.dataset.key;
        if (state.hidden.has(k)) state.hidden.delete(k);
        else state.hidden.add(k);
        b.classList.toggle("is-off", state.hidden.has(k));
        refresh(false);
      });
    });
  }

  /* ---------- timeline ---------- */
  function buildTimeline() {
    const order = state.view === "commute"
      ? (a) => (commuteBucket(a) == null ? 99 : commuteBucket(a) * 100 + (commuteInfo(a) ? commuteInfo(a).minutes : 99))
      : (a) => a.rent;
    const list = state.view === "commute" ? areas.filter((a) => commuteBucket(a) != null) : areas;
    qs("#tlBar").innerHTML = list
      .slice()
      .sort((a, b) => order(a) - order(b))
      .map((a) => {
        const ci = state.view === "commute" ? commuteInfo(a) : null;
        const title = ci
          ? `${fmt.area(a.name)} · 港铁 ${ci.minutes} 分钟`
          : `${fmt.area(a.name)} · HK$${fmt.money(a.rent)}`;
        return `<span class="tl__seg" data-name="${a.name}" style="background:${colorOf(a)}" title="${title}"></span>`;
      })
      .join("");
    qsa("#tlBar .tl__seg").forEach((s2) => {
      s2.addEventListener("click", () => selectArea(s2.dataset.name, true));
    });
  }

  /* ---------- refresh ---------- */
  function refresh(resetSelection) {
    const vis = visibleAreas();
    qs("#resultCount").textContent = vis.length;
    if (resetSelection || !vis.find((a) => a.name === state.selected)) {
      state.selected = vis.length ? vis[0].name : null;
    }
    drawAreas();
    drawRings();
    if (state.points) drawListings();
    else listingLayer.clearLayers();
    renderPanel();
    drawCampuses();
    if (state.campus) {
      const c = campuses.find((x) => x.id === state.campus);
      if (c) {
        const hub = areaByName(c.hub);
        if (hub && resetSelection) map.flyTo([hub.lat, hub.lng], 12, { duration: 0.9 });
      }
    }
  }

  const railToggle = qs("#railToggle");
  if (railToggle) railToggle.addEventListener("click", () => {
    const rail = railToggle.closest(".rail");
    const open = rail.classList.toggle("is-open");
    railToggle.setAttribute("aria-expanded", open ? "true" : "false");
    railToggle.textContent = open ? "收起筛选" : "筛选条件";
    setTimeout(() => map.invalidateSize(), 60);
  });

  /* ---------- boot ---------- */
  drawCampuses();
  buildLegend();
  buildTimeline();
  syncViewChrome();
  refresh(false);

  // deep-link ?area=
  const param = new URLSearchParams(location.search).get("area");
  if (param) {
    const a = areaByName(param);
    if (a) { state.selected = a.name; selectArea(a.name, true); }
  }
})();

/* Listings explorer */
(function () {
  "use strict";
  const { fmt, levelColor, data, qs } = window.HKUE;
  const areas = data.areas;
  const listings = data.listings;

  const state = { q: "", area: "", type: "", budget: 999999, sort: "price-asc", page: 0, per: 24 };

  const areaSel = qs("#areaSel");
  areas
    .slice()
    .sort((a, b) => a.rent - b.rent)
    .forEach((a) => {
      const o = document.createElement("option");
      o.value = a.name;
      o.textContent = `${fmt.area(a.name)} · HK$${fmt.money(a.rent)}`;
      areaSel.appendChild(o);
    });

  const param = new URLSearchParams(location.search).get("area");
  if (param) {
    state.area = param;
    areaSel.value = param;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let rows = listings.filter((r) => {
      if (state.area) {
        const a = areas[r[2]];
        if (!a || a.name !== state.area) return false;
      }
      if (state.type !== "" && r[9] !== Number(state.type)) return false;
      if (r[4] > state.budget) return false;
      if (q && !(r[1].toLowerCase().includes(q) || String(r[3]).toLowerCase().includes(q))) return false;
      return true;
    });
    const s = state.sort;
    rows.sort((a, b) => {
      if (s === "price-asc") return a[4] - b[4];
      if (s === "price-desc") return b[4] - a[4];
      if (s === "psf-asc") return (a[6] || 999) - (b[6] || 999);
      if (s === "size-desc") return (b[5] || 0) - (a[5] || 0);
      return 0;
    });
    return rows;
  }

  const typeName = (t) => (t === 0 ? "整租" : t === 1 ? "床位" : "其他");

  function card(r) {
    const a = areas[r[2]];
    return `<a class="lcard" href="https://www.28hse.com/rent/apartment/property-${r[0]}" target="_blank" rel="noopener">
      <div class="lcard__top">
        <span class="lcard__area"><i style="background:${a ? levelColor(a.level) : "#ccc"}"></i>${a ? fmt.area(a.name) : r[3]}</span>
        <span class="tag" style="font-size:10px">${typeName(r[9])}</span>
      </div>
      <div class="lcard__title">${r[1]}</div>
      <div class="lcard__bottom">
        <div>
          <div class="lcard__price"><span class="hk">HK$</span>${fmt.money(r[4])}<span style="font-size:10px;font-weight:500;color:var(--muted)"> /月</span></div>
          <div class="lcard__meta">${r[5]} 呎 · 呎租 ${r[6] || "—"}</div>
        </div>
        <span class="lcard__link">28Hse ↗</span>
      </div>
    </a>`;
  }

  function render(reset) {
    const rows = filtered();
    qs("#count").textContent = rows.length.toLocaleString();
    if (reset) state.page = 0;
    const slice = rows.slice(0, (state.page + 1) * state.per);
    qs("#grid").innerHTML = slice.map(card).join("");
    qs("#more").style.display = slice.length >= rows.length ? "none" : "";
    qs("#more").textContent = `加载更多（还有 ${(rows.length - slice.length).toLocaleString()} 条）`;
  }

  ["#q", "#areaSel", "#typeSel", "#budgetSel", "#sortSel"].forEach((sel) => {
    const el = qs(sel);
    el.addEventListener("input", () => {
      state.q = qs("#q").value;
      state.area = qs("#areaSel").value;
      state.type = qs("#typeSel").value;
      state.budget = Number(qs("#budgetSel").value);
      state.sort = qs("#sortSel").value;
      render(true);
    });
  });

  qs("#more").addEventListener("click", () => { state.page++; render(false); });

  render(true);
})();

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/1QY6xEU_ppaR8zZNg44hHJ8OH4w7n-GWO/gviz/tq?tqx=out:csv";
const REKAP_CSV_URL = `${SHEET_BASE_URL}&sheet=REKAP`;
const COST_CSV_URL = `${SHEET_BASE_URL}&sheet=COST`;

let rows = [];
let costRows = [];
const SHARE_SPLIT = [
  { name: "Husein", percent: 30 },
  { name: "Shafi", percent: 30 },
  { name: "Yusuf", percent: 30 },
  { name: "Bebas", percent: 10 },
];
const COST_PARTNERS = ["Yusuf", "Shafi", "Husein"];
const USD_TO_IDR = 16500;

const els = {
  status: document.querySelector("#dataStatus"),
  updated: document.querySelector("#lastUpdated"),
  month: document.querySelector("#monthFilter"),
  country: document.querySelector("#countryFilter"),
  search: document.querySelector("#searchInput"),
  navLinks: document.querySelectorAll("[data-page-link]"),
  dashboardPage: document.querySelector("#dashboardPage"),
  profitSharePage: document.querySelector("#profitSharePage"),
  costSharePage: document.querySelector("#costSharePage"),
  selling: document.querySelector("#totalSelling"),
  profit: document.querySelector("#netProfit"),
  orders: document.querySelector("#totalOrders"),
  margin: document.querySelector("#margin"),
  shareBase: document.querySelector("#shareBase"),
  shareCards: document.querySelector("#shareCards"),
  chart: document.querySelector("#monthlyChart"),
  topItems: document.querySelector("#topItems"),
  table: document.querySelector("#salesTable"),
  totalBuyingCost: document.querySelector("#totalBuyingCost"),
  totalDeliveryCost: document.querySelector("#totalDeliveryCost"),
  totalCost: document.querySelector("#totalCost"),
  partnerCostAvg: document.querySelector("#partnerCostAvg"),
  costBase: document.querySelector("#costBase"),
  costCards: document.querySelector("#costCards"),
  costTable: document.querySelector("#costTable"),
  refresh: document.querySelector("#refreshBtn"),
};

function parseCSV(text) {
  const result = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (cell || row.length) result.push([...row, cell]);
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") i++;
    } else {
      cell += char;
    }
  }
  if (cell || row.length) result.push([...row, cell]);
  return result;
}

function toNumber(value) {
  if (!value || String(value).trim() === "-") return 0;
  const cleaned = String(value)
    .replace(/IDR|USD|Rp|\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}

function toDate(value) {
  const parts = String(value || "").split(/[/-]/).map(Number);
  if (parts.length < 3) return null;
  const [month, day, year] = parts;
  return new Date(year, month - 1, day);
}

function money(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

function dollar(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function moneyPair(idrValue, usdValue = idrValue / USD_TO_IDR) {
  return `<span class="money-pair"><strong>${money(idrValue)}</strong><small>${dollar(usdValue)}</small></span>`;
}

function monthKey(date) {
  if (!date) return "Unknown";
  return date.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function normalizeData(csv) {
  const [header, ...data] = parseCSV(csv);
  return data.filter(r => r.length > 5 && r[0] && r[0].trim() !== "-").map(r => {
    const rec = Object.fromEntries(header.map((key, index) => [key.trim(), (r[index] || "").trim()]));
    const date = toDate(rec.Date);
    const buying = toNumber(rec["Total Buying"] || rec["Buying Price"]);
    const delivery = toNumber(rec["Delivery Cost (Kurasi)"]);
    const profit = toNumber(rec.Profit);
    return {
      no: rec.No,
      date,
      dateText: rec.Date,
      code: rec["Transaction Code"],
      buyer: rec.Buyer,
      item: rec.Item,
      qty: toNumber(rec.Qty),
      country: rec["Buyer Country"],
      rate: toNumber(rec["Rate Selling"]),
      sellingUsd: toNumber(rec["Selling Price"]),
      totalSelling: toNumber(rec["Total Selling"]),
      buying,
      buyingUsd: buying / USD_TO_IDR,
      delivery,
      deliveryUsd: delivery / USD_TO_IDR,
      tracking: rec["Tracking Code"],
      profit,
      profitUsd: profit / USD_TO_IDR,
      month: monthKey(date),
    };
  });
}

function normalizeCostFromSales(salesRows) {
  return salesRows.map(r => {
    const total = r.buying + r.delivery;
    const partnerShare = total / 3;
    return {
      code: r.code,
      tracking: r.tracking,
      buying: r.buying,
      delivery: r.delivery,
      yusuf: partnerShare,
      shafi: partnerShare,
      husein: partnerShare,
      total,
    };
  }).filter(r => r.code && r.code !== "-" && r.total > 0);
}

function filteredRows() {
  const q = els.search.value.trim().toLowerCase();
  return rows.filter(r => {
    const matchMonth = els.month.value === "all" || r.month === els.month.value;
    const matchCountry = els.country.value === "all" || r.country === els.country.value;
    const haystack = `${r.item} ${r.buyer} ${r.tracking} ${r.code} ${r.country}`.toLowerCase();
    return matchMonth && matchCountry && (!q || haystack.includes(q));
  });
}

function filteredCostRows() {
  const codes = new Set(filteredRows().map(r => r.code));
  return costRows.filter(r => codes.has(r.code));
}

function fillFilters() {
  const months = [...new Set(rows.map(r => r.month))];
  const countries = [...new Set(rows.map(r => r.country).filter(Boolean))].sort();
  els.month.innerHTML = '<option value="all">Semua bulan</option>' + months.map(m => `<option>${m}</option>`).join("");
  els.country.innerHTML = '<option value="all">Semua negara</option>' + countries.map(c => `<option>${c}</option>`).join("");
}

function render() {
  const data = filteredRows();
  const totalSelling = data.reduce((sum, r) => sum + r.totalSelling, 0);
  const totalProfit = data.reduce((sum, r) => sum + r.profit, 0);
  els.selling.textContent = money(totalSelling);
  els.profit.textContent = money(totalProfit);
  els.orders.textContent = data.length.toLocaleString("id-ID");
  els.margin.textContent = totalSelling ? `${((totalProfit / totalSelling) * 100).toFixed(1)}%` : "0%";
  renderShares(totalProfit);
  renderChart(data);
  renderTopItems(data);
  renderTable(data);
  renderCost(costRows);
}

function renderShares(totalProfit) {
  els.shareBase.textContent = `Dari net profit ${money(totalProfit)}`;
  els.shareCards.innerHTML = SHARE_SPLIT.map(share => {
    const amount = totalProfit * share.percent / 100;
    return `
      <article class="share-card">
        <div>
          <span>${share.name}</span>
          <strong>${money(amount)}</strong>
          <small>${dollar(amount / USD_TO_IDR)}</small>
        </div>
        <em>${share.percent}%</em>
      </article>`;
  }).join("");
}

function renderCost(data) {
  const totals = data.reduce((acc, r) => {
    acc.buying += r.buying;
    acc.delivery += r.delivery;
    acc.yusuf += r.yusuf;
    acc.shafi += r.shafi;
    acc.husein += r.husein;
    return acc;
  }, { buying: 0, delivery: 0, yusuf: 0, shafi: 0, husein: 0 });
  const grandTotal = totals.buying + totals.delivery;
  els.totalBuyingCost.textContent = money(totals.buying);
  els.totalDeliveryCost.textContent = money(totals.delivery);
  els.totalCost.textContent = money(grandTotal);
  els.partnerCostAvg.textContent = money(grandTotal / 3);
  els.costBase.textContent = `${data.length} transaksi dari semua data REKAP`;
  els.costCards.innerHTML = COST_PARTNERS.map(name => {
    const amount = totals[name.toLowerCase()];
    return `
      <article class="share-card">
        <div>
          <span>${name}</span>
          <strong>${money(amount)}</strong>
          <small>${dollar(amount / USD_TO_IDR)}</small>
        </div>
        <em>Cost</em>
      </article>`;
  }).join("");
  els.costTable.innerHTML = data.map(r => `
    <tr>
      <td>${r.code}</td>
      <td>${r.tracking}</td>
      <td>${moneyPair(r.buying)}</td>
      <td>${moneyPair(r.delivery)}</td>
      <td>${moneyPair(r.yusuf)}</td>
      <td>${moneyPair(r.shafi)}</td>
      <td>${moneyPair(r.husein)}</td>
      <td>${moneyPair(r.total)}</td>
    </tr>`).join("") || '<tr><td colspan="8">Data cost belum ada.</td></tr>';
}

function renderChart(data) {
  const grouped = new Map();
  data.forEach(r => grouped.set(r.month, (grouped.get(r.month) || 0) + r.profit));
  const entries = [...grouped.entries()];
  const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);
  els.chart.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <strong>${label}</strong>
      <div class="track"><div class="fill" style="width:${Math.max(Math.abs(value) / max * 100, 3)}%"></div></div>
      <span class="${value >= 0 ? "profit-pos" : "profit-neg"}">${money(value)}</span>
    </div>`).join("") || '<p class="subtitle">Data belum ada.</p>';
}

function renderTopItems(data) {
  const grouped = new Map();
  data.forEach(r => grouped.set(r.item, (grouped.get(r.item) || 0) + r.profit));
  const top = [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  els.topItems.innerHTML = top.map(([item, profit], index) => `
    <div class="rank-item">
      <strong>${index + 1}. ${item}</strong>
      <span>${money(profit)}</span>
    </div>`).join("") || '<p class="subtitle">Data belum ada.</p>';
}

function renderTable(data) {
  els.table.innerHTML = data.map(r => `
    <tr>
      <td>${r.dateText}</td>
      <td>${r.buyer}</td>
      <td>${r.item}</td>
      <td>${r.country}</td>
      <td>${moneyPair(r.totalSelling, r.sellingUsd)}</td>
      <td>${moneyPair(r.buying, r.buyingUsd)}</td>
      <td>${moneyPair(r.delivery, r.deliveryUsd)}</td>
      <td class="${r.profit >= 0 ? "profit-pos" : "profit-neg"}">${moneyPair(r.profit, r.profitUsd)}</td>
    </tr>`).join("");
}

async function fetchCsv(url) {
  const res = await fetch(`${url}&cacheBust=${Date.now()}`);
  if (!res.ok) throw new Error(`Google Sheet tidak bisa dibaca (${res.status})`);
  return res.text();
}

async function loadData() {
  els.status.textContent = "Mengambil data";
  const rekapCsv = await fetchCsv(REKAP_CSV_URL);
  rows = normalizeData(rekapCsv);
  costRows = normalizeCostFromSales(rows);
  fillFilters();
  render();
  els.status.textContent = `${rows.length} sales loaded`;
  els.updated.textContent = `Update: ${new Date().toLocaleString("id-ID")}`;
}

function setPage(page) {
  els.dashboardPage.classList.toggle("active", page === "dashboard");
  els.profitSharePage.classList.toggle("active", page === "profit-share");
  els.costSharePage.classList.toggle("active", page === "cost-share");
  els.navLinks.forEach(link => link.classList.toggle("active", link.dataset.pageLink === page));
}

els.navLinks.forEach(link => link.addEventListener("click", event => {
  event.preventDefault();
  const page = link.dataset.pageLink;
  history.replaceState(null, "", `#${page}`);
  setPage(page);
}));

[els.month, els.country, els.search].forEach(el => el.addEventListener("input", render));
els.refresh.addEventListener("click", () => loadData().catch(showError));
setPage(["#profit-share", "#cost-share"].includes(location.hash) ? location.hash.slice(1) : "dashboard");

function showError(error) {
  console.error(error);
  els.status.textContent = "Gagal load data";
  els.updated.textContent = error.message;
}

loadData().catch(showError);

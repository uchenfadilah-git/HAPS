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
  cashflowPage: document.querySelector("#cashflowPage"),
  problemsPage: document.querySelector("#problemsPage"),
  itemsPage: document.querySelector("#itemsPage"),
  reportsPage: document.querySelector("#reportsPage"),
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
  cashIn: document.querySelector("#cashIn"),
  cashOut: document.querySelector("#cashOut"),
  netCash: document.querySelector("#netCash"),
  avgRate: document.querySelector("#avgRate"),
  cashflowList: document.querySelector("#cashflowList"),
  lossOrders: document.querySelector("#lossOrders"),
  totalLoss: document.querySelector("#totalLoss"),
  highDelivery: document.querySelector("#highDelivery"),
  lowMargin: document.querySelector("#lowMargin"),
  problemList: document.querySelector("#problemList"),
  itemInsights: document.querySelector("#itemInsights"),
  reportSummary: document.querySelector("#reportSummary"),
  printReport: document.querySelector("#printReportBtn"),
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
  renderCashflow(data);
  renderProblems(data);
  renderItemInsights(data);
  renderReport(data);
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
      <td data-label="Transaction">${r.code}</td>
      <td data-label="Tracking">${r.tracking}</td>
      <td data-label="Buying Cost">${moneyPair(r.buying)}</td>
      <td data-label="Delivery Cost">${moneyPair(r.delivery)}</td>
      <td data-label="Yusuf Share">${moneyPair(r.yusuf)}</td>
      <td data-label="Shafi Share">${moneyPair(r.shafi)}</td>
      <td data-label="Husein Share">${moneyPair(r.husein)}</td>
      <td data-label="Total Cost">${moneyPair(r.total)}</td>
    </tr>`).join("") || '<tr><td colspan="8">Data cost belum ada.</td></tr>';
}


function renderCashflow(data) {
  const cashIn = data.reduce((sum, r) => sum + r.totalSelling, 0);
  const cashOut = data.reduce((sum, r) => sum + r.buying + r.delivery, 0);
  const rates = data.map(r => r.rate).filter(Boolean);
  const avgRate = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : USD_TO_IDR;
  els.cashIn.textContent = money(cashIn);
  els.cashOut.textContent = money(cashOut);
  els.netCash.textContent = money(cashIn - cashOut);
  els.avgRate.textContent = Math.round(avgRate).toLocaleString("id-ID");
  els.cashflowList.innerHTML = data.map(r => {
    const out = r.buying + r.delivery;
    const net = r.totalSelling - out;
    return `<div class="rank-item split-item">
      <strong>${r.code} - ${r.buyer || "Buyer"}</strong>
      <span>In ${money(r.totalSelling)} / Out ${money(out)} / Net ${money(net)}</span>
    </div>`;
  }).join("") || '<p class="subtitle">Data belum ada.</p>';
}

function renderProblems(data) {
  const loss = data.filter(r => r.profit < 0);
  const highDelivery = data.filter(r => r.totalSelling && r.delivery / r.totalSelling > 0.35);
  const lowMargin = data.filter(r => r.totalSelling && r.profit >= 0 && r.profit / r.totalSelling < 0.15);
  const problemRows = [...new Map([...loss, ...highDelivery, ...lowMargin].map(r => [r.code, r])).values()];
  els.lossOrders.textContent = loss.length.toLocaleString("id-ID");
  els.totalLoss.textContent = money(Math.abs(loss.reduce((sum, r) => sum + r.profit, 0)));
  els.highDelivery.textContent = highDelivery.length.toLocaleString("id-ID");
  els.lowMargin.textContent = lowMargin.length.toLocaleString("id-ID");
  els.problemList.innerHTML = problemRows.map(r => {
    const flags = [];
    if (r.profit < 0) flags.push("Profit minus");
    if (r.totalSelling && r.delivery / r.totalSelling > 0.35) flags.push("Delivery tinggi");
    if (r.totalSelling && r.profit >= 0 && r.profit / r.totalSelling < 0.15) flags.push("Margin rendah");
    return `<div class="rank-item split-item danger-item">
      <strong>${r.code} - ${r.item}</strong>
      <span>${flags.join(" / ")} | Profit ${money(r.profit)} | Delivery ${money(r.delivery)}</span>
    </div>`;
  }).join("") || '<p class="subtitle">Belum ada transaksi bermasalah dari filter ini.</p>';
}

function renderItemInsights(data) {
  const grouped = new Map();
  data.forEach(r => {
    const current = grouped.get(r.item) || { item: r.item, orders: 0, qty: 0, selling: 0, profit: 0, delivery: 0 };
    current.orders += 1;
    current.qty += r.qty;
    current.selling += r.totalSelling;
    current.profit += r.profit;
    current.delivery += r.delivery;
    grouped.set(r.item, current);
  });
  const insights = [...grouped.values()].sort((a, b) => b.profit - a.profit);
  els.itemInsights.innerHTML = insights.map(item => {
    const margin = item.selling ? `${((item.profit / item.selling) * 100).toFixed(1)}%` : "0%";
    return `<div class="rank-item split-item">
      <strong>${item.item}</strong>
      <span>${item.orders} order / Qty ${item.qty} / Profit ${money(item.profit)} / Margin ${margin} / Delivery ${money(item.delivery)}</span>
    </div>`;
  }).join("") || '<p class="subtitle">Data item belum ada.</p>';
}

function renderReport(data) {
  const totalSelling = data.reduce((sum, r) => sum + r.totalSelling, 0);
  const totalProfit = data.reduce((sum, r) => sum + r.profit, 0);
  const totalBuying = data.reduce((sum, r) => sum + r.buying, 0);
  const totalDelivery = data.reduce((sum, r) => sum + r.delivery, 0);
  const totalCost = totalBuying + totalDelivery;
  const margin = totalSelling ? `${((totalProfit / totalSelling) * 100).toFixed(1)}%` : "0%";
  const monthLabel = els.month.value === "all" ? "Semua bulan" : els.month.value;
  const countryLabel = els.country.value === "all" ? "Semua negara" : els.country.value;
  const topItems = [...data]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
    .map((r, index) => `<tr><td>${index + 1}</td><td>${r.item}</td><td>${r.buyer}</td><td>${money(r.totalSelling)}</td><td>${money(r.profit)}</td></tr>`)
    .join("") || '<tr><td colspan="5">Data belum ada.</td></tr>';
  const shareRows = SHARE_SPLIT.map(share => {
    const amount = totalProfit * share.percent / 100;
    return `<tr><td>${share.name}</td><td>${share.percent}%</td><td>${money(amount)}</td></tr>`;
  }).join("");

  els.reportSummary.innerHTML = `
    <div class="report-cover">
      <img src="assets/logo.png" alt="HB Autopartshop" />
      <div>
        <p class="eyebrow">Monthly Business Report</p>
        <h2>HB Autopartshop</h2>
        <span>${monthLabel} / ${countryLabel} / ${new Date().toLocaleDateString("id-ID")}</span>
      </div>
    </div>
    <div class="report-grid">
      <div class="report-tile"><span>Total Order</span><strong>${data.length.toLocaleString("id-ID")}</strong></div>
      <div class="report-tile"><span>Total Selling</span><strong>${money(totalSelling)}</strong></div>
      <div class="report-tile"><span>Total Cost</span><strong>${money(totalCost)}</strong></div>
      <div class="report-tile"><span>Net Profit</span><strong>${money(totalProfit)}</strong></div>
      <div class="report-tile"><span>Margin</span><strong>${margin}</strong></div>
      <div class="report-tile"><span>Buying / Delivery</span><strong>${money(totalBuying)} / ${money(totalDelivery)}</strong></div>
    </div>
    <div class="report-section">
      <h3>Profit Share</h3>
      <table class="report-table"><thead><tr><th>Partner</th><th>Percent</th><th>Amount</th></tr></thead><tbody>${shareRows}</tbody></table>
    </div>
    <div class="report-section">
      <h3>Top Profit Transactions</h3>
      <table class="report-table"><thead><tr><th>#</th><th>Item</th><th>Buyer</th><th>Selling</th><th>Profit</th></tr></thead><tbody>${topItems}</tbody></table>
    </div>`;
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
      <td data-label="Date">${r.dateText}</td>
      <td data-label="Buyer">${r.buyer}</td>
      <td data-label="Item">${r.item}</td>
      <td data-label="Country">${r.country}</td>
      <td data-label="Selling">${moneyPair(r.totalSelling, r.sellingUsd)}</td>
      <td data-label="Buying">${moneyPair(r.buying, r.buyingUsd)}</td>
      <td data-label="Delivery">${moneyPair(r.delivery, r.deliveryUsd)}</td>
      <td data-label="Profit" class="${r.profit >= 0 ? "profit-pos" : "profit-neg"}">${moneyPair(r.profit, r.profitUsd)}</td>
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
  els.cashflowPage.classList.toggle("active", page === "cashflow");
  els.problemsPage.classList.toggle("active", page === "problems");
  els.itemsPage.classList.toggle("active", page === "items");
  els.reportsPage.classList.toggle("active", page === "reports");
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
const validPages = ["#profit-share", "#cost-share", "#cashflow", "#problems", "#items", "#reports"];
setPage(validPages.includes(location.hash) ? location.hash.slice(1) : "dashboard");
els.printReport.addEventListener("click", () => window.print());

function showError(error) {
  console.error(error);
  els.status.textContent = "Gagal load data";
  els.updated.textContent = error.message;
}

loadData().catch(showError);

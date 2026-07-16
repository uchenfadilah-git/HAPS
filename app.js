const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/1QY6xEU_ppaR8zZNg44hHJ8OH4w7n-GWO/gviz/tq?tqx=out:csv";
const TABS = {
  rekap: `${SHEET_BASE_URL}&sheet=REKAP`,
  cost: `${SHEET_BASE_URL}&sheet=COST`,
  profit: `${SHEET_BASE_URL}&sheet=PROFIT`,
  capital: `${SHEET_BASE_URL}&sheet=Permodalan`,
  settlement: `${SHEET_BASE_URL}&sheet=Pencatatan%20eBay`,
  cash: `${SHEET_BASE_URL}&sheet=Saldo%20Cash`,
};
const USD_TO_IDR = 16500;
const PARTNERS = ["Yusuf", "Shafi", "Husein"];
const PROFIT_SPLIT = [
  { name: "Yusuf", percent: 30 },
  { name: "Shafi", percent: 30 },
  { name: "Husein", percent: 30 },
  { name: "Laba Ditahan", percent: 10 },
];

let salesRows = [];
let costRows = [];
let costSheetRows = [];
let costFallbackRows = [];
let profitRows = [];
let settlementRows = [];
let cashRows = [];
let capitalRows = [];
let auditItems = [];

const els = {
  status: document.querySelector("#dataStatus"), updated: document.querySelector("#lastUpdated"),
  month: document.querySelector("#monthFilter"), country: document.querySelector("#countryFilter"), search: document.querySelector("#searchInput"), refresh: document.querySelector("#refreshBtn"),
  navLinks: document.querySelectorAll("[data-page-link]"), themeButtons: document.querySelectorAll("[data-theme-choice]"), printReport: document.querySelector("#printReportBtn"),
  pages: {
    dashboard: document.querySelector("#dashboardPage"), sales: document.querySelector("#salesPage"), settlement: document.querySelector("#settlementPage"), cash: document.querySelector("#cashPage"), partners: document.querySelector("#partnersPage"), share: document.querySelector("#sharePage"), audit: document.querySelector("#auditPage"), reports: document.querySelector("#reportsPage"),
  },
  totalSales: document.querySelector("#totalSales"), netProfit: document.querySelector("#netProfit"), cashInTotal: document.querySelector("#cashInTotal"), cashOutTotal: document.querySelector("#cashOutTotal"), cashBalance: document.querySelector("#cashBalance"), auditIssueCount: document.querySelector("#auditIssueCount"),
  businessHealth: document.querySelector("#businessHealth"), monthlyChart: document.querySelector("#monthlyChart"), topItems: document.querySelector("#topItems"), salesCount: document.querySelector("#salesCount"), salesTable: document.querySelector("#salesTable"),
  ebayCash: document.querySelector("#ebayCash"), payoneerActual: document.querySelector("#payoneerActual"), otherCostActual: document.querySelector("#otherCostActual"), rateDiff: document.querySelector("#rateDiff"), settlementCount: document.querySelector("#settlementCount"), settlementTable: document.querySelector("#settlementTable"),
  cashInPage: document.querySelector("#cashInPage"), cashOutPage: document.querySelector("#cashOutPage"), cashBalancePage: document.querySelector("#cashBalancePage"), cashRowsCount: document.querySelector("#cashRowsCount"), cashTimeline: document.querySelector("#cashTimeline"),
  partnerCards: document.querySelector("#partnerCards"), partnerTable: document.querySelector("#partnerTable"), shareBase: document.querySelector("#shareBase"), shareCards: document.querySelector("#shareCards"), costBase: document.querySelector("#costBase"), costCards: document.querySelector("#costCards"), costTable: document.querySelector("#costTable"),
  auditCount: document.querySelector("#auditCount"), auditList: document.querySelector("#auditList"), reportSummary: document.querySelector("#reportSummary"),
};

function parseCSV(text) {
  const result = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (cell || row.length) result.push([...row, cell]); row = []; cell = ""; if (char === "\r" && next === "\n") i++; }
    else cell += char;
  }
  if (cell || row.length) result.push([...row, cell]);
  return result;
}
function isFilled(value) { const text = String(value || "").trim(); return Boolean(text && text !== "-"); }
function toNumber(value) {
  const raw = String(value || "").trim(); if (!raw || raw === "-") return 0;
  const cleaned = raw.replace(/IDR|USD|Rp|\s/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}
function toDate(value) { const p = String(value || "").trim().split(/[/-]/).map(Number); return p.length >= 3 ? new Date(p[2], p[1] - 1, p[0]) : null; }
function monthKey(date) { return date ? date.toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : "Unknown"; }
function money(value) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0); }
function dollar(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0); }
function moneyPair(idrValue, usdValue = idrValue / USD_TO_IDR) { return `<span class="money-pair"><strong>${money(idrValue)}</strong><small>${dollar(usdValue)}</small></span>`; }
function roundup(value) { return Math.ceil(value || 0); }
function rowsFromCsv(csv, requiredFields = []) {
  const [header = [], ...data] = parseCSV(csv || ""); const normalizedHeader = header.map(k => k.trim());
  return data.map(r => Object.fromEntries(normalizedHeader.map((key, index) => [key, (r[index] || "").trim()])))
    .filter(rec => requiredFields.some(field => isFilled(rec[field])));
}
async function fetchCsv(url) { const res = await fetch(`${url}&cacheBust=${Date.now()}`); if (!res.ok) throw new Error(`Google Sheet tidak bisa dibaca (${res.status})`); return res.text(); }

function normalizeSales(csv) {
  return rowsFromCsv(csv, ["Date", "Transaction Code", "Buyer", "Item", "Buyer Country", "Tracking Code"]).map(rec => {
    const date = toDate(rec.Date); const buying = toNumber(rec["Total Buying"] || rec["Buying Price"]); const delivery = toNumber(rec["Delivery Cost (Kurasi)"]); const profit = toNumber(rec.Profit); const totalSelling = toNumber(rec["Total Selling"]); const rate = toNumber(rec["Rate Selling"]); const code = rec["Transaction Code"];
    const status = !isFilled(code) ? "Draft" : /cancel/i.test(`${rec["Tracking Code"]} ${rec.Item}`) ? "Cancelled" : (!delivery && buying ? "Pending Delivery" : "Completed");
    return { no: rec.No, date, dateText: rec.Date, month: monthKey(date), code, buyer: rec.Buyer, item: rec.Item, qty: toNumber(rec.Qty), country: rec["Buyer Country"], rate, sellingUsd: rate ? totalSelling / rate : toNumber(rec["Sales - Fee eBay"]), totalSelling, buying, buyingUsd: buying / USD_TO_IDR, delivery, deliveryUsd: delivery / USD_TO_IDR, tracking: rec["Tracking Code"], profit, profitUsd: profit / USD_TO_IDR, withdrawal: toNumber(rec["Total Withdrawal"]), status };
  });
}
function normalizeCost(csv) {
  return rowsFromCsv(csv, ["Transaction Code", "Tracking Code"]).map(rec => {
    const buying = toNumber(rec["Total Buying"]), delivery = toNumber(rec["Delivery Cost (Kurasi)"]);
    return { code: rec["Transaction Code"], tracking: rec["Tracking Code"], buying, delivery, yusuf: (toNumber(rec.Yusuf) || roundup(buying / 3)) + (toNumber(rec.Yusuf2) || roundup(delivery / 3)), shafi: (toNumber(rec.Shafi) || roundup(buying / 3)) + (toNumber(rec.Shafi2) || roundup(delivery / 3)), husein: (toNumber(rec.Husein) || roundup(buying / 3)) + (toNumber(rec.Husein2) || roundup(delivery / 3)), total: buying + delivery, source: "COST" };
  }).filter(r => isFilled(r.code) && r.code !== "-" && r.total > 0);
}
function costFromSales(rows) {
  return rows.map(r => ({ code: r.code, tracking: r.tracking, buying: r.buying, delivery: r.delivery, yusuf: roundup(r.buying / 3) + roundup(r.delivery / 3), shafi: roundup(r.buying / 3) + roundup(r.delivery / 3), husein: roundup(r.buying / 3) + roundup(r.delivery / 3), total: r.buying + r.delivery, source: "REKAP fallback" })).filter(r => isFilled(r.code) && r.total > 0);
}
function normalizeProfit(csv) { return rowsFromCsv(csv, ["Transaction Code", "Buyer", "Item"]).map(rec => ({ code: rec["Transaction Code"], buyer: rec.Buyer, item: rec.Item, profit: toNumber(rec.Profit), yusuf: toNumber(rec["Yusuf (30%)"]), shafi: toNumber(rec["Shafi (30%)"]), husein: toNumber(rec["Husein (30%)"]), retained: toNumber(rec["Laba ditahan (10%)"]) })).filter(r => isFilled(r.code) && r.code !== "-"); }
function normalizeSettlement(csv) {
  return rowsFromCsv(csv, ["Date", "Buyer", "Item", "Uang Cair dari eBay\n(IDR)", "ACTUAL\nUang Cair dari Payoneer\n(IDR)"]).map(rec => ({ date: toDate(rec.Date), dateText: rec.Date, month: monthKey(toDate(rec.Date)), buyer: rec.Buyer, item: rec.Item, country: rec["Buyer Country"], salesFeeUsd: toNumber(rec["Sales - Fee eBay"]), ebayCashIdr: toNumber(rec["Uang Cair dari eBay\n(IDR)"]), ebayCashUsd: toNumber(rec["Uang Cair dari eBay\n(USD)"]), otherCostIdr: toNumber(rec["Other Cost\n(IDR)"]), payoneerIdr: toNumber(rec["Uang Cair dari Payoneer\n(IDR)"]), actualPayoneerIdr: toNumber(rec["ACTUAL\nUang Cair dari Payoneer\n(IDR)"]), diff: toNumber(rec["Selisih Karena Rate"]), status: toNumber(rec["ACTUAL\nUang Cair dari Payoneer\n(IDR)"]) ? "Settled" : "Pending" }));
}
function normalizeCash(csv) { return rowsFromCsv(csv, ["Tanggal", "Keterangan", "Pemasukan", "Pengeluaran", "Sisah Saldo"]).map(rec => ({ date: toDate(rec.Tanggal), dateText: rec.Tanggal, month: monthKey(toDate(rec.Tanggal)), desc: rec.Keterangan, in: toNumber(rec.Pemasukan), out: toNumber(rec.Pengeluaran), balance: toNumber(rec["Sisah Saldo"]) })).filter(r => r.dateText || r.desc || r.in || r.out || r.balance); }
function normalizeCapital(csv) {
  const rows = parseCSV(csv || ""); const [header = [], ...data] = rows; const partners = [{ name: "Yusuf", start: 0 }, { name: "Shafi", start: 6 }, { name: "Husein", start: 12 }]; const out = [];
  data.forEach(r => partners.forEach(p => { const rec = { partner: p.name, dateText: (r[p.start] || "").trim(), date: toDate(r[p.start]), desc: (r[p.start + 1] || "").trim(), in: toNumber(r[p.start + 2]), out: toNumber(r[p.start + 3]), balance: toNumber(r[p.start + 4]) }; if (rec.dateText || rec.desc || rec.in || rec.out || rec.balance) out.push(rec); }));
  return out;
}

function filteredSales() { const q = els.search.value.trim().toLowerCase(); return salesRows.filter(r => (els.month.value === "all" || r.month === els.month.value) && (els.country.value === "all" || r.country === els.country.value) && (!q || `${r.code} ${r.buyer} ${r.item} ${r.country} ${r.tracking} ${r.status}`.toLowerCase().includes(q))); }
function filteredSettlement() { const q = els.search.value.trim().toLowerCase(); return settlementRows.filter(r => (els.month.value === "all" || r.month === els.month.value) && (!q || `${r.buyer} ${r.item} ${r.status}`.toLowerCase().includes(q))); }
function filteredCash() { const q = els.search.value.trim().toLowerCase(); return cashRows.filter(r => (els.month.value === "all" || r.month === els.month.value) && (!q || `${r.desc}`.toLowerCase().includes(q))); }
function filteredCost() { const codes = new Set(filteredSales().map(r => r.code)); return costRows.filter(r => codes.has(r.code)); }
function fillFilters() { const months = [...new Set([...salesRows, ...settlementRows, ...cashRows].map(r => r.month).filter(Boolean))]; const countries = [...new Set(salesRows.map(r => r.country).filter(Boolean))].sort(); els.month.innerHTML = '<option value="all">Semua bulan</option>' + months.map(m => `<option>${m}</option>`).join(""); els.country.innerHTML = '<option value="all">Semua negara</option>' + countries.map(c => `<option>${c}</option>`).join(""); }

function buildAudit() {
  const salesCodes = new Set(salesRows.map(r => r.code).filter(isFilled)); const costCodes = new Set(costSheetRows.map(r => r.code).filter(isFilled)); const profitCodes = new Set(profitRows.map(r => r.code).filter(isFilled)); const fallbackCodes = new Set(costFallbackRows.map(r => r.code)); auditItems = [];
  [...salesCodes].filter(code => !costCodes.has(code)).forEach(code => auditItems.push({ level: fallbackCodes.has(code) ? "warn" : "danger", title: `COST belum lengkap: ${code}`, detail: fallbackCodes.has(code) ? "Dashboard pakai fallback dari REKAP." : "Tidak ada cost dan tidak bisa fallback." }));
  [...salesCodes].filter(code => !profitCodes.has(code)).forEach(code => auditItems.push({ level: "danger", title: `PROFIT belum ada: ${code}`, detail: "Split profit belum tercatat di tab PROFIT." }));
  salesRows.filter(r => r.status !== "Completed").forEach(r => auditItems.push({ level: "warn", title: `${r.status}: ${r.code}`, detail: `${r.item || "-"} / ${r.tracking || "tracking kosong"}` }));
  settlementRows.filter(r => r.status === "Pending" && (r.salesFeeUsd || r.buyer || r.item)).forEach(r => auditItems.push({ level: "warn", title: `Settlement pending: ${r.buyer || r.item || "baris eBay"}`, detail: "Actual Payoneer belum tercatat." }));
}

function render() {
  const sales = filteredSales(), settlement = filteredSettlement(), cash = filteredCash(), costs = filteredCost();
  const totalSales = sales.reduce((s, r) => s + r.totalSelling, 0), profit = sales.reduce((s, r) => s + r.profit, 0), buying = sales.reduce((s, r) => s + r.buying, 0), delivery = sales.reduce((s, r) => s + r.delivery, 0);
  const cashIn = cash.reduce((s, r) => s + r.in, 0), cashOut = cash.reduce((s, r) => s + r.out, 0), cashBalance = cash.length ? cash[cash.length - 1].balance : (cashRows.at(-1)?.balance || 0);
  els.totalSales.textContent = money(totalSales); els.netProfit.textContent = money(profit); els.cashInTotal.textContent = money(cashIn); els.cashOutTotal.textContent = money(cashOut); els.cashBalance.textContent = money(cashBalance); els.auditIssueCount.textContent = auditItems.length.toLocaleString("id-ID");
  renderHealth(sales, costs, settlement, cash, profit, totalSales, buying, delivery); renderChart(sales); renderTopItems(sales); renderSales(sales); renderSettlement(settlement); renderCash(cash); renderPartners(); renderShares(profit, costs); renderAudit(); renderReport(sales, settlement, cash, costs);
}
function renderHealth(sales, costs, settlement, cash, profit, totalSales, buying, delivery) {
  const items = [
    ["Sales", `${sales.length} transaksi / ${money(totalSales)}`, `Profit ${money(profit)} (${totalSales ? (profit / totalSales * 100).toFixed(1) : 0}%)`],
    ["Cost", `${money(buying + delivery)} total`, `${costSheetRows.length} dari COST, ${costFallbackRows.length} fallback REKAP`],
    ["Settlement", `${settlement.filter(r => r.status === "Settled").length} settled`, `${settlement.filter(r => r.status === "Pending").length} pending`],
    ["Cash", `${cash.length} ledger entries`, `Saldo akhir ${money(cash.length ? cash.at(-1).balance : 0)}`],
  ];
  els.businessHealth.innerHTML = items.map(([a,b,c]) => `<div class="rank-item split-item"><strong>${a}</strong><span>${b}</span><small>${c}</small></div>`).join("");
}
function renderChart(data) { const grouped = new Map(); data.forEach(r => grouped.set(r.month, (grouped.get(r.month) || 0) + r.profit)); const entries = [...grouped.entries()]; const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 1); els.monthlyChart.innerHTML = entries.map(([label, value]) => `<div class="bar-row"><strong>${label}</strong><div class="track"><div class="fill" style="width:${Math.max(Math.abs(value) / max * 100, 3)}%"></div></div><span class="${value >= 0 ? "profit-pos" : "profit-neg"}">${money(value)}</span></div>`).join("") || '<p class="subtitle">Data belum ada.</p>'; }
function renderTopItems(data) { const grouped = new Map(); data.forEach(r => { const cur = grouped.get(r.item) || { profit: 0, sales: 0, qty: 0 }; cur.profit += r.profit; cur.sales += r.totalSelling; cur.qty += r.qty; grouped.set(r.item, cur); }); els.topItems.innerHTML = [...grouped.entries()].sort((a,b)=>b[1].profit-a[1].profit).slice(0,6).map(([item,v],i)=>`<div class="rank-item"><strong>${i+1}. ${item}</strong><span>${money(v.profit)} / ${v.qty} pcs</span></div>`).join("") || '<p class="subtitle">Data belum ada.</p>'; }
function renderSales(data) { els.salesCount.textContent = `${data.length} transaksi`; els.salesTable.innerHTML = data.map(r => `<tr><td data-label="Date">${r.dateText}</td><td data-label="Code">${r.code}</td><td data-label="Buyer">${r.buyer}</td><td data-label="Item">${r.item}</td><td data-label="Country">${r.country}</td><td data-label="Selling">${moneyPair(r.totalSelling, r.sellingUsd)}</td><td data-label="Buying">${r.buying ? moneyPair(r.buying) : ""}</td><td data-label="Delivery">${r.delivery ? moneyPair(r.delivery) : ""}</td><td data-label="Profit" class="${r.profit >= 0 ? "profit-pos" : "profit-neg"}">${moneyPair(r.profit)}</td><td data-label="Status"><span class="status-pill ${r.status === "Completed" ? "ok" : "warn"}">${r.status}</span></td></tr>`).join("") || '<tr><td colspan="10">Data belum ada.</td></tr>'; }
function renderSettlement(data) { const ebay = data.reduce((s,r)=>s+r.ebayCashIdr,0), actual = data.reduce((s,r)=>s+r.actualPayoneerIdr,0), other = data.reduce((s,r)=>s+r.otherCostIdr,0), diff = data.reduce((s,r)=>s+r.diff,0); els.ebayCash.textContent = money(ebay); els.payoneerActual.textContent = money(actual); els.otherCostActual.textContent = money(other); els.rateDiff.textContent = money(diff); els.settlementCount.textContent = `${data.length} baris`; els.settlementTable.innerHTML = data.map(r=>`<tr><td data-label="Date">${r.dateText}</td><td data-label="Buyer">${r.buyer}</td><td data-label="Item">${r.item}</td><td data-label="Sales Fee">${dollar(r.salesFeeUsd)}</td><td data-label="eBay Cash">${r.ebayCashIdr ? moneyPair(r.ebayCashIdr, r.ebayCashUsd) : ""}</td><td data-label="Other Cost">${r.otherCostIdr ? money(r.otherCostIdr) : ""}</td><td data-label="Payoneer">${r.payoneerIdr ? money(r.payoneerIdr) : ""}</td><td data-label="Actual">${r.actualPayoneerIdr ? money(r.actualPayoneerIdr) : ""}</td><td data-label="Selisih">${r.diff ? money(r.diff) : ""}</td><td data-label="Status"><span class="status-pill ${r.status === "Settled" ? "ok" : "warn"}">${r.status}</span></td></tr>`).join("") || '<tr><td colspan="10">Data belum ada.</td></tr>'; }
function renderCash(data) { const cashIn = data.reduce((s,r)=>s+r.in,0), cashOut = data.reduce((s,r)=>s+r.out,0), balance = data.length ? data.at(-1).balance : 0; els.cashInPage.textContent = money(cashIn); els.cashOutPage.textContent = money(cashOut); els.cashBalancePage.textContent = money(balance); els.cashRowsCount.textContent = data.length.toLocaleString("id-ID"); els.cashTimeline.innerHTML = data.slice().reverse().map(r=>`<div class="rank-item split-item"><strong>${r.dateText} - ${r.desc || "-"}</strong><span>Masuk ${money(r.in)} / Keluar ${money(r.out)} / Saldo ${money(r.balance)}</span></div>`).join("") || '<p class="subtitle">Data belum ada.</p>'; }
function renderPartners() { const latest = PARTNERS.map(name => capitalRows.filter(r=>r.partner===name).at(-1) || { partner:name, balance:0, in:0, out:0 }); els.partnerCards.innerHTML = latest.map(r=>`<article class="metric"><span>${r.partner}</span><strong>${money(r.balance)}</strong><small>Saldo modal terakhir</small></article>`).join(""); els.partnerTable.innerHTML = capitalRows.map(r=>`<tr><td data-label="Partner">${r.partner}</td><td data-label="Date">${r.dateText}</td><td data-label="Keterangan">${r.desc}</td><td data-label="Pemasukan">${r.in ? money(r.in) : ""}</td><td data-label="Pengeluaran">${r.out ? money(r.out) : ""}</td><td data-label="Saldo">${money(r.balance)}</td></tr>`).join("") || '<tr><td colspan="6">Data belum ada.</td></tr>'; }
function renderShares(totalProfit, costs) { els.shareBase.textContent = `Dari profit ${money(totalProfit)}`; els.shareCards.innerHTML = PROFIT_SPLIT.map(s=>{ const amount=totalProfit*s.percent/100; return `<article class="share-card"><div><span>${s.name}</span><strong>${money(amount)}</strong><small>${s.percent}% / ${dollar(amount/USD_TO_IDR)}</small></div><em>${s.percent}%</em></article>`; }).join(""); const totals = costs.reduce((a,r)=>{ a.yusuf+=r.yusuf; a.shafi+=r.shafi; a.husein+=r.husein; a.total+=r.total; return a; }, { yusuf:0, shafi:0, husein:0, total:0 }); els.costBase.textContent = `${costs.length} transaksi / ${money(totals.total)}`; els.costCards.innerHTML = PARTNERS.map(name=>`<article class="share-card"><div><span>${name}</span><strong>${money(totals[name.toLowerCase()])}</strong><small>Beban cost</small></div><em>Cost</em></article>`).join(""); els.costTable.innerHTML = costs.map(r=>`<tr><td data-label="Code">${r.code}</td><td data-label="Tracking">${r.tracking}</td><td data-label="Buying">${moneyPair(r.buying)}</td><td data-label="Delivery">${moneyPair(r.delivery)}</td><td data-label="Yusuf">${money(r.yusuf)}</td><td data-label="Shafi">${money(r.shafi)}</td><td data-label="Husein">${money(r.husein)}</td><td data-label="Source">${r.source}</td></tr>`).join("") || '<tr><td colspan="8">Data belum ada.</td></tr>'; }
function renderAudit() { els.auditCount.textContent = `${auditItems.length} issue`; els.auditList.innerHTML = auditItems.map(i=>`<div class="rank-item split-item ${i.level === "danger" ? "danger-item" : "warn-item"}"><strong>${i.title}</strong><span>${i.detail}</span></div>`).join("") || '<p class="subtitle">Data health aman.</p>'; }
function renderReport(sales, settlement, cash, costs) { const totalSales=sales.reduce((s,r)=>s+r.totalSelling,0), profit=sales.reduce((s,r)=>s+r.profit,0), totalCost=costs.reduce((s,r)=>s+r.total,0), actual=settlement.reduce((s,r)=>s+r.actualPayoneerIdr,0), balance=cash.length?cash.at(-1).balance:0; els.reportSummary.innerHTML = `<div class="report-cover"><img src="assets/logo.png" alt="HB Auto Parts" /><div><p class="eyebrow">Monthly Business Report</p><h2>HB Auto Parts</h2><span>${els.month.value === "all" ? "Semua bulan" : els.month.value} / ${new Date().toLocaleDateString("id-ID")}</span></div></div><div class="report-grid"><div class="report-tile"><span>Total Order</span><strong>${sales.length}</strong></div><div class="report-tile"><span>Total Sales</span><strong>${money(totalSales)}</strong></div><div class="report-tile"><span>Total Cost</span><strong>${money(totalCost)}</strong></div><div class="report-tile"><span>Net Profit</span><strong>${money(profit)}</strong></div><div class="report-tile"><span>Payoneer Actual</span><strong>${money(actual)}</strong></div><div class="report-tile"><span>Saldo Cash</span><strong>${money(balance)}</strong></div></div><div class="report-section"><h3>Audit Summary</h3><p>${auditItems.length} issue perlu dicek. Cost sheet ${costSheetRows.length}, fallback ${costFallbackRows.length}, profit rows ${profitRows.length}.</p></div>`; }

async function loadData() {
  els.status.textContent = "Mengambil data";
  const [rekapCsv, costCsv, profitCsv, capitalCsv, settlementCsv, cashCsv] = await Promise.all([fetchCsv(TABS.rekap), fetchCsv(TABS.cost).catch(()=>""), fetchCsv(TABS.profit).catch(()=>""), fetchCsv(TABS.capital).catch(()=>""), fetchCsv(TABS.settlement).catch(()=>""), fetchCsv(TABS.cash).catch(()=>"")]);
  salesRows = normalizeSales(rekapCsv); costSheetRows = normalizeCost(costCsv); const costCodes = new Set(costSheetRows.map(r=>r.code)); costFallbackRows = costFromSales(salesRows).filter(r=>!costCodes.has(r.code)); costRows = [...costSheetRows, ...costFallbackRows]; profitRows = normalizeProfit(profitCsv); capitalRows = normalizeCapital(capitalCsv); settlementRows = normalizeSettlement(settlementCsv); cashRows = normalizeCash(cashCsv); buildAudit(); fillFilters(); render(); els.status.textContent = `${salesRows.length} sales loaded`; els.updated.textContent = `Update: ${new Date().toLocaleString("id-ID")}`;
}
function applyTheme(choice) { const theme = choice === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : choice; document.documentElement.dataset.theme = theme; els.themeButtons.forEach(b => b.classList.toggle("active", b.dataset.themeChoice === choice)); }
function setTheme(choice) { localStorage.setItem("hb-theme", choice); applyTheme(choice); }
function setPage(page) { Object.entries(els.pages).forEach(([key, el]) => el.classList.toggle("active", key === page)); els.navLinks.forEach(link => link.classList.toggle("active", link.dataset.pageLink === page)); }
function showError(error) { console.error(error); els.status.textContent = "Gagal load data"; els.updated.textContent = error.message; }

els.navLinks.forEach(link => link.addEventListener("click", event => { event.preventDefault(); const page = link.dataset.pageLink; history.replaceState(null, "", `#${page}`); setPage(page); }));
[els.month, els.country, els.search].forEach(el => el.addEventListener("input", render));
els.refresh.addEventListener("click", () => loadData().catch(showError));
els.themeButtons.forEach(button => button.addEventListener("click", () => setTheme(button.dataset.themeChoice)));
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if ((localStorage.getItem("hb-theme") || "system") === "system") applyTheme("system"); });
els.printReport.addEventListener("click", () => window.print());
const validPages = Object.keys(els.pages).map(p => `#${p}`); setPage(validPages.includes(location.hash) ? location.hash.slice(1) : "dashboard"); applyTheme(localStorage.getItem("hb-theme") || "system"); loadData().catch(showError);

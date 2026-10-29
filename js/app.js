/* =========================================================
   app.js — Expense & Budget Visualizer
   Vanilla JS · LocalStorage · Chart.js
   Features: Dark/Light mode · Custom categories · Spend limit
   ========================================================= */

'use strict';

// ──────────────────────────────────────────────────────────
// Storage Keys
// ──────────────────────────────────────────────────────────
const KEY_TRANSACTIONS  = 'budgetVisualizer_transactions';
const KEY_CUSTOM_CATS   = 'budgetVisualizer_customCats';
const KEY_SPEND_LIMIT   = 'budgetVisualizer_spendLimit';
const KEY_CAT_LIMITS    = 'budgetVisualizer_catLimits';
const KEY_THEME         = 'budgetVisualizer_theme';

// ──────────────────────────────────────────────────────────
// Built-in Categories
// ──────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = [
  { name: 'Makanan',      emoji: '🍔', color: '#f59e0b', badgeClass: 'badge-food' },
  { name: 'Transportasi', emoji: '🚗', color: '#3b82f6', badgeClass: 'badge-transport' },
  { name: 'Hiburan',      emoji: '🎮', color: '#a855f7', badgeClass: 'badge-fun' },
];

// ──────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────
let transactions = loadJSON(KEY_TRANSACTIONS, []);
let customCats   = loadJSON(KEY_CUSTOM_CATS,  []);   // [{ name, emoji, color }]
let spendLimit   = loadJSON(KEY_SPEND_LIMIT,  0);    // number, 0 = off
let catLimits    = loadJSON(KEY_CAT_LIMITS,   {});   // { [catName]: number }
let chartInstance = null;

// ──────────────────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────────────────
const html           = document.documentElement;
const themeToggle    = document.getElementById('themeToggle');
const themeIcon      = document.getElementById('themeIcon');
const themeLabel     = document.getElementById('themeLabel');

const form           = document.getElementById('transactionForm');
const inputName      = document.getElementById('itemName');
const inputAmount    = document.getElementById('amount');
const selectType     = document.getElementById('type');
const selectCategory = document.getElementById('category');
const categoryGroup  = document.getElementById('categoryGroup');
const errName        = document.getElementById('errName');
const errAmount      = document.getElementById('errAmount');
const errCategory    = document.getElementById('errCategory');

const listEl         = document.getElementById('transactionList');
const listEmpty      = document.getElementById('listEmpty');
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl  = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const chartCanvas    = document.getElementById('expenseChart');
const chartEmpty     = document.getElementById('chartEmpty');
const btnClearAll    = document.getElementById('clearAll');
const limitAlert     = document.getElementById('limitAlert');
const limitAlertMsg  = document.getElementById('limitAlertMsg');

const categoryForm   = document.getElementById('categoryForm');
const newCatName     = document.getElementById('newCatName');
const newCatEmoji    = document.getElementById('newCatEmoji');
const newCatColor    = document.getElementById('newCatColor');
const errCatName     = document.getElementById('errCatName');
const customCatList  = document.getElementById('customCatList');

const spendLimitInput   = document.getElementById('spendLimit');
const saveLimit         = document.getElementById('saveLimit');
const catLimitsWrapper  = document.getElementById('catLimitsWrapper');
const catLimitsList     = document.getElementById('catLimitsList');

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Semua kategori (built-in + custom). */
function allCategories() {
  return [...BUILTIN_CATEGORIES, ...customCats];
}

/** Cari meta kategori berdasarkan nama. */
function getCatMeta(name) {
  return allCategories().find(c => c.name === name) || null;
}

// ──────────────────────────────────────────────────────────
// 1. Dark / Light Mode
// ──────────────────────────────────────────────────────────

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIcon.textContent  = '☀️';
    themeLabel.textContent = 'Light';
  } else {
    themeIcon.textContent  = '🌙';
    themeLabel.textContent = 'Dark';
  }
  // Update Chart.js legend text colour to match theme
  if (chartInstance) {
    const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
    chartInstance.options.plugins.legend.labels.color = textColor;
    chartInstance.update();
  }
}

function toggleTheme() {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveJSON(KEY_THEME, next);
}

themeToggle.addEventListener('click', toggleTheme);

// ──────────────────────────────────────────────────────────
// 2. Custom Categories
// ──────────────────────────────────────────────────────────

/** Populasi <select id="category"> dari built-in + custom. */
function populateCategorySelect() {
  // Pertahankan nilai yang sudah dipilih
  const current = selectCategory.value;
  selectCategory.innerHTML = '<option value="">-- Pilih Kategori --</option>';

  allCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat.name;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    selectCategory.appendChild(opt);
  });

  if (current) selectCategory.value = current;
}

/** Render daftar custom kategori di panel settings. */
function renderCustomCatList() {
  customCatList.innerHTML = '';

  if (customCats.length === 0) {
    customCatList.innerHTML =
      '<p style="font-size:.82rem;color:var(--clr-muted);margin-top:.25rem">Belum ada kategori kustom.</p>';
    return;
  }

  customCats.forEach((cat, idx) => {
    const item = document.createElement('div');
    item.className = 'custom-cat-item';
    item.innerHTML = `
      <span class="custom-cat-swatch" style="background:${cat.color}"></span>
      <span class="custom-cat-label">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span>
      <button class="btn-remove-cat" data-idx="${idx}" aria-label="Hapus kategori ${escapeHtml(cat.name)}">✕</button>
    `;
    customCatList.appendChild(item);
  });

  customCatList.querySelectorAll('.btn-remove-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      customCats.splice(idx, 1);
      saveJSON(KEY_CUSTOM_CATS, customCats);
      populateCategorySelect();
      renderCustomCatList();
      renderCatLimitsInputs();
      renderAll();
    });
  });
}

categoryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  errCatName.textContent = '';
  newCatName.classList.remove('invalid');

  const name  = newCatName.value.trim();
  const emoji = newCatEmoji.value.trim() || '📦';
  const color = newCatColor.value;

  if (!name) {
    newCatName.classList.add('invalid');
    errCatName.textContent = 'Nama kategori wajib diisi.';
    return;
  }

  // Cek duplikat
  const isDuplicate = allCategories().some(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    newCatName.classList.add('invalid');
    errCatName.textContent = 'Kategori ini sudah ada.';
    return;
  }

  customCats.push({ name, emoji, color });
  saveJSON(KEY_CUSTOM_CATS, customCats);

  populateCategorySelect();
  renderCustomCatList();
  renderCatLimitsInputs();

  categoryForm.reset();
  newCatColor.value = '#06b6d4';
});

// ──────────────────────────────────────────────────────────
// 3. Spending Limit
// ──────────────────────────────────────────────────────────

/** Render input batas per kategori di panel settings. */
function renderCatLimitsInputs() {
  const cats = allCategories();
  catLimitsWrapper.style.display = cats.length ? 'block' : 'none';
  catLimitsList.innerHTML = '';

  cats.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'cat-limit-row';
    row.innerHTML = `
      <span class="cat-swatch" style="background:${cat.color}"></span>
      <label>${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</label>
      <input
        type="number"
        min="0"
        placeholder="Tidak ada batas"
        data-cat="${escapeHtml(cat.name)}"
        value="${catLimits[cat.name] || ''}"
        aria-label="Batas ${escapeHtml(cat.name)}"
      />
    `;
    catLimitsList.appendChild(row);
  });
}

/** Cek apakah suatu transaksi melebihi batas. */
function isOverLimit(transaction) {
  if (transaction.type !== 'pengeluaran') return false;
  const cat = transaction.category;

  // Batas per kategori
  if (cat && catLimits[cat] > 0) {
    const catTotal = transactions
      .filter(t => t.type === 'pengeluaran' && t.category === cat)
      .reduce((s, t) => s + t.amount, 0);
    if (catTotal > catLimits[cat]) return true;
  }

  return false;
}

/** Cek dan tampilkan alert batas total. */
function checkGlobalLimit() {
  const totalExp = transactions
    .filter(t => t.type === 'pengeluaran')
    .reduce((s, t) => s + t.amount, 0);

  if (spendLimit > 0 && totalExp > spendLimit) {
    limitAlert.style.display = 'flex';
    limitAlertMsg.textContent =
      `Total pengeluaran ${formatRupiah(totalExp)} melebihi batas ${formatRupiah(spendLimit)}!`;
  } else {
    limitAlert.style.display = 'none';
  }
}

saveLimit.addEventListener('click', () => {
  const val = Number(spendLimitInput.value);
  spendLimit = val >= 0 ? val : 0;
  saveJSON(KEY_SPEND_LIMIT, spendLimit);

  // Simpan semua batas per kategori
  catLimitsList.querySelectorAll('input[data-cat]').forEach(input => {
    const cat = input.dataset.cat;
    const v   = Number(input.value);
    if (v > 0) catLimits[cat] = v;
    else delete catLimits[cat];
  });
  saveJSON(KEY_CAT_LIMITS, catLimits);

  renderAll();

  saveLimit.textContent = '✅ Tersimpan!';
  setTimeout(() => (saveLimit.textContent = '💾 Simpan Batas'), 1500);
});

// ──────────────────────────────────────────────────────────
// Transaction CRUD
// ──────────────────────────────────────────────────────────

function clearErrors() {
  [inputName, inputAmount, selectCategory].forEach(el => el.classList.remove('invalid'));
  [errName, errAmount, errCategory].forEach(el => (el.textContent = ''));
}

function validateForm() {
  clearErrors();
  let valid = true;
  const name   = inputName.value.trim();
  const amount = inputAmount.value.trim();
  const type   = selectType.value;
  const cat    = selectCategory.value;

  if (!name) {
    inputName.classList.add('invalid');
    errName.textContent = 'Nama item wajib diisi.';
    valid = false;
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    inputAmount.classList.add('invalid');
    errAmount.textContent = 'Masukkan jumlah yang valid (lebih dari 0).';
    valid = false;
  }
  if (type === 'pengeluaran' && !cat) {
    selectCategory.classList.add('invalid');
    errCategory.textContent = 'Pilih kategori untuk pengeluaran.';
    valid = false;
  }
  return valid;
}

selectType.addEventListener('change', () => {
  const isPengeluaran = selectType.value === 'pengeluaran';
  categoryGroup.style.display = isPengeluaran ? 'block' : 'none';
  if (!isPengeluaran) { selectCategory.value = ''; clearErrors(); }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  transactions.unshift({
    id:       Date.now().toString(),
    name:     inputName.value.trim(),
    amount:   Number(inputAmount.value),
    type:     selectType.value,
    category: selectType.value === 'pengeluaran' ? selectCategory.value : null,
    date:     new Date().toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
              }),
  });

  saveJSON(KEY_TRANSACTIONS, transactions);
  renderAll();
  form.reset();
  clearErrors();
  categoryGroup.style.display = 'block';
});

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveJSON(KEY_TRANSACTIONS, transactions);
  renderAll();
}

btnClearAll.addEventListener('click', () => {
  if (transactions.length === 0) return;
  if (!confirm('Yakin ingin menghapus semua transaksi?')) return;
  transactions = [];
  saveJSON(KEY_TRANSACTIONS, transactions);
  renderAll();
});

// ──────────────────────────────────────────────────────────
// Render: Balance
// ──────────────────────────────────────────────────────────

function renderBalance() {
  const totalIncome  = transactions.filter(t => t.type === 'pemasukan')
                                   .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'pengeluaran')
                                   .reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  totalBalanceEl.textContent = formatRupiah(balance);
  totalIncomeEl.textContent  = formatRupiah(totalIncome);
  totalExpenseEl.textContent = formatRupiah(totalExpense);
  totalBalanceEl.style.color = balance < 0 ? '#fca5a5' : '#ffffff';
}

// ──────────────────────────────────────────────────────────
// Render: Transaction List
// ──────────────────────────────────────────────────────────

function renderList() {
  Array.from(listEl.children).forEach(c => { if (c !== listEmpty) c.remove(); });

  if (transactions.length === 0) { listEmpty.style.display = 'block'; return; }
  listEmpty.style.display = 'none';

  transactions.forEach(t => {
    const item       = document.createElement('div');
    const isExpense  = t.type === 'pengeluaran';
    const overLimit  = isExpense && isOverLimit(t);

    item.className = `transaction-item ${t.type}${overLimit ? ' over-limit' : ''}`;
    if (t.category) item.dataset.category = t.category;

    // Badge
    let badgeHtml = '';
    if (t.category) {
      const meta    = getCatMeta(t.category);
      const emoji   = meta?.emoji      || '📦';
      const cls     = meta?.badgeClass || '';
      const bgColor = (!meta?.badgeClass && meta?.color) ? meta.color : null;
      const style   = bgColor
        ? `style="background:${bgColor}22;color:${bgColor};border:1px solid ${bgColor}55"`
        : '';
      badgeHtml = `<span class="badge ${cls}" ${style}>${emoji} ${escapeHtml(t.category)}</span>`;
    } else {
      badgeHtml = `<span class="badge badge-pemasukan">📥 Pemasukan</span>`;
    }

    // Over-limit badge
    const overBadge = overLimit
      ? `<span class="over-limit-badge">⚠️ Melebihi Batas</span>`
      : '';

    item.innerHTML = `
      <div class="item-info">
        <p class="item-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</p>
        <div class="item-meta">
          ${badgeHtml}
          ${overBadge}
          <span class="item-date">${t.date}</span>
        </div>
      </div>
      <div class="item-right">
        <span class="item-amount ${isExpense ? 'expense' : 'income'}">
          ${isExpense ? '-' : '+'}${formatRupiah(t.amount)}
        </span>
        <button class="btn-delete" data-id="${t.id}"
          aria-label="Hapus ${escapeHtml(t.name)}">✕</button>
      </div>
    `;

    listEl.appendChild(item);
  });

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

// ──────────────────────────────────────────────────────────
// Render: Pie Chart
// ──────────────────────────────────────────────────────────

function renderChart() {
  const expenses = transactions.filter(t => t.type === 'pengeluaran');
  const totals   = {};
  expenses.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map(l => getCatMeta(l)?.color || '#94a3b8');

  const isEmpty = labels.length === 0;
  chartEmpty.style.display  = isEmpty ? 'block' : 'none';
  chartCanvas.style.display = isEmpty ? 'none'  : 'block';

  if (isEmpty) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const isDark    = html.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';

  if (chartInstance) {
    chartInstance.data.labels                        = labels;
    chartInstance.data.datasets[0].data              = data;
    chartInstance.data.datasets[0].backgroundColor   = colors;
    chartInstance.options.plugins.legend.labels.color = textColor;
    chartInstance.update();
  } else {
    chartInstance = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor:     isDark ? '#1e293b' : '#ffffff',
          borderWidth:     3,
          hoverOffset:     10,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding:        16,
              color:          textColor,
              usePointStyle:  true,
              font: { size: 12, family: "'Segoe UI', system-ui, sans-serif" },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val   = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((val / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${formatRupiah(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

// ──────────────────────────────────────────────────────────
// Render All
// ──────────────────────────────────────────────────────────

function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  checkGlobalLimit();
}

// ──────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────

(function init() {
  // Tema tersimpan
  const savedTheme = loadJSON(KEY_THEME, 'light');
  applyTheme(savedTheme);

  // Isi ulang <select> kategori
  populateCategorySelect();

  // Render daftar custom kategori di settings
  renderCustomCatList();

  // Isi input batas total
  if (spendLimit > 0) spendLimitInput.value = spendLimit;

  // Render input batas per kategori
  renderCatLimitsInputs();

  // Render data
  renderAll();
})();

// Studio Cannes — version locale (stockage navigateur, sans Firebase)
// Toutes les données vivent dans localStorage, sur cet appareil uniquement.

const STORAGE_KEY = "studio-cannes:local-data";

const PHASES = { achat: "Achat du bien", courant: "Vie courante" };
const ACQ_CATEGORIES = [
  "Prix d'achat", "Frais de notaire", "Frais d'agence", "Frais de dossier bancaire",
  "Garantie / caution prêt", "Travaux avant emménagement", "Ameublement / équipement",
  "Autre frais d'achat",
];
const RUN_CATEGORIES = [
  "Charges de copropriété", "Travaux / entretien", "Taxe foncière", "Assurance",
  "Ménage", "Loyer perçu", "Autre",
];
const DOC_CATEGORIES = [
  "Compromis / acte", "Copropriété", "Diagnostics", "Assurance",
  "Financement", "Travaux", "Autre",
];

// ---------------- State ----------------
let transactions = [];
let documents = [];
let names = { a: "Arthur", b: "Ma sœur" };
let phaseFilter = "all";
let editingTxId = null;
let editingDocId = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------------- Helpers ----------------
const fmtEUR = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};
const todayISO = () => new Date().toISOString().slice(0, 10);

function showError(msg) {
  document.getElementById("errorText").textContent = msg;
  document.getElementById("retryBtn").style.display = "none";
  document.getElementById("errorBanner").style.display = "flex";
}
document.getElementById("errorClose").addEventListener("click", () => {
  document.getElementById("errorBanner").style.display = "none";
});

// ---------------- Local storage persistence ----------------
function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      transactions = parsed.transactions || [];
      documents = parsed.documents || [];
      names = parsed.names || { a: "Arthur", b: "Ma sœur" };
    }
  } catch (e) {
    console.error(e);
    showError("Impossible de lire les données locales (stockage du navigateur inaccessible ou corrompu).");
  }
}

function saveData() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ transactions, documents, names })
    );
  } catch (e) {
    console.error(e);
    showError("Échec de l'enregistrement local. Le stockage du navigateur est peut-être plein ou désactivé (mode privé ?).");
  }
}

// ---------------- Export / Import ----------------
document.getElementById("exportBtn").addEventListener("click", () => {
  const payload = JSON.stringify({ transactions, documents, names }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studio-cannes-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("importInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!confirm("Importer ce fichier remplacera les données actuelles sur cet appareil. Continuer ?")) {
        e.target.value = "";
        return;
      }
      transactions = parsed.transactions || [];
      documents = parsed.documents || [];
      names = parsed.names || names;
      saveData();
      render();
    } catch (err) {
      showError("Fichier invalide — impossible de l'importer.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ---------------- Derived stats ----------------
function computeStats() {
  let totalExpenses = 0, totalIncome = 0, paidA = 0, paidB = 0, recvA = 0, recvB = 0;
  let achatTotal = 0, courantTotal = 0;
  for (const t of transactions) {
    const amt = Number(t.amount) || 0;
    if (t.type === "expense") {
      totalExpenses += amt;
      if (t.paidBy === "a") paidA += amt; else paidB += amt;
      if (t.phase === "achat") achatTotal += amt; else courantTotal += amt;
    } else {
      totalIncome += amt;
      if (t.paidBy === "a") recvA += amt; else recvB += amt;
    }
  }
  const fairExpense = totalExpenses / 2;
  const fairIncome = totalIncome / 2;
  const netA = (paidA - fairExpense) - (recvA - fairIncome);
  return { totalExpenses, totalIncome, paidA, paidB, recvA, recvB, netA, achatTotal, courantTotal };
}

// ---------------- Rendering ----------------
function render() {
  document.getElementById("personAName").textContent = names.a;
  document.getElementById("personBName").textContent = names.b;
  document.getElementById("nameA").value = names.a;
  document.getElementById("nameB").value = names.b;
  const paidBySelect = document.getElementById("txPaidBy");
  paidBySelect.innerHTML = `<option value="a">${names.a}</option><option value="b">${names.b}</option>`;

  const stats = computeStats();
  const n = Math.round(stats.netA * 100) / 100;
  const balanceRow = document.getElementById("balanceRow");
  const balanceAmount = document.getElementById("balanceAmount");
  if (Math.abs(n) < 0.01) {
    balanceRow.innerHTML = `<div class="balance-even">Comptes à l'équilibre</div>`;
    balanceAmount.textContent = "";
  } else {
    const debtor = n > 0 ? names.b : names.a;
    const creditor = n > 0 ? names.a : names.b;
    balanceRow.innerHTML = `<div class="balance-row"><span class="balance-name">${debtor}</span><span class="balance-arrow">doit à</span><span class="balance-name">${creditor}</span></div>`;
    balanceAmount.textContent = fmtEUR(Math.abs(n));
  }

  document.getElementById("totalExpenses").textContent = fmtEUR(stats.totalExpenses);
  document.getElementById("totalIncome").textContent = fmtEUR(stats.totalIncome);
  document.getElementById("expenseSub").textContent = `achat ${fmtEUR(stats.achatTotal)} · courant ${fmtEUR(stats.courantTotal)}`;
  document.getElementById("paidA").textContent = fmtEUR(stats.paidA);
  document.getElementById("recvA").textContent = fmtEUR(stats.recvA);
  document.getElementById("paidB").textContent = fmtEUR(stats.paidB);
  document.getElementById("recvB").textContent = fmtEUR(stats.recvB);

  renderTxList();
  renderDocList();
}

function renderTxList() {
  const list = document.getElementById("txList");
  const empty = document.getElementById("txEmpty");
  const filtered = [...transactions]
    .filter((t) => phaseFilter === "all" || t.phase === phaseFilter)
    .sort((x, y) => (x.date < y.date ? 1 : -1));
  list.innerHTML = "";
  empty.style.display = filtered.length === 0 ? "block" : "none";

  for (const t of filtered) {
    const li = document.createElement("li");
    li.className = "row";
    const badgeClass = t.phase === "achat" ? "phase-badge achat" : "phase-badge";
    const badgeLabel = t.phase === "achat" ? "Achat" : "Courant";
    const payer = t.paidBy === "a" ? names.a : names.b;
    li.innerHTML = `
      <div class="row-date">${fmtDate(t.date)}</div>
      <div class="row-main">
        <div class="row-desc">${escapeHtml(t.description)}</div>
        <div class="row-meta"><span class="${badgeClass}">${badgeLabel}</span> ${escapeHtml(t.category)} · payé par ${escapeHtml(payer)}</div>
      </div>
      <div class="row-amount" style="color:${t.type === "expense" ? "#A8432F" : "#3F6659"}">${t.type === "expense" ? "−" : "+"}${fmtEUR(t.amount)}</div>
      <button class="delete-btn" aria-label="Supprimer">✕</button>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.closest(".delete-btn")) return;
      openEditTx(t);
    });
    li.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      transactions = transactions.filter((x) => x.id !== t.id);
      saveData();
      render();
    });
    list.appendChild(li);
  }
}

function renderDocList() {
  const list = document.getElementById("docList");
  const empty = document.getElementById("docEmpty");
  const sorted = [...documents].sort((x, y) => (x.date < y.date ? 1 : -1));
  list.innerHTML = "";
  empty.style.display = sorted.length === 0 ? "block" : "none";

  for (const d of sorted) {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `
      <div class="row-main">
        <div class="row-desc">${escapeHtml(d.title)}</div>
        <div class="row-meta">${escapeHtml(d.category)} · ajouté le ${fmtDate(d.date)}${d.note ? " · " + escapeHtml(d.note) : ""}</div>
      </div>
      ${d.link ? `<a href="${escapeAttr(d.link)}" target="_blank" rel="noopener noreferrer" class="doc-link">Ouvrir ↗</a>` : ""}
      <button class="delete-btn" aria-label="Supprimer">✕</button>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.closest(".delete-btn") || e.target.closest(".doc-link")) return;
      openEditDoc(d);
    });
    li.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      documents = documents.filter((x) => x.id !== d.id);
      saveData();
      render();
    });
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ---------------- Tabs ----------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-comptes").style.display = tab === "comptes" ? "block" : "none";
    document.getElementById("tab-documents").style.display = tab === "documents" ? "block" : "none";
  });
});

// ---------------- Filter chips ----------------
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    phaseFilter = chip.dataset.filter;
    renderTxList();
  });
});

// ---------------- Transaction modal ----------------
const txModalOverlay = document.getElementById("txModalOverlay");
const txForm = document.getElementById("txForm");
let txFormState = { type: "expense", phase: "courant" };

function populateCategorySelect() {
  const sel = document.getElementById("txCategory");
  const cats = txFormState.phase === "achat" ? ACQ_CATEGORIES : RUN_CATEGORIES;
  sel.innerHTML = cats.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
}

document.querySelectorAll('.type-btn[data-field="type"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll('.type-btn[data-field="type"]').forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    txFormState.type = btn.dataset.value;
  });
});
document.querySelectorAll('.type-btn[data-field="phase"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll('.type-btn[data-field="phase"]').forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    txFormState.phase = btn.dataset.value;
    populateCategorySelect();
  });
});

function resetTxForm() {
  editingTxId = null;
  txFormState = { type: "expense", phase: "courant" };
  document.querySelectorAll('.type-btn[data-field="type"]').forEach((b) => b.classList.toggle("active", b.dataset.value === "expense"));
  document.querySelectorAll('.type-btn[data-field="phase"]').forEach((b) => b.classList.toggle("active", b.dataset.value === "courant"));
  populateCategorySelect();
  document.getElementById("txDescription").value = "";
  document.getElementById("txAmount").value = "";
  document.getElementById("txDate").value = todayISO();
  document.getElementById("txPaidBy").value = "a";
  document.getElementById("txModalTitle").textContent = "Nouveau mouvement";
}

function openNewTx() {
  resetTxForm();
  txModalOverlay.style.display = "flex";
}
function openEditTx(t) {
  editingTxId = t.id;
  txFormState = { type: t.type, phase: t.phase || "courant" };
  document.querySelectorAll('.type-btn[data-field="type"]').forEach((b) => b.classList.toggle("active", b.dataset.value === t.type));
  document.querySelectorAll('.type-btn[data-field="phase"]').forEach((b) => b.classList.toggle("active", b.dataset.value === (t.phase || "courant")));
  populateCategorySelect();
  document.getElementById("txDescription").value = t.description;
  document.getElementById("txAmount").value = t.amount;
  document.getElementById("txDate").value = t.date;
  document.getElementById("txCategory").value = t.category;
  document.getElementById("txPaidBy").value = t.paidBy;
  document.getElementById("txModalTitle").textContent = "Modifier le mouvement";
  txModalOverlay.style.display = "flex";
}

document.getElementById("addTxBtn").addEventListener("click", openNewTx);
document.getElementById("txCancel").addEventListener("click", () => { txModalOverlay.style.display = "none"; });
txModalOverlay.addEventListener("click", (e) => { if (e.target === txModalOverlay) txModalOverlay.style.display = "none"; });

txForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(String(document.getElementById("txAmount").value).replace(",", "."));
  const description = document.getElementById("txDescription").value.trim();
  if (!amount || amount <= 0 || !description) return;
  const data = {
    type: txFormState.type,
    phase: txFormState.phase,
    description,
    amount,
    date: document.getElementById("txDate").value,
    category: document.getElementById("txCategory").value,
    paidBy: document.getElementById("txPaidBy").value,
  };
  if (editingTxId) {
    transactions = transactions.map((t) => (t.id === editingTxId ? { ...t, ...data } : t));
  } else {
    transactions.push({ id: uid(), ...data });
  }
  saveData();
  render();
  txModalOverlay.style.display = "none";
});

// ---------------- Document modal ----------------
const docModalOverlay = document.getElementById("docModalOverlay");
const docForm = document.getElementById("docForm");

function populateDocCategorySelect() {
  const sel = document.getElementById("docCategory");
  sel.innerHTML = DOC_CATEGORIES.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
}

function resetDocForm() {
  editingDocId = null;
  populateDocCategorySelect();
  document.getElementById("docTitle").value = "";
  document.getElementById("docLink").value = "";
  document.getElementById("docNote").value = "";
  document.getElementById("docDate").value = todayISO();
  document.getElementById("docModalTitle").textContent = "Nouveau document";
}
function openNewDoc() {
  resetDocForm();
  docModalOverlay.style.display = "flex";
}
function openEditDoc(d) {
  editingDocId = d.id;
  populateDocCategorySelect();
  document.getElementById("docTitle").value = d.title;
  document.getElementById("docCategory").value = d.category;
  document.getElementById("docLink").value = d.link || "";
  document.getElementById("docNote").value = d.note || "";
  document.getElementById("docDate").value = d.date;
  document.getElementById("docModalTitle").textContent = "Modifier le document";
  docModalOverlay.style.display = "flex";
}

document.getElementById("addDocBtn").addEventListener("click", openNewDoc);
document.getElementById("docCancel").addEventListener("click", () => { docModalOverlay.style.display = "none"; });
docModalOverlay.addEventListener("click", (e) => { if (e.target === docModalOverlay) docModalOverlay.style.display = "none"; });

docForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("docTitle").value.trim();
  if (!title) return;
  const data = {
    title,
    category: document.getElementById("docCategory").value,
    link: document.getElementById("docLink").value.trim(),
    note: document.getElementById("docNote").value.trim(),
    date: document.getElementById("docDate").value || todayISO(),
  };
  if (editingDocId) {
    documents = documents.map((d) => (d.id === editingDocId ? { ...d, ...data } : d));
  } else {
    documents.push({ id: uid(), ...data });
  }
  saveData();
  render();
  docModalOverlay.style.display = "none";
});

// ---------------- Settings modal ----------------
const settingsModalOverlay = document.getElementById("settingsModalOverlay");
document.getElementById("settingsBtn").addEventListener("click", () => {
  document.getElementById("nameA").value = names.a;
  document.getElementById("nameB").value = names.b;
  settingsModalOverlay.style.display = "flex";
});
document.getElementById("settingsCancel").addEventListener("click", () => { settingsModalOverlay.style.display = "none"; });
settingsModalOverlay.addEventListener("click", (e) => { if (e.target === settingsModalOverlay) settingsModalOverlay.style.display = "none"; });
document.getElementById("settingsSave").addEventListener("click", () => {
  const a = document.getElementById("nameA").value.trim() || "Arthur";
  const b = document.getElementById("nameB").value.trim() || "Ma sœur";
  names = { a, b };
  saveData();
  render();
  settingsModalOverlay.style.display = "none";
});

// ---------------- Init ----------------
document.getElementById("txDate").value = todayISO();
document.getElementById("docDate").value = todayISO();
populateCategorySelect();
populateDocCategorySelect();
loadData();
render();
document.getElementById("loading").style.display = "none";
document.getElementById("app").style.display = "block";

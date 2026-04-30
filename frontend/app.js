const DEFAULT_SCRIPT_PLACEHOLDER = "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE";

const state = {
  keys: [],
  members: [],
  activeView: "keys",
  pendingSubmit: false,
  pendingTimer: null,
  refreshTimer: null,
  isRefreshing: false,
};

const els = {
  appTitle: document.getElementById("appTitle"),
  todayText: document.getElementById("todayText"),
  clockText: document.getElementById("clockText"),
  setupWarning: document.getElementById("setupWarning"),
  settingsCard: document.getElementById("settingsCard"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  form: document.getElementById("gymForm"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  adminInput: document.getElementById("adminInput"),
  customerNameInput: document.getElementById("customerNameInput"),
  keyNumberInput: document.getElementById("keyNumberInput"),
  statusInput: document.getElementById("statusInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  refreshMembersBtn: document.getElementById("refreshMembersBtn"),
  scriptUrlInput: document.getElementById("scriptUrlInput"),
  saveScriptUrlBtn: document.getElementById("saveScriptUrlBtn"),
  clearScriptUrlBtn: document.getElementById("clearScriptUrlBtn"),
  keysViewBtn: document.getElementById("keysViewBtn"),
  membersViewBtn: document.getElementById("membersViewBtn"),
  keysPanel: document.getElementById("keysPanel"),
  membersPanel: document.getElementById("membersPanel"),
  tableTitle: document.getElementById("tableTitle"),
  keySearchInput: document.getElementById("keySearchInput"),
  statusFilterInput: document.getElementById("statusFilterInput"),
  memberSearchInput: document.getElementById("memberSearchInput"),
  totalKeysText: document.getElementById("totalKeysText"),
  usedKeysText: document.getElementById("usedKeysText"),
  emptyKeysText: document.getElementById("emptyKeysText"),
  memberCountText: document.getElementById("memberCountText"),
  lastUpdatedText: document.getElementById("lastUpdatedText"),
  autoRefreshText: document.getElementById("autoRefreshText"),
  keysTableBody: document.getElementById("keysTableBody"),
  membersTableBody: document.getElementById("membersTableBody"),
  toast: document.getElementById("toast"),
};

function getConfig() {
  return window.GYM_CONFIG || {};
}

function getRefreshInterval() {
  const configValue = Number(getConfig().REFRESH_INTERVAL_MS || 5000);
  if (!Number.isFinite(configValue) || configValue < 3000) return 5000;
  return configValue;
}

function getScriptUrl() {
  const savedUrl = localStorage.getItem("gymScriptUrl") || "";
  const configuredUrl = (getConfig().SCRIPT_URL || "").trim();
  return (savedUrl || configuredUrl).trim();
}

function isScriptConfigured() {
  const url = getScriptUrl();
  return Boolean(url) && url !== DEFAULT_SCRIPT_PLACEHOLDER && url.startsWith("https://script.google.com/");
}

function applyConfig() {
  const config = getConfig();
  const appName = config.APP_NAME || "Sistem Admin Gym";
  const gymName = config.GYM_NAME || "Nama Gym Kamu";
  document.title = `${appName} - ${gymName}`;
  els.appTitle.textContent = gymName;

  const savedAdmin = localStorage.getItem("gymAdminName") || "";
  els.adminInput.value = savedAdmin;
  els.scriptUrlInput.value = getScriptUrl() === DEFAULT_SCRIPT_PLACEHOLDER ? "" : getScriptUrl();
  els.autoRefreshText.textContent = `Auto-refresh tiap ${Math.round(getRefreshInterval() / 1000)} detik.`;

  toggleSetupWarning();
}

function toggleSetupWarning() {
  if (isScriptConfigured()) {
    els.setupWarning.classList.add("hidden");
  } else {
    els.setupWarning.classList.remove("hidden");
  }
}

function updateClock() {
  const now = new Date();
  els.todayText.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  els.clockText.textContent = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function showToast(message, type = "success") {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 3600);
}

function setLoading(isLoading) {
  els.submitBtn.disabled = isLoading;
  els.submitBtn.textContent = isLoading ? "Menyimpan..." : "Simpan ke Google Sheet";
}

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!isScriptConfigured()) {
      reject(new Error("URL Apps Script belum disambungkan."));
      return;
    }

    const callbackName = `gymCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback: callbackName, ...params });
    const baseUrl = getScriptUrl();
    const separator = baseUrl.includes("?") ? "&" : "?";
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Request timeout. Cek koneksi atau deploy Apps Script."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (response && response.ok) {
        resolve(response);
      } else {
        reject(new Error(response?.message || "Gagal mengambil data."));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Gagal menghubungi Apps Script."));
    };

    script.src = `${baseUrl}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}

async function refreshAll(showLoading = false) {
  if (!isScriptConfigured()) {
    renderKeys([]);
    renderMembers([]);
    updateStats();
    toggleSetupWarning();
    return;
  }

  if (state.isRefreshing) return;
  state.isRefreshing = true;

  if (showLoading) {
    els.refreshBtn.disabled = true;
    els.refreshBtn.textContent = "…";
    els.refreshMembersBtn.disabled = true;
  }

  try {
    const [keysResult, membersResult] = await Promise.allSettled([
      jsonp("keys"),
      jsonp("members"),
    ]);

    if (keysResult.status === "fulfilled") {
      state.keys = Array.isArray(keysResult.value.data) ? keysResult.value.data : [];
      renderKeys(state.keys);
    } else if (showLoading) {
      showToast(keysResult.reason.message, "error");
    }

    if (membersResult.status === "fulfilled") {
      state.members = Array.isArray(membersResult.value.data) ? membersResult.value.data : [];
      renderMembers(state.members);
    } else if (showLoading) {
      showToast(membersResult.reason.message, "error");
    }

    updateStats();
    els.lastUpdatedText.textContent = `Update terakhir: ${new Date().toLocaleTimeString("id-ID")}`;
  } finally {
    state.isRefreshing = false;
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "↻";
    els.refreshMembersBtn.disabled = false;
  }
}

function updateStats() {
  const total = state.keys.length;
  const used = state.keys.filter((item) => item.status === "Dipakai").length;
  const empty = state.keys.filter((item) => item.status === "Kosong").length;

  els.totalKeysText.textContent = total;
  els.usedKeysText.textContent = used;
  els.emptyKeysText.textContent = empty;
  els.memberCountText.textContent = state.members.length;
}

function renderKeys(keys) {
  const search = els.keySearchInput.value.trim().toLowerCase();
  const statusFilter = els.statusFilterInput.value;

  const filtered = keys.filter((item) => {
    const text = `${item.keyNumber} ${item.status} ${item.customerName || ""}`.toLowerCase();
    const matchSearch = !search || text.includes(search);
    const matchStatus = statusFilter === "Semua" || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    els.keysTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Tidak ada data kunci yang cocok.</td></tr>`;
    return;
  }

  els.keysTableBody.innerHTML = filtered.map((item) => {
    const badgeClass = item.status === "Dipakai" ? "used" : "empty";
    return `
      <tr>
        <td><strong>${escapeHtml(item.keyNumber)}</strong></td>
        <td><span class="badge ${badgeClass}">${escapeHtml(item.status || "Kosong")}</span></td>
        <td>${escapeHtml(item.customerName || "-")}</td>
        <td>${escapeHtml(item.checkInTime || "-")}</td>
        <td>${escapeHtml(item.updatedAt || "-")}</td>
      </tr>
    `;
  }).join("");
}

function renderMembers(members) {
  const search = els.memberSearchInput.value.trim().toLowerCase();
  const filtered = members.filter((item) => {
    const text = `${item.memberId} ${item.memberName} ${item.status} ${item.createdBy}`.toLowerCase();
    return !search || text.includes(search);
  });

  if (!filtered.length) {
    els.membersTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada data member lifetime yang cocok.</td></tr>`;
    return;
  }

  els.membersTableBody.innerHTML = filtered.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.memberId || "-")}</strong></td>
      <td>${escapeHtml(item.memberName || "-")}</td>
      <td>${escapeHtml(item.registeredAt || "-")}</td>
      <td><span class="badge member">${escapeHtml(item.status || "Lifetime")}</span></td>
      <td>${escapeHtml(item.createdBy || "-")}</td>
      <td>${escapeHtml(item.updatedAt || "-")}</td>
    </tr>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearCustomerFields() {
  els.customerNameInput.value = "";
  els.keyNumberInput.value = "";
  els.statusInput.value = "Masuk";
  els.customerNameInput.focus();
}

function handleSubmit(event) {
  event.preventDefault();

  toggleSetupWarning();
  if (!isScriptConfigured()) {
    showToast("URL Apps Script belum benar. Atur dulu backend-nya.", "warning");
    return;
  }

  if (!els.form.reportValidity()) return;

  const adminName = els.adminInput.value.trim();
  if (adminName) localStorage.setItem("gymAdminName", adminName);

  state.pendingSubmit = true;
  setLoading(true);
  window.clearTimeout(state.pendingTimer);
  state.pendingTimer = window.setTimeout(() => {
    if (state.pendingSubmit) {
      state.pendingSubmit = false;
      setLoading(false);
      showToast("Belum ada respons dari backend. Cek deploy Apps Script kamu.", "warning");
    }
  }, 15000);

  els.form.action = getScriptUrl();
  els.form.method = "POST";
  els.form.target = "hidden-submit-frame";
  els.form.submit();
}

function handleBackendMessage(event) {
  const data = event.data;
  if (!data || data.source !== "sistem-gym-backend") return;

  state.pendingSubmit = false;
  window.clearTimeout(state.pendingTimer);
  setLoading(false);

  const payload = data.payload || {};
  if (payload.ok) {
    showToast(payload.message || "Data berhasil disimpan.", "success");
    clearCustomerFields();
    refreshAll(true);
  } else {
    showToast(payload.message || "Data gagal disimpan.", "error");
  }
}

function saveScriptUrl() {
  const value = els.scriptUrlInput.value.trim();
  if (!value) {
    showToast("Isi URL Web App Apps Script dulu.", "warning");
    return;
  }
  if (!value.startsWith("https://script.google.com/")) {
    showToast("URL harus dari script.google.com.", "warning");
    return;
  }
  localStorage.setItem("gymScriptUrl", value);
  toggleSetupWarning();
  showToast("URL backend disimpan di browser ini.", "success");
  refreshAll(true);
}

function clearScriptUrl() {
  localStorage.removeItem("gymScriptUrl");
  els.scriptUrlInput.value = getScriptUrl() === DEFAULT_SCRIPT_PLACEHOLDER ? "" : getScriptUrl();
  toggleSetupWarning();
  state.keys = [];
  state.members = [];
  renderKeys([]);
  renderMembers([]);
  updateStats();
  showToast("URL lokal direset.", "success");
}

function showView(viewName) {
  state.activeView = viewName;
  const isKeys = viewName === "keys";
  els.keysPanel.classList.toggle("hidden", !isKeys);
  els.membersPanel.classList.toggle("hidden", isKeys);
  els.keysViewBtn.classList.toggle("active", isKeys);
  els.membersViewBtn.classList.toggle("active", !isKeys);
  els.tableTitle.textContent = isKeys ? "Daftar Kunci" : "Daftar Member Lifetime";
}

function startAutoRefresh() {
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = window.setInterval(() => refreshAll(false), getRefreshInterval());
}

function initEvents() {
  els.form.addEventListener("submit", handleSubmit);
  els.resetBtn.addEventListener("click", clearCustomerFields);
  els.refreshBtn.addEventListener("click", () => refreshAll(true));
  els.refreshMembersBtn.addEventListener("click", () => refreshAll(true));
  els.keySearchInput.addEventListener("input", () => renderKeys(state.keys));
  els.statusFilterInput.addEventListener("change", () => renderKeys(state.keys));
  els.memberSearchInput.addEventListener("input", () => renderMembers(state.members));
  els.saveScriptUrlBtn.addEventListener("click", saveScriptUrl);
  els.clearScriptUrlBtn.addEventListener("click", clearScriptUrl);
  els.openSettingsBtn.addEventListener("click", () => els.scriptUrlInput.focus());
  els.keysViewBtn.addEventListener("click", () => showView("keys"));
  els.membersViewBtn.addEventListener("click", () => showView("members"));
  window.addEventListener("message", handleBackendMessage);
}

function init() {
  applyConfig();
  updateClock();
  window.setInterval(updateClock, 1000);
  initEvents();
  refreshAll(true);
  startAutoRefresh();
}

init();

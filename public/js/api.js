// API helper
const API = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),

  async req(url, opts = {}) {
    opts.headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    if (this.token) opts.headers.Authorization = "Bearer " + this.token;
    const res = await fetch("/api" + url, opts);
    const data = await res.json().catch(() => ({}));
    // Token het han / user khong ton tai nua -> tu dang xuat
    if (res.status === 401 && this.token) {
      this.logout();
      this._sessionExpired = true;
      renderNavbar();
      toast("Phiên hết hạn, vui lòng đăng nhập lại");
      throw new Error(data.error || "Phiên đã hết hạn");
    }
    if (!res.ok) throw new Error(data.error || "Lỗi máy chủ");
    return data;
  },
  // cache GET trong 30 giay giua cac trang -> chuyen trang nhan hon, giam truy van lap
  _cache: new Map(),
  async get(url) {
    const now = Date.now();
    const hit = this._cache.get(url);
    if (hit && now - hit.at < 30000) return hit.data;
    const data = await this.req(url);
    this._cache.set(url, { data, at: now });
    if (this._cache.size > 100) this._cache.delete(this._cache.keys().next().value);
    return data;
  },
  post(url, body) {
    this._cache.clear(); // du lieu thay doi -> bo cache
    return this.req(url, { method: "POST", body: JSON.stringify(body || {}) });
  },
  put(url, body) {
    this._cache.clear();
    return this.req(url, { method: "PUT", body: JSON.stringify(body || {}) });
  },
  del(url) {
    this._cache.clear();
    return this.req(url, { method: "DELETE" });
  },

  save(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  },
  logout() {
    this.token = "";
    this.user = null;
    localStorage.clear();
  },

  async upload(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload thất bại");
    return (await res.json()).url;
  },
};

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast-item";
  t.textContent = msg;
  document.getElementById("toast").appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

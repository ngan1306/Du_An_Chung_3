// UI chung: navbar, card, helpers
function starHtml(v) {
  const full = Math.round(v || 0);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function recipeCard(r) {
  return `<div class="card" onclick="go('/recipe/${r.id}')">
    <img class="cover" src="${esc(r.image)}" alt="" loading="lazy">
    <div class="body">
      <h3>${esc(r.title)}</h3>
      <div class="meta">
        <span class="stars">${starHtml(r.avg_rating)} (${r.rating_count || 0})</span>
        <span>👁 ${r.views}</span>
        <span>⏱ ${(+r.prep_minutes || 0) + (+r.cook_minutes || 0)}'</span>
      </div>
      <div style="margin-top:8px"><span class="badge">${esc(r.category || "Khác")}</span>
      <span class="badge">${esc(r.difficulty)}</span>
      ${r.diet ? `<span class="badge">${esc(r.diet)}</span>` : ""}</div>
    </div>
  </div>`;
}

function renderNavbar() {
  const u = API.user;
  const route = location.hash.slice(1) || "/";
  const links = [
    ["/", "Trang chủ"],
    ["/search", "Tìm kiếm"],
    ["/community", "Cộng đồng"],
    ["/planner", "Meal Planner"],
    ["/shopping", "Shopping List"],
    ["/ai", "AI Gợi ý"],
    ...(API.user
      ? [
          ["/favorites", "Yêu thích"],
          ["/profile", "Hồ sơ"],
        ]
      : []),
    ...(API.user && ["admin", "moderator"].includes(API.user.role)
      ? [["/admin", "Quản trị"]]
      : []),
  ];
  document.getElementById("navbar").innerHTML = `
  <div class="navbar">
    <span class="logo" onclick="go('/')">🍲 RecipeApp</span>
    <form class="searchbox" onsubmit="event.preventDefault(); go('/search?q='+encodeURIComponent(this.q.value))">
      <input name="q" placeholder="Tìm món ăn, nguyên liệu..." value="${esc(route.startsWith("/search") ? new URLSearchParams(route.split("?")[1]).get("q") || "" : "")}">
      <button class="btn small">Tìm</button>
    </form>
    <nav>${links.map(([h, t]) => `<a href="#${h}" class="${route === h || (h !== "/" && route.startsWith(h)) ? "active" : ""}">${t}</a>`).join("")}
      ${
        u
          ? `<img class="avatar" src="${esc(u.avatar || "/img/default-avatar.svg")}" title="${esc(u.username)}" onclick="go('/profile')">`
          : `<button class="btn small" onclick="go('/login')">Đăng nhập</button>`
      }
    </nav>
  </div>`;
  const bell = document.querySelector(".navbar");
  if (u) {
    const b = document.createElement("button");
    b.className = "btn secondary small";
    b.textContent = "🔔";
    b.title = "Thông báo";
    b.onclick = showNotifications;
    b.style.marginLeft = "8px";
    bell.appendChild(b);
  }
}

async function showNotifications() {
  try {
    const list = await API.get("/recipes/notifications");
    openModal(
      "Thông báo",
      list.length
        ? list
            .map(
              (n) =>
                `<div class="comment"><b>${esc(n.type)}</b> · ${esc(n.message)}<div class="muted">${esc(n.created_at)}</div></div>`,
            )
            .join("")
        : '<div class="empty">Chưa có thông báo</div>',
    );
  } catch (e) {
    toast(e.message);
  }
}

function openModal(title, html) {
  let ov = document.getElementById("modal-ov");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "modal-ov";
    ov.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px";
    ov.onclick = (e) => {
      if (e.target === ov) ov.remove();
    };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:80vh;overflow:auto;padding:22px;position:relative">
    <button class="btn secondary small" style="position:absolute;top:10px;right:12px" onclick="document.getElementById('modal-ov').remove()">✕</button>
    <h2 style="margin-bottom:14px">${esc(title)}</h2>${html}</div>`;
}

function go(path) {
  location.hash = "#" + path;
}

// Upload file helper
async function pickAndUpload(inputEl, cb) {
  if (!inputEl.files[0]) return;
  try {
    cb(await API.upload(inputEl.files[0]));
  } catch (e) {
    toast(e.message);
  }
}

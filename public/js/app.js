// Router SPA + log lich su xem
const routes = {
  "/": () => Pages.home(),
  "/login": () => Pages.login(),
  "/register": () => Pages.register(),
  "/search": (q) => Pages.searchResults(q),
  "/recipe": (q, m) => Pages.recipe(m),
  "/user": (q, m) => Pages.user(m),
  "/favorites": () => Pages.favorites(),
  "/profile": () => Pages.profile(),
  "/new-recipe": () => Pages.recipeForm(null),
  "/edit-recipe": (q, m) => Pages.recipeForm(m),
  "/community": (q) => Pages.community(q),
  "/planner": () => Pages.planner(),
  "/shopping": () => Pages.shopping(),
  "/ai": () => Pages.ai(),
  "/contact": () => Pages.contact(),
  "/share": (q, m) => Pages.share(m),
  "/admin": () => Pages.admin(),
};

async function route() {
  const raw = location.hash.slice(1) || "/";
  const [path, queryStr] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(queryStr || ""));
  renderNavbar();
  const parts = path.split("/").filter(Boolean); // ['/recipe','3']
  const key = "/" + (parts[0] || "");
  window.scrollTo(0, 0);
  try {
    if (routes[key]) await routes[key](query, parts);
    else Pages.home();
  } catch (e) {
    console.error(e);
    // het phien / chua dang nhap -> dua ve trang login thay vi bao loi chung
    if (API.user === null && API._sessionExpired) {
      API._sessionExpired = false;
      go("/login");
      return;
    }
    document.getElementById("app").innerHTML =
      `<div class="empty">⚠️ ${esc(e.message)} <br><br><a href="#/">← Về trang chủ</a></div>`;
  }
  if (API.user && key === "/recipe" && parts[1]) {
    API.post("/recipes/_logView", {}).catch(() => {});
    fetch("/api/recipes/" + parts[1]).catch(() => {}); // ghi nhan view
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

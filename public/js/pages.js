// Cac trang SPA
const Pages = {};
const app = () => document.getElementById("app");

/* ---------- Trang chủ ---------- */
Pages.home = async () => {
  const h = await API.get("/home");
  const sec = (title, items, emoji) =>
    items.length
      ? `
    <h2 class="section">${emoji} ${title}</h2>
    <div class="grid">${items.map(recipeCard).join("")}</div>`
      : "";
  app().innerHTML = `
    <div class="hero">
      <h1>Nấu món bạn yêu thích 🍳</h1>
      <p>Hàng ngàn công thức từ cộng đồng — tìm kiếm, lưu trữ và chia sẻ đam mê ẩm thực.</p>
      <button class="btn" onclick="go('/search')">Khám phá công thức</button>
      <div class="cat-chips">${h.categories
        .map(
          (c) =>
            `<span class="cat-chip" onclick="go('/search?category=${c.id}')">${c.icon} ${esc(c.name)}</span>`,
        )
        .join("")}</div>
    </div>
    ${API.user ? `<h2 class="section">✨ Gợi ý cho bạn</h2><div class="grid" id="suggest"><div class="empty">Đang tải...</div></div>` : ""}
    ${sec("Món ăn nổi bật", h.featured, "🔥")}
    ${sec("Công thức mới nhất", h.newest, "🆕")}
    ${sec("Được đánh giá cao", h.topRated, "⭐")}`;
  if (API.user) {
    try {
      const sg = await API.get("/recipes/suggest");
      document.getElementById("suggest").innerHTML =
        sg.map(recipeCard).join("") || '<div class="empty">Chưa có gợi ý</div>';
    } catch {}
  }
};

/* ---------- Tìm kiếm ---------- */
Pages.search = async (query) => {
  const qs = new URLSearchParams(query);
  const [cats, countries] = await Promise.all([
    API.get("/recipes/meta/categories"),
    API.get("/recipes/meta/countries"),
  ]);
  const f = (k) => esc(qs.get(k) || "");
  app().innerHTML = `
    <h2 class="section">🔍 Tìm kiếm công thức</h2>
    <div class="filters">
      <input id="fq" placeholder="Tên món..." value="${f("q")}" style="flex:1;min-width:180px">
      <input id="fi" placeholder="Nguyên liệu (VD: gà)" value="${f("ingredient")}">
      <select id="fcat"><option value="">-- Danh mục --</option>${cats.map((c) => `<option value="${c.id}" ${qs.get("category") == c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <select id="fcountry"><option value="">-- Quốc gia --</option>${countries.map((c) => `<option ${qs.get("country") === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select id="fdiff"><option value="">-- Độ khó --</option>${["Dễ", "Trung bình", "Khó"].map((d) => `<option ${qs.get("difficulty") === d ? "selected" : ""}>${d}</option>`).join("")}</select>
      <select id="fdiet"><option value="">-- Chế độ ăn --</option>${["Chay", "Vegan", "Keto"].map((d) => `<option ${qs.get("diet") === d ? "selected" : ""}>${d}</option>`).join("")}</select>
      <input id="ftime" type="number" placeholder="Thời gian ≤ (phút)" value="${f("maxTime")}" style="width:150px">
      <input id="fcal" type="number" placeholder="Calo ≤" value="${f("maxCal")}" style="width:110px">
      <select id="fsort">
        <option value="">-- Sắp xếp --</option>
        <option value="newest" ${qs.get("sort") === "newest" ? "selected" : ""}>Mới nhất</option>
        <option value="views" ${qs.get("sort") === "views" ? "selected" : ""}>Nhiều xem nhất</option>
        <option value="rating" ${qs.get("sort") === "rating" ? "selected" : ""}>Đánh giá cao</option>
        <option value="time" ${qs.get("sort") === "time" ? "selected" : ""}>Nhanh nhất</option>
      </select>
      <button class="btn" onclick="Pages._doSearch()">Lọc</button>
    </div>
    <div id="results" class="grid"><div class="empty">Đang tải...</div></div>
    <div id="results-meta" class="muted" style="text-align:center;margin:16px 0"></div>`;
  await Pages.searchResults(query);
};

Pages._doSearch = () => {
  const v = (id) => document.getElementById(id)?.value || "";
  const p = new URLSearchParams();
  [
    ["q", "q"],
    ["ingredient", "fi"],
    ["category", "fcat"],
    ["country", "fcountry"],
    ["difficulty", "fdiff"],
    ["diet", "fdiet"],
    ["maxTime", "ftime"],
    ["maxCal", "fcal"],
    ["sort", "fsort"],
  ].forEach(([k, id]) => {
    if (v(id)) p.set(k, v(id));
  });
  location.hash = "#/search" + (p.toString() ? "?" + p : "");
};

Pages.searchResults = async (query) => {
  // dung boi router khi co ?query
  if (!document.getElementById("results")) return Pages.search(query);
  const data = await API.get("/recipes?" + new URLSearchParams(query));
  document.getElementById("results").innerHTML = data.items.length
    ? data.items.map(recipeCard).join("")
    : '<div class="empty">Không tìm thấy công thức nào 😢</div>';
  const totalPages = Math.ceil(data.total / 12);
  const page = Number(data.page) || 1;
  if (!data.total) {
    document.getElementById("results-meta").innerHTML = "";
    return;
  }
  if (totalPages <= 1) {
    document.getElementById("results-meta").innerHTML = `${data.total} món ăn`;
    return;
  }

  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  const pageButtons = [];
  const addPageButton = (number) => {
    pageButtons.push(
      `<button class="btn ${number === page ? "" : "secondary"} small" ${number === page ? 'aria-current="page" disabled' : `onclick="Pages._goToPage(${number})"`}>${number}</button>`,
    );
  };
  if (startPage > 1) {
    addPageButton(1);
    if (startPage > 2) pageButtons.push('<span aria-hidden="true">…</span>');
  }
  for (let number = startPage; number <= endPage; number += 1)
    addPageButton(number);
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pageButtons.push('<span aria-hidden="true">…</span>');
    addPageButton(totalPages);
  }

  document.getElementById("results-meta").innerHTML = `
    <div>Trang ${page}/${totalPages} · ${data.total} món ăn</div>
    <nav aria-label="Phân trang" style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn secondary small" ${page <= 1 ? "disabled" : `onclick="Pages._goToPage(${page - 1})"`} aria-label="Trang trước">← Trước</button>
      ${pageButtons.join("")}
      <button class="btn secondary small" ${page >= totalPages ? "disabled" : `onclick="Pages._goToPage(${page + 1})"`} aria-label="Trang tiếp theo">Sau →</button>
    </nav>`;
};

Pages._goToPage = (page) => {
  const [route, queryString = ""] = location.hash.slice(1).split("?");
  const query = new URLSearchParams(queryString);
  query.set("page", page);
  location.hash = `${route}?${query}`;
};

/* ---------- Chi tiết công thức + Cooking Mode ---------- */
Pages.recipe = async (m) => {
  const r = await API.get("/recipes/" + m[1]);
  const steps = r.steps;
  app().innerHTML = `
  <div class="detail-head">
    <img src="${esc(r.image)}" alt="${esc(r.title)}">
    <div>
      <h1>${esc(r.title)}</h1>
      <p class="muted">${esc(r.description)}</p>
      <div><span class="stars">${starHtml(r.avg_rating)}</span> ${r.avg_rating} · ${r.rating_count} đánh giá · 👁 ${r.views} lượt xem</div>
      <div style="margin:10px 0"><span class="badge">${esc(r.category)}</span> <span class="badge">${esc(r.country)}</span>
        <span class="badge">${esc(r.difficulty)}</span> ${r.diet ? `<span class="badge">${esc(r.diet)}</span>` : ""}
        ${r.video_url ? `<span class="badge"><a href="${esc(r.video_url)}" target="_blank">▶ Video HD</a></span>` : ""}</div>
      <div class="kv">
        <div><b>${r.prep_minutes}'</b><span>Chuẩn bị</span></div>
        <div><b>${r.cook_minutes}'</b><span>Nấu</span></div>
        <div><b>${r.servings}</b><span>Khẩu phần</span></div>
        <div><b>${r.calories}</b><span>kcal</span></div>
        <div><b>${r.protein}g</b><span>Protein</span></div>
        <div><b>${r.carbs}g / ${r.fat}g</b><span>Carb / Fat</span></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="Pages._toggleFav(${r.id})" id="favBtn">${r.is_fav ? "💔 Bỏ yêu thích" : "❤️ Yêu thích"}</button>
        ${
          API.user
            ? `<button class="btn secondary" onclick="Pages._openCollectionPicker(${r.id})">📁 Thêm vào bộ sưu tập</button>
        <button class="btn secondary" onclick="Pages._addToPlan(${r.id})">📅 Thêm vào thực đơn</button>
        <button class="btn secondary" onclick="Pages._toShopping(${r.id})">🛒 Thêm nguyên liệu vào danh sách mua</button>`
            : ""
        }
        <button class="btn secondary" onclick="Pages.cookingMode(${JSON.stringify(steps).replace(/"/g, "&quot;")}, '${esc(r.title).replace(/'/g, "\\'")}', ${r.cook_minutes})">👨‍🍳 Cooking Mode</button>
        ${
          API.user && API.user.id === r.user_id
            ? `<button class="btn secondary" onclick="go('/edit-recipe/${r.id}')">✏️ Sửa</button>
        <button class="btn danger" onclick="Pages._deleteRecipe(${r.id})">🗑 Xóa</button>`
            : ""
        }
      </div>
      <div class="muted" style="margin-top:10px">👤 <a href="#/user/${r.author.id}">${esc(r.author.display_name || r.author.username)}</a></div>
    </div>
  </div>

  <div class="panel">
    <h2>🥘 Nguyên liệu</h2>
    <ul class="ing-list">${r.ingredients.map((i) => `<li>${esc(i.name)} — <b>${esc(i.quantity)} ${esc(i.unit)}</b></li>`).join("")}</ul>
  </div>
  <div class="panel">
    <h2>📝 Các bước chế biến</h2>
    <ol class="steps">${steps.map((s) => `<li style="margin:10px 0">${esc(s.text)}</li>`).join("")}</ol>
  </div>
  ${Comments.html(r)}
  <script>Comments.bind(${JSON.stringify(r.ratings).replace(/</g, "\\u003c")}, ${r.id})</script>`;
  Comments.bind(r.ratings, r.id);
};

Pages._toggleFav = async (id) => {
  try {
    const { fav } = await API.post(`/recipes/${id}/favorite`);
    document.getElementById("favBtn").textContent = fav
      ? "💔 Bỏ yêu thích"
      : "❤️ Yêu thích";
    toast(fav ? "Đã thêm vào yêu thích" : "Đã bỏ khỏi yêu thích");
  } catch (e) {
    toast(e.message);
  }
};
Pages._toShopping = async (id) => {
  try {
    const { added } = await API.post(`/recipes/shopping/from-recipe/${id}`);
    toast(`Đã thêm ${added} nguyên liệu vào danh sách mua`);
  } catch (e) {
    toast(e.message);
  }
};
Pages._addToPlan = async (id) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const date = d.toISOString().slice(0, 10);
  try {
    await API.post("/recipes/mealplan", { date, slot: "trua", recipe_id: id });
    toast("Đã thêm vào thực đơn trưa ngày mai. Xem tại Meal Planner.");
  } catch (e) {
    toast(e.message);
  }
};
Pages._deleteRecipe = async (id) => {
  if (!confirm("Xóa công thức này vĩnh viễn?")) return;
  try {
    await API.del(`/recipes/${id}`);
    toast("Đã xóa");
    go("/");
  } catch (e) {
    toast(e.message);
  }
};

/* ---------- Cooking Mode ---------- */
Pages.cookingMode = (steps, title, cookMin) => {
  steps = typeof steps === "string" ? JSON.parse(steps) : steps;
  let idx = 0,
    remaining = 0,
    timerInt = null;
  const ov = document.createElement("div");
  ov.className = "cook-overlay";
  document.body.appendChild(ov);
  const render = () => {
    ov.innerHTML = `
      <h2 style="font-size:20px">👨‍🍳 ${esc(title)} — Bước ${idx + 1}/${steps.length}</h2>
      <div class="step-text">${esc(steps[idx].text)}</div>
      <div class="progress"><div style="width:${((idx + 1) / steps.length) * 100}%"></div></div>
      <div class="timer-display" id="cookTimer">⏱ --:--</div>
      <div style="display:flex;gap:12px">
        <button class="btn secondary" ${idx === 0 ? "disabled" : ""} onclick="Pages._cm.prev()">◀ Trước</button>
        <button class="btn secondary" onclick="Pages._cm.zoom()" style="font-size:18px">A+</button>
        <button class="btn secondary" id="cmTimerBtn" onclick="Pages._cm.timer(${+cookMin * 60})">⏱ Đếm ${cookMin} phút</button>
        ${
          idx < steps.length - 1
            ? `<button class="btn" onclick="Pages._cm.next()">Hoàn thành ✔ & Tiếp ▶</button>`
            : `<button class="btn" onclick="Pages._cm.close()">🎉 Hoàn thành món ăn!</button>`
        }
      </div>
      <button class="btn danger small" onclick="Pages._cm.close()">Thoát</button>`;
    if (remaining > 0) Pages._cm.tick();
  };
  let fontScale = 1;
  Pages._cm = {
    next() {
      idx++;
      render();
    },
    prev() {
      idx = Math.max(0, idx - 1);
      render();
    },
    zoom() {
      fontScale += 0.15;
      document.querySelector(".step-text").style.fontSize =
        26 * fontScale + "px";
    },
    timer(sec) {
      remaining = sec;
      document.getElementById("cmTimerBtn").disabled = true;
      this.tick();
    },
    tick() {
      clearInterval(timerInt);
      timerInt = setInterval(() => {
        remaining--;
        const el = document.getElementById("cookTimer");
        if (!el) {
          clearInterval(timerInt);
          return;
        }
        el.textContent = `⏱ ${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
        if (remaining <= 0) {
          clearInterval(timerInt);
          toast("⏰ Hết giờ nấu!");
        }
      }, 1000);
    },
    close() {
      clearInterval(timerInt);
      ov.remove();
    },
  };
  render();
};

/* ---------- Bình luận & đánh giá ---------- */
const Comments = {
  list: [],
  recipeId: null,
  html: (r) => `
  <div class="panel">
    <h2>💬 Đánh giá & bình luận</h2>
    ${
      API.user
        ? `
      <div style="margin:12px 0">
        <div id="pickStars" class="star-picker" role="radiogroup" aria-label="Chọn số sao">
          ${[1, 2, 3, 4, 5]
            .map(
              (stars) => `<button type="button" class="star-choice" role="radio" aria-checked="false" aria-label="${stars} sao" onclick="Comments.setStars(${stars})">☆</button>`,
            )
            .join("")}
        </div>
        <textarea id="cText" placeholder="Chia sẻ cảm nhận, kèm ảnh món bạn đã nấu..." rows="2" style="width:100%"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <label style="margin:0" class="btn secondary small">📷 Ảnh món đã nấu<input type="file" accept="image/*" hidden onchange="Comments.pickPhoto(this)"></label>
          <img id="cPhotoPrev" style="height:34px;border-radius:6px" hidden>
          <button class="btn small" onclick="Comments.submit(${r.id})">Gửi</button>
        </div>
      </div>`
        : '<p class="muted">Đăng nhập để đánh giá và bình luận.</p>'
    }
    <div id="cList"></div>
  </div>`,
  bind(list, recipeId) {
    this.list = list;
    this.recipeId = recipeId;
    this.stars = 0;
    this.photo = "";
    this.replyTo = null;
    if (API.user) {
      const previous = list.find(
        (rating) =>
          String(rating.user_id) === String(API.user.id) && !rating.parent_id,
      );
      if (previous) {
        this.stars = Number(previous.stars);
        document.getElementById("cText").value = previous.comment || "";
        this.photo = previous.photo || "";
        if (this.photo) {
          const preview = document.getElementById("cPhotoPrev");
          preview.src = this.photo;
          preview.hidden = false;
        }
      }
      this.renderStarPicker();
    }
    this.render();
  },
  setStars(stars) {
    this.stars = stars;
    this.renderStarPicker();
  },
  renderStarPicker() {
    document.querySelectorAll("#pickStars .star-choice").forEach((button) => {
      const value = Number(button.getAttribute("aria-label").split(" ")[0]);
      const selected = value <= this.stars;
      button.textContent = selected ? "★" : "☆";
      button.setAttribute("aria-checked", String(value === this.stars));
      button.classList.toggle("selected", selected);
    });
  },
  async pickPhoto(inp) {
    this.photo = await API.upload(inp.files[0]);
    const pv = document.getElementById("cPhotoPrev");
    pv.src = this.photo;
    pv.hidden = false;
  },
  async submit(id) {
    if (!this.stars) return toast("Hãy chọn số sao");
    try {
      await API.post(`/recipes/${id}/rate`, {
        stars: this.stars,
        comment: document.getElementById("cText").value,
        photo: this.photo,
      });
      toast("Đã gửi đánh giá!");
      Pages.recipe([null, id]);
    } catch (e) {
      toast(e.message);
    }
  },
  render() {
    const el = document.getElementById("cList");
    if (!el) return;
    el.innerHTML =
      this.list
        .map(
          (c) => `
      <div class="comment">
        <div class="who"><img src="${esc(c.avatar)}"><div>
          <b>${esc(c.display_name || c.username)}</b>
          <span class="stars">${"★".repeat(c.stars)}${"☆".repeat(5 - c.stars)}</span></div></div>
        ${c.comment ? `<p style="margin:6px 0">${esc(c.comment)}</p>` : ""}
        ${c.photo ? `<img src="${esc(c.photo)}" style="max-height:180px;border-radius:8px;margin:6px 0">` : ""}
        <div class="actions">
          <a onclick="Comments.like('${c.rowid}')">👍 ${c.likes || 0} Thích</a>
          ${API.user && !c.parent_id ? `<a onclick="Comments.reply('${c.rowid}','${esc(c.username)}')">↩ Trả lời</a>` : ""}
          <span class="muted">${esc(c.created_at)}</span>
        </div>
      </div>`,
        )
        .join("") || '<div class="empty">Chưa có bình luận nào</div>';
  },
  reply(rid, who) {
    const t = document.getElementById("cText");
    t.value = `@${who} ` + t.value;
    t.focus();
  },
  async like(rid) {
    try {
      await API.post(`/recipes/comments/${rid}/like`);
      const c = this.list.find((x) => String(x.rowid) === String(rid));
      c.likes = (c.likes || 0) + 1;
      this.render();
    } catch (e) {
      toast(e.message);
    }
  },
};

/* ---------- Yêu thích ---------- */
Pages.favorites = async () => {
  const [favs, cols] = await Promise.all([
    API.get("/recipes/favorites/list"),
    API.get("/recipes/collections/list"),
  ]);
  Pages._favoriteRecipes = favs;
  app().innerHTML = `
    <h2 class="section">❤️ Công thức yêu thích</h2>
    <div class="grid">${favs.map(recipeCard).join("") || '<div class="empty">Chưa có công thức yêu thích</div>'}</div>
    <h2 class="section">📁 Bộ sưu tập</h2>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <input id="colName" placeholder="Tên bộ sưu tập mới">
      <button class="btn small" onclick="Pages._newCol()">＋ Tạo</button>
    </div>
    ${cols
      .map(
        (c) => `<div class="panel">
      <b>📁 ${esc(c.name)}</b> <span class="muted">(${c.items.length} món)</span>
      <button class="btn small secondary" style="float:right" onclick="Pages._shareCol('${esc(c.share_token)}')">🔗 Chia sẻ</button>
      <button class="btn small secondary" style="float:right;margin-right:8px" onclick="Pages._pickRecipeForCollection(${c.id})">＋ Thêm món</button>
      <div class="grid" style="margin-top:12px">${c.items.map(recipeCard).join("")}</div>
    </div>`,
      )
      .join("")}`;
};
Pages._newCol = async () => {
  const n = document.getElementById("colName").value.trim();
  if (!n) return;
  await API.post("/recipes/collections", { name: n });
  toast("Đã tạo bộ sưu tập");
  Pages.favorites();
};
Pages._openCollectionPicker = async (recipeId) => {
  try {
    const collections = await API.get("/recipes/collections/list");
    const options = collections
      .map((collection) => `<option value="${collection.id}">${esc(collection.name)}</option>`)
      .join("");
    openModal(
      "Thêm vào bộ sưu tập",
      `<label for="collectionPicker">Chọn bộ sưu tập</label>
      <select id="collectionPicker" style="width:100%" ${collections.length ? "" : "disabled"}>
        ${options || '<option value="">Bạn chưa có bộ sưu tập</option>'}
      </select>
      <button class="btn" style="margin-top:12px" onclick="Pages._saveRecipeToCollection(${recipeId})" ${collections.length ? "" : "disabled"}>Thêm món</button>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
      <label for="newCollectionName">Hoặc tạo bộ sưu tập mới</label>
      <input id="newCollectionName" maxlength="150" placeholder="Tên bộ sưu tập" style="width:100%">
      <button class="btn secondary" style="margin-top:8px" onclick="Pages._createCollectionForRecipe(${recipeId})">Tạo và thêm món</button>`,
    );
  } catch (e) {
    toast(e.message);
  }
};
Pages._saveRecipeToCollection = async (recipeId) => {
  const collectionId = document.getElementById("collectionPicker").value;
  if (!collectionId) return toast("Hãy chọn bộ sưu tập");
  try {
    await API.post(`/recipes/collections/${collectionId}/items`, {
      recipe_id: recipeId,
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã thêm món vào bộ sưu tập");
  } catch (e) {
    toast(e.message);
  }
};
Pages._createCollectionForRecipe = async (recipeId) => {
  const name = document.getElementById("newCollectionName").value.trim();
  if (!name) return toast("Hãy nhập tên bộ sưu tập");
  try {
    const collection = await API.post("/recipes/collections", { name });
    await API.post(`/recipes/collections/${collection.id}/items`, {
      recipe_id: recipeId,
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã tạo bộ sưu tập và thêm món");
  } catch (e) {
    toast(e.message);
  }
};
Pages._pickRecipeForCollection = (collectionId) => {
  openModal(
    "Thêm món vào bộ sưu tập",
    `<label for="collectionRecipeSearch">Tìm món ăn theo tên</label>
    <div style="display:flex;gap:8px;margin:8px 0">
      <input id="collectionRecipeSearch" maxlength="100" placeholder="Nhập tên món cần tìm" style="flex:1">
      <button class="btn secondary" onclick="Pages._searchCollectionRecipes(${collectionId})">Tìm</button>
    </div>
    <label for="collectionRecipePicker">Chọn món</label>
    <select id="collectionRecipePicker" style="width:100%" disabled>
      <option value="">Nhập ít nhất 2 ký tự để tìm món</option>
    </select>
    <button class="btn" style="margin-top:12px" onclick="Pages._saveSelectedRecipeToCollection(${collectionId})">Thêm món</button>`,
  );
  document
    .getElementById("collectionRecipeSearch")
    ?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        Pages._searchCollectionRecipes(collectionId);
      }
    });
};
Pages._searchCollectionRecipes = async (collectionId) => {
  const search = document.getElementById("collectionRecipeSearch");
  const picker = document.getElementById("collectionRecipePicker");
  const term = search?.value.trim() || "";
  if (term.length < 2) return toast("Hãy nhập ít nhất 2 ký tự để tìm món");
  try {
    const recipes = await API.get(
      `/recipes/collections/${collectionId}/recipes?q=${encodeURIComponent(term)}`,
    );
    picker.innerHTML = recipes.length
      ? `<option value="">Chọn món ăn</option>${recipes
          .map((recipe) => `<option value="${recipe.id}">${esc(recipe.title)}</option>`)
          .join("")}`
      : '<option value="">Không tìm thấy món phù hợp</option>';
    picker.disabled = !recipes.length;
  } catch (e) {
    toast(e.message);
  }
};
Pages._saveSelectedRecipeToCollection = async (collectionId) => {
  const recipeId = document.getElementById("collectionRecipePicker")?.value;
  if (!recipeId) return toast("Hãy chọn món ăn");
  try {
    await API.post(`/recipes/collections/${collectionId}/items`, {
      recipe_id: Number(recipeId),
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã thêm món vào bộ sưu tập");
    await Pages.favorites();
  } catch (e) {
    toast(e.message);
  }
};
Pages._shareCol = (token) => {
  const url = `${location.origin}/#/share/${token}`;
  navigator.clipboard?.writeText(url);
  openModal(
    "Link chia sẻ bộ sưu tập",
    `<input style="width:100%" value="${esc(url)}" onclick="this.select()">
    <p class="muted" style="margin-top:8px">Đã copy vào clipboard (hoặc bấm vào ô để chọn).</p>`,
  );
};

/* ---------- Hồ sơ ---------- */
Pages.profile = async () => {
  const me = await API.get("/recipes/users/" + API.user.id);
  app().innerHTML = `
  <div class="tabs">
    <button class="active" data-t="info" onclick="Pages._ptab('info')">Hồ sơ</button>
    <button data-t="recipes" onclick="Pages._ptab('recipes')">Công thức của tôi</button>
    <button data-t="history" onclick="Pages._ptab('history')">Lịch sử đã xem</button>
  </div>
  <div id="ptab-info">
    <div class="panel" style="max-width:520px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <img class="avatar" style="width:64px;height:64px" id="pfAvatar" src="${esc(API.user.avatar || "/img/default-avatar.svg")}">
        <label class="btn secondary small">Đổi ảnh đại diện<input type="file" accept="image/*" hidden onchange="Pages._changeAvatar(this)"></label>
      </div>
      <label>Tên hiển thị</label><input id="pfName" value="${esc(me.display_name || "")}" style="width:100%">
      <label>Giới thiệu</label><textarea id="pfBio" rows="3" style="width:100%">${esc(me.bio)}</textarea>
      <label>Sở thích (VD: chay, món nhật)</label><input id="pfPrefs" value="${esc(me.prefs || "")}" style="width:100%">
      <button class="btn" style="margin-top:12px" onclick="Pages._saveProfile()">Lưu hồ sơ</button>
      <hr style="margin:18px 0;border:none;border-top:1px solid #eee">
      <h3>🔒 Bảo mật</h3>
      <label>Mật khẩu hiện tại</label><input id="pwCur" type="password" style="width:100%">
      <label>Mật khẩu mới</label><input id="pwNew" type="password" style="width:100%">
      <button class="btn secondary" style="margin-top:10px" onclick="Pages._changePw()">Đổi mật khẩu</button>
      <hr style="margin:18px 0;border:none;border-top:1px solid #eee">
      <button class="btn danger" onclick="Pages._deleteAcc()">Xóa tài khoản vĩnh viễn</button>
      <button class="btn secondary" style="margin-left:8px" onclick="API.logout();go('/');toast('Đã đăng xuất')">Đăng xuất</button>
    </div>
  </div>
  <div id="ptab-recipes" hidden>
    <button class="btn" style="margin-bottom:14px" onclick="go('/new-recipe')">＋ Thêm công thức</button>
    <div class="grid" id="myRecipes"><div class="empty">Đang tải...</div></div>
  </div>
  <div id="ptab-history" hidden><div class="grid" id="histList"><div class="empty">Đang tải...</div></div></div>`;
  Pages._ptabLoadRecipes = async () => {
    document.getElementById("myRecipes").innerHTML =
      (await API.get("/recipes/mine/list"))
        .map(
          (r) =>
            recipeCard(r) +
            `<div style="margin-top:-6px;background:#fff;padding:0 14px 10px;box-shadow:var(--shadow)">
          <a onclick="go('/edit-recipe/${r.id}')">✏️ Sửa</a> · <a onclick="Pages._deleteRecipe(${r.id})">🗑 Xóa</a></div>`,
        )
        .join("") || '<div class="empty">Chưa có công thức nào</div>';
    const h = await API.get("/recipes/history/list");
    document.getElementById("histList").innerHTML =
      h.map(recipeCard).join("") ||
      '<div class="empty">Chưa có lịch sử xem</div>';
  };
};
Pages._ptab = (t) => {
  document
    .querySelectorAll(".tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.t === t));
  ["info", "recipes", "history"].forEach(
    (k) => (document.getElementById("ptab-" + k).hidden = k !== t),
  );
  if (t !== "info") Pages._ptabLoadRecipes();
};
Pages._saveProfile = async () => {
  await API.put("/auth/profile", {
    display_name: document.getElementById("pfName").value,
    bio: document.getElementById("pfBio").value,
    prefs: document.getElementById("pfPrefs").value,
  });
  API.user.display_name = document.getElementById("pfName").value;
  localStorage.setItem("user", JSON.stringify(API.user));
  toast("Đã lưu hồ sơ");
  renderNavbar();
};
Pages._changeAvatar = async (inp) => {
  const url = await API.upload(inp.files[0]);
  await API.put("/auth/profile", { avatar: url });
  API.user.avatar = url;
  localStorage.setItem("user", JSON.stringify(API.user));
  document.getElementById("pfAvatar").src = url;
  renderNavbar();
  toast("Đã đổi ảnh đại diện");
};
Pages._changePw = async () => {
  try {
    await API.put("/auth/change-password", {
      current: document.getElementById("pwCur").value,
      newPassword: document.getElementById("pwNew").value,
    });
    toast("Đã đổi mật khẩu");
  } catch (e) {
    toast(e.message);
  }
};
Pages._deleteAcc = async () => {
  if (!confirm("Xóa tài khoản vĩnh viễn? Mọi dữ liệu sẽ mất!")) return;
  await API.del("/auth/me");
  API.logout();
  go("/");
  toast("Tài khoản đã bị xóa");
};

/* ---------- Thêm / sửa công thức ---------- */
Pages.recipeForm = async (m) => {
  const editing = !!m;
  let r = {
    image: "/img/food-placeholder.jpg",
    ingredients: [{}],
    steps: [""],
    prep_minutes: 10,
    cook_minutes: 20,
    servings: 2,
    difficulty: "Dễ",
    is_public: 1,
  };
  if (editing) r = await API.get("/recipes/" + m[1]);
  const cats = await API.get("/recipes/meta/categories");
  app().innerHTML = `<div class="panel" style="max-width:760px;margin:auto">
    <h2>${editing ? "✏️ Sửa công thức" : "＋ Thêm công thức mới"}</h2>
    <label>Tên món ăn *</label><input id="rfTitle" value="${esc(r.title || "")}" style="width:100%">
    <label>Mô tả</label><textarea id="rfDesc" rows="2" style="width:100%">${esc(r.description || "")}</textarea>
    <div style="display:flex;gap:12px;align-items:center;margin-top:8px">
      <img id="rfImgPrev" src="${esc(r.image)}" style="width:80px;height:60px;object-fit:cover;border-radius:8px">
      <label class="btn secondary small">📷 Tải ảnh món ăn<input type="file" accept="image/*" hidden onchange="pickAndUpload(this, u => document.getElementById('rfImgPrev').src = u)"></label>
    </div>
    <input id="rfImgUrl" hidden value="${esc(r.image)}">
    <label>Video hướng dẫn (URL)</label><input id="rfVideo" value="${esc(r.video_url || "")}" style="width:100%">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">
      <div><label>Danh mục</label><select id="rfCat" style="width:100%">${cats.map((c) => `<option value="${c.id}" ${r.category_id == c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div><label>Quốc gia</label><input id="rfCountry" value="${esc(r.country || "Việt Nam")}" style="width:100%"></div>
      <div><label>Thời gian chuẩn bị (phút)</label><input id="rfPrep" type="number" value="${r.prep_minutes}"></div>
      <div><label>Thời gian nấu (phút)</label><input id="rfCook" type="number" value="${r.cook_minutes}"></div>
      <div><label>Khẩu phần</label><input id="rfServ" type="number" value="${r.servings}"></div>
      <div><label>Độ khó</label><select id="rfDiff">${["Dễ", "Trung bình", "Khó"].map((d) => `<option ${r.difficulty === d ? "selected" : ""}>${d}</option>`).join("")}</select></div>
      <div><label>Chế độ ăn</label><select id="rfDiet"><option value="">Không</option>${["Chay", "Vegan", "Keto"].map((d) => `<option ${r.diet === d ? "selected" : ""}>${d}</option>`).join("")}</select></div>
      <div><label>Công khai</label><select id="rfPub"><option value="1" ${r.is_public ? "selected" : ""}>Công khai</option><option value="0" ${!r.is_public ? "selected" : ""}>Riêng tư</option></select></div>
    </div>
    <label>Thông tin dinh dưỡng (mỗi khẩu phần)</label>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      <input id="rfCal" type="number" placeholder="Calo" value="${r.calories || ""}">
      <input id="rfPro" type="number" placeholder="Protein (g)" value="${r.protein || ""}">
      <input id="rfCarb" type="number" placeholder="Carb (g)" value="${r.carbs || ""}">
      <input id="rfFat" type="number" placeholder="Fat (g)" value="${r.fat || ""}">
    </div>
    <label>Nguyên liệu (tên - số lượng - đơn vị)</label>
    <div id="rfIngs"></div>
    <button class="btn secondary small" onclick="Pages._addIng()">＋ Nguyên liệu</button>
    <label>Các bước chế biến</label>
    <div id="rfSteps"></div>
    <button class="btn secondary small" onclick="Pages._addStep()">＋ Bước</button>
    <div style="margin-top:18px"><button class="btn" onclick="Pages._saveRecipe(${editing ? r.id : "null"})">💾 Lưu công thức</button></div>
  </div>`;
  Pages._rfIngRows = r.ingredients.map((i) =>
    i.name || i === "" ? i : { name: "" },
  );
  Pages._rfStepRows = r.steps.map((s) => s.text || s);
  Pages._renderIngSteps();
};
Pages._renderIngSteps = () => {
  document.getElementById("rfIngs").innerHTML = Pages._rfIngRows
    .map(
      (i, ix) => `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:6px">
      <input placeholder="Tên nguyên liệu" value="${esc(i.name)}" onchange="Pages._rfIngRows[${ix}].name=this.value">
      <input placeholder="Số lượng" value="${esc(i.quantity || "")}" onchange="Pages._rfIngRows[${ix}].quantity=this.value">
      <input placeholder="Đơn vị (g, muỗng...)" value="${esc(i.unit || "")}" onchange="Pages._rfIngRows[${ix}].unit=this.value">
      <button class="btn danger small" onclick="Pages._rfIngRows.splice(${ix},1);Pages._renderIngSteps()">✕</button>
    </div>`,
    )
    .join("");
  document.getElementById("rfSteps").innerHTML = Pages._rfStepRows
    .map(
      (s, ix) => `
    <div style="display:flex;gap:8px;margin-bottom:6px">
      <span style="padding-top:9px">${ix + 1}.</span>
      <input style="flex:1" value="${esc(s)}" onchange="Pages._rfStepRows[${ix}]=this.value">
      <button class="btn danger small" onclick="Pages._rfStepRows.splice(${ix},1);Pages._renderIngSteps()">✕</button>
    </div>`,
    )
    .join("");
};
Pages._addIng = () => {
  Pages._rfIngRows.push({});
  Pages._renderIngSteps();
};
Pages._addStep = () => {
  Pages._rfStepRows.push("");
  Pages._renderIngSteps();
};
Pages._saveRecipe = async (id) => {
  const imgPrev = document.getElementById("rfImgPrev").src;
  const v = (id2) => document.getElementById(id2).value;
  const body = {
    title: v("rfTitle"),
    description: v("rfDesc"),
    image:
      imgPrev.startsWith("http") || imgPrev.startsWith("/")
        ? imgPrev
        : "/img/food-placeholder.jpg",
    video_url: v("rfVideo"),
    category_id: +v("rfCat"),
    country: v("rfCountry"),
    prep_minutes: +v("rfPrep"),
    cook_minutes: +v("rfCook"),
    servings: +v("rfServ"),
    difficulty: v("rfDiff"),
    diet: v("rfDiet"),
    is_public: v("rfPub") === "1",
    calories: +v("rfCal"),
    protein: +v("rfPro"),
    carbs: +v("rfCarb"),
    fat: +v("rfFat"),
    ingredients: Pages._rfIngRows.filter((i) => i.name),
    steps: Pages._rfStepRows.filter((s) => s.trim()),
  };
  try {
    if (id) await API.put("/recipes/" + id, body);
    else await API.post("/recipes", body);
    toast("Đã lưu công thức!");
    go("/profile");
  } catch (e) {
    toast(e.message);
  }
};

/* ---------- Cộng đồng ---------- */
Pages.community = async (query) => {
  const following = query && query.following === "1";
  const posts = await API.get(
    "/recipes/posts/feed" + (following ? "?following=1" : ""),
  );
  app().innerHTML = `
    <h2 class="section">👥 Cộng đồng đầu bếp</h2>
    ${
      API.user
        ? `<div style="display:flex;gap:8px;margin-bottom:16px">
      <textarea id="postText" rows="2" placeholder="Đăng bài về món ăn bạn vừa nấu, chia sẻ công thức..." style="flex:1"></textarea>
      <div><button class="btn" onclick="Pages._newPost()">Đăng bài</button>
      <label class="btn secondary small" style="display:block;margin-top:6px;text-align:center">📷 Ảnh<input type="file" hidden onchange="Pages._postPhotoReady=1;pickAndUpload(this, u => Pages._postPhoto=u)"></label></div>
    </div>`
        : ""
    }
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button class="btn ${!following ? "" : "secondary"} small" onclick="go('/community')">Tất cả bài viết</button>
      ${API.user ? `<button class="btn ${following ? "" : "secondary"} small" onclick="go('/community?following=1')">Từ người đang theo dõi</button>` : ""}
    </div>
    ${
      posts
        .map(
          (p) => `<div class="feed-post">
      <div class="who" style="display:flex;align-items:center;gap:10px">
        <img class="avatar" style="width:38px;height:38px" src="${esc(p.avatar)}">
        <div><b><a href="#/user/${p.user_id}">${esc(p.display_name || p.username)}</a></b>
        <div class="muted">${esc(p.created_at)}</div></div>
      </div>
      <p style="margin:10px 0">${esc(p.content)}</p>
      ${p.image ? `<img src="${esc(p.image)}" style="max-height:280px;border-radius:10px">` : ""}
      ${p.recipe_id ? `<div style="margin-top:6px"><a href="#/recipe/${p.recipe_id}">🍲 Xem công thức đính kèm</a></div>` : ""}
      <div style="margin-top:8px">
        <button class="btn secondary small" onclick="Pages._likePost(${p.id}, this)">❤️ <span>${p.like_count}</span></button>
      </div>
    </div>`,
        )
        .join("") || '<div class="empty">Chưa có bài viết</div>'
    }`;
};
Pages._postPhoto = "";
Pages._newPost = async () => {
  const t = document.getElementById("postText").value.trim();
  if (!t) return;
  await API.post("/recipes/posts", { content: t, image: Pages._postPhoto });
  Pages._postPhoto = "";
  toast("Đã đăng bài");
  Pages.community();
};
Pages._likePost = async (id, btn) => {
  const { liked } = await API.post(`/recipes/posts/${id}/like`);
  const s = btn.querySelector("span");
  s.textContent = +s.textContent + (liked ? 1 : -1);
};

/* ---------- Trang cá nhân người khác ---------- */
Pages.user = async (m) => {
  const u = await API.get("/recipes/users/" + m[1]);
  const [f1, f2] = await Promise.all([
    API.get(`/auth/${u.id}/followers`),
    API.get(`/auth/${u.id}/following`),
  ]);
  const following = f1.some((x) => x.id === API.user?.id);
  app().innerHTML = `
    <div class="panel" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
      <img class="avatar" style="width:72px;height:72px" src="${esc(u.avatar)}">
      <div style="flex:1">
        <h2>${esc(u.display_name || u.username)} <span class="badge">👨‍🍳 Đầu bếp</span></h2>
        <p class="muted">${esc(u.bio)}</p>
        <div class="muted">👤 ${u.followers} người theo dõi · Đang theo dõi ${u.following} · ${u.recipes.length} công thức</div>
      </div>
      ${API.user && API.user.id !== u.id ? `<button class="btn" onclick="Pages._toggleFollow(${u.id}, this)">${following ? "Hủy theo dõi" : "＋ Theo dõi"}</button>` : ""}
    </div>
    <details class="panel"><summary>👥 Người theo dõi (${f1.length}) / Đang theo dõi (${f2.length})</summary>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">
        ${f1
          .concat(f2)
          .map(
            (x) =>
              `<div style="text-align:center"><img class="avatar" src="${esc(x.avatar)}"><div style="font-size:12px">${esc(x.display_name || x.username)}</div></div>`,
          )
          .join("")}
      </div></details>
    <h2 class="section">🍲 Công thức</h2>
    <div class="grid">${u.recipes.map(recipeCard).join("") || '<div class="empty">Chưa có công thức công khai</div>'}</div>
    <h2 class="section">📰 Bài viết</h2>
    ${u.posts.map((p) => `<div class="feed-post"><p>${esc(p.content)}</p><span class="muted">${esc(p.created_at)}</span></div>`).join("") || '<p class="muted">Chưa có bài viết</p>'}`;
};
Pages._toggleFollow = async (id, btn) => {
  const { following } = await API.post(`/recipes/users/${id}/follow`);
  btn.textContent = following ? "Hủy theo dõi" : "＋ Theo dõi";
  toast(following ? "Đã theo dõi" : "Đã hủy theo dõi");
};

/* ---------- Meal Planner ---------- */
Pages.planner = async () => {
  if (!API.user) return Pages.login();
  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + 1); // thu 2
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const plans = await API.get(
    `/recipes/mealplan?start=${days[0]}&end=${days[6]}`,
  );
  const names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  app().innerHTML = `
    <h2 class="section">📅 Meal Planner — Kế hoạch tuần này</h2>
    <p class="muted">Bấm vào ô trống của một bữa để chọn công thức. Bấm vào món đã chọn để đánh dấu hoàn thành.</p>
    <div class="week-grid">
    ${days
      .map(
        (d, i) => `
      <div class="day"><b>${names[i]}</b><div class="muted">${d.slice(5)}</div>
        ${["sang", "trua", "toi"]
          .map((slot) => {
            const p = plans.find((x) => x.date === d && x.slot === slot);
            return `<div class="meal-row ${p && p.done ? "done" : ""}" ${p ? `onclick="Pages._toggleDone(${p.id})"` : `onclick="Pages._pickMeal('${d}','${slot}')"`}>
              ${slot === "sang" ? "🌅 Sáng: " : slot === "trua" ? "☀️ Trưa: " : "🌙 Tối: "}${p ? esc(p.title) : "+ chọn món"}
            </div>`;
          })
          .join("")}
      </div>`,
      )
      .join("")}
    </div>
    <div class="panel" style="margin-top:18px">
      <h3>🥗 Theo dõi dinh dưỡng tuần</h3>
      <p>Đã lập <b>${plans.length}</b> bữa · Hoàn thành <b>${plans.filter((p) => p.done).length}</b> bữa · Tổng ~<b>${plans.reduce((s, p) => s + (p.calories || 0), 0)}</b> kcal đã lên kế hoạch</p>
      <p class="muted">Trung bình Protein/Carb/Fat được hiển thị trong chi tiết từng công thức.</p>
    </div>`;
};
Pages._pickMeal = async (date, slot) => {
  const data = await API.get("/recipes?sort=views");
  const opts = data.items
    .map(
      (r) =>
        `<div class="cat-chip" onclick="Pages._setMeal('${date}','${slot}',${r.id})">${esc(r.title)}</div>`,
    )
    .join("");
  openModal(
    `Chọn món cho bữa ${slot} ngày ${date}`,
    `<div class="cat-chips">${opts}</div>`,
  );
};
Pages._setMeal = async (date, slot, rid) => {
  await API.post("/recipes/mealplan", { date, slot, recipe_id: rid });
  document.getElementById("modal-ov")?.remove();
  Pages.planner();
};
Pages._toggleDone = async (id) => {
  await API.post(`/recipes/mealplan/${id}/done`);
  Pages.planner();
};

/* ---------- Shopping List ---------- */
Pages.shopping = async () => {
  if (!API.user) return Pages.login();
  const items = await API.get("/recipes/shopping");
  const total = items.length,
    bought = items.filter((i) => i.bought).length;
  app().innerHTML = `
    <h2 class="section">🛒 Danh sách mua sắm</h2>
    <p class="muted">Đã mua ${bought}/${total} nguyên liệu · Có thể tạo tự động từ công thức (nút 🛒 trong trang chi tiết món).</p>
    <div style="display:flex;gap:8px;margin:12px 0">
      <input id="siName" placeholder="Tên nguyên liệu" style="flex:1">
      <input id="siQty" placeholder="Số lượng" style="width:130px">
      <button class="btn" onclick="Pages._addShop()">Thêm</button>
    </div>
    <div class="panel">
      ${
        items
          .map(
            (
              i,
            ) => `<div class="comment" style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" ${i.bought ? "checked" : ""} onchange="Pages._bought(${i.id}, this.checked)">
        <span style="flex:1;${i.bought ? "text-decoration:line-through;opacity:.55" : ""}"><b>${esc(i.name)}</b> ${esc(i.quantity || "")}</span>
        <button class="btn danger small" onclick="Pages._delShop(${i.id})">✕</button>
      </div>`,
          )
          .join("") || '<div class="empty">Danh sách trống</div>'
      }
    </div>`;
};
Pages._addShop = async () => {
  const n = document.getElementById("siName").value.trim();
  if (!n) return;
  await API.post("/recipes/shopping", {
    name: n,
    quantity: document.getElementById("siQty").value,
  });
  Pages.shopping();
};
Pages._bought = async (id, v) => {
  await API.put("/recipes/shopping/" + id, { bought: v });
  Pages.shopping();
};
Pages._delShop = async (id) => {
  await API.del("/recipes/shopping/" + id);
  Pages.shopping();
};

/* ---------- AI ---------- */
Pages.ai = async () => {
  if (!API.user) return Pages.login();
  const ings = await API.get("/recipes/meta/ingredients");
  app().innerHTML = `
    <h2 class="section">🤖 AI Recipe — Gợi ý thông minh</h2>
    <div class="panel">
      <h3>1️⃣ Món ăn từ nguyên liệu có sẵn</h3>
      <div class="cat-chips" style="margin:10px 0">${ings.map((i) => `<span class="cat-chip" onclick="Pages._aiToggle(this,'${esc(i.name)}')">${esc(i.name)}</span>`).join("")}</div>
      <button class="btn" onclick="Pages._aiFromIngs()">Gợi ý món ăn</button>
      <div id="aiRes1"></div>
    </div>
    <div class="panel">
      <h3>2️⃣ Thực đơn theo khẩu vị</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        <select id="aiDiet"><option value="">Mọi chế độ</option><option>Chay</option><option>Vegan</option><option>Keto</option></select>
        <input id="aiCal" type="number" placeholder="Calo tối đa/ngày" value="1800">
        <input id="aiTime" type="number" placeholder="Thời gian tối đa (phút)" value="60">
        <button class="btn" onclick="Pages._aiMenu()">Tạo thực đơn</button>
      </div>
      <div id="aiRes2"></div>
    </div>`;
};
Pages._aiSel = [];
Pages._aiToggle = (el, name) => {
  el.style.background =
    el.style.background === "rgb(255, 241, 230)" ? "" : "#fff1e6";
  el.style.borderColor = "var(--primary)";
  const i = Pages._aiSel.indexOf(name);
  i >= 0 ? Pages._aiSel.splice(i, 1) : Pages._aiSel.push(name);
};
Pages._aiFromIngs = async () => {
  const res = await API.post("/ai/from-ingredients", {
    ingredients: Pages._aiSel,
  });
  document.getElementById("aiRes1").innerHTML = res.length
    ? res
        .map(
          (x) => `
    <div class="comment"><b><a href="#/recipe/${x.recipe.id}">${esc(x.recipe.title)}</a></b>
      <div class="muted">Khớp ${x.score} nguyên liệu: ${esc(x.match.join(", "))}</div>
      ${x.missing.length ? `<div class="muted">Còn thiếu: ${esc(x.missing.join(", "))} <a onclick="Pages._buyMissing(${x.recipe.id})">🛒 Thêm thiếu vào danh sách mua</a></div>` : ""}</div>`,
        )
        .join("")
    : '<div class="empty">Chưa chọn nguyên liệu nào hoặc không có món phù hợp</div>';
};
Pages._buyMissing = async (rid) => {
  const all = await API.get("/recipes/" + rid);
  const have = Pages._aiSel.map((s) => s.toLowerCase());
  let n = 0;
  for (const i of all.ingredients) {
    if (!have.some((h) => i.name.toLowerCase().includes(h))) {
      await API.post("/recipes/shopping", {
        name: i.name,
        quantity: `${i.quantity} ${i.unit}`.trim(),
      });
      n++;
    }
  }
  toast(`Đã thêm ${n} nguyên liệu còn thiếu vào danh sách mua`);
};
Pages._aiMenu = async () => {
  const r = await API.post("/ai/suggest-menu", {
    diet: document.getElementById("aiDiet").value,
    maxCalories: +document.getElementById("aiCal").value,
    maxTime: +document.getElementById("aiTime").value,
  });
  document.getElementById("aiRes2").innerHTML =
    `<p style="margin:10px 0"><b>${esc(r.note)}</b></p>
    <div class="grid">${r.items.map(recipeCard).join("")}</div>`;
};

/* ---------- Chia sẻ bộ sưu tập ---------- */
Pages.share = async (m) => {
  try {
    const c = await API.get("/recipes/collections/share/" + m[1]);
    app().innerHTML = `<h2 class="section">📁 Bộ sưu tập: ${esc(c.name)}</h2>
      <div class="grid">${c.items.map(recipeCard).join("") || '<div class="empty">Bộ sưu tập trống</div>'}</div>`;
  } catch (e) {
    app().innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
};

/* ---------- Auth ---------- */
Pages.login = () => {
  app().innerHTML = `<div class="auth-card">
    <h2>🔓 Đăng nhập</h2>
    <input id="liUser" placeholder="Username hoặc email">
    <input id="liPass" type="password" placeholder="Mật khẩu">
    <div class="msg-error" id="liErr"></div>
    <button class="btn" style="width:100%" onclick="Pages._login()">Đăng nhập</button>
    <button class="btn secondary" style="width:100%;margin-top:8px" onclick="go('/register')">Chưa có tài khoản? Đăng ký</button>
    <button class="btn secondary" style="width:100%;margin-top:8px" onclick="Pages._google()">🔵 Đăng nhập bằng Google (demo)</button>
    <p style="margin-top:12px"><a onclick="Pages.forgot()">Quên mật khẩu?</a></p>
  </div>`;
};
Pages._login = async () => {
  try {
    const { token, user } = await API.post("/auth/login", {
      username: document.getElementById("liUser").value,
      password: document.getElementById("liPass").value,
    });
    API.save(token, user);
    toast("Xin chào " + (user.display_name || user.username) + "!");
    go("/");
  } catch (e) {
    document.getElementById("liErr").textContent = e.message;
  }
};
Pages._google = async () => {
  const email = prompt("Nhập email Google của bạn (demo OAuth):");
  if (!email) return;
  const { token, user } = await API.post("/auth/google", {
    email,
    name: email.split("@")[0],
  });
  API.save(token, user);
  go("/");
};
Pages.forgot = () => {
  app().innerHTML = `<div class="auth-card"><h2>🔑 Quên mật khẩu</h2>
    <input id="fgEmail" placeholder="Email của bạn" style="width:100%">
    <button class="btn" style="width:100%;margin-top:8px" onclick="Pages._forgot()">Gửi link đặt lại</button>
    <div id="fgRes" style="margin-top:10px"></div></div>`;
};
Pages._forgot = async () => {
  try {
    const r = await API.post("/auth/forgot-password", {
      email: document.getElementById("fgEmail").value,
    });
    document.getElementById("fgRes").innerHTML =
      `<p>${esc(r.message || "")}</p>` +
      (r.resetToken
        ? `<p class="muted">(Demo) Token: <code>${esc(r.resetToken)}</code></p>
        <input id="rsNew" placeholder="Mật khẩu mới" style="width:100%;margin-top:8px">
        <button class="btn" onclick="Pages._reset('${esc(r.resetToken)}')">Đặt lại mật khẩu</button>`
        : "");
  } catch (e) {
    toast(e.message);
  }
};
Pages._reset = async (token) => {
  try {
    await API.post("/auth/reset-password", {
      token,
      password: document.getElementById("rsNew").value,
    });
    toast("Đã đặt lại mật khẩu, hãy đăng nhập");
    go("/login");
  } catch (e) {
    toast(e.message);
  }
};
Pages.register = () => {
  app().innerHTML = `<div class="auth-card"><h2>📝 Đăng ký tài khoản</h2>
    <input id="rgUser" placeholder="Username" style="width:100%">
    <input id="rgEmail" placeholder="Email" style="width:100%">
    <input id="rgPass" type="password" placeholder="Mật khẩu" style="width:100%">
    <div class="msg-error" id="rgErr"></div>
    <button class="btn" style="width:100%" onclick="Pages._register()">Đăng ký</button>
    <p style="margin-top:10px"><a onclick="go('/login')">Đã có tài khoản? Đăng nhập</a></p></div>`;
};
Pages._register = async () => {
  try {
    const { token, user } = await API.post("/auth/register", {
      username: document.getElementById("rgUser").value,
      email: document.getElementById("rgEmail").value,
      password: document.getElementById("rgPass").value,
    });
    API.save(token, user);
    toast("Đăng ký thành công! Email xác thực đã được gửi (demo).");
    go("/");
  } catch (e) {
    document.getElementById("rgErr").textContent = e.message;
  }
};

/* ---------- Trang Administration ---------- */
Pages.admin = async () => {
  if (!API.user || !["admin", "moderator"].includes(API.user.role)) {
    app().innerHTML =
      '<div class="empty">⛔ Bạn không có quyền truy cập trang này</div>';
    return;
  }
  const tabs = [
    "dashboard",
    "users",
    "recipes",
    "catalog",
    "comments",
    "reports",
    "logs",
  ];
  app().innerHTML = `
    <h2 class="section">⚙️ Quản trị hệ thống</h2>
    <div class="tabs">${tabs
      .map(
        (t, i) =>
          `<button data-t="${t}" class="${i === 0 ? "active" : ""}" onclick="Pages._atab('${t}')">${
            {
              dashboard: "📊 Dashboard",
              users: "👤 Người dùng",
              recipes: "🍲 Công thức",
              catalog: "🗂 Danh mục & Nguyên liệu",
              comments: "💬 Bình luận",
              reports: "🚩 Báo cáo",
              logs: "📜 Nhật ký",
            }[t]
          }</button>`,
      )
      .join("")}</div>
    <div id="atab"></div>`;
  Pages._atab("dashboard");
};
Pages._atab = async (t) => {
  document
    .querySelectorAll(".tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.t === t));
  const el = document.getElementById("atab");
  el.innerHTML = '<div class="empty">Đang tải...</div>';
  if (t === "dashboard") {
    const s = await API.get("/admin/stats");
    el.innerHTML = `<div class="stat-grid">
      ${[
        ["👥 Người dùng", s.users],
        ["🍲 Công thức", s.recipes],
        ["⏳ Chờ duyệt", s.pending],
        ["👁 Tổng lượt xem", s.views],
        ["💬 Bình luận", s.comments],
        ["🚩 Báo cáo mở", s.reports],
      ]
        .map(([l, v]) => `<div class="stat"><b>${v}</b>${l}</div>`)
        .join("")}
    </div>
    <div class="panel" style="margin-top:16px"><b>🔥 Top công thức xem nhiều:</b>
      <ul>${s.topRecipes.map((r) => `<li>${esc(r.title)} — ${r.views} lượt xem</li>`).join("")}</ul></div>
    <div class="panel"><h3>📣 Gửi thông báo hệ thống</h3>
      <input id="bcMsg" placeholder="Nội dung thông báo tới toàn bộ người dùng" style="width:70%">
      <button class="btn" onclick="Pages._broadcast()">Gửi</button></div>`;
  }
  if (t === "users") {
    const users = await API.get("/admin/users");
    el.innerHTML = `<table><tr><th>ID</th><th>Tên</th><th>Email</th><th>Quyền</th><th>Trạng thái</th><th>Món</th><th>Hành động</th></tr>
      ${users
        .map(
          (
            u,
          ) => `<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td>
        <td>${esc(u.role)}</td><td>${u.status === "locked" ? "🔒 Bị khóa" : "✅ Active"}</td><td>${u.recipes}</td>
        <td><button class="btn secondary small" onclick="Pages._setRole(${u.id}, this.dataset.r)" data-r="${u.role === "admin" ? "admin" : u.role === "moderator" ? "moderator" : "user"}">${u.role === "admin" ? "👑" : u.role === "moderator" ? "🛡" : "👤"}</button>
        <button class="btn ${u.status === "locked" ? "" : "danger"} small" onclick="Pages._lockUser(${u.id},'${u.status === "locked" ? "active" : "locked"}')">${u.status === "locked" ? "Mở khóa" : "Khóa"}</button></td></tr>`,
        )
        .join("")}</table>`;
  }
  if (t === "recipes") {
    const [all, pending] = await Promise.all([
      API.get("/admin/recipes"),
      API.get("/admin/recipes?pending=1"),
    ]);
    el.innerHTML = `<h3>⏳ Chờ duyệt (${pending.length})</h3>
      ${
        pending
          .map(
            (
              r,
            ) => `<div class="comment"><b>${esc(r.title)}</b> — ${esc(r.username)}
        <button class="btn small" onclick="Pages._approve(${r.id},1)">✅ Duyệt</button>
        <button class="btn danger small" onclick="Pages._approve(${r.id},0)">❌ Từ chối</button></div>`,
          )
          .join("") || '<p class="muted">Không có công thức chờ duyệt</p>'
      }
      <h3 style="margin-top:16px">🍲 Tất cả công thức</h3>
      <table><tr><th>ID</th><th>Tiêu đề</th><th>Tác giả</th><th>⭐</th><th>👁</th><th>Duyệt</th><th></th></tr>
      ${all
        .map(
          (
            r,
          ) => `<tr><td>${r.id}</td><td><a href="#/recipe/${r.id}">${esc(r.title)}</a></td><td>${esc(r.username)}</td>
        <td>${r.avg_rating}</td><td>${r.views}</td><td>${r.approved ? "✅" : "⏳"}</td>
        <td><button class="btn danger small" onclick="Pages._delRecipeAd(${r.id})">Xóa</button></td></tr>`,
        )
        .join("")}</table>`;
  }
  if (t === "catalog") {
    const [cats, ings] = await Promise.all([
      API.get("/admin/categories"),
      API.get("/admin/ingredients"),
    ]);
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="panel"><h3>🗂 Danh mục</h3>
        ${cats
          .map(
            (
              c,
            ) => `<div class="comment">${c.icon} <b>${esc(c.name)}</b> (${c.count})
          <button class="btn danger small" style="float:right" onclick="Pages._delCat(${c.id})">✕</button></div>`,
          )
          .join("")}
        <div style="display:flex;gap:8px;margin-top:10px"><input id="ncName" placeholder="Tên danh mục"><input id="ncIcon" placeholder="Icon" style="width:70px">
        <button class="btn small" onclick="Pages._addCat()">Thêm</button></div></div>
      <div class="panel"><h3>🥕 Nguyên liệu</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${ings.map((i) => `<span class="badge">${esc(i.name)} <a onclick="Pages._delIng(${i.id})">✕</a></span>`).join("")}</div>
        <div style="display:flex;gap:8px;margin-top:10px"><input id="niName" placeholder="Nguyên liệu mới">
        <button class="btn small" onclick="Pages._addIng2()">Thêm</button></div></div></div>`;
  }
  if (t === "comments") {
    const cs = await API.get("/admin/comments");
    el.innerHTML = `<table><tr><th>User</th><th>Món</th><th>⭐</th><th>Bình luận</th><th></th></tr>
      ${cs
        .map(
          (
            c,
          ) => `<tr><td>${esc(c.username)}</td><td><a href="#/recipe/${c.recipe_id}">${esc(c.title)}</a></td>
        <td>${"★".repeat(c.stars)}</td><td>${esc(c.comment || "(chỉ chấm sao)")}</td>
        <td><button class="btn danger small" onclick="Pages._delCm('${c.rid}')">Xóa</button></td></tr>`,
        )
        .join("")}</table>`;
  }
  if (t === "reports") {
    const rs = await API.get("/admin/reports");
    el.innerHTML =
      rs
        .map(
          (
            r,
          ) => `<div class="comment">🚩 <b>${esc(r.username)}</b>: ${esc(r.reason)}
      ${r.rating_id ? `(bình luận #${r.rating_id})` : ""} — <span class="badge">${r.status}</span>
      ${r.status === "open" ? `<button class="btn small" onclick="Pages._resolve(${r.id})">Đã xử lý</button>` : ""}</div>`,
        )
        .join("") || '<div class="empty">Không có báo cáo</div>';
  }
  if (t === "logs") {
    const logs = await API.get("/admin/logs");
    el.innerHTML = `<table><tr><th>Thời gian</th><th>User</th><th>Hành động</th><th>Chi tiết</th></tr>
      ${logs.map((l) => `<tr><td>${esc(l.created_at)}</td><td>${esc(l.username || "-")}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join("")}</table>`;
  }
};
Pages._broadcast = async () => {
  const r = await API.post("/admin/broadcast", {
    message: document.getElementById("bcMsg").value,
  });
  toast(`Đã gửi tới ${r.sent} người dùng`);
};
Pages._setRole = async (id, btn) => {
  const cur = btn.dataset.r;
  const next = { user: "moderator", moderator: "admin", admin: "user" }[cur];
  try {
    await API.put("/admin/users/" + id, { role: next });
    toast("Đã chuyển quyền: " + next);
    Pages._atab("users");
  } catch (e) {
    toast(e.message);
  }
};
Pages._lockUser = async (id, status) => {
  await API.put("/admin/users/" + id, { status });
  Pages._atab("users");
};
Pages._approve = async (id, ok) => {
  await API.put(`/admin/recipes/${id}/approve`, { approve: !!ok });
  Pages._atab("recipes");
};
Pages._delRecipeAd = async (id) => {
  if (confirm("Xóa công thức?")) {
    await API.del("/admin/recipes/" + id);
    Pages._atab("recipes");
  }
};
Pages._addCat = async () => {
  await API.post("/admin/categories", {
    name: document.getElementById("ncName").value,
    icon: document.getElementById("ncIcon").value,
  });
  Pages._atab("catalog");
};
Pages._delCat = async (id) => {
  await API.del("/admin/categories/" + id);
  Pages._atab("catalog");
};
Pages._addIng2 = async () => {
  await API.post("/admin/ingredients", {
    name: document.getElementById("niName").value,
  });
  Pages._atab("catalog");
};
Pages._delIng = async (id) => {
  await API.del("/admin/ingredients/" + id);
  Pages._atab("catalog");
};
Pages._delCm = async (rid) => {
  await API.del("/admin/comments/" + rid);
  Pages._atab("comments");
};
Pages._resolve = async (id) => {
  await API.put("/admin/reports/" + id, { status: "resolved" });
  Pages._atab("reports");
};

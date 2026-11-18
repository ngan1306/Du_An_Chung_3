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

Pages.marketplace = async (q = {}) => {
  const result = await API.get(`/marketplace/catalog?page=${encodeURIComponent(q.page || 1)}`);
  const page = Number(result.page) || 1;
  const totalPages = Number(result.totalPages) || 1;
  const items = (result.items || []).map((item) => ({
    ...item,
    author: item.author_id == null ? null : {
      id: item.author_id,
      username: item.author_username,
      display_name: item.author_display_name,
      avatar: item.author_avatar,
    },
    avg_rating: 0,
    rating_count: 0,
  }));
  app().innerHTML = `
    <h2 class="section">⭐ Công thức cộng đồng</h2>
    <p class="muted" style="margin:-6px 0 18px">Có ${Number(result.total || 0)} công thức công khai. Công thức miễn phí luôn xem được, không cần thanh toán. Công thức Premium cần mua để mở khóa đầy đủ.</p>
    ${items.length
      ? `<div class="grid">${items.map((item) => `<div>
        ${recipeCard(item)}
        <div class="badge" style="margin:8px 4px">${item.is_premium ? "⭐ Premium · Thanh toán để mở khóa" : "✓ Miễn phí · Không cần thanh toán"}</div>
      </div>`).join("")}</div>
      <nav aria-label="Phân trang Marketplace" style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:18px">
        <button class="btn secondary small" ${page <= 1 ? "disabled" : `onclick="Pages._goToPage(${page - 1})"`}>← Trước</button>
        <span>Trang ${page}/${totalPages}</span>
        <button class="btn secondary small" ${page >= totalPages ? "disabled" : `onclick="Pages._goToPage(${page + 1})"`}>Sau →</button>
      </nav>`
      : '<div class="empty">Chưa có công thức công khai.</div>'}`;
};

Pages.ingredientsStore = async (q = {}) => {
  const [suppliers, products] = await Promise.all([
    API.get("/commerce/suppliers"),
    API.get("/commerce/products" + (q.supplierId ? `?supplierId=${encodeURIComponent(q.supplierId)}` : "")),
  ]);
  app().innerHTML = `
    <h2 class="section">🛍️ Cửa hàng nguyên liệu</h2>
    <p class="muted">Catalog, tồn kho và thanh toán mô phỏng trong môi trường phát triển; không phát sinh giao dịch tiền thật.</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0">
      <label for="storeSupplier">Nhà cung cấp</label>
      <select id="storeSupplier" onchange="Pages._filterSupplier(this.value)">
        <option value="">Tất cả (${suppliers.length})</option>
        ${suppliers.map((supplier) => `<option value="${supplier.id}" ${String(q.supplierId) === String(supplier.id) ? "selected" : ""}>${esc(supplier.name)} · ${supplier.product_count} sản phẩm</option>`).join("")}
      </select>
      <button class="btn" onclick="go('/ingredient-cart')">🛒 Giỏ hàng & thanh toán</button>
    </div>
    ${products.length ? `<div class="grid">${products.map((product) => `<div class="card">
      <div class="body">
        <div class="badge">${esc(product.supplier_name)}</div>
        <h3>${esc(product.name)}</h3>
        <p class="muted">${esc(product.sku)} · ${esc(product.unit)}</p>
        <b>${Number(product.price).toLocaleString("vi-VN")} ₫</b>
        <p class="muted">Còn ${product.available_stock}</p>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input id="storeQty-${product.id}" type="number" min="1" max="${Math.min(99, product.available_stock)}" value="1" style="width:80px" ${product.available_stock <= 0 ? "disabled" : ""}>
          <button class="btn small" onclick="Pages._addProductToCart(${product.id})" ${product.available_stock <= 0 ? "disabled" : ""}>Thêm vào giỏ</button>
        </div>
      </div>
    </div>`).join("")}</div>` : '<div class="empty">Không có sản phẩm phù hợp.</div>'}`;
};
Pages._filterSupplier = (supplierId) => go(`/ingredients${supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ""}`);
Pages._addProductToCart = async (productId) => {
  if (!API.user) return go("/login");
  try {
    await API.post("/commerce/cart", {
      productId,
      quantity: Number(document.getElementById(`storeQty-${productId}`).value),
    });
    toast("Đã thêm vào giỏ nguyên liệu");
  } catch (e) { toast(e.message); }
};

Pages.ingredientCart = async () => {
  if (!API.user) return Pages.login();
  const [items, providers] = await Promise.all([
    API.get("/commerce/cart"),
    API.get("/commerce/providers"),
  ]);
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  app().innerHTML = `
    <h2 class="section">🛒 Giỏ hàng nguyên liệu</h2>
    <p class="muted">Thanh toán và vận chuyển là mô phỏng cho kiểm thử; không thu tiền và không tạo vận đơn thật.</p>
    ${items.length ? `<div class="panel">${items.map((item) => `<div class="comment" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><b>${esc(item.name)}</b><div class="muted">${esc(item.supplier_name)} · ${esc(item.unit)} · ${Number(item.price).toLocaleString("vi-VN")} ₫</div></div>
      <input id="cartQty-${item.product_id}" type="number" min="1" max="${item.available_stock}" value="${item.quantity}" style="width:84px">
      <b>${(Number(item.price) * Number(item.quantity)).toLocaleString("vi-VN")} ₫</b>
      <button class="btn secondary small" onclick="Pages._updateProductQuantity(${item.product_id})">Cập nhật</button>
      <button class="btn danger small" onclick="Pages._removeProduct(${item.product_id})">Xóa</button>
    </div>`).join("")}</div>
    <div class="panel" style="margin-top:16px">
      <h3>Thanh toán mô phỏng</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 16px">
        <div><label for="commerceRecipient">Người nhận</label><input id="commerceRecipient" maxlength="150" autocomplete="name" required style="width:100%"></div>
        <div><label for="commercePhone">Số điện thoại</label><input id="commercePhone" type="tel" maxlength="30" autocomplete="tel" required style="width:100%"></div>
        <div><label for="commerceAddress">Địa chỉ giao hàng</label><input id="commerceAddress" maxlength="500" autocomplete="street-address" required style="width:100%"></div>
        <div><label>Ghi chú</label><input id="commerceNote" maxlength="500" style="width:100%"></div>
        <input id="commercePayment" type="hidden" value="${esc(providers.payments[0]?.id || "")}">
        <input id="commerceShipping" type="hidden" value="${esc(providers.shipping[0]?.id || "")}">
        <div class="checkout-choice">
          <h4>1. Chọn nút thanh toán</h4>
          <div class="checkout-options" role="group" aria-label="Cổng thanh toán">
            ${providers.payments.map((provider, index) => `<button type="button" class="checkout-option${index === 0 ? " selected" : ""}" data-commerce-option="payment" data-value="${esc(provider.id)}" aria-pressed="${index === 0}" onclick="Pages._selectCommerceOption('payment','${esc(provider.id)}')">
              <b>${esc(provider.name)}</b><span>Mô phỏng · bấm để chọn</span>
            </button>`).join("")}
          </div>
        </div>
        <div class="checkout-choice">
          <h4>2. Chọn nút vận chuyển</h4>
          <div class="checkout-options" role="group" aria-label="Đơn vị vận chuyển">
            ${providers.shipping.map((provider, index) => `<button type="button" class="checkout-option${index === 0 ? " selected" : ""}" data-commerce-option="shipping" data-value="${esc(provider.id)}" data-fee="${Number(provider.fee)}" aria-pressed="${index === 0}" onclick="Pages._selectCommerceOption('shipping','${esc(provider.id)}')">
              <b>${esc(provider.name)}</b><span>Phí ${Number(provider.fee).toLocaleString("vi-VN")} ₫ · mô phỏng</span>
            </button>`).join("")}
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:12px;flex-wrap:wrap">
        <b id="commerceOrderTotal" data-subtotal="${subtotal}">Tổng đơn (gồm giao hàng): ${(subtotal + Number(providers.shipping[0]?.fee || 0)).toLocaleString("vi-VN")} ₫</b>
        <button class="btn checkout-submit" onclick="Pages._checkoutCommerce()">Đặt hàng & đi tới thanh toán</button>
      </div>
    </div>` : `<div class="empty">Giỏ hàng đang trống.
      <p class="muted" style="margin:8px 0 14px">Thêm sản phẩm vào giỏ để chọn phương thức thanh toán và đơn vị giao hàng.</p>
      <button class="btn" onclick="go('/ingredients')">Mở cửa hàng nguyên liệu</button>
    </div>`}`;
};
Pages._updateProductQuantity = async (productId) => {
  try {
    await API.put(`/commerce/cart/${productId}`, {
      quantity: Number(document.getElementById(`cartQty-${productId}`).value),
    });
    await Pages.ingredientCart();
  } catch (e) { toast(e.message); }
};
Pages._removeProduct = async (productId) => {
  try {
    await API.del(`/commerce/cart/${productId}`);
    await Pages.ingredientCart();
  } catch (e) { toast(e.message); }
};
Pages._selectCommerceOption = (kind, value) => {
  const field = document.getElementById(kind === "payment" ? "commercePayment" : "commerceShipping");
  if (!field) return;
  field.value = value;
  document.querySelectorAll(`[data-commerce-option="${kind}"]`).forEach((button) => {
    const selected = button.dataset.value === value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (kind === "shipping") {
    const option = [...document.querySelectorAll('[data-commerce-option="shipping"]')]
      .find((button) => button.dataset.value === value);
    const total = document.getElementById("commerceOrderTotal");
    if (option && total) {
      const amount = Number(total.dataset.subtotal) + Number(option.dataset.fee);
      total.textContent = `Tổng đơn (gồm giao hàng): ${amount.toLocaleString("vi-VN")} ₫`;
    }
  }
};
Pages._checkoutCommerce = async () => {
  const button = document.querySelector(".checkout-submit");
  try {
    const recipientName = document.getElementById("commerceRecipient")?.value.trim();
    const phone = document.getElementById("commercePhone")?.value.trim();
    const address = document.getElementById("commerceAddress")?.value.trim();
    const note = document.getElementById("commerceNote")?.value.trim() || "";
    if (!recipientName) throw new Error("Vui lòng nhập tên người nhận.");
    if (!phone || !/^[0-9+().\-\s]{8,30}$/.test(phone))
      throw new Error("Vui lòng nhập số điện thoại hợp lệ (8–30 ký tự).");
    if (!address) throw new Error("Vui lòng nhập địa chỉ giao hàng.");
    if (note.length > 500) throw new Error("Ghi chú không được vượt quá 500 ký tự.");
    const paymentProvider = document.getElementById("commercePayment")?.value;
    const shippingProvider = document.getElementById("commerceShipping")?.value;
    if (!paymentProvider || !shippingProvider)
      throw new Error("Hãy chọn cổng thanh toán và đơn vị vận chuyển.");
    if (button) {
      button.disabled = true;
      button.textContent = "Đang tạo đơn hàng…";
    }
    const result = await API.post("/commerce/checkout", {
      recipientName,
      phone,
      address,
      note,
      paymentProvider,
      shippingProvider,
    });
    go(result.paymentUrl.replace(/^\/#/, ""));
  } catch (e) {
    if (button) {
      button.disabled = false;
      button.textContent = "Đặt hàng & đi tới thanh toán";
    }
    toast(e.message);
  }
};

Pages.mockPayment = async (m) => {
  if (!API.user) return Pages.login();
  const recipeOrder = m[1] === "recipe";
  const orderId = Number(recipeOrder ? m[2] : m[1]);
  const providerName = {
    vnpay: "VNPay",
    momo: "MoMo",
    zalopay: "ZaloPay",
  }[new URLSearchParams(location.hash.split("?")[1] || "").get("provider")] || "Cổng thanh toán";
  app().innerHTML = `<div class="panel" style="max-width:620px;margin:40px auto;text-align:center">
    <h2>Thanh toán ${esc(providerName)} (mô phỏng)</h2>
    <p>Đây là màn hình giả lập để kiểm thử. Không nhập thẻ, không có tiền thật được chuyển.</p>
    <h3 style="margin:14px 0">Chọn kết quả kiểm thử</h3>
    <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
      <button class="btn" onclick="Pages._completeMockPayment(${orderId},'success',${recipeOrder})">Giả lập thanh toán thành công</button>
      <button class="btn danger" onclick="Pages._completeMockPayment(${orderId},'failure',${recipeOrder})">Giả lập thanh toán thất bại</button>
    </div>
    <p style="margin-top:16px"><a class="btn secondary small" href="${recipeOrder ? "#/cart" : "#/ingredient-cart"}">Quay lại giỏ hàng</a></p>
  </div>`;
};
Pages._completeMockPayment = async (orderId, outcome, recipeOrder) => {
  try {
    const result = await API.post(
      recipeOrder ? `/marketplace/mock-payment/${orderId}` : `/commerce/orders/${orderId}/mock-payment`,
      { outcome },
    );
    toast(result.status === "paid"
      ? recipeOrder ? "Thanh toán mô phỏng thành công; công thức đã mở khóa và doanh thu Creator được ghi nhận."
        : "Thanh toán mô phỏng thành công; tồn kho đã trừ và vận đơn được tạo."
      : "Đã ghi nhận thanh toán mô phỏng thất bại.");
    go(recipeOrder ? "/purchases" : "/orders");
  } catch (e) { toast(e.message); }
};

Pages.commerceOrders = async () => {
  if (!API.user) return Pages.login();
  const orders = await API.get("/commerce/orders");
  const labels = {
    pending_payment: "Chờ thanh toán",
    payment_failed: "Thanh toán thất bại",
    paid: "Đã thanh toán",
    shipped: "Đang giao",
    delivered: "Đã giao",
    shipping_cancelled: "Đã hủy vận chuyển",
    refunded: "Đã hoàn tiền (mô phỏng)",
    cancelled: "Đã hủy",
  };
  app().innerHTML = `<h2 class="section">📦 Đơn nguyên liệu</h2>
    <p class="muted">Theo dõi thanh toán, đơn vị giao hàng, mã vận đơn và trạng thái giao hàng. Tất cả đều mô phỏng; không có giao dịch/vận đơn thật.</p>
    ${orders.length ? orders.map((order) => `<div class="panel" style="margin:12px 0">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <b>Đơn #${order.id} · ${esc(labels[order.status] || order.status)}</b>
        <b>${Number(order.total_amount).toLocaleString("vi-VN")} ₫</b>
      </div>
      <div class="muted">Thanh toán: ${esc(order.payment_provider)} · Trạng thái: ${esc(order.payment_status || order.status)} (mô phỏng)</div>
      <div class="muted">Đơn vị vận chuyển: ${esc(order.shipment_provider || order.shipping_provider)} · Trạng thái: ${esc(order.shipment_status || "Chờ thanh toán")}</div>
      <div>${esc(order.recipient_name)} · ${esc(order.phone)} · ${esc(order.delivery_address)}</div>
      ${order.tracking_number ? `<p>Mã vận đơn: <b>${esc(order.tracking_number)}</b></p>` : ""}
      <ul>${order.items.map((item) => `<li>${esc(item.name)} · ${item.quantity} ${esc(item.unit)} × ${Number(item.unit_price).toLocaleString("vi-VN")} ₫ = ${Number(item.line_total).toLocaleString("vi-VN")} ₫</li>`).join("")}</ul>
      ${order.shipment_events.length ? `<ol>${order.shipment_events.map((event) => `<li>${esc(event.description)} · ${esc(event.created_at)}</li>`).join("")}</ol>` : ""}
    </div>`).join("") : '<div class="empty">Bạn chưa có đơn hàng.</div>'}`;
};

Pages.cart = async () => {
  if (!API.user) return Pages.login();
  const items = await API.get("/marketplace/cart");
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  app().innerHTML = `
    <h2 class="section">🛒 Giỏ hàng</h2>
    ${items.length ? `
      <div class="panel">${items.map((item) => `<div class="comment" style="display:flex;align-items:center;gap:12px">
        <img src="${esc(item.image)}" alt="" style="width:76px;height:60px;object-fit:cover;border-radius:8px">
        <div style="flex:1"><b>${esc(item.title)}</b><div class="muted">${Number(item.price).toLocaleString("vi-VN")} ₫</div></div>
        <button class="btn danger small" onclick="Pages._removeCartItem(${item.id})">Xóa</button>
      </div>`).join("")}
      <h3 style="text-align:right;margin:14px 0">Tổng: ${total.toLocaleString("vi-VN")} ₫</h3>
      <button class="btn" onclick="Pages._checkout()">Thanh toán</button>
      <p class="muted" style="margin-top:8px">Có VNPay, MoMo và ZaloPay mô phỏng; màn tiếp theo cho chọn kết quả kiểm thử. Không thu tiền thật.</p>
      </div>` : '<div class="empty">Giỏ hàng đang trống.</div>'}`;
};

Pages._removeCartItem = async (id) => {
  try {
    await API.del(`/marketplace/cart/${id}`);
    await Pages.cart();
  } catch (e) { toast(e.message); }
};

Pages._checkout = async () => {
  try {
    const providers = await API.get("/commerce/providers");
    openModal(
      "Chọn cổng thanh toán",
      `<p class="muted">Thanh toán giả lập để kiểm thử; không thu tiền thật.</p>
      <select id="cartPaymentProvider" style="width:100%">${providers.payments.map((provider) => `<option value="${provider.id}_mock">${esc(provider.name)} (mô phỏng)</option>`).join("")}</select>
      <button class="btn" style="margin-top:12px" onclick="Pages._checkoutRecipeCart()">Tiếp tục</button>`,
    );
  } catch (e) { toast(e.message); }
};
Pages._checkoutRecipeCart = async () => {
  try {
    const result = await API.post("/marketplace/checkout", {
      paymentProvider: document.getElementById("cartPaymentProvider").value,
    });
    document.getElementById("modal-ov")?.remove();
    go(result.paymentUrl.replace(/^\/#/, ""));
  } catch (e) { toast(e.message); }
};

Pages.purchases = async (query) => {
  if (!API.user) return Pages.login();
  const items = await API.get("/marketplace/purchases");
  const paymentMessage = {
    success: "Thanh toán thành công. Công thức đã được mở khóa.",
    failed: "Thanh toán chưa thành công. Đơn hàng chưa được mở khóa.",
    pending: "VNPay đã trả về kết quả. Hệ thống đang chờ IPN xác nhận từ máy chủ thanh toán; hãy tải lại sau ít phút.",
    invalid: query?.message || "Không xác minh được giao dịch.",
  }[query?.payment];
  app().innerHTML = `
    <h2 class="section">📚 Công thức đã mua</h2>
    ${paymentMessage ? `<div class="panel">${esc(paymentMessage)}</div>` : ""}
    ${items.length ? `<div class="grid">${items.map((item) => recipeCard({
      ...item, is_premium: true, views: 0, prep_minutes: 0, cook_minutes: 0,
      avg_rating: 0, rating_count: 0, difficulty: "Đã sở hữu",
    })).join("")}</div>` : '<div class="empty">Bạn chưa mua công thức nào.</div>'}`;
};

Pages.creator = async () => {
  if (!API.user) return Pages.login();
  if (API.user.role !== "creator" && API.user.role !== "admin") {
    app().innerHTML = `<div class="panel" style="max-width:620px;margin:auto">
      <h2>🍳 Trở thành Creator</h2>
      <p class="muted" style="margin:10px 0">Đăng công thức Premium và theo dõi các giao dịch mua.</p>
      <label>Giới thiệu về bạn</label><textarea id="creatorBio" maxlength="1000" rows="4" style="width:100%"></textarea>
      <button class="btn" style="margin-top:12px" onclick="Pages._registerCreator()">Đăng ký Creator</button>
    </div>`;
    return;
  }
  const [sales, recipes, walletData] = await Promise.all([
    API.get("/marketplace/creator/sales"),
    API.get("/marketplace/creator/recipes"),
    API.get("/marketplace/creator/wallet"),
  ]);
  const revenue = Number(walletData.wallet.total_earned || 0);
  app().innerHTML = `<h2 class="section">🍳 Creator Studio</h2>
    <div class="stat-grid">
      <div class="stat"><b>${sales.length}</b>Lượt mua</div>
      <div class="stat"><b>${revenue.toLocaleString("vi-VN")} ₫</b>Thu nhập ròng sau hoa hồng</div>
      <div class="stat"><b>${Number(walletData.wallet.available_balance).toLocaleString("vi-VN")} ₫</b>Số dư khả dụng</div>
      <div class="stat"><b>${Number(walletData.wallet.held_balance).toLocaleString("vi-VN")} ₫</b>Đang chờ xử lý</div>
    </div>
    <div class="panel" style="margin:14px 0">
      <h3>Ví Creator · Hoa hồng nền tảng 10%</h3>
      <p class="muted">Tỷ lệ hoa hồng được chụp lại trên từng đơn; doanh thu cũ không bị tính lại khi cấu hình thay đổi. Rút tiền ở bản này được xử lý mô phỏng bởi Admin, không tự chuyển khoản ngân hàng.</p>
      <label>Ngân hàng</label><input id="creatorBankName" maxlength="100" value="${esc(walletData.bank.bank_name || "")}" style="width:100%">
      <label>Số tài khoản</label><input id="creatorBankAccount" maxlength="100" value="${esc(walletData.bank.bank_account || "")}" style="width:100%">
      <label>Tên chủ tài khoản</label><input id="creatorAccountName" maxlength="150" value="${esc(walletData.bank.account_name || "")}" style="width:100%">
      <button class="btn secondary small" style="margin-top:8px" onclick="Pages._saveCreatorBank()">Lưu thông tin nhận tiền</button>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <input id="creatorWithdrawAmount" type="number" min="50000" max="99999999" step="1000" placeholder="Số tiền rút (tối thiểu 50.000)" style="flex:1">
        <button class="btn" onclick="Pages._requestCreatorWithdrawal()">Gửi yêu cầu rút</button>
      </div>
    </div>
    <button class="btn" style="margin:14px 0" onclick="go('/new-recipe')">＋ Đăng công thức Premium</button>
    <h3>Công thức của bạn</h3>
    ${recipes.length ? `<div class="panel">${recipes.map((recipe) => {
      const listingStatus = recipe.is_premium
        ? recipe.approved ? "Premium · Đang bán" : "Premium · Đang duyệt"
        : recipe.is_public && recipe.approved ? "Miễn phí · Đang hiển thị"
          : recipe.is_public ? "Miễn phí · Chờ duyệt" : "Miễn phí · Đang ẩn";
      return `<div class="comment" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="flex:1"><b>${esc(recipe.title)}</b>
        <div class="muted">${esc(listingStatus)}${recipe.is_premium ? ` · ${Number(recipe.price).toLocaleString("vi-VN")} ₫` : ""}</div>
      </div>
      <button class="btn secondary small" onclick="go('/edit-recipe/${recipe.id}${recipe.is_premium ? "" : "?sell=1"}')">${recipe.is_premium ? "Sửa" : "Đăng bán"}</button>
      ${recipe.is_premium ? `<button class="btn danger small" onclick="Pages._withdrawPremiumRecipe(${recipe.id})">Thu hồi</button>` : ""}
    </div>`;
    }).join("")}</div>` : '<div class="empty">Bạn chưa đăng công thức.</div>'}
    <h3>Giao dịch bán</h3>
    ${sales.length ? `<div class="panel">${sales.map((sale) => `<div class="comment">${esc(sale.title)} · Giá ${Number(sale.price).toLocaleString("vi-VN")} ₫ · Hoa hồng ${Number(sale.commission_amount).toLocaleString("vi-VN")} ₫ (${Number(sale.commission_rate_bps) / 100}%) · Nhận ${Number(sale.creator_amount).toLocaleString("vi-VN")} ₫ · ${esc(sale.purchased_at)}</div>`).join("")}</div>` : '<div class="empty">Chưa có giao dịch.</div>'}
    <h3>Yêu cầu rút tiền</h3>
    ${walletData.withdrawals.length ? `<div class="panel">${walletData.withdrawals.map((request) => `<div class="comment">#${request.id} · ${Number(request.amount).toLocaleString("vi-VN")} ₫ · ${esc(request.status)} · ${esc(request.bank_name)} · ${esc(request.bank_account)}${request.admin_note ? `<div class="muted">${esc(request.admin_note)}</div>` : ""}</div>`).join("")}</div>` : '<div class="empty">Chưa có yêu cầu rút tiền.</div>'}
    <h3>Sổ cái ví</h3>
    ${walletData.ledger.length ? `<div class="panel">${walletData.ledger.map((entry) => `<div class="comment">${esc(entry.note)} · Thực thu/chi ${Number(entry.net_amount).toLocaleString("vi-VN")} ₫ · ${esc(entry.created_at)}</div>`).join("")}</div>` : '<div class="empty">Chưa có giao dịch ví.</div>'}`;
};

Pages._saveCreatorBank = async () => {
  try {
    await API.put("/marketplace/creator/bank-account", {
      bank_name: document.getElementById("creatorBankName").value,
      bank_account: document.getElementById("creatorBankAccount").value,
      account_name: document.getElementById("creatorAccountName").value,
    });
    toast("Đã lưu thông tin nhận tiền");
  } catch (e) { toast(e.message); }
};
Pages._requestCreatorWithdrawal = async () => {
  try {
    await API.post("/marketplace/creator/withdrawals", {
      amount: Number(document.getElementById("creatorWithdrawAmount").value),
    });
    toast("Đã gửi yêu cầu rút tiền chờ Admin xử lý");
    await Pages.creator();
  } catch (e) { toast(e.message); }
};

Pages._withdrawPremiumRecipe = async (id) => {
  if (!confirm("Thu hồi công thức Premium? Công thức sẽ chuyển thành miễn phí và không nhận đơn mua mới.")) return;
  try {
    await API.post(`/marketplace/creator/recipes/${id}/withdraw`, {});
    toast("Đã thu hồi; công thức được chuyển thành miễn phí.");
    await Pages.creator();
  } catch (e) { toast(e.message); }
};

Pages._registerCreator = async () => {
  try {
    const result = await API.post("/marketplace/creator", { bio: document.getElementById("creatorBio").value });
    API.save(result.token, result.user);
    renderNavbar();
    await Pages.creator();
    toast("Đăng ký Creator thành công");
  } catch (e) { toast(e.message); }
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
      ${r.is_premium ? `<div class="badge" style="margin:8px 0">⭐ Premium · ${Number(r.price).toLocaleString("vi-VN")} ₫</div>` : ""}
      ${r.is_locked ? `<div class="panel"><b>🔒 Công thức Premium</b><p style="margin:6px 0 12px">Mua công thức để mở khóa nguyên liệu và toàn bộ hướng dẫn.</p>
        ${API.user ? `<button class="btn" onclick="Pages._buyPremium(${r.id})">🛒 Mua công thức</button>
          <button class="btn secondary" style="margin-left:6px" onclick="Pages._addPremiumToCart(${r.id})">Thêm vào giỏ hàng</button>` : `<button class="btn" onclick="go('/login')">🛒 Mua công thức · đăng nhập</button>`}
      </div>` : ""}
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
          !r.is_locked
            ? `<button class="btn" onclick="Pages._buyRecipe(${r.id},${!!r.is_premium},${API.user?.id === r.user_id},${!!r.is_locked})">🛒 Mua công thức</button>
        ${API.user ? `<button class="btn secondary" onclick="Pages._openCollectionPicker(${r.id})">📁 Thêm vào bộ sưu tập</button>
        <button class="btn secondary" onclick="Pages._addToPlan(${r.id})">📅 Thêm vào thực đơn</button>
        <button class="btn secondary" onclick="Pages._toShopping(${r.id})">🛒 Thêm nguyên liệu vào danh sách mua</button>` : ""}`
            : ""
        }
        ${!r.is_locked ? `<button class="btn secondary" onclick="Pages.cookingMode(${JSON.stringify(steps).replace(/"/g, "&quot;")}, '${esc(r.title).replace(/'/g, "\\'")}', ${r.cook_minutes})">👨‍🍳 Cooking Mode</button>` : ""}
        ${
          API.user && API.user.id === r.user_id
            ? `${!r.is_premium ? `<button class="btn" onclick="Pages._sellExistingRecipe(${r.id})">${API.user.role === "creator" || API.user.role === "admin" ? "⭐ Đăng bán công thức này" : "🍳 Đăng ký Creator để bán"}</button>` : ""}
        <button class="btn secondary" onclick="go('/edit-recipe/${r.id}')">✏️ Sửa</button>
        <button class="btn danger" onclick="Pages._deleteRecipe(${r.id})">🗑 Xóa</button>`
            : ""
        }
      </div>
      <div class="muted" style="margin-top:10px">👤 <a href="#/user/${r.author.id}">${esc(r.author.display_name || r.author.username)}</a></div>
    </div>
  </div>

  ${r.is_locked ? "" : `<div class="panel">
    <h2>🥘 Nguyên liệu</h2>
    <ul class="ing-list">${r.ingredients.map((i) => `<li>${esc(i.name)} — <b>${esc(i.quantity)} ${esc(i.unit)}</b></li>`).join("")}</ul>
  </div>
  <div class="panel">
    <h2>📝 Các bước chế biến</h2>
    <ol class="steps">${steps.map((s) => `<li style="margin:10px 0">${esc(s.text)}</li>`).join("")}</ol>
  </div>`}
  ${Comments.html(r)}
  <script>Comments.bind(${JSON.stringify(r.ratings).replace(/</g, "\\u003c")}, ${r.id})</script>`;
  Comments.bind(r.ratings, r.id);
};

Pages._sellExistingRecipe = (id) => {
  if (API.user?.role !== "creator" && API.user?.role !== "admin") {
    go("/creator");
    return;
  }
  go(`/edit-recipe/${id}?sell=1`);
};

Pages._buyRecipe = (id, isPremium, isOwner, isLocked) => {
  const recipeId = Number(id);
  if (!Number.isSafeInteger(recipeId) || recipeId < 1) return toast("Công thức không hợp lệ");
  if (isPremium && !isOwner && isLocked) {
    if (!API.user) return go("/login");
    return Pages._buyPremium(recipeId);
  }
  if (isPremium && !isOwner && API.user?.role !== "admin") {
    toast("Bạn đã sở hữu công thức này.");
    return go("/purchases");
  }
  if (isPremium && !isOwner && API.user?.role === "admin")
    return Pages._buyPremium(recipeId);
  if (isPremium && isOwner) {
    toast("Đây là công thức của bạn; mở Creator Studio để quản lý bán.");
    return go("/creator");
  }
  toast("Công thức này miễn phí, không cần thanh toán.");
};

Pages._addPremiumToCart = async (id) => {
  try {
    await API.post(`/marketplace/cart/${id}`);
    toast("Đã thêm công thức vào giỏ hàng");
    go("/cart");
  } catch (e) { toast(e.message); }
};
Pages._buyPremium = async (id) => {
  const providers = await API.get("/commerce/providers");
  openModal(
    "Chọn cổng thanh toán",
    `<p class="muted">Chọn cổng thanh toán giả lập. Không phát sinh giao dịch thật.</p>
    <select id="premiumPaymentProvider" style="width:100%">${providers.payments.map((provider) => `<option value="${provider.id}_mock">${esc(provider.name)} (mô phỏng)</option>`).join("")}</select>
    <button class="btn" style="margin-top:12px" onclick="Pages._checkoutPremium(${id})">Tạo đơn thanh toán</button>`,
  );
};
Pages._checkoutPremium = async (id) => {
  try {
    const result = await API.post("/marketplace/checkout", {
      recipeId: id,
      paymentProvider: document.getElementById("premiumPaymentProvider").value,
    });
    document.getElementById("modal-ov")?.remove();
    go(result.paymentUrl.replace(/^\/#/, ""));
  } catch (e) { toast(e.message); }
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
      API.user && !r.is_locked
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
        : r.is_locked
          ? '<p class="muted">Mua công thức để đánh giá và bình luận.</p>'
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
    if (API.user && document.getElementById("cText")) {
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
          ${!r.is_premium ? `<button class="btn small" onclick="Pages._sellExistingRecipe(${r.id})">${API.user.role === "creator" || API.user.role === "admin" ? "⭐ Đăng bán công thức" : "🍳 Trở thành Creator để bán"}</button> · ` : ""}
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
  try {
    await API.del("/auth/me");
    API.logout();
    go("/");
    toast("Tài khoản đã bị xóa");
  } catch (e) {
    toast(e.message);
  }
};

/* ---------- Thêm / sửa công thức ---------- */
Pages.recipeForm = async (m, q = {}) => {
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
    <h2>${q.sell === "1" && editing ? "⭐ Đăng bán công thức có sẵn" : editing ? "✏️ Sửa công thức" : "＋ Thêm công thức mới"}</h2>
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
      ${API.user?.role === "creator" || API.user?.role === "admin" ? `
      <div class="panel" style="margin-top:12px">
        <label><input id="rfPremium" type="checkbox" ${r.is_premium || q.sell === "1" ? "checked" : ""}> Đăng bán công thức Premium</label>
        <label>Giá bán (VNĐ)</label><input id="rfPrice" type="number" min="5000" max="99999999" step="1000" value="${r.price || ""}" placeholder="Ví dụ: 50000">
        <p class="muted">Công thức mới hoặc công thức bạn đã đăng trước đây đều có thể bán. Khi bật Premium, công thức sẽ chờ Admin duyệt trước khi xuất hiện trong Marketplace.</p>
      </div>` : !editing ? `<div class="panel" style="margin-top:12px">Muốn bán công thức Premium? <a href="#/creator">Đăng ký Creator</a>.</div>` : ""}
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
    is_premium: !!document.getElementById("rfPremium")?.checked,
    price: Number(document.getElementById("rfPrice")?.value || 0),
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
    if (API.user?.role === "admin" && sessionStorage.getItem("adminReturnTab")) {
      go("/admin");
    } else {
      go("/profile");
    }
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
  if (u.contact) {
    app().innerHTML = `
      <div class="panel">
        <h2>Liên hệ quản trị viên</h2>
        <p>${esc(u.display_name)}</p>
        <p>☎️ Hotline: <a href="tel:${esc(u.contact.phone)}">${esc(u.contact.phone)}</a></p>
        <p>✉️ Gmail: <a href="mailto:${esc(u.contact.email)}">${esc(u.contact.email)}</a></p>
      </div>`;
    return;
  }
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
Pages.contact = async () => {
  const contact = await API.get("/recipes/admin-contact");
  app().innerHTML = `
    <div class="panel">
      <h2>Liên hệ quản trị viên</h2>
      <p>${esc(contact.name)}</p>
      <p>☎️ Hotline: <a href="tel:${esc(contact.phone)}">${esc(contact.phone)}</a></p>
      <p>✉️ Gmail: <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></p>
    </div>`;
};
Pages._toggleFollow = async (id, btn) => {
  const { following } = await API.post(`/recipes/users/${id}/follow`);
  btn.textContent = following ? "Hủy theo dõi" : "＋ Theo dõi";
  toast(following ? "Đã theo dõi" : "Đã hủy theo dõi");
};

/* ---------- Meal Planner ---------- */
Pages.planner = async () => {
  if (!API.user) return Pages.login();
  const dateKey = (value) =>
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value ?? "").slice(0, 10);
  const pad = (value) => String(value).padStart(2, "0");
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const plans = await API.get(
    `/recipes/mealplan?start=${days[0]}&end=${days[6]}`,
  );
  const planBySlot = new Map(
    plans.map((plan) => [`${dateKey(plan.date)}:${plan.slot}`, plan]),
  );
  const names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const slots = ["sang", "trua", "toi"];
  const slotNames = { sang: "Sáng", trua: "Trưa", toi: "Tối" };
  const mealDetails = days.flatMap((date, dayIndex) =>
    slots
      .map((slot) => ({
        date,
        dayName: names[dayIndex],
        slot,
        plan: planBySlot.get(`${date}:${slot}`),
      }))
      .filter((meal) => meal.plan),
  );
  const sumNutrition = (field) =>
    plans.reduce((sum, plan) => sum + (Number(plan[field]) || 0), 0);
  const displayNutrition = (value, unit) =>
    value == null || value === ""
      ? "Chưa cập nhật"
      : `${Number(value).toLocaleString("vi-VN")} ${unit}`;
  app().innerHTML = `
    <h2 class="section">📅 Meal Planner — Kế hoạch tuần này</h2>
    <p class="muted">Chọn món ở bữa trống; dùng Chỉnh sửa để đổi món hoặc Xóa để bỏ món khỏi thực đơn.</p>
    <div class="week-grid">
    ${days
      .map(
        (d, i) => `
      <div class="day"><b>${names[i]}</b><div class="muted">${d.slice(5)}</div>
        ${slots
          .map((slot) => {
            const p = planBySlot.get(`${d}:${slot}`);
            return `<div class="meal-row">
              <div class="meal-title">${slot === "sang" ? "🌅" : slot === "trua" ? "☀️" : "🌙"} ${slotNames[slot]}: ${p ? esc(p.title) : ""}</div>
              ${p ? `<div class="meal-actions">
                <button type="button" class="btn secondary small" onclick="Pages._pickMeal('${d}','${slot}',true)">Chỉnh sửa</button>
                <button type="button" class="btn danger small" onclick="Pages._deleteMeal('${d}','${slot}')">Xóa</button>
              </div>` : `<button type="button" class="meal-add" onclick="Pages._pickMeal('${d}','${slot}')">+ chọn món</button>`}
            </div>`;
          })
          .join("")}
      </div>`,
      )
      .join("")}
    </div>
    <div class="panel" style="margin-top:18px">
      <h3>🥗 Theo dõi dinh dưỡng tuần</h3>
      <p>Đã lập <b>${plans.length}</b> bữa · Tổng ~<b>${sumNutrition("calories").toLocaleString("vi-VN")}</b> kcal theo khẩu phần đã lên kế hoạch</p>
      <p>Protein: <b>${sumNutrition("protein").toLocaleString("vi-VN")} g</b> · Carb: <b>${sumNutrition("carbs").toLocaleString("vi-VN")} g</b> · Fat: <b>${sumNutrition("fat").toLocaleString("vi-VN")} g</b></p>
      <p class="muted">Chi tiết dưới đây dựa trên thông tin dinh dưỡng mỗi khẩu phần của công thức.</p>
      ${mealDetails.length ? `<div style="display:grid;gap:8px;margin-top:12px">
        ${mealDetails.map(({ dayName, date, slot, plan }) => `<div class="comment" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><b>${dayName} ${date.slice(5)} · ${slotNames[slot]}</b><div>${esc(plan.title)}</div></div>
          <div class="muted">Calo: ${displayNutrition(plan.calories, "kcal")} · Protein: ${displayNutrition(plan.protein, "g")} · Carb: ${displayNutrition(plan.carbs, "g")} · Fat: ${displayNutrition(plan.fat, "g")}</div>
        </div>`).join("")}
      </div>` : '<p class="muted">Chưa có món nào trong tuần này. Hãy chọn món trong một ô bữa ăn để xem kế hoạch và dinh dưỡng tại đây.</p>'}
    </div>`;
};
Pages._pickMeal = async (date, slot, editing = false) => {
  try {
    const items = await API.get("/recipes/mealplan/recipes");
    openModal(
      `${editing ? "Chỉnh sửa món" : "Chọn món"} cho bữa ${slot} ngày ${date}`,
      `<label for="mealRecipeSearch">Tìm món theo tên hoặc nguyên liệu</label>
      <input id="mealRecipeSearch" type="search" maxlength="100" placeholder="Ví dụ: phở, gà..." style="width:100%;margin-bottom:12px"
        oninput="Pages._searchMealRecipes('${date}','${slot}')">
      <div id="mealRecipeResults">${Pages._mealRecipeOptions(date, slot, items)}</div>`,
    );
  } catch (e) { toast(e.message); }
};
Pages._mealRecipeOptions = (date, slot, items) => items.length
  ? `<div style="display:grid;gap:8px">${items.map((recipe) =>
    `<button class="btn secondary" style="text-align:left" onclick="Pages._setMeal('${date}','${slot}',${recipe.id})">${esc(recipe.title)}${recipe.category ? ` · ${esc(recipe.category)}` : ""}</button>`,
  ).join("")}</div>`
  : '<p class="muted">Không tìm thấy món phù hợp.</p>';
Pages._searchMealRecipes = (date, slot) => {
  clearTimeout(Pages._mealSearchTimer);
  const search = document.getElementById("mealRecipeSearch")?.value.trim() || "";
  const requestId = (Pages._mealSearchId || 0) + 1;
  Pages._mealSearchId = requestId;
  Pages._mealSearchTimer = setTimeout(async () => {
    const results = document.getElementById("mealRecipeResults");
    if (!results) return;
    results.innerHTML = '<p class="muted">Đang tìm...</p>';
    try {
      const items = await API.get(`/recipes/mealplan/recipes?q=${encodeURIComponent(search)}`);
      if (requestId !== Pages._mealSearchId) return;
      results.innerHTML = Pages._mealRecipeOptions(date, slot, items);
    } catch (e) {
      if (requestId === Pages._mealSearchId && results.isConnected)
        results.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
    }
  }, 250);
};
Pages._setMeal = async (date, slot, rid) => {
  try {
    await API.post("/recipes/mealplan", { date, slot, recipe_id: rid });
    document.getElementById("modal-ov")?.remove();
    toast("Đã lưu món vào thực đơn");
    Pages.planner();
  } catch (e) { toast(e.message); }
};
Pages._deleteMeal = async (date, slot) => {
  if (!confirm("Xóa món này khỏi thực đơn?")) return;
  try {
    await API.del(`/recipes/mealplan?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slot)}`);
    toast("Đã xóa món khỏi thực đơn");
    Pages.planner();
  } catch (e) { toast(e.message); }
};

/* ---------- Shopping List ---------- */
Pages.shopping = async (q = {}) => {
  if (!API.user) return Pages.login();
  const items = await API.get("/recipes/shopping");
  const total = items.length,
    bought = items.filter((i) => i.bought).length;
  app().innerHTML = `
    <h2 class="section">🛒 Danh sách mua sắm</h2>
    <p class="muted">Đã mua ${bought}/${total} nguyên liệu · Có thể tạo tự động từ công thức (nút 🛒 trong trang chi tiết món).</p>
    <div class="panel" style="margin:12px 0">
      <b>Muốn đặt mua nguyên liệu?</b>
      <p class="muted">Mở cửa hàng để chọn sản phẩm đóng gói có giá và tồn kho riêng, thêm giỏ hàng, chọn cổng thanh toán/vận chuyển mô phỏng.</p>
      <button class="btn" onclick="go('/ingredients')">Mở cửa hàng nguyên liệu</button>
    </div>
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
        <span style="flex:1;${i.bought ? "text-decoration:line-through;opacity:.55" : ""}"><b>${esc(i.name)}</b> ${esc(i.quantity || "")}
        </span>
        <button class="btn danger small" onclick="Pages._delShop(${i.id})">✕</button>
      </div>`,
          )
          .join("") || '<div class="empty">Danh sách trống</div>'
      }
    </div>`;
};
Pages._checkoutGroceries = async () => {
  try {
    const result = await API.post("/marketplace/grocery-checkout", {
      recipientName: document.getElementById("groceryRecipient").value,
      phone: document.getElementById("groceryPhone").value,
      address: document.getElementById("groceryAddress").value,
      note: document.getElementById("groceryNote").value,
    });
    location.href = result.paymentUrl;
  } catch (e) { toast(e.message); }
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
  if (!API.user || API.user.role !== "admin") {
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
    "commerce",
    "grocery",
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
              commerce: "🛍️ Thương mại",
              grocery: "📦 Đơn nguyên liệu",
              logs: "📜 Nhật ký",
            }[t]
          }</button>`,
      )
      .join("")}</div>
    <div id="atab"></div>`;
  const initialTab = sessionStorage.getItem("adminReturnTab") || "dashboard";
  sessionStorage.removeItem("adminReturnTab");
  Pages._atab(initialTab);
};
Pages._atab = async (t) => {
  document
    .querySelectorAll(".tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.t === t));
  const el = document.getElementById("atab");
  const canManage = API.user?.role === "admin";
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
    Pages._adminUsers = users;
    el.innerHTML = `${canManage ? '<button class="btn" onclick="Pages._adminCreateUser()">＋ Thêm tài khoản</button>' : ""}
      <table style="margin-top:12px"><tr><th>ID</th><th>Tên</th><th>Email</th><th>Quyền</th><th>Trạng thái</th><th>Món</th><th>Hành động</th></tr>
      ${users
        .map(
          (
            u,
          ) => `<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td>
        <td>${esc(u.role)}</td><td>${u.status === "locked" ? "🔒 Bị khóa" : "✅ Active"}</td><td>${u.recipes}</td>
        <td>${canManage ? `<button class="btn secondary small" onclick="Pages._adminEditUser(${u.id})">✏️ Sửa</button>
        <button class="btn danger small" onclick="Pages._adminDeleteUser(${u.id})">Xóa</button>` : ""}</td></tr>`,
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
        ${r.is_premium ? `<span class="badge">Premium · ${Number(r.price).toLocaleString("vi-VN")} ₫</span>` : ""}
        <button class="btn small" onclick="Pages._approve(${r.id},1)">✅ Duyệt</button>
        <button class="btn danger small" onclick="Pages._approve(${r.id},0)">❌ Từ chối</button></div>`,
          )
          .join("") || '<p class="muted">Không có công thức chờ duyệt</p>'
      }
      <h3 style="margin-top:16px">🍲 Tất cả công thức</h3>
      ${canManage ? '<button class="btn" onclick="Pages._adminNewRecipe()">＋ Thêm công thức</button>' : ""}
      <table><tr><th>ID</th><th>Tiêu đề</th><th>Tác giả</th><th>⭐</th><th>👁</th><th>Duyệt</th><th></th></tr>
      ${all
        .map(
          (
            r,
          ) => `<tr><td>${r.id}</td><td><a href="#/recipe/${r.id}">${esc(r.title)}</a>${r.is_premium ? `<div class="badge">Premium · ${Number(r.price).toLocaleString("vi-VN")} ₫</div>` : ""}</td><td>${esc(r.username)}</td>
        <td>${r.avg_rating}</td><td>${r.views}</td><td>${r.approved ? "✅" : "⏳"}</td>
        <td>${canManage ? `<button class="btn secondary small" onclick="Pages._adminEditRecipe(${r.id})">Sửa</button>
        <button class="btn danger small" onclick="Pages._delRecipeAd(${r.id})">Xóa</button>` : ""}</td></tr>`,
        )
        .join("")}</table>`;
  }
  if (t === "catalog") {
    const [cats, ings] = await Promise.all([
      API.get("/admin/categories"),
      API.get("/admin/ingredients"),
    ]);
    Pages._adminCategories = cats;
    Pages._adminIngredients = ings;
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="panel"><h3>🗂 Danh mục</h3>
        ${cats
          .map(
            (
              c,
            ) => `<div class="comment">${esc(c.icon)} <b>${esc(c.name)}</b> (${c.count})
            ${canManage ? `<button class="btn secondary small" style="float:right;margin-right:6px" onclick="Pages._adminEditCategory(${c.id})">Sửa</button>
            <button class="btn danger small" style="float:right" onclick="Pages._delCat(${c.id})">✕</button>` : ""}</div>`,
          )
          .join("")}
        ${canManage ? '<div style="display:flex;gap:8px;margin-top:10px"><input id="ncName" placeholder="Tên danh mục"><input id="ncIcon" placeholder="Icon" style="width:70px"><button class="btn small" onclick="Pages._addCat()">Thêm</button></div>' : ""}</div>
      <div class="panel"><h3>🥕 Nguyên liệu</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${ings.map((i) => `<span class="badge">${esc(i.name)} · ${Number(i.unit_price || 0).toLocaleString("vi-VN")} ₫/dòng ${canManage ? `<a onclick="Pages._adminEditIngredient(${i.id})" title="Sửa">✏️</a> <a onclick="Pages._delIng(${i.id})" title="Xóa">✕</a>` : ""}</span>`).join("")}</div>
        ${canManage ? '<div style="display:flex;gap:8px;margin-top:10px"><input id="niName" placeholder="Nguyên liệu mới"><input id="niPrice" type="number" min="0" max="99999999" placeholder="Giá/dòng (₫)"><button class="btn small" onclick="Pages._addIng2()">Thêm</button></div>' : ""}</div></div>`;
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
        <td>${canManage ? `<button class="btn danger small" onclick="Pages._delCm('${c.rid}')">Xóa</button>` : ""}</td></tr>`,
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
  if (t === "commerce") {
    el.innerHTML = `<div class="tabs" id="commerceTabs">
      ${[
        ["suppliers", "Nhà cung cấp"],
        ["products", "Sản phẩm & kho"],
        ["orders", "Đơn hàng"],
        ["payments", "Giao dịch"],
        ["shipments", "Vận chuyển"],
        ["wallet", "Creator & hoa hồng"],
      ].map(([key, label], index) => `<button data-commerce-tab="${key}" class="${index === 0 ? "active" : ""}" onclick="Pages._adminCommerceTab('${key}')">${label}</button>`).join("")}
    </div><div id="commerceDetail"></div>`;
    await Pages._adminCommerceTab("suppliers");
  }
  if (t === "logs") {
    const logs = await API.get("/admin/logs");
    el.innerHTML = `<table><tr><th>Thời gian</th><th>User</th><th>Hành động</th><th>Chi tiết</th></tr>
      ${logs.map((l) => `<tr><td>${esc(l.created_at)}</td><td>${esc(l.username || "-")}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join("")}</table>`;
  }
  if (t === "grocery") {
    const orders = await API.get("/admin/grocery-orders");
    const statusLabels = {
      pending: "Chờ thanh toán",
      paid: "Đã thanh toán",
      failed: "Thanh toán thất bại",
      expired: "Hết hạn",
    };
    el.innerHTML = orders.length ? `<div class="panel">${orders.map((order) => `<div class="comment">
      <b>Đơn #${order.id}</b> · User #${order.user_id} · ${Number(order.total_amount).toLocaleString("vi-VN")} ₫ · ${esc(statusLabels[order.status] || order.status)}
      <div>Người nhận: ${esc(order.recipient_name)} · ${esc(order.phone)}</div>
      <div>Địa chỉ: ${esc(order.delivery_address)}</div>
      ${order.delivery_note ? `<div>Ghi chú: ${esc(order.delivery_note)}</div>` : ""}
      <ul>${order.items.map((item) => `<li>${esc(item.name)} ${esc(item.quantity || "")} · ${Number(item.price).toLocaleString("vi-VN")} ₫</li>`).join("")}</ul>
      <div class="muted">${esc(order.created_at)}${order.paid_at ? ` · Thanh toán: ${esc(order.paid_at)}` : ""}</div>
    </div>`).join("")}</div>` : '<div class="empty">Chưa có đơn nguyên liệu.</div>';
  }
};
Pages._adminCommerceTab = async (tab) => {
  document.querySelectorAll("#commerceTabs button").forEach((button) =>
    button.classList.toggle("active", button.dataset.commerceTab === tab),
  );
  const el = document.getElementById("commerceDetail");
  if (!el) return;
  el.innerHTML = '<div class="empty">Đang tải...</div>';
  try {
    if (tab === "suppliers") {
      const suppliers = await API.get("/admin/commerce/suppliers");
      el.innerHTML = `<button class="btn small" onclick="Pages._adminAddSupplier()">＋ Nhà cung cấp</button>
        <div class="panel" style="margin-top:12px">${suppliers.map((supplier) => `<div class="comment" style="display:flex;gap:12px;align-items:center">
          <div style="flex:1"><b>${esc(supplier.name)}</b> · ${esc(supplier.code)}<div class="muted">${esc(supplier.provider_key)} · ${supplier.product_count} sản phẩm · ${supplier.is_active ? "Đang hoạt động" : "Đã tắt"}</div></div>
          <button class="btn secondary small" onclick="Pages._adminToggleSupplier(${supplier.id},${!supplier.is_active})">${supplier.is_active ? "Tắt" : "Bật"}</button>
        </div>`).join("")}</div>`;
    } else if (tab === "products") {
      const [products, suppliers] = await Promise.all([
        API.get("/admin/commerce/products"),
        API.get("/admin/commerce/suppliers"),
      ]);
      el.innerHTML = `<button class="btn small" onclick="Pages._adminAddCommerceProduct()">＋ Sản phẩm</button>
        <table style="margin-top:12px"><tr><th>Sản phẩm / nhà cung cấp</th><th>SKU</th><th>Giá</th><th>Tồn / giữ / còn</th><th>Trạng thái</th><th></th></tr>
        ${products.map((product) => `<tr><td>${esc(product.name)} · ${esc(product.unit)}<div class="muted">${esc(product.supplier_name)}</div></td>
          <td>${esc(product.sku)}</td><td>${Number(product.price).toLocaleString("vi-VN")} ₫</td>
          <td>${product.stock_on_hand} / ${product.reserved_quantity} / ${product.available_stock}</td><td>${product.is_active ? "Đang bán" : "Đã tắt"}</td>
          <td><button class="btn secondary small" onclick="Pages._adminEditCommerceProduct(${product.id})">Sửa</button></td></tr>`).join("")}</table>`;
      Pages._commerceAdminProducts = products;
      Pages._commerceAdminSuppliers = suppliers;
    } else if (tab === "orders") {
      const orders = await API.get("/admin/commerce/orders");
      el.innerHTML = orders.length ? `<div class="panel">${orders.map((order) => `<div class="comment">
        <b>Đơn #${order.id}</b> · ${esc(order.username)} · ${Number(order.total_amount).toLocaleString("vi-VN")} ₫ · ${esc(order.status)}
        <div>${esc(order.recipient_name)} · ${esc(order.phone)} · ${esc(order.delivery_address)}</div>
        <ul>${order.items.map((item) => `<li>${esc(item.supplier_name)}: ${esc(item.product_name)} · ${item.quantity} ${esc(item.unit)} × ${Number(item.unit_price).toLocaleString("vi-VN")} ₫</li>`).join("")}</ul>
        <div class="muted">Thanh toán ${esc(order.paid_provider || "-")} · Giao ${esc(order.shipment_provider || "-")} · ${esc(order.tracking_number || "Chưa có mã vận đơn")}</div>
      </div>`).join("")}</div>` : '<div class="empty">Chưa có đơn hàng.</div>';
    } else if (tab === "payments") {
      const payments = await API.get("/admin/commerce/payments");
      el.innerHTML = payments.length ? `<div class="panel">${payments.map((payment) => `<div class="comment">
        <b>${payment.order_type === "recipe" ? "Công thức" : "Nguyên liệu"} · Đơn #${payment.order_id}</b> · ${esc(payment.username)}
        <div>${esc(payment.provider)} · ${Number(payment.amount).toLocaleString("vi-VN")} ₫ · ${esc(payment.status)} · Ref ${esc(payment.reference)}</div>
        <div class="muted">${esc(payment.created_at)} ${payment.transaction_ref ? `· ${esc(payment.transaction_ref)}` : ""}</div>
        ${payment.status === "paid" ? `<button class="btn danger small" onclick="Pages._adminRefundPayment(${payment.id},'${payment.order_type}')">Hoàn tiền mô phỏng</button>` : ""}
      </div>`).join("")}</div>` : '<div class="empty">Chưa có giao dịch.</div>';
    } else if (tab === "shipments") {
      const shipments = await API.get("/admin/commerce/shipments");
      el.innerHTML = shipments.length ? `<div class="panel">${shipments.map((shipment) => `<div class="comment">
        <b>Đơn #${shipment.order_id}</b> · ${esc(shipment.provider)} (mô phỏng) · ${esc(shipment.tracking_number)} · ${esc(shipment.status)}
        <div>${esc(shipment.recipient_name)} · ${esc(shipment.phone)} · ${esc(shipment.delivery_address)}</div>
        ${!["delivered", "returned", "cancelled"].includes(shipment.status) ? `<button class="btn small" onclick="Pages._adminAdvanceShipment(${shipment.id})">Chuyển trạng thái tiếp</button>
          <button class="btn danger small" onclick="Pages._adminCancelShipment(${shipment.id})">Hủy vận đơn</button>` : ""}
      </div>`).join("")}</div>` : '<div class="empty">Chưa có vận đơn.</div>';
    } else if (tab === "wallet") {
      const data = await API.get("/admin/commerce/commission");
      el.innerHTML = `<div class="panel">
        <h3>Cấu hình hoa hồng nền tảng</h3>
        <p>Hiện tại: <b>${Number(data.commissionRateBps) / 100}%</b>. Tỷ lệ mới chỉ áp dụng cho đơn tạo sau khi lưu.</p>
        <div style="display:flex;gap:8px;align-items:center"><input id="adminCommissionPercent" type="number" min="0" max="50" step="0.01" value="${Number(data.commissionRateBps) / 100}" style="width:160px"><span>%</span>
          <button class="btn small" onclick="Pages._adminSaveCommission()">Lưu tỷ lệ</button></div>
        <h3>Ví Creator và hoa hồng đã ghi nhận</h3>
        <table><tr><th>Creator</th><th>Khả dụng</th><th>Đang giữ</th><th>Thu nhập ròng</th><th>Đã rút</th><th>Hoa hồng nền tảng</th></tr>
          ${data.creators.map((creator) => `<tr><td>${esc(creator.username)}</td><td>${Number(creator.available_balance || 0).toLocaleString("vi-VN")} ₫</td><td>${Number(creator.held_balance || 0).toLocaleString("vi-VN")} ₫</td><td>${Number(creator.total_earned || 0).toLocaleString("vi-VN")} ₫</td><td>${Number(creator.total_withdrawn || 0).toLocaleString("vi-VN")} ₫</td><td>${Number(creator.platform_commission || 0).toLocaleString("vi-VN")} ₫</td></tr>`).join("")}</table>
      </div>
      <h3>Yêu cầu rút tiền (chi trả mô phỏng)</h3>
      ${data.withdrawals.length ? `<div class="panel">${data.withdrawals.map((request) => `<div class="comment">
        <b>#${request.id} · ${esc(request.username)}</b> · ${Number(request.amount).toLocaleString("vi-VN")} ₫ · ${esc(request.status)}
        <div>${esc(request.bank_name)} · ${esc(request.bank_account)} · ${esc(request.account_name)}</div>
        ${request.admin_note ? `<div class="muted">${esc(request.admin_note)}</div>` : ""}
        ${request.status === "pending" ? `<button class="btn small" onclick="Pages._adminDecideWithdrawal(${request.id},'approve')">Duyệt chi trả giả lập</button>
          <button class="btn danger small" onclick="Pages._adminDecideWithdrawal(${request.id},'reject')">Từ chối</button>` : ""}
      </div>`).join("")}</div>` : '<div class="empty">Chưa có yêu cầu rút tiền.</div>'}
      <h3>Sổ cái giao dịch và hoa hồng</h3>
      ${data.ledger.length ? `<div class="panel">${data.ledger.map((entry) => `<div class="comment">${esc(entry.username)} · ${esc(entry.event_type)} · Gộp ${Number(entry.gross_amount).toLocaleString("vi-VN")} ₫ · Phí ${Number(entry.commission_amount).toLocaleString("vi-VN")} ₫ · Thực nhận ${Number(entry.net_amount).toLocaleString("vi-VN")} ₫ · ${Number(entry.commission_rate_bps) / 100}% · ${esc(entry.created_at)}</div>`).join("")}</div>` : '<div class="empty">Chưa có bút toán.</div>'}`;
    }
  } catch (e) {
    el.innerHTML = `<div class="empty">Không tải được dữ liệu: ${esc(e.message)}</div>`;
  }
};
Pages._adminToggleSupplier = async (id, isActive) => {
  try {
    await API.put(`/admin/commerce/suppliers/${id}`, { is_active: isActive });
    await Pages._adminCommerceTab("suppliers");
  } catch (e) { toast(e.message); }
};
Pages._adminAddSupplier = () => openModal(
  "Thêm nhà cung cấp",
  `<label>Mã định danh</label><input id="newSupplierCode" maxlength="40" style="width:100%">
  <label>Tên nhà cung cấp</label><input id="newSupplierName" maxlength="150" style="width:100%">
  <label>Provider key</label><input id="newSupplierProvider" maxlength="40" placeholder="Tên adapter tương lai" style="width:100%">
  <button class="btn" style="margin-top:12px" onclick="Pages._saveNewSupplier()">Thêm</button>`,
);
Pages._saveNewSupplier = async () => {
  try {
    await API.post("/admin/commerce/suppliers", {
      code: document.getElementById("newSupplierCode").value,
      name: document.getElementById("newSupplierName").value,
      provider_key: document.getElementById("newSupplierProvider").value,
    });
    document.getElementById("modal-ov")?.remove();
    await Pages._adminCommerceTab("suppliers");
  } catch (e) { toast(e.message); }
};
Pages._adminAddCommerceProduct = () => {
  const suppliers = Pages._commerceAdminSuppliers || [];
  openModal(
    "Thêm sản phẩm",
    `<label>Nhà cung cấp</label><select id="newProductSupplier" style="width:100%">${suppliers.filter((s) => s.is_active).map((supplier) => `<option value="${supplier.id}">${esc(supplier.name)}</option>`).join("")}</select>
    <label>SKU</label><input id="newProductSku" maxlength="80" style="width:100%">
    <label>Tên</label><input id="newProductName" maxlength="150" style="width:100%">
    <label>Đơn vị đóng gói</label><input id="newProductUnit" maxlength="50" style="width:100%">
    <label>Giá</label><input id="newProductPrice" type="number" min="0" max="99999999" style="width:100%">
    <label>Tồn kho</label><input id="newProductStock" type="number" min="0" max="1000000" style="width:100%">
    <button class="btn" style="margin-top:12px" onclick="Pages._saveNewCommerceProduct()">Thêm</button>`,
  );
};
Pages._saveNewCommerceProduct = async () => {
  try {
    await API.post("/admin/commerce/products", {
      supplier_id: Number(document.getElementById("newProductSupplier").value),
      sku: document.getElementById("newProductSku").value,
      name: document.getElementById("newProductName").value,
      unit: document.getElementById("newProductUnit").value,
      price: Number(document.getElementById("newProductPrice").value),
      stock_on_hand: Number(document.getElementById("newProductStock").value),
    });
    document.getElementById("modal-ov")?.remove();
    await Pages._adminCommerceTab("products");
  } catch (e) { toast(e.message); }
};
Pages._adminEditCommerceProduct = (id) => {
  const product = (Pages._commerceAdminProducts || []).find((item) => item.id === id);
  if (!product) return toast("Không tìm thấy sản phẩm");
  openModal(
    "Cập nhật giá và tồn kho",
    `<label>Tên</label><input id="editProductName" maxlength="150" value="${esc(product.name)}" style="width:100%">
    <label>Đơn vị đóng gói</label><input id="editProductUnit" maxlength="50" value="${esc(product.unit)}" style="width:100%">
    <label>Giá</label><input id="editProductPrice" type="number" min="0" max="99999999" value="${product.price}" style="width:100%">
    <label>Tồn kho (đang giữ: ${product.reserved_quantity})</label><input id="editProductStock" type="number" min="${product.reserved_quantity}" max="1000000" value="${product.stock_on_hand}" style="width:100%">
    <label><input id="editProductActive" type="checkbox" ${product.is_active ? "checked" : ""}> Đang bán</label>
    <button class="btn" style="margin-top:12px" onclick="Pages._saveCommerceProduct(${id})">Lưu</button>`,
  );
};
Pages._saveCommerceProduct = async (id) => {
  try {
    await API.put(`/admin/commerce/products/${id}`, {
      name: document.getElementById("editProductName").value,
      unit: document.getElementById("editProductUnit").value,
      price: Number(document.getElementById("editProductPrice").value),
      stock_on_hand: Number(document.getElementById("editProductStock").value),
      is_active: document.getElementById("editProductActive").checked,
    });
    document.getElementById("modal-ov")?.remove();
    await Pages._adminCommerceTab("products");
  } catch (e) { toast(e.message); }
};
Pages._adminRefundPayment = async (id, orderType) => {
  if (!confirm("Xác nhận hoàn tiền mô phỏng? Việc này cập nhật trạng thái và số dư/kho, không chuyển tiền thật.")) return;
  try {
    await API.post(orderType === "recipe"
      ? `/admin/commerce/recipe-payments/${id}/refund`
      : `/admin/commerce/payments/${id}/refund`, {});
    await Pages._adminCommerceTab("payments");
  } catch (e) { toast(e.message); }
};
Pages._adminAdvanceShipment = async (id) => {
  try {
    await API.post(`/admin/commerce/shipments/${id}/advance`, {});
    await Pages._adminCommerceTab("shipments");
  } catch (e) { toast(e.message); }
};
Pages._adminCancelShipment = async (id) => {
  if (!confirm("Hủy vận đơn mô phỏng này?")) return;
  try {
    await API.post(`/admin/commerce/shipments/${id}/cancel`, {});
    await Pages._adminCommerceTab("shipments");
  } catch (e) { toast(e.message); }
};
Pages._adminSaveCommission = async () => {
  try {
    await API.put("/admin/commerce/commission", {
      percent: Number(document.getElementById("adminCommissionPercent").value),
    });
    toast("Đã cập nhật tỷ lệ; tỷ lệ đơn cũ được giữ nguyên");
    await Pages._adminCommerceTab("wallet");
  } catch (e) { toast(e.message); }
};
Pages._adminDecideWithdrawal = async (id, decision) => {
  const note = prompt(decision === "approve" ? "Ghi chú chi trả mô phỏng (không chuyển khoản thật):" : "Lý do từ chối:");
  if (note === null) return;
  try {
    await API.post(`/admin/commerce/withdrawals/${id}/decision`, { decision, note });
    await Pages._adminCommerceTab("wallet");
  } catch (e) { toast(e.message); }
};
Pages._broadcast = async () => {
  const r = await API.post("/admin/broadcast", {
    message: document.getElementById("bcMsg").value,
  });
  toast(`Đã gửi tới ${r.sent} người dùng`);
};
Pages._adminCreateUser = () => {
  openModal(
    "Thêm tài khoản",
    `<label>Tên đăng nhập</label><input id="adminUserName" maxlength="100" style="width:100%">
    <label>Email</label><input id="adminUserEmail" type="email" maxlength="150" style="width:100%">
    <label>Tên hiển thị</label><input id="adminUserDisplayName" maxlength="150" style="width:100%">
    <label>Mật khẩu tạm thời (ít nhất 8 ký tự)</label><input id="adminUserPassword" type="password" minlength="8" style="width:100%">
    <label>Quyền</label><select id="adminUserRole" style="width:100%"><option value="user">Người dùng</option><option value="creator">Creator</option><option value="moderator">Điều hành viên</option><option value="admin">Quản trị viên</option></select>
    <button class="btn" style="margin-top:12px" onclick="Pages._adminSaveNewUser()">Tạo tài khoản</button>`,
  );
};
Pages._adminSaveNewUser = async () => {
  const value = (id) => document.getElementById(id)?.value.trim() || "";
  try {
    await API.post("/admin/users", {
      username: value("adminUserName"),
      email: value("adminUserEmail"),
      display_name: value("adminUserDisplayName"),
      password: document.getElementById("adminUserPassword")?.value || "",
      role: value("adminUserRole"),
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã tạo tài khoản");
    await Pages._atab("users");
  } catch (e) {
    toast(e.message);
  }
};
Pages._adminEditUser = (id) => {
  const user = (Pages._adminUsers || []).find((item) => item.id === id);
  if (!user) return toast("Không tìm thấy tài khoản");
  openModal(
    "Chỉnh sửa tài khoản",
    `<label>Tên đăng nhập</label><input id="adminUserName" maxlength="100" value="${esc(user.username)}" style="width:100%">
    <label>Email</label><input id="adminUserEmail" type="email" maxlength="150" value="${esc(user.email)}" style="width:100%">
    <label>Tên hiển thị</label><input id="adminUserDisplayName" maxlength="150" value="${esc(user.display_name || "")}" style="width:100%">
    <label>Quyền</label><select id="adminUserRole" style="width:100%">
      <option value="user" ${user.role === "user" ? "selected" : ""}>Người dùng</option>
      <option value="creator" ${user.role === "creator" ? "selected" : ""}>Creator</option>
      <option value="moderator" ${user.role === "moderator" ? "selected" : ""}>Điều hành viên</option>
      <option value="admin" ${user.role === "admin" ? "selected" : ""}>Quản trị viên</option>
    </select>
    <label>Trạng thái</label><select id="adminUserStatus" style="width:100%">
      <option value="active" ${user.status === "active" ? "selected" : ""}>Đang hoạt động</option>
      <option value="locked" ${user.status === "locked" ? "selected" : ""}>Đã khóa</option>
    </select>
    <button class="btn" style="margin-top:12px" onclick="Pages._adminSaveUser(${user.id})">Lưu thay đổi</button>`,
  );
};
Pages._adminSaveUser = async (id) => {
  const value = (field) => document.getElementById(field)?.value.trim() || "";
  try {
    await API.put(`/admin/users/${id}`, {
      username: value("adminUserName"),
      email: value("adminUserEmail"),
      display_name: value("adminUserDisplayName"),
      role: value("adminUserRole"),
      status: value("adminUserStatus"),
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã cập nhật tài khoản");
    await Pages._atab("users");
  } catch (e) {
    toast(e.message);
  }
};
Pages._adminDeleteUser = async (id) => {
  if (!confirm("Xóa vĩnh viễn tài khoản và nội dung do tài khoản này tạo? Nhật ký quản trị sẽ được giữ lại.")) return;
  try {
    await API.del(`/admin/users/${id}`);
    toast("Đã xóa tài khoản và nội dung liên quan");
    await Pages._atab("users");
  } catch (e) {
    toast(e.message);
  }
};
Pages._adminNewRecipe = () => {
  sessionStorage.setItem("adminReturnTab", "recipes");
  go("/new-recipe");
};
Pages._adminEditRecipe = (id) => {
  sessionStorage.setItem("adminReturnTab", "recipes");
  go(`/edit-recipe/${id}`);
};
Pages._adminEditCategory = (id) => {
  const category = (Pages._adminCategories || []).find((item) => item.id === id);
  if (!category) return toast("Không tìm thấy danh mục");
  openModal(
    "Chỉnh sửa danh mục",
    `<label>Tên danh mục</label><input id="adminCategoryName" maxlength="100" value="${esc(category.name)}" style="width:100%">
    <label>Biểu tượng</label><input id="adminCategoryIcon" maxlength="10" value="${esc(category.icon || "")}" style="width:100%">
    <button class="btn" style="margin-top:12px" onclick="Pages._adminSaveCategory(${category.id})">Lưu thay đổi</button>`,
  );
};
Pages._adminSaveCategory = async (id) => {
  try {
    await API.put(`/admin/categories/${id}`, {
      name: document.getElementById("adminCategoryName").value,
      icon: document.getElementById("adminCategoryIcon").value,
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã cập nhật danh mục");
    await Pages._atab("catalog");
  } catch (e) {
    toast(e.message);
  }
};
Pages._adminEditIngredient = async (id) => {
  const ingredient = (Pages._adminIngredients || []).find((item) => item.id === id);
  if (!ingredient) return toast("Không tìm thấy nguyên liệu");
  openModal(
    "Chỉnh sửa nguyên liệu",
    `<label>Tên nguyên liệu</label><input id="adminIngredientName" maxlength="150" value="${esc(ingredient.name)}" style="width:100%">
    <label>Giá theo dòng nguyên liệu (VNĐ)</label><input id="adminIngredientPrice" type="number" min="0" max="99999999" value="${Number(ingredient.unit_price || 0)}" style="width:100%">
    <button class="btn" style="margin-top:12px" onclick="Pages._adminSaveIngredient(${ingredient.id})">Lưu thay đổi</button>`,
  );
};
Pages._adminSaveIngredient = async (id) => {
  try {
    await API.put(`/admin/ingredients/${id}`, {
      name: document.getElementById("adminIngredientName").value,
      unit_price: Number(document.getElementById("adminIngredientPrice").value),
    });
    document.getElementById("modal-ov")?.remove();
    toast("Đã cập nhật nguyên liệu");
    await Pages._atab("catalog");
  } catch (e) {
    toast(e.message);
  }
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
    try {
      await API.del("/admin/recipes/" + id);
      toast("Đã xóa công thức");
      Pages._atab("recipes");
    } catch (e) {
      toast(e.message);
    }
  }
};
Pages._addCat = async () => {
  try {
    await API.post("/admin/categories", {
      name: document.getElementById("ncName").value,
      icon: document.getElementById("ncIcon").value,
    });
    toast("Đã thêm danh mục");
    Pages._atab("catalog");
  } catch (e) {
    toast(e.message);
  }
};
Pages._delCat = async (id) => {
  try {
    await API.del("/admin/categories/" + id);
    toast("Đã xóa danh mục");
    Pages._atab("catalog");
  } catch (e) {
    toast(e.message);
  }
};
Pages._addIng2 = async () => {
  try {
    await API.post("/admin/ingredients", {
      name: document.getElementById("niName").value,
      unit_price: Number(document.getElementById("niPrice").value || 0),
    });
    toast("Đã thêm nguyên liệu");
    Pages._atab("catalog");
  } catch (e) {
    toast(e.message);
  }
};
Pages._delIng = async (id) => {
  if (!confirm("Xóa nguyên liệu này khỏi danh mục nguyên liệu?")) return;
  try {
    await API.del("/admin/ingredients/" + id);
    toast("Đã xóa nguyên liệu");
    Pages._atab("catalog");
  } catch (e) {
    toast(e.message);
  }
};
Pages._delCm = async (rid) => {
  await API.del("/admin/comments/" + rid);
  Pages._atab("comments");
};
Pages._resolve = async (id) => {
  await API.put("/admin/reports/" + id, { status: "resolved" });
  Pages._atab("reports");
};

// Admin (SQL Server): dashboard, quan ly user, recipe, category, comment, report, phan quyen, log
const express = require("express");
const bcrypt = require("bcryptjs");
const { query, exec, get } = require("../db/database");
const { authRequired, log } = require("../middleware");
const { schemaReady: marketplaceSchemaReady } = require("./marketplace");
const { schemaReady: commerceSchemaReady } = require("./commerce");
const mockCommerce = require("../providers/commerce/mock");

const router = express.Router();

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(e.statusCode || 500).json({ error: e.message }));
const adminRoleOnly = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Chỉ quản trị viên mới được thực hiện thao tác này" });
  next();
};
router.use(authRequired, adminRoleOnly);
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const text = (value) => (typeof value === "string" ? value.trim() : "");

async function deleteRecipeData(recipeId) {
  await exec(
    `SET XACT_ABORT ON;
     BEGIN TRY
       BEGIN TRANSACTION;
       DELETE FROM reports WHERE recipe_id=? OR rating_id IN (SELECT rowid FROM ratings WHERE recipe_id=?);
       DELETE FROM comment_likes WHERE rating_id IN (SELECT rowid FROM ratings WHERE recipe_id=?);
       DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE recipe_id=?);
       UPDATE posts SET recipe_id=NULL WHERE recipe_id=?;
       DELETE FROM meal_plans WHERE recipe_id=?;
       DELETE FROM favorites WHERE recipe_id=?;
       DELETE FROM collection_items WHERE recipe_id=?;
       DELETE FROM ratings WHERE recipe_id=?;
       DELETE FROM recipe_ingredients WHERE recipe_id=?;
       DELETE FROM recipe_steps WHERE recipe_id=?;
       DELETE FROM recipes WHERE id=?;
       COMMIT TRANSACTION;
     END TRY
     BEGIN CATCH
       IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
       THROW;
     END CATCH`,
    [recipeId, recipeId, recipeId, recipeId, recipeId, recipeId, recipeId, recipeId, recipeId, recipeId, recipeId, recipeId],
  );
}

async function deleteUserData(userId) {
  await exec(
    `SET XACT_ABORT ON;
     BEGIN TRY
       BEGIN TRANSACTION;
       DECLARE @recipeIds TABLE (id INT PRIMARY KEY);
       DECLARE @postIds TABLE (id INT PRIMARY KEY);
       DECLARE @ratingIds TABLE (id INT PRIMARY KEY);
       DECLARE @collectionIds TABLE (id INT PRIMARY KEY);
       INSERT INTO @recipeIds SELECT id FROM recipes WHERE user_id=?;
       INSERT INTO @postIds SELECT id FROM posts WHERE user_id=?;
       INSERT INTO @ratingIds SELECT rowid FROM ratings
         WHERE user_id=? OR recipe_id IN (SELECT id FROM @recipeIds);
       INSERT INTO @collectionIds SELECT id FROM collections WHERE user_id=?;
       DELETE FROM reports WHERE user_id=? OR recipe_id IN (SELECT id FROM @recipeIds)
         OR rating_id IN (SELECT id FROM @ratingIds);
       DELETE FROM comment_likes WHERE user_id=? OR rating_id IN (SELECT id FROM @ratingIds);
       DELETE FROM post_likes WHERE user_id=? OR post_id IN (SELECT id FROM @postIds);
       UPDATE posts SET recipe_id=NULL WHERE recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM posts WHERE user_id=?;
       DELETE FROM shopping_items WHERE user_id=?;
       DELETE FROM meal_plans WHERE user_id=? OR recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM marketplace_cart_items WHERE recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM favorites WHERE user_id=? OR recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM collection_items WHERE collection_id IN (SELECT id FROM @collectionIds)
         OR recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM collections WHERE user_id=?;
       DELETE FROM ratings WHERE user_id=? OR recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM recipe_steps WHERE recipe_id IN (SELECT id FROM @recipeIds);
       DELETE FROM recipes WHERE user_id=?;
       DELETE FROM follows WHERE follower_id=? OR following_id=?;
       DELETE FROM password_resets WHERE user_id=?;
       DELETE FROM notifications WHERE user_id=?;
       UPDATE activity_logs SET user_id=NULL WHERE user_id=?;
       DELETE FROM users WHERE id=?;
       COMMIT TRANSACTION;
     END TRY
     BEGIN CATCH
       IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
       THROW;
     END CATCH`,
    Array(20).fill(userId),
  );
}

router.get("/stats", wrap(async (_req, res) => {
  const [counts, topRecipes, newUsers] = await Promise.all([
    get(`SELECT
      (SELECT COUNT(*) FROM users) users,
      (SELECT COUNT(*) FROM recipes) recipes,
      (SELECT COUNT(*) FROM recipes WHERE approved=0) pending,
      (SELECT COUNT(*) FROM ratings) comments,
      (SELECT ISNULL(SUM(views),0) FROM recipes) views,
      (SELECT COUNT(*) FROM reports WHERE status='open') reports,
      (SELECT COUNT(*) FROM posts) posts`),
    query("SELECT TOP 5 title,views FROM recipes ORDER BY views DESC"),
    query("SELECT TOP 5 username, created_at FROM users ORDER BY created_at DESC"),
  ]);
  res.json({ ...counts, topRecipes, newUsers });
}));

router.get("/users", wrap(async (_req, res) => {
  res.json(await query(`SELECT id,username,email,display_name,role,status,created_at,
  (SELECT COUNT(*) FROM recipes WHERE user_id=users.id) recipes FROM users ORDER BY id`));
}));

router.post("/users", adminRoleOnly, wrap(async (req, res) => {
  const username = text(req.body.username);
  const email = text(req.body.email).toLowerCase();
  const displayName = text(req.body.display_name) || username;
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const role = req.body.role || "user";
  if (!username || username.length > 100 || !email || email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 ||
      displayName.length > 150 || !["user", "creator", "moderator", "admin"].includes(role)) {
    throw fail(400, "Thông tin tài khoản không hợp lệ; mật khẩu cần ít nhất 8 ký tự");
  }
  if (await get("SELECT id FROM users WHERE username=? OR email=?", username, email))
    throw fail(409, "Tên đăng nhập hoặc email đã được sử dụng");
  const id = (await exec(
    "INSERT INTO users (username,email,password_hash,display_name,role,verified) VALUES (?,?,?,?,?,1)",
    [username, email, bcrypt.hashSync(password, 10), displayName, role],
  )).insertId;
  log(req.user.id, "admin_create_user", `user #${id}`);
  res.status(201).json({ id, ok: true });
}));

router.put("/users/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Tài khoản không hợp lệ");
  const u = await get("SELECT id,username,email,display_name,role,status FROM users WHERE id=?", id);
  if (!u) throw fail(404, "Không tìm thấy tài khoản");
  const { role, status } = req.body;
  const username = req.body.username === undefined ? u.username : text(req.body.username);
  const email = req.body.email === undefined ? u.email : text(req.body.email).toLowerCase();
  const displayName = req.body.display_name === undefined ? u.display_name : text(req.body.display_name);
  if (!username || username.length > 100 || !email || email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length > 150 ||
      (role !== undefined && !["user", "creator", "moderator", "admin"].includes(role)) ||
      (status !== undefined && !["active", "locked"].includes(status))) {
    throw fail(400, "Thông tin tài khoản không hợp lệ");
  }
  if (await get("SELECT id FROM users WHERE (username=? OR email=?) AND id<>?", username, email, id))
    throw fail(409, "Tên đăng nhập hoặc email đã được sử dụng");
  if (id === req.user.id && ((role && role !== "admin") || (status && status !== "active")))
    throw fail(400, "Không thể tự hạ quyền hoặc khóa tài khoản đang đăng nhập");
  if (u.role === "admin" && role && role !== "admin" &&
      Number((await get("SELECT COUNT(*) c FROM users WHERE role='admin' AND status='active'")).c) <= 1)
    throw fail(409, "Không thể hạ quyền quản trị viên cuối cùng");
  await exec(
    "UPDATE users SET username=?,email=?,display_name=?,role=?,status=? WHERE id=?",
    [username, email, displayName, role || u.role, status || u.status, id],
  );
  log(req.user.id, "admin_update_user", `user #${id}`);
  res.json({ ok: true });
}));

router.delete("/users/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Tài khoản không hợp lệ");
  if (id === req.user.id) throw fail(400, "Không thể xóa tài khoản đang đăng nhập");
  const user = await get("SELECT id,role FROM users WHERE id=?", id);
  if (!user) throw fail(404, "Không tìm thấy tài khoản");
  if (user.role === "admin" &&
      Number((await get("SELECT COUNT(*) c FROM users WHERE role='admin' AND status='active'")).c) <= 1)
    throw fail(409, "Không thể xóa quản trị viên cuối cùng");
  await marketplaceSchemaReady;
  if (await get(
    `SELECT 1 x FROM marketplace_orders WHERE user_id=?
     UNION ALL SELECT 1 x FROM marketplace_order_items WHERE creator_id=?`,
    id, id,
  )) throw fail(409, "Không thể xóa tài khoản có lịch sử mua hoặc bán trên Marketplace");
  await exec("DELETE FROM marketplace_cart_items WHERE user_id=?", id);
  await exec("DELETE FROM creator_profiles WHERE user_id=?", id);
  await deleteUserData(id);
  log(req.user.id, "admin_delete_user", `user #${id}`);
  res.json({ ok: true });
}));

router.get("/recipes", wrap(async (req, res) => {
  await marketplaceSchemaReady;
  const w = req.query.pending === "1" ? " WHERE r.approved=0" : "";
  res.json(await query(
    `SELECT TOP 100 r.id, r.title, r.views, r.approved, r.is_premium, r.price, r.created_at, u.username,
      ISNULL((SELECT AVG(CAST(rt.stars AS FLOAT)) FROM ratings rt WHERE rt.recipe_id=r.id),0) avg_rating
     FROM recipes r JOIN users u ON u.id=r.user_id${w} ORDER BY r.created_at DESC`,
  ));
}));

router.put("/recipes/:id/approve", wrap(async (req, res) => {
  const ap = req.body.approve ? 1 : 0;
  await exec("UPDATE recipes SET approved=? WHERE id=?", [ap, req.params.id]);
  log(req.user.id, ap ? "approve_recipe" : "reject_recipe", `recipe #${req.params.id}`);
  res.json({ ok: true });
}));

router.delete("/recipes/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Công thức không hợp lệ");
  if (!await get("SELECT id FROM recipes WHERE id=?", id)) throw fail(404, "Không tìm thấy công thức");
  await marketplaceSchemaReady;
  if (await get("SELECT 1 x FROM marketplace_order_items WHERE recipe_id=?", id))
    throw fail(409, "Không thể xóa công thức đã có đơn hàng để bảo toàn lịch sử giao dịch");
  await deleteRecipeData(id);
  log(req.user.id, "admin_delete_recipe", `recipe #${id}`);
  res.json({ ok: true });
}));

router.get("/categories", wrap(async (_req, res) => {
  res.json(await query("SELECT c.*, (SELECT COUNT(*) FROM recipes WHERE category_id=c.id) count FROM categories c"));
}));
router.post("/categories", adminRoleOnly, wrap(async (req, res) => {
  const name = text(req.body.name);
  const icon = text(req.body.icon) || "🍲";
  if (!name || name.length > 100 || icon.length > 10) throw fail(400, "Tên hoặc biểu tượng danh mục không hợp lệ");
  if (await get("SELECT id FROM categories WHERE name=?", name)) throw fail(409, "Danh mục đã tồn tại");
  const result = await exec("INSERT INTO categories (name,icon) VALUES (?,?)", name, icon);
  res.status(201).json({ id: result.insertId, ok: true });
}));
router.put("/categories/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const name = text(req.body.name);
  const icon = text(req.body.icon);
  if (!Number.isInteger(id) || id < 1 || !name || name.length > 100 || icon.length > 10)
    throw fail(400, "Tên hoặc biểu tượng danh mục không hợp lệ");
  if (!await get("SELECT id FROM categories WHERE id=?", id)) throw fail(404, "Không tìm thấy danh mục");
  if (await get("SELECT id FROM categories WHERE name=? AND id<>?", name, id))
    throw fail(409, "Tên danh mục đã được sử dụng");
  await exec("UPDATE categories SET name=?,icon=? WHERE id=?", name, icon || "🍲", id);
  res.json({ ok: true });
}));
router.delete("/categories/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Danh mục không hợp lệ");
  if (!await get("SELECT id FROM categories WHERE id=?", id)) throw fail(404, "Không tìm thấy danh mục");
  if (await get("SELECT TOP 1 id FROM recipes WHERE category_id=?", id))
    throw fail(409, "Không thể xóa danh mục đang có công thức");
  await exec("DELETE FROM categories WHERE id=?", id);
  res.json({ ok: true });
}));

router.get("/ingredients", wrap(async (_req, res) => {
  await marketplaceSchemaReady;
  res.json(await query("SELECT * FROM ingredients ORDER BY name"));
}));
router.post("/ingredients", adminRoleOnly, wrap(async (req, res) => {
  await marketplaceSchemaReady;
  const name = text(req.body.name);
  const unitPrice = req.body.unit_price === undefined ? 0 : Number(req.body.unit_price);
  if (!name || name.length > 150 || !Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > 99999999)
    throw fail(400, "Tên nguyên liệu hoặc giá không hợp lệ");
  if (await get("SELECT id FROM ingredients WHERE name=?", name)) throw fail(409, "Nguyên liệu đã tồn tại");
  const result = await exec("INSERT INTO ingredients (name,unit_price) VALUES (?,?)", name, unitPrice);
  res.status(201).json({ id: result.insertId, ok: true });
}));
router.put("/ingredients/:id", adminRoleOnly, wrap(async (req, res) => {
  await marketplaceSchemaReady;
  const id = Number(req.params.id);
  const name = text(req.body.name);
  if (!Number.isInteger(id) || id < 1 || !name || name.length > 150)
    throw fail(400, "Tên nguyên liệu không hợp lệ");
  const ingredient = await get("SELECT id,name,unit_price FROM ingredients WHERE id=?", id);
  if (!ingredient) throw fail(404, "Không tìm thấy nguyên liệu");
  const unitPrice = req.body.unit_price === undefined ? Number(ingredient.unit_price) : Number(req.body.unit_price);
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > 99999999)
    throw fail(400, "Giá nguyên liệu phải từ 0 đến 99.999.999 VNĐ");
  if (await get("SELECT id FROM ingredients WHERE name=? AND id<>?", name, id))
    throw fail(409, "Tên nguyên liệu đã được sử dụng");
  await exec("UPDATE recipe_ingredients SET name=? WHERE name=?", name, ingredient.name);
  await exec("UPDATE ingredients SET name=?,unit_price=? WHERE id=?", name, unitPrice, id);
  res.json({ ok: true });
}));
router.get("/grocery-orders", wrap(async (_req, res) => {
  await marketplaceSchemaReady;
  const orders = await query(`
    SELECT TOP 100 id,user_id,recipient_name,phone,delivery_address,delivery_note,total_amount,status,created_at,paid_at
    FROM grocery_orders ORDER BY created_at DESC
  `);
  for (const order of orders) {
    order.items = await query(
      "SELECT name,quantity,price FROM grocery_order_items WHERE order_id=? ORDER BY id",
      order.id,
    );
  }
  res.json(orders);
}));
router.delete("/ingredients/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Nguyên liệu không hợp lệ");
  if (!await get("SELECT id FROM ingredients WHERE id=?", id)) throw fail(404, "Không tìm thấy nguyên liệu");
  await exec("DELETE FROM ingredients WHERE id=?", id);
  res.json({ ok: true });
}));

router.get("/commerce/suppliers", wrap(async (_req, res) => {
  await commerceSchemaReady;
  res.json(await query(`
    SELECT s.id,s.code,s.name,s.provider_key,s.is_active,s.created_at,
      (SELECT COUNT(*) FROM commerce_products p WHERE p.supplier_id=s.id) AS product_count
    FROM commerce_suppliers s ORDER BY s.name
  `));
}));
router.post("/commerce/suppliers", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const code = text(req.body.code).toUpperCase();
  const name = text(req.body.name);
  const providerKey = text(req.body.provider_key).toLowerCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || !name || name.length > 150 ||
      !/^[a-z0-9_-]{2,40}$/.test(providerKey))
    throw fail(400, "Mã, tên hoặc provider nhà cung cấp không hợp lệ");
  if (await get("SELECT id FROM commerce_suppliers WHERE code=?", code))
    throw fail(409, "Mã nhà cung cấp đã tồn tại");
  const result = await exec(
    "INSERT INTO commerce_suppliers (code,name,provider_key,is_active) VALUES (?,?,?,1)",
    code, name, providerKey,
  );
  res.status(201).json({ id: result.insertId, ok: true });
}));
router.put("/commerce/suppliers/:id", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || typeof req.body.is_active !== "boolean")
    throw fail(400, "Nhà cung cấp hoặc trạng thái không hợp lệ");
  if (!await get("SELECT id FROM commerce_suppliers WHERE id=?", id))
    throw fail(404, "Không tìm thấy nhà cung cấp");
  await exec("UPDATE commerce_suppliers SET is_active=? WHERE id=?", req.body.is_active ? 1 : 0, id);
  res.json({ ok: true });
}));
router.get("/commerce/products", wrap(async (_req, res) => {
  await commerceSchemaReady;
  res.json(await query(`
    SELECT p.id,p.supplier_id,s.name AS supplier_name,p.sku,p.name,p.unit,p.price,
      p.stock_on_hand,p.reserved_quantity,p.stock_on_hand-p.reserved_quantity AS available_stock,p.is_active
    FROM commerce_products p JOIN commerce_suppliers s ON s.id=p.supplier_id
    ORDER BY s.name,p.name
  `));
}));
router.post("/commerce/products", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const supplierId = Number(req.body.supplier_id);
  const sku = text(req.body.sku);
  const name = text(req.body.name);
  const unit = text(req.body.unit);
  const price = Number(req.body.price);
  const stock = Number(req.body.stock_on_hand);
  if (!Number.isInteger(supplierId) || supplierId < 1 || !sku || sku.length > 80 ||
      !name || name.length > 150 || !unit || unit.length > 50 ||
      !Number.isSafeInteger(price) || price < 0 || price > 99999999 ||
      !Number.isInteger(stock) || stock < 0 || stock > 1000000)
    throw fail(400, "Thông tin sản phẩm không hợp lệ");
  if (!await get("SELECT id FROM commerce_suppliers WHERE id=? AND is_active=1", supplierId))
    throw fail(400, "Nhà cung cấp không tồn tại hoặc đang tắt");
  if (await get("SELECT id FROM commerce_products WHERE sku=?", sku))
    throw fail(409, "SKU đã được sử dụng");
  const result = await exec(`
    INSERT INTO commerce_products (supplier_id,sku,name,unit,price,stock_on_hand,is_active)
    VALUES (?,?,?,?,?,?,1)
  `, supplierId, sku, name, unit, price, stock);
  res.status(201).json({ id: result.insertId, ok: true });
}));
router.put("/commerce/products/:id", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const id = Number(req.params.id);
  const name = text(req.body.name);
  const unit = text(req.body.unit);
  const price = Number(req.body.price);
  const stock = Number(req.body.stock_on_hand);
  if (!Number.isInteger(id) || id < 1 || !name || name.length > 150 ||
      !unit || unit.length > 50 || !Number.isSafeInteger(price) ||
      price < 0 || price > 99999999 || !Number.isInteger(stock) || stock < 0 || stock > 1000000 ||
      typeof req.body.is_active !== "boolean")
    throw fail(400, "Thông tin sản phẩm không hợp lệ");
  const product = await get("SELECT id,reserved_quantity FROM commerce_products WHERE id=?", id);
  if (!product) throw fail(404, "Không tìm thấy sản phẩm");
  if (stock < Number(product.reserved_quantity))
    throw fail(409, "Tồn kho không thể thấp hơn số lượng đang được giữ cho đơn chờ thanh toán");
  await exec(`
    UPDATE commerce_products SET name=?,unit=?,price=?,stock_on_hand=?,is_active=? WHERE id=?
  `, name, unit, price, stock, req.body.is_active ? 1 : 0, id);
  res.json({ ok: true });
}));
router.get("/commerce/orders", wrap(async (_req, res) => {
  await commerceSchemaReady;
  const orders = await query(`
    SELECT TOP 200 o.*,u.username,p.provider AS paid_provider,p.status AS payment_status,
      s.provider AS shipment_provider,s.tracking_number,s.status AS shipment_status
    FROM commerce_orders o JOIN users u ON u.id=o.user_id
    LEFT JOIN commerce_payments p ON p.order_id=o.id
    LEFT JOIN commerce_shipments s ON s.order_id=o.id
    ORDER BY o.created_at DESC
  `);
  for (const order of orders) {
    order.items = await query(`
      SELECT sku,product_name,quantity,unit,unit_price,line_total,supplier_name
      FROM commerce_order_items WHERE order_id=? ORDER BY id
    `, order.id);
  }
  res.json(orders);
}));
router.get("/commerce/payments", wrap(async (_req, res) => {
  await commerceSchemaReady;
  const [groceryPayments, recipePayments] = await Promise.all([query(`
    SELECT TOP 300 p.id,p.order_id,p.provider,p.reference,p.amount,p.status,p.transaction_ref,
      p.response_code,p.created_at,p.paid_at,p.refunded_at,u.username,'ingredient' AS order_type
    FROM commerce_payments p JOIN commerce_orders o ON o.id=p.order_id
    JOIN users u ON u.id=o.user_id ORDER BY p.created_at DESC
  `), query(`
    SELECT TOP 300 p.id,p.order_id,p.provider,p.txn_ref AS reference,p.amount,p.status,
      p.provider_txn_no AS transaction_ref,N'' AS response_code,p.created_at,p.paid_at,
      CAST(NULL AS DATETIME) AS refunded_at,u.username,'recipe' AS order_type
    FROM marketplace_payments p JOIN marketplace_orders o ON o.id=p.order_id
    JOIN users u ON u.id=o.user_id ORDER BY p.created_at DESC
  `)]);
  res.json([...groceryPayments, ...recipePayments].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ).slice(0, 300));
}));
router.get("/commerce/shipments", wrap(async (_req, res) => {
  await commerceSchemaReady;
  res.json(await query(`
    SELECT TOP 200 s.id,s.order_id,s.provider,s.tracking_number,s.status,s.shipping_fee,
      s.created_at,s.updated_at,o.recipient_name,o.phone,o.delivery_address
    FROM commerce_shipments s JOIN commerce_orders o ON o.id=s.order_id
    ORDER BY s.created_at DESC
  `));
}));
router.post("/commerce/shipments/:id/advance", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Vận đơn không hợp lệ");
  const shipment = await get("SELECT id,status FROM commerce_shipments WHERE id=?", id);
  if (!shipment) throw fail(404, "Không tìm thấy vận đơn");
  const transition = mockCommerce.shipmentTransitions[shipment.status];
  if (!transition) throw fail(409, "Vận đơn không còn trạng thái để chuyển tiếp");
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE commerce_shipments SET status=?,updated_at=GETDATE() WHERE id=? AND status=?;
    IF @@ROWCOUNT=0 THROW 51004,'Trạng thái vận đơn đã thay đổi.',1;
    INSERT INTO commerce_shipment_events (shipment_id,status,description) VALUES (?,?,?);
    UPDATE commerce_orders SET status=? WHERE id=(SELECT order_id FROM commerce_shipments WHERE id=?);
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, transition.next, id, shipment.status, id, transition.next, transition.label,
  transition.next === "delivered" ? "delivered" : "shipped", id);
  res.json({ ok: true, status: transition.next, label: transition.label });
}));
router.post("/commerce/shipments/:id/cancel", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Vận đơn không hợp lệ");
  const shipment = await get("SELECT id,order_id,status FROM commerce_shipments WHERE id=?", id);
  if (!shipment) throw fail(404, "Không tìm thấy vận đơn");
  if (["delivered", "returned", "cancelled"].includes(shipment.status))
    throw fail(409, "Không thể hủy vận đơn ở trạng thái hiện tại");
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE commerce_shipments SET status='cancelled',updated_at=GETDATE()
      WHERE id=? AND status=?;
    IF @@ROWCOUNT=0 THROW 51006,'Trạng thái vận đơn đã thay đổi.',1;
    INSERT INTO commerce_shipment_events (shipment_id,status,description)
      VALUES (?,'cancelled','Vận đơn mô phỏng đã bị quản trị viên hủy');
    UPDATE commerce_orders SET status='shipping_cancelled' WHERE id=? AND status<>'refunded';
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, id, shipment.status, id, shipment.order_id);
  res.json({ ok: true, status: "cancelled" });
}));
router.post("/commerce/payments/:id/refund", adminRoleOnly, wrap(async (req, res) => {
  await commerceSchemaReady;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Giao dịch không hợp lệ");
  const payment = await get(`
    SELECT p.id,p.order_id,p.status,o.status AS order_status
    FROM commerce_payments p JOIN commerce_orders o ON o.id=p.order_id
    WHERE p.id=?
  `, id);
  if (!payment) throw fail(404, "Không tìm thấy giao dịch");
  if (payment.status !== "paid") throw fail(409, "Chỉ có thể hoàn giao dịch đã thanh toán");
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE commerce_payments SET status='refunded',refunded_at=GETDATE()
      WHERE id=? AND status='paid';
    IF @@ROWCOUNT=0 THROW 51005,'Giao dịch đã được xử lý.',1;
    UPDATE commerce_orders SET status='refunded',refunded_at=GETDATE() WHERE id=?;
    UPDATE p SET stock_on_hand=stock_on_hand+oi.quantity
      FROM commerce_products p JOIN commerce_order_items oi ON oi.product_id=p.id
      JOIN commerce_shipments s ON s.order_id=oi.order_id AND s.status<>'delivered'
      WHERE oi.order_id=?;
    UPDATE commerce_shipments SET status='returned',updated_at=GETDATE()
      WHERE order_id=? AND status<>'delivered';
    INSERT INTO commerce_shipment_events (shipment_id,status,description)
      SELECT id,'returned','Đơn được hoàn tiền; hàng được trả về kho mô phỏng'
      FROM commerce_shipments WHERE order_id=?;
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, id, payment.order_id, payment.order_id, payment.order_id, payment.order_id);
  res.json({ ok: true, status: "refunded" });
}));
router.post("/commerce/recipe-payments/:id/refund", adminRoleOnly, wrap(async (req, res) => {
  await marketplaceSchemaReady;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Giao dịch không hợp lệ");
  const payment = await get(`
    SELECT p.id,p.order_id,p.status,o.status AS order_status
    FROM marketplace_payments p JOIN marketplace_orders o ON o.id=p.order_id
    WHERE p.id=?
  `, id);
  if (!payment) throw fail(404, "Không tìm thấy giao dịch");
  if (payment.status !== "paid") throw fail(409, "Chỉ có thể hoàn giao dịch đã thanh toán");
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE marketplace_payments SET status='refunded' WHERE id=? AND status='paid';
    IF @@ROWCOUNT=0 THROW 51013,'Giao dịch đã được xử lý.',1;
    UPDATE marketplace_orders SET status='refunded' WHERE id=? AND status='paid';
    DELETE FROM purchased_recipes WHERE order_id=?;
    INSERT INTO creator_wallet_ledger
      (creator_id,order_id,order_item_id,event_key,event_type,gross_amount,commission_amount,
       net_amount,commission_rate_bps,note)
    SELECT creator_id,order_id,id,N'refund-'+CONVERT(NVARCHAR(20),id),'refund',
      -price,-commission_amount,-creator_amount,commission_rate_bps,N'Hoàn tiền đơn Premium'
    FROM marketplace_order_items oi
    WHERE oi.order_id=? AND NOT EXISTS (
      SELECT 1 FROM creator_wallet_ledger l WITH (UPDLOCK,HOLDLOCK)
      WHERE l.event_key=N'refund-'+CONVERT(NVARCHAR(20),oi.id)
    );
    UPDATE w SET available_balance=available_balance-x.amount,
      total_earned=total_earned-x.amount,updated_at=GETDATE()
    FROM creator_wallets w
    JOIN (
      SELECT creator_id,SUM(creator_amount) AS amount FROM marketplace_order_items
      WHERE order_id=? GROUP BY creator_id
    ) x ON x.creator_id=w.user_id;
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, id, payment.order_id, payment.order_id, payment.order_id, payment.order_id);
  res.json({ ok: true, status: "refunded" });
}));
router.get("/commerce/commission", wrap(async (_req, res) => {
  await marketplaceSchemaReady;
  const setting = await get(
    "SELECT setting_value,updated_at FROM marketplace_settings WHERE setting_key='creator_commission_bps'",
  );
  const creators = await query(`
    SELECT u.id AS creator_id,u.username,w.available_balance,w.held_balance,w.total_earned,w.total_withdrawn,
      ISNULL(SUM(l.commission_amount),0) AS platform_commission
    FROM users u LEFT JOIN creator_wallets w ON w.user_id=u.id
    LEFT JOIN creator_wallet_ledger l ON l.creator_id=u.id
    WHERE u.role IN ('creator','admin')
    GROUP BY u.id,u.username,w.available_balance,w.held_balance,w.total_earned,w.total_withdrawn
    ORDER BY u.username
  `);
  const [ledger, withdrawals] = await Promise.all([
    query(`
      SELECT TOP 200 l.id,l.creator_id,u.username,l.order_id,l.event_type,l.gross_amount,
        l.commission_amount,l.net_amount,l.commission_rate_bps,l.note,l.created_at
      FROM creator_wallet_ledger l JOIN users u ON u.id=l.creator_id ORDER BY l.id DESC
    `),
    query(`
      SELECT TOP 200 w.id,w.creator_id,u.username,w.amount,w.bank_name,w.bank_account,
        w.account_name,w.status,w.admin_note,w.created_at,w.updated_at
      FROM creator_withdrawals w JOIN users u ON u.id=w.creator_id ORDER BY w.id DESC
    `),
  ]);
  res.json({ commissionRateBps: Number(setting?.setting_value ?? 1000), updatedAt: setting?.updated_at, creators, ledger, withdrawals });
}));
router.put("/commerce/commission", adminRoleOnly, wrap(async (req, res) => {
  await marketplaceSchemaReady;
  const rate = Number(req.body.percent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 50 || Math.round(rate * 100) !== rate * 100)
    throw fail(400, "Hoa hồng phải từ 0 đến 50%, tối đa 2 chữ số thập phân");
  const rateBps = Math.round(rate * 100);
  await exec(`
    UPDATE marketplace_settings SET setting_value=?,updated_at=GETDATE()
    WHERE setting_key='creator_commission_bps'
  `, rateBps);
  res.json({ ok: true, commissionRateBps: rateBps });
}));
router.post("/commerce/withdrawals/:id/decision", adminRoleOnly, wrap(async (req, res) => {
  await marketplaceSchemaReady;
  const id = Number(req.params.id);
  const decision = req.body.decision;
  const note = text(req.body.note);
  if (!Number.isInteger(id) || id < 1 || !["approve", "reject"].includes(decision) || note.length > 500)
    throw fail(400, "Quyết định rút tiền không hợp lệ");
  const withdrawal = await get("SELECT * FROM creator_withdrawals WHERE id=?", id);
  if (!withdrawal) throw fail(404, "Không tìm thấy yêu cầu rút tiền");
  if (withdrawal.status !== "pending") throw fail(409, "Yêu cầu này đã được xử lý");
  if (decision === "approve") {
    await exec(`
      SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      UPDATE creator_withdrawals SET status='paid',admin_note=?,processed_by=?,updated_at=GETDATE()
        WHERE id=? AND status='pending';
      IF @@ROWCOUNT=0 THROW 51007,'Yêu cầu rút tiền đã được xử lý.',1;
      UPDATE creator_wallets SET held_balance=held_balance-?,
        total_withdrawn=total_withdrawn+?,updated_at=GETDATE()
        WHERE user_id=? AND held_balance>=?;
      IF @@ROWCOUNT=0 THROW 51008,'Số dư đang giữ không khớp yêu cầu rút tiền.',1;
      INSERT INTO creator_wallet_ledger
        (creator_id,event_key,event_type,gross_amount,commission_amount,net_amount,commission_rate_bps,note)
        VALUES (?,?,'withdrawal_paid',?,0,-?,0,?);
      COMMIT TRANSACTION;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
    `, note || "Đã duyệt chi trả giả lập", req.user.id, id, withdrawal.amount,
    withdrawal.amount, withdrawal.creator_id, withdrawal.amount, withdrawal.creator_id,
    `withdraw-paid-${id}`, withdrawal.amount, withdrawal.amount, note || "Chi trả ngân hàng giả lập");
  } else {
    await exec(`
      SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      UPDATE creator_withdrawals SET status='rejected',admin_note=?,processed_by=?,updated_at=GETDATE()
        WHERE id=? AND status='pending';
      IF @@ROWCOUNT=0 THROW 51009,'Yêu cầu rút tiền đã được xử lý.',1;
      UPDATE creator_wallets SET available_balance=available_balance+?,
        held_balance=held_balance-?,updated_at=GETDATE()
        WHERE user_id=? AND held_balance>=?;
      IF @@ROWCOUNT=0 THROW 51012,'Số dư đang giữ không khớp yêu cầu rút tiền.',1;
      INSERT INTO creator_wallet_ledger
        (creator_id,event_key,event_type,gross_amount,commission_amount,net_amount,commission_rate_bps,note)
        VALUES (?,?,'withdrawal_released',?,0,?,0,?);
      COMMIT TRANSACTION;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
    `, note || "Đã từ chối yêu cầu rút tiền", req.user.id, id,
    withdrawal.amount, withdrawal.amount, withdrawal.creator_id, withdrawal.amount,
    withdrawal.creator_id, `withdraw-release-${id}`, withdrawal.amount, withdrawal.amount,
    note || "Hoàn số dư về ví Creator");
  }
  res.json({ ok: true, status: decision === "approve" ? "paid" : "rejected" });
}));

router.get("/comments", wrap(async (_req, res) => {
  res.json(await query(`SELECT TOP 100 rt.rowid rid, rt.*, u.username, r.title
  FROM ratings rt JOIN users u ON u.id=rt.user_id JOIN recipes r ON r.id=rt.recipe_id
  ORDER BY rt.created_at DESC`));
}));
router.delete("/comments/:rid", adminRoleOnly, wrap(async (req, res) => {
  await exec("DELETE FROM reports WHERE rating_id=?", req.params.rid);
  await exec("DELETE FROM comment_likes WHERE rating_id=?", req.params.rid);
  await exec("DELETE FROM ratings WHERE rowid=?", req.params.rid);
  res.json({ ok: true });
}));

router.get("/reports", wrap(async (_req, res) => {
  res.json(await query(`SELECT rp.*, u.username FROM reports rp JOIN users u ON u.id=rp.user_id ORDER BY rp.status, rp.id DESC`));
}));
router.put("/reports/:id", wrap(async (req, res) => {
  await exec("UPDATE reports SET status=? WHERE id=?", [req.body.status || "resolved", req.params.id]);
  res.json({ ok: true });
}));

// Gui thong bao he thong cho moi nguoi
router.post("/broadcast", wrap(async (req, res) => {
  const users = await query("SELECT id FROM users WHERE status='active'");
  const message = req.body.message || "Thông báo từ hệ thống";
  for (let start = 0; start < users.length; start += 600) {
    const batch = users.slice(start, start + 600);
    const values = batch.map(() => "(?,?,?)").join(",");
    await exec(
      `INSERT INTO notifications (user_id,type,message) VALUES ${values}`,
      batch.flatMap((user) => [user.id, "system", message]),
    );
  }
  log(req.user.id, "broadcast", message);
  res.json({ sent: users.length });
}));

router.get("/logs", wrap(async (_req, res) => {
  res.json(await query(`SELECT TOP 100 l.*, u.username FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC`));
}));

module.exports = router;

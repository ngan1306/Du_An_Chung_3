// Admin (SQL Server): dashboard, quan ly user, recipe, category, comment, report, phan quyen, log
const express = require("express");
const bcrypt = require("bcryptjs");
const { query, exec, get } = require("../db/database");
const { authRequired, adminOnly, log } = require("../middleware");

const router = express.Router();
router.use(authRequired, adminOnly);

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(e.statusCode || 500).json({ error: e.message }));
const adminRoleOnly = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Chỉ quản trị viên mới được thực hiện thao tác này" });
  next();
};
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
  const c = async (sql, p) => (await get(sql, p)).c;
  res.json({
    users: await c("SELECT COUNT(*) c FROM users"),
    recipes: await c("SELECT COUNT(*) c FROM recipes"),
    pending: await c("SELECT COUNT(*) c FROM recipes WHERE approved=0"),
    comments: await c("SELECT COUNT(*) c FROM ratings"),
    views: await c("SELECT ISNULL(SUM(views),0) c FROM recipes"),
    reports: await c("SELECT COUNT(*) c FROM reports WHERE status='open'"),
    posts: await c("SELECT COUNT(*) c FROM posts"),
    topRecipes: await query("SELECT TOP 5 title,views FROM recipes ORDER BY views DESC"),
    newUsers: await query("SELECT TOP 5 username, created_at FROM users ORDER BY created_at DESC"),
  });
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
      displayName.length > 150 || !["user", "moderator", "admin"].includes(role)) {
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
      (role !== undefined && !["user", "moderator", "admin"].includes(role)) ||
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
  await deleteUserData(id);
  log(req.user.id, "admin_delete_user", `user #${id}`);
  res.json({ ok: true });
}));

router.get("/recipes", wrap(async (req, res) => {
  const w = req.query.pending === "1" ? " WHERE r.approved=0" : "";
  const rows = await query(
    `SELECT TOP 100 r.*, u.username FROM recipes r JOIN users u ON u.id=r.user_id${w} ORDER BY r.created_at DESC`);
  for (const r of rows) {
    const a = await get("SELECT AVG(CAST(stars AS FLOAT)) a FROM ratings WHERE recipe_id=?", r.id);
    r.avg_rating = a && a.a ? Math.round(a.a * 10) / 10 : 0;
  }
  res.json(rows);
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
  res.json(await query("SELECT * FROM ingredients ORDER BY name"));
}));
router.post("/ingredients", adminRoleOnly, wrap(async (req, res) => {
  const name = text(req.body.name);
  if (!name || name.length > 150) throw fail(400, "Tên nguyên liệu không hợp lệ");
  if (await get("SELECT id FROM ingredients WHERE name=?", name)) throw fail(409, "Nguyên liệu đã tồn tại");
  const result = await exec("INSERT INTO ingredients (name) VALUES (?)", name);
  res.status(201).json({ id: result.insertId, ok: true });
}));
router.put("/ingredients/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const name = text(req.body.name);
  if (!Number.isInteger(id) || id < 1 || !name || name.length > 150)
    throw fail(400, "Tên nguyên liệu không hợp lệ");
  const ingredient = await get("SELECT id,name FROM ingredients WHERE id=?", id);
  if (!ingredient) throw fail(404, "Không tìm thấy nguyên liệu");
  if (await get("SELECT id FROM ingredients WHERE name=? AND id<>?", name, id))
    throw fail(409, "Tên nguyên liệu đã được sử dụng");
  await exec("UPDATE recipe_ingredients SET name=? WHERE name=?", name, ingredient.name);
  await exec("UPDATE ingredients SET name=? WHERE id=?", name, id);
  res.json({ ok: true });
}));
router.delete("/ingredients/:id", adminRoleOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw fail(400, "Nguyên liệu không hợp lệ");
  if (!await get("SELECT id FROM ingredients WHERE id=?", id)) throw fail(404, "Không tìm thấy nguyên liệu");
  await exec("DELETE FROM ingredients WHERE id=?", id);
  res.json({ ok: true });
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
  for (const u of users)
    await exec("INSERT INTO notifications (user_id,type,message) VALUES (?,?,?)",
      [u.id, "system", req.body.message || "Thông báo từ hệ thống"]);
  log(req.user.id, "broadcast", req.body.message);
  res.json({ sent: users.length });
}));

router.get("/logs", wrap(async (_req, res) => {
  res.json(await query(`SELECT TOP 100 l.*, u.username FROM activity_logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC`));
}));

module.exports = router;

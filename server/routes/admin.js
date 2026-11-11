// Admin (SQL Server): dashboard, quan ly user, recipe, category, comment, report, phan quyen, log
const express = require("express");
const { query, exec, get } = require("../db/database");
const { authRequired, adminOnly, log } = require("../middleware");

const router = express.Router();
router.use(authRequired, adminOnly);

const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(500).json({ error: e.message }));

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

router.put("/users/:id", wrap(async (req, res) => {
  const { role, status } = req.body;
  const u = await get("SELECT * FROM users WHERE id=?", req.params.id);
  if (!u) return res.status(404).json({ error: "Không tìm thấy" });
  if (u.role === "admin" && role && role !== "admin")
    return res.status(400).json({ error: "Không thể hạ quyền admin" });
  await exec("UPDATE users SET role=COALESCE(?,role), status=COALESCE(?,status) WHERE id=?",
    [role ?? null, status ?? null, u.id]);
  log(req.user.id, "admin_update_user", `user #${u.id} role=${role} status=${status}`);
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

router.delete("/recipes/:id", wrap(async (req, res) => {
  await exec("DELETE FROM recipes WHERE id=?", req.params.id);
  log(req.user.id, "admin_delete_recipe", `recipe #${req.params.id}`);
  res.json({ ok: true });
}));

router.get("/categories", wrap(async (_req, res) => {
  res.json(await query("SELECT c.*, (SELECT COUNT(*) FROM recipes WHERE category_id=c.id) count FROM categories c"));
}));
router.post("/categories", wrap(async (req, res) => {
  await exec("INSERT INTO categories (name,icon) VALUES (?,?)", [req.body.name, req.body.icon || "🍲"]);
  res.json({ ok: true });
}));
router.delete("/categories/:id", wrap(async (req, res) => {
  await exec("DELETE FROM categories WHERE id=?", req.params.id);
  res.json({ ok: true });
}));

router.get("/ingredients", wrap(async (_req, res) => {
  res.json(await query("SELECT * FROM ingredients ORDER BY name"));
}));
router.post("/ingredients", wrap(async (req, res) => {
  await exec("IF NOT EXISTS (SELECT 1 FROM ingredients WHERE name=?) INSERT INTO ingredients (name) VALUES (?)",
    req.body.name, req.body.name);
  res.json({ ok: true });
}));
router.delete("/ingredients/:id", wrap(async (req, res) => {
  await exec("DELETE FROM ingredients WHERE id=?", req.params.id);
  res.json({ ok: true });
}));

router.get("/comments", wrap(async (_req, res) => {
  res.json(await query(`SELECT TOP 100 rt.rowid rid, rt.*, u.username, r.title
  FROM ratings rt JOIN users u ON u.id=rt.user_id JOIN recipes r ON r.id=rt.recipe_id
  ORDER BY rt.created_at DESC`));
}));
router.delete("/comments/:rid", wrap(async (req, res) => {
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

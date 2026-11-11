const jwt = require("jsonwebtoken");
const { get, exec } = require("./db/database");

const SECRET = process.env.JWT_SECRET || "recipe-app-secret";

function sign(u) {
  return jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: "7d" });
}

async function authOptional(req, _res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  req.user = null;
  if (token) {
    try {
      const p = jwt.verify(token, SECRET);
      req.user =
        (await get(
          "SELECT id,username,email,role,status,avatar,display_name,bio,prefs FROM users WHERE id=?",
          p.id,
        )) || null;
    } catch {
      req.user = null;
    }
  }
  next();
}

function authRequired(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (req.user.status === "locked")
      return res.status(403).json({ error: "Tài khoản bị khóa" });
    next();
  });
}

function adminOnly(req, res, next) {
  if (!req.user || !["admin", "moderator"].includes(req.user.role))
    return res.status(403).json({ error: "Yêu cầu quyền Admin/Moderator" });
  next();
}

// fire-and-forget helpers
function log(userId, action, detail = "") {
  exec("INSERT INTO activity_logs (user_id,action,detail) VALUES (?,?,?)", [
    userId, action, detail,
  ]).catch(() => { });
}

function notify(userId, type, message, link = "") {
  exec(
    "INSERT INTO notifications (user_id,type,message,link) VALUES (?,?,?,?)",
    [userId, type, message, link],
  ).catch(() => { });
}

module.exports = { sign, authOptional, authRequired, adminOnly, log, notify, SECRET };

// Auth: dang ky, dang nhap, quen mat khau, doi mat khau, ho so, xoa tai khoan (SQL Server)
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query, exec, get } = require("../db/database");
const { sign, authRequired, log } = require("../middleware");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Thiếu thông tin" });
    if (await get("SELECT id FROM users WHERE username=? OR email=?", username, email))
      return res.status(409).json({ error: "Username hoặc email đã tồn tại" });
    const id = (
      await exec(
        `INSERT INTO users (username,email,password_hash,display_name,verified) VALUES (?,?,?,?,1)`,
        [username, email, bcrypt.hashSync(password, 10), username],
      )
    ).insertId;
    const u = await get("SELECT * FROM users WHERE id=?", id);
    log(u.id, "register", username);
    res.json({
      token: sign(u),
      user: { id: u.id, username: u.username, email: u.email, role: u.role },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const u = await get(
      "SELECT * FROM users WHERE username=? OR email=?",
      username || "", username || "",
    );
    if (!u || !bcrypt.compareSync(password || "", u.password_hash))
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    if (u.status === "locked")
      return res.status(403).json({ error: "Tài khoản đã bị khóa bởi quản trị viên" });
    log(u.id, "login");
    res.json({
      token: sign(u),
      user: {
        id: u.id, username: u.username, email: u.email, role: u.role,
        avatar: u.avatar, display_name: u.display_name,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Google login demo: nhan email tu client -> tao/dang nhap truc tiep
router.post("/google", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: "Thiếu email Google" });
    let u = await get("SELECT * FROM users WHERE email=?", email);
    if (!u) {
      const id = (
        await exec(
          `INSERT INTO users (username,email,password_hash,display_name,verified) VALUES (?,?,?,?,1)`,
          [email.split("@")[0], email, bcrypt.hashSync(crypto.randomBytes(8).toString("hex"), 10), name || email.split("@")[0]],
        )
      ).insertId;
      u = await get("SELECT * FROM users WHERE id=?", id);
    }
    res.json({ token: sign(u), user: { id: u.id, username: u.username, role: u.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Quen mat khau: sinh token (mo phong gui email)
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const u = await get("SELECT * FROM users WHERE email=?", email || "");
    if (!u) return res.json({ ok: true });
    const token = crypto.randomBytes(16).toString("hex");
    await exec(
      `INSERT INTO password_resets (user_id,token,expires_at) VALUES (?,?,DATEADD(HOUR,1,GETDATE()))`,
      [u.id, token],
    );
    res.json({ ok: true, resetToken: token, message: "Link đặt lại mật khẩu đã gửi tới email (demo)" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    const r = await get(
      `SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at > GETDATE()`,
      token || "",
    );
    if (!r) return res.status(400).json({ error: "Token không hợp lệ hoặc hết hạn" });
    await exec("UPDATE users SET password_hash=? WHERE id=?", [bcrypt.hashSync(password, 10), r.user_id]);
    await exec("UPDATE password_resets SET used=1 WHERE id=?", [r.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/change-password", authRequired, async (req, res) => {
  try {
    const { current, newPassword } = req.body;
    const u = await get("SELECT * FROM users WHERE id=?", req.user.id);
    if (!bcrypt.compareSync(current || "", u.password_hash))
      return res.status(400).json({ error: "Mật khẩu hiện tại sai" });
    await exec("UPDATE users SET password_hash=? WHERE id=?", [bcrypt.hashSync(newPassword, 10), u.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ho so ca nhan
router.put("/profile", authRequired, async (req, res) => {
  try {
    const { display_name, bio, avatar, prefs } = req.body;
    await exec(
      "UPDATE users SET display_name=?, bio=?, avatar=COALESCE(?,avatar), prefs=? WHERE id=?",
      [
        display_name ?? req.user.display_name,
        bio ?? req.user.bio,
        avatar ?? null,
        prefs ?? req.user.prefs,
        req.user.id,
      ],
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/me", authRequired, async (req, res) => {
  try {
    await exec("DELETE FROM users WHERE id=?", [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Danh sach user theo doi / nguoi theo doi
router.get("/:id/followers", async (req, res) => {
  res.json(await query(
    `SELECT u.id,u.username,u.display_name,u.avatar FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.following_id=?`,
    [req.params.id],
  ));
});
router.get("/:id/following", async (req, res) => {
  res.json(await query(
    `SELECT u.id,u.username,u.display_name,u.avatar FROM follows f JOIN users u ON u.id=f.following_id WHERE f.follower_id=?`,
    [req.params.id],
  ));
});

module.exports = router;

process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e && e.message || e));
process.on("uncaughtException", (e) => console.error("Uncaught exception:", e && e.message || e));

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { query, get } = require("./db/database");
const { authOptional } = require("./middleware");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(authOptional);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(express.static(path.join(__dirname, "..", "public")));

// Upload anh (multer)
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (_req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/[^\w.]/g, "_")),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err)
      return res.status(400).json({ error: "Upload lá»—i: " + err.message });
    if (!req.file) return res.status(400).json({ error: "ChÆ°a chá»n file" });
    res.json({ url: "/uploads/" + req.file.filename });
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/recipes", require("./routes/recipes"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/ai", require("./routes/ai"));

// Home endpoint tong hop (SQL Server)
app.get("/api/home", async (_req, res) => {
  try {
    const card = `SELECT TOP 6 r.id, r.title, r.image, r.views, r.prep_minutes,
      r.cook_minutes, r.difficulty, r.diet, c.name AS category,
      ISNULL((SELECT AVG(CAST(rt.stars AS FLOAT)) FROM ratings rt WHERE rt.recipe_id=r.id),0) AS avg_rating
      FROM recipes r LEFT JOIN categories c ON c.id=r.category_id
      WHERE r.is_public=1 AND r.approved=1`;
    const [featured, newest, topRated, categories] = await Promise.all([
      query(`${card} ORDER BY r.views DESC`),
      query(`${card} ORDER BY r.created_at DESC`),
      query(`${card} ORDER BY (SELECT AVG(CAST(rt.stars AS FLOAT)) FROM ratings rt WHERE rt.recipe_id=r.id) DESC`),
      query("SELECT * FROM categories"),
    ]);
    res.json({
      featured,
      newest,
      popular: featured,
      topRated,
      categories,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// error handler chung
app.use((err, _req, res, _next) => {
  console.error("ERR:", err && err.message || err);
  res.status(500).json({ error: (err && err.message) || "Lá»—i mÃ¡y chá»§" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Recipe App cháº¡y táº¡i http://localhost:${PORT}`),
);

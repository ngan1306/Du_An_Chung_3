// AI Recipe (SQL Server): goi y mon tu nguyen lieu co san, thuc don theo khau vi
const express = require("express");
const { query } = require("../db/database");
const { authRequired } = require("../middleware");

const router = express.Router();

// Goi y mon tu nguyen lieu co san: cham diem cong thuc theo so nguyen lieu trung khop
router.post("/from-ingredients", authRequired, async (req, res) => {
  try {
    const ings = (Array.isArray(req.body.ingredients) ? req.body.ingredients : [])
      .filter(s => typeof s === "string")
      .map(s => s.toLowerCase().trim())
      .filter(Boolean);
    if (!ings.length) return res.json([]);
    const rows = await query(`SELECT r.*, ri.name AS ingredient_name
      FROM recipes r
      JOIN recipe_ingredients ri ON ri.recipe_id=r.id
      WHERE r.is_public=1 AND r.approved=1`);
    const byRecipe = new Map();
    for (const row of rows) {
      let entry = byRecipe.get(row.id);
      if (!entry) {
        entry = { recipe: {}, ingredients: [] };
        for (const [key, value] of Object.entries(row)) {
          if (key !== "ingredient_name") entry.recipe[key] = value;
        }
        byRecipe.set(row.id, entry);
      }
      if (row.ingredient_name) entry.ingredients.push(row.ingredient_name.toLowerCase());
    }
    const scored = [];
    for (const { recipe, ingredients: ri } of byRecipe.values()) {
      const match = ings.filter(i => ri.some(x => x.includes(i) || i.includes(x)));
      const missing = ri.filter(x => !match.some(m => x.includes(m) || m.includes(x)));
      if (match.length) scored.push({ recipe, score: match.length, match, missing: missing.slice(0, 5) });
    }
    scored.sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, 6));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Thuc don theo khau vi (diet + thoi gian + calo)
router.post("/suggest-menu", authRequired, async (req, res) => {
  try {
    const { diet = "", maxCalories = 2000, maxTime = 60 } = req.body;
    let sql = "SELECT TOP 3 * FROM recipes WHERE is_public=1 AND approved=1 AND calories<=? AND (prep_minutes+cook_minutes)<=?";
    const args = [maxCalories, maxTime];
    if (diet) { sql += " AND (diet=? OR diet='')"; args.push(diet); }
    sql += " ORDER BY NEWID()";
    const rows = await query(sql, args);
    const total = rows.reduce((s, r) => s + (r.calories || 0), 0);
    res.json({ items: rows, totalCalories: total, note: `Thực đơn ~${total} kcal trong ngày` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

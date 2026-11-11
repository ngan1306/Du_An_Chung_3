// Reset + seed lai SQL Server
const { exec } = require("./mssql");
const tables = [
  "activity_logs",
  "notifications",
  "shopping_items",
  "meal_plans",
  "post_likes",
  "posts",
  "follows",
  "reports",
  "comment_likes",
  "ratings",
  "collection_items",
  "collections",
  "favorites",
  "recipe_steps",
  "recipe_ingredients",
  "recipes",
  "ingredients",
  "categories",
  "password_resets",
  "users",
];
(async () => {
  for (const t of tables) await exec(`DELETE FROM ${t}`);
  await exec("DBCC CHECKIDENT (users, RESEED, 0)");
  await exec("DBCC CHECKIDENT (recipes, RESEED, 0)");
  console.log("Cleaned");
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

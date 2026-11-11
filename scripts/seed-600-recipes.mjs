import { readFile } from "node:fs/promises";
import { exec, query } from "../server/db/mssql.js";

const expected = 600;
const recipes = JSON.parse(
  await readFile(new URL("../server/db/sample-recipes-600.json", import.meta.url), "utf8"),
);
if (recipes.length !== expected)
  throw new Error(`Expected ${expected} new recipes; found ${recipes.length}.`);

const existingRecipes = await query("SELECT id, title, image FROM recipes");
const normalize = (value) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const recipeNames = new Set();
for (const recipe of recipes) {
  const name = normalize(recipe.title);
  if (!name || recipeNames.has(name))
    throw new Error(`The downloaded dataset contains a duplicate recipe: ${recipe.title}`);
  recipeNames.add(name);
}
const existingByTitle = new Map(
  existingRecipes.map((recipe) => [normalize(recipe.title), recipe]),
);
const toInsert = [];
for (const recipe of recipes) {
  const existing = existingByTitle.get(normalize(recipe.title));
  if (!existing) {
    toInsert.push(recipe);
  } else if (existing.image !== recipe.image) {
    throw new Error(
      `The recipe "${recipe.title}" already exists with a different photo. No changes were made; 600 additional dishes cannot be guaranteed.`,
    );
  }
}

const users = await query("SELECT id FROM users WHERE role='admin' ORDER BY id");
const userId = users[0]?.id;
if (!userId) throw new Error("An admin account is required to import sample recipes.");

const categoryNames = [...new Set(toInsert.map((recipe) => recipe.category))];
const categories = await query("SELECT id, name FROM categories");
const categoryIds = new Map(categories.map((category) => [category.name, category.id]));
for (const name of categoryNames) {
  if (categoryIds.has(name)) continue;
  const result = await exec(
    "INSERT INTO categories (name, icon) VALUES (?, ?)",
    [name, "🍽️"],
  );
  categoryIds.set(name, result.insertId);
}

const recipeIds = new Map(
  recipes.flatMap((recipe) => {
    const existing = existingByTitle.get(normalize(recipe.title));
    return existing ? [[recipe.title, existing.id]] : [];
  }),
);
const recipeColumns = [
  "user_id",
  "title",
  "description",
  "image",
  "video_url",
  "category_id",
  "country",
  "prep_minutes",
  "cook_minutes",
  "servings",
  "difficulty",
  "calories",
  "protein",
  "carbs",
  "fat",
  "diet",
  "is_public",
  "views",
];
const fieldsPerRecipe = recipeColumns.length;
const recipeBatchSize = 100;
for (let offset = 0; offset < toInsert.length; offset += recipeBatchSize) {
  const batch = toInsert.slice(offset, offset + recipeBatchSize);
  const placeholders = batch
    .map(() => `(${Array(fieldsPerRecipe).fill("?").join(",")})`)
    .join(",");
  const sql = `INSERT INTO recipes (${recipeColumns.join(",")}) OUTPUT INSERTED.id, INSERTED.title VALUES ${placeholders}`;
  const parameters = batch.flatMap((recipe) => [
    userId,
    recipe.title,
    recipe.description,
    recipe.image,
    "",
    categoryIds.get(recipe.category),
    recipe.country,
    recipe.prep_minutes,
    recipe.cook_minutes,
    recipe.servings,
    recipe.difficulty,
    recipe.calories,
    recipe.protein,
    recipe.carbs,
    recipe.fat,
    recipe.diet,
    1,
    recipe.views,
  ]);
  const inserted = await query(sql, parameters);
  for (const recipe of batch) {
    const insertedRecipe = inserted.find((row) => row.title === recipe.title);
    if (!insertedRecipe)
      throw new Error(`SQL Server did not return an ID for ${recipe.title}.`);
    recipeIds.set(recipe.title, insertedRecipe.id);
  }
  console.log(`Imported ${Math.min(offset + batch.length, expected)}/${expected} recipes.`);
}

if (recipeIds.size !== expected)
  throw new Error(`Resolved ${recipeIds.size}/${expected} sample recipe IDs.`);

const recipeIdList = [...recipeIds.values()];
const idPlaceholders = recipeIdList.map(() => "?").join(",");
const existingIngredients = await query(
  `SELECT recipe_id, name, quantity, unit FROM recipe_ingredients WHERE recipe_id IN (${idPlaceholders})`,
  recipeIdList,
);
const existingSteps = await query(
  `SELECT recipe_id, step_order, text FROM recipe_steps WHERE recipe_id IN (${idPlaceholders})`,
  recipeIdList,
);
const ingredientCounts = new Map();
for (const ingredient of existingIngredients) {
  const key = JSON.stringify([
      ingredient.recipe_id,
      normalize(ingredient.name),
      ingredient.quantity || "",
      ingredient.unit || "",
    ]);
  ingredientCounts.set(key, (ingredientCounts.get(key) || 0) + 1);
}
const stepKeys = new Set(
  existingSteps.map((step) =>
    JSON.stringify([step.recipe_id, Number(step.step_order), step.text]),
  ),
);
const relationRows = [];
for (const recipe of recipes) {
  const recipeId = recipeIds.get(recipe.title);
  if (!recipeId) throw new Error(`SQL Server did not return an ID for ${recipe.title}.`);
  for (const ingredient of recipe.ingredients) {
    const quantity = (ingredient.quantity || "").slice(0, 50);
    const key = JSON.stringify([
      recipeId,
      normalize(ingredient.name),
      quantity,
      ingredient.unit || "",
    ]);
    const existingCount = ingredientCounts.get(key) || 0;
    if (existingCount > 0) {
      ingredientCounts.set(key, existingCount - 1);
      continue;
    }
    relationRows.push([
      "recipe_ingredients",
      recipeId,
      ingredient.name,
      quantity,
      ingredient.unit || "",
    ]);
  }
  for (const [index, step] of recipe.steps.entries()) {
    const key = JSON.stringify([recipeId, index + 1, step]);
    if (stepKeys.has(key)) continue;
    stepKeys.add(key);
    relationRows.push(["recipe_steps", recipeId, String(index + 1), step]);
  }
}

async function insertRows(table, rows, columns, valuesPerRow, batchSize = 500) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const placeholders = batch
      .map(() => `(${Array(valuesPerRow).fill("?").join(",")})`)
      .join(",");
    await query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`,
      batch.flat(),
    );
  }
}

const ingredients = relationRows
  .filter(([table]) => table === "recipe_ingredients")
  .map(([, recipeId, name, quantity, unit]) => [recipeId, name, quantity, unit]);
const steps = relationRows
  .filter(([table]) => table === "recipe_steps")
  .map(([, recipeId, order, text]) => [recipeId, order, text]);
await insertRows(
  "recipe_ingredients",
  ingredients,
  ["recipe_id", "name", "quantity", "unit"],
  4,
);
await insertRows(
  "recipe_steps",
  steps,
  ["recipe_id", "step_order", "text"],
  3,
);

const counts = {
  recipes: (await query("SELECT COUNT(*) c FROM recipes WHERE image LIKE ?", "/img/meal-%"))[0].c,
  totalRecipes: (await query("SELECT COUNT(*) c FROM recipes"))[0].c,
  ingredients: (
    await query(
      `SELECT COUNT(*) c FROM recipe_ingredients WHERE recipe_id IN (${idPlaceholders})`,
      recipeIdList,
    )
  )[0].c,
  steps: (
    await query(
      `SELECT COUNT(*) c FROM recipe_steps WHERE recipe_id IN (${idPlaceholders})`,
      recipeIdList,
    )
  )[0].c,
};
const expectedIngredients = recipes.reduce(
  (count, recipe) => count + recipe.ingredients.length,
  0,
);
const expectedSteps = recipes.reduce(
  (count, recipe) => count + recipe.steps.length,
  0,
);
if (
  counts.recipes !== expected ||
  counts.ingredients !== expectedIngredients ||
  counts.steps !== expectedSteps
)
  throw new Error(
    `Import verification failed: ${counts.recipes}/600 recipes, ${counts.ingredients}/${expectedIngredients} ingredients, ${counts.steps}/${expectedSteps} steps.`,
  );

console.log(
  `Verified 600 new recipes (${counts.totalRecipes} recipes total); ${counts.ingredients} ingredients and ${counts.steps} cooking steps.`,
);

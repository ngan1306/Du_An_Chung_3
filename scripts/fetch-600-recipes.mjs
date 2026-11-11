import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imageDirectory = path.join(root, "public", "img");
const dataPath = path.join(root, "server", "db", "sample-recipes-600.json");
const api = "https://www.themealdb.com/api/json/v1/1";
const target = 600;
const concurrency = 4;
const knownDishes = new Set([
  "pho bo ha noi",
  "beef pho",
  "sushi ca hoi",
  "sushi",
  "salad bo me rang",
  "ga nuong mat ong",
  "tiramisu y",
  "tiramisu",
  "canh chua ca",
  "fish soup",
  "banh mi viet nam",
  "banh mi",
  "com tam suon nuong",
  "pork chop rice",
  "bun bo hue",
  "goi cuon tom thit",
  "fresh spring rolls",
  "seafood ramen",
  "ramen",
  "pizza margherita",
  "pad thai tom",
  "pad thai",
  "pancake mat ong",
  "pancake",
  "pho mai que",
  "cheese sticks",
  "bo bit tet",
  "steak",
  "hoanh thanh chien",
  "fried wonton",
  "kem vanilla dau",
  "ice cream",
  "sinh to xoai",
  "mango smoothie",
  "ca phe sua da",
  "iced coffee",
]);
const sourceCategoryNames = [
  "Beef",
  "Chicken",
  "Dessert",
  "Lamb",
  "Miscellaneous",
  "Pasta",
  "Pork",
  "Seafood",
  "Side",
  "Starter",
  "Vegan",
  "Vegetarian",
  "Breakfast",
  "Goat",
];
const areaGroups = ["Japanese", "Vietnamese"];
const clean = (value) => (value || "").trim();
const normalize = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function requestJson(url, attempt = 0) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      return requestJson(url, attempt + 1);
    }
    throw error;
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(retryAfter * 1000, 1000 * 2 ** attempt)),
    );
    return requestJson(url, attempt + 1);
  }
  if (!response.ok)
    throw new Error(`TheMealDB request failed (${response.status}): ${url}`);
  return response.json();
}

async function downloadPhoto(url, destination, attempt = 0) {
  if (await isJpeg(destination)) return;
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      return downloadPhoto(url, destination, attempt + 1);
    }
    throw new Error(`Could not download photo ${url}: ${error.message}`);
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(retryAfter * 1000, 1000 * 2 ** attempt)),
    );
    return downloadPhoto(url, destination, attempt + 1);
  }
  if (!response.ok)
    throw new Error(`Could not download photo ${url}: HTTP ${response.status}`);
  const image = Buffer.from(await response.arrayBuffer());
  if (image.length < 5000 || image[0] !== 0xff || image[1] !== 0xd8)
    throw new Error(`Downloaded photo is not a valid JPEG: ${url}`);
  await writeFile(destination, image);
}

async function isJpeg(filename) {
  try {
    const file = await readFile(filename);
    return file.length > 5000 && file[0] === 0xff && file[1] === 0xd8;
  } catch {
    return false;
  }
}

function getIngredients(recipe) {
  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const name = clean(recipe[`strIngredient${index}`]);
    if (!name) continue;
    ingredients.push({
      name,
      quantity: clean(recipe[`strMeasure${index}`]).slice(0, 50),
      unit: "",
    });
  }
  return ingredients;
}

function getSteps(instructions) {
  const paragraphs = clean(instructions)
    .split(/\r?\n+/)
    .map(clean)
    .filter(Boolean);
  return paragraphs.length > 1
    ? paragraphs
    : clean(instructions)
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map(clean)
        .filter(Boolean);
}

function getCategory(category, area) {
  if (category === "Dessert") return "Món tráng miệng";
  if (category === "Vegan" || category === "Vegetarian") return "Món chay";
  if (area === "Japanese") return "Món Nhật";
  if (area === "Vietnamese") return "Món Việt";
  if (/beverage|drink|cocktail|coffee|tea|juice|smoothie/i.test(category))
    return "Đồ uống";
  return "Món chính";
}

async function getCandidates() {
  const groups = await Promise.all(
    sourceCategoryNames.map(async (category) => {
      const { meals } = await requestJson(
        `${api}/filter.php?c=${encodeURIComponent(category)}`,
      );
      return meals || [];
    }),
  );
  const areas = await Promise.all(
    areaGroups.map(async (area) => {
      const { meals } = await requestJson(
        `${api}/filter.php?a=${encodeURIComponent(area)}`,
      );
      return meals || [];
    }),
  );
  groups.push(...areas);

  const priorData = JSON.parse(await readFile(dataPath.replace("600", "30"), "utf8"));
  const excludedIds = new Set(priorData.map((recipe) => String(recipe.sourceId)));
  const seenIds = new Set();
  const seenTitles = new Set(knownDishes);
  const candidates = [];
  const positions = groups.map(() => 0);
  while (candidates.length < target) {
    let found = false;
    for (const [groupIndex, group] of groups.entries()) {
      while (positions[groupIndex] < group.length) {
        const recipe = group[positions[groupIndex]++];
        const id = String(recipe.idMeal);
        const title = normalize(recipe.strMeal);
        if (
          !id ||
          !title ||
          excludedIds.has(id) ||
          seenIds.has(id) ||
          seenTitles.has(title)
        )
          continue;
        seenIds.add(id);
        seenTitles.add(title);
        candidates.push(recipe);
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  if (candidates.length < target)
    throw new Error(
      `TheMealDB returned only ${candidates.length} unique recipes after excluding existing dishes; ${target} are required.`,
    );
  return candidates;
}

const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function buildRecipe(candidate) {
  const sourceId = String(candidate.idMeal);
  const recipe = await requestJson(`${api}/lookup.php?i=${sourceId}`).then(
    (data) => data.meals?.[0],
  );
  if (!recipe?.strMealThumb || !recipe.strInstructions)
    throw new Error(`Recipe ${sourceId} has no photo or instructions.`);

  const ingredients = getIngredients(recipe);
  const steps = getSteps(recipe.strInstructions);
  if (!ingredients.length || !steps.length)
    throw new Error(`Recipe ${sourceId} has no ingredients or cooking steps.`);

  const image = `/img/meal-${sourceId}.jpg`;
  await downloadPhoto(recipe.strMealThumb, path.join(imageDirectory, path.basename(image)));
  return {
    sourceId: Number(sourceId),
    sourceTitle: clean(recipe.strMeal),
    sourceUrl: `https://www.themealdb.com/meal.php?c=${sourceId}`,
    imageSourceUrl: recipe.strMealThumb,
    title: clean(recipe.strMeal).slice(0, 190),
    description: `Công thức ${clean(recipe.strMeal)}${clean(recipe.strArea) ? ` theo phong cách ${clean(recipe.strArea)}` : ""}.`,
    image,
    category: getCategory(clean(recipe.strCategory), clean(recipe.strArea)),
    country: clean(recipe.strArea) || "Quốc tế",
    prep_minutes: 15,
    cook_minutes: 30,
    servings: 4,
    difficulty: "Trung bình",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    diet:
      clean(recipe.strCategory) === "Vegan"
        ? "Vegan"
        : clean(recipe.strCategory) === "Vegetarian"
          ? "Chay"
          : "",
    ingredients,
    steps,
    views: 0,
  };
}

await mkdir(imageDirectory, { recursive: true });

const candidates = await getCandidates();
const previous = await readFile(dataPath, "utf8")
  .then((contents) => JSON.parse(contents))
  .catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
const recipesById = new Map(
  previous.map((recipe) => [String(recipe.sourceId), recipe]),
);
const pending = candidates.filter(
  (recipe) => !recipesById.has(String(recipe.idMeal)),
);
let completed = 0;
let nextIndex = 0;
let firstError;
let writeQueue = Promise.resolve();

function persistRecipes() {
  const contents = `${JSON.stringify([...recipesById.values()], null, 2)}\n`;
  writeQueue = writeQueue.then(() => writeFile(dataPath, contents, "utf8"));
  return writeQueue;
}

async function worker() {
  while (nextIndex < pending.length && !firstError) {
    const index = nextIndex++;
    try {
      const recipe = await buildRecipe(pending[index]);
      recipesById.set(String(recipe.sourceId), recipe);
      completed += 1;
      if (completed % 20 === 0 || recipesById.size === target)
        await persistRecipes();
      if (completed % 20 === 0 || recipesById.size === target)
        console.log(`Downloaded ${recipesById.size}/${target} recipe photos.`);
    } catch (error) {
      firstError = error;
    }
    await pause(150);
  }
}

await Promise.all(
  Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()),
);

if (firstError) throw firstError;
if (recipesById.size !== target)
  throw new Error(
    `Downloaded ${recipesById.size} recipes; expected exactly ${target}. Run the command again to resume.`,
  );

await writeFile(
  dataPath,
  `${JSON.stringify([...recipesById.values()], null, 2)}\n`,
  "utf8",
);
console.log(`Saved ${target} new recipes and real photos to ${path.relative(root, dataPath)}.`);

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imageDirectory = path.join(root, "public", "img");
const recipesPath = path.join(root, "server", "db", "sample-recipes-30.json");
const dishes = [
  [53281, "Kefta bò Algeria", "Món chính", ""],
  [53366, "Bò xào bông cải xanh", "Món chính", ""],
  [52904, "Bò hầm vang đỏ kiểu Pháp", "Món chính", ""],
  [53050, "Gà nướng sốt dừa Malaysia", "Món chính", ""],
  [52940, "Gà hầm kiểu Jamaica", "Món chính", ""],
  [53161, "Cơm gà và xúc xích chorizo", "Món chính", ""],
  [52831, "Gà karaage Nhật", "Món Nhật", ""],
  [52893, "Bánh crumble táo và mâm xôi", "Món tráng miệng", ""],
  [52768, "Tart táo frangipane", "Món tráng miệng", ""],
  [53138, "Bánh quy nhân dulce de leche", "Món tráng miệng", ""],
  [52794, "Bánh chocolate thuần chay", "Món tráng miệng", "Vegan"],
  [53262, "Kebab Adana", "Món chính", ""],
  [53265, "Sườn cừu gừng ớt", "Món chính", ""],
  [52839, "Mì linguine tôm ớt", "Món chính", ""],
  [53064, "Mì fettuccine sốt Alfredo", "Món chính", ""],
  [52844, "Lasagne bò phô mai", "Món chính", ""],
  [52995, "Bánh mì kẹp thịt heo BBQ", "Món chính", ""],
  [53496, "Cơm heo nướng Campuchia", "Món chính", ""],
  [53018, "Bigos hầm kiểu Ba Lan", "Món chính", ""],
  [52959, "Cá hồi nướng thì là và cà chua", "Món chính", ""],
  [53239, "Salad tôm sốt cay", "Món chính", ""],
  [52819, "Taco cá Cajun", "Món chính", ""],
  [53495, "Cà ri cá Amok Trey", "Món chính", ""],
  [53373, "Chả giò nồi chiên không dầu", "Món chính", ""],
  [53094, "Sốt cà tím Baba Ghanoush", "Món chay", "Vegan"],
  [52942, "Paella cà tím và thì là", "Món chay", "Vegan"],
  [52775, "Lasagne thuần chay", "Món chay", "Vegan"],
  [52807, "Cà tím nghiền kiểu Ấn Độ", "Món chay", "Chay"],
  [53078, "Súp củ dền Borscht", "Món chay", "Chay"],
  [52896, "Bữa sáng kiểu Anh", "Món chính", ""],
];

const asText = (value) => (value || "").trim();

async function getRecipe(id) {
  const response = await fetch(
    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`,
  );
  if (!response.ok)
    throw new Error(`Could not load TheMealDB recipe ${id}: HTTP ${response.status}`);
  const data = await response.json();
  const recipe = data.meals?.[0];
  if (!recipe?.strMealThumb || !recipe.strInstructions)
    throw new Error(`TheMealDB recipe ${id} is missing its photo or instructions`);
  return recipe;
}

async function downloadPhoto(url, destination) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Could not download photo ${url}: HTTP ${response.status}`);
  const image = Buffer.from(await response.arrayBuffer());
  if (image.length < 5000 || image[0] !== 0xff || image[1] !== 0xd8)
    throw new Error(`Downloaded photo is not a valid JPEG: ${url}`);
  await writeFile(destination, image);
}

function getIngredients(recipe) {
  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const name = asText(recipe[`strIngredient${index}`]);
    if (!name) continue;
    ingredients.push({
      name,
      quantity: asText(recipe[`strMeasure${index}`]),
      unit: "",
    });
  }
  if (!ingredients.length)
    throw new Error(`TheMealDB recipe ${recipe.idMeal} has no ingredients`);
  return ingredients;
}

function getSteps(instructions, id) {
  const paragraphs = instructions
    .split(/\r?\n+/)
    .map(asText)
    .filter(Boolean);
  const steps =
    paragraphs.length > 1
      ? paragraphs
      : instructions
          .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
          .map(asText)
          .filter(Boolean);
  if (!steps.length)
    throw new Error(`TheMealDB recipe ${id} has no usable instructions`);
  return steps;
}

await mkdir(imageDirectory, { recursive: true });

const recipes = [];
for (const [id, title, category, diet] of dishes) {
  const recipe = await getRecipe(id);
  const image = `/img/meal-${id}.jpg`;
  await downloadPhoto(recipe.strMealThumb, path.join(imageDirectory, `meal-${id}.jpg`));
  recipes.push({
    sourceId: id,
    sourceTitle: asText(recipe.strMeal),
    sourceUrl: `https://www.themealdb.com/meal.php?c=${id}`,
    title,
    description: `Công thức ${asText(recipe.strMeal)}${recipe.strArea ? ` theo phong cách ${asText(recipe.strArea)}` : ""}.`,
    image,
    category,
    country: asText(recipe.strArea) || "Quốc tế",
    prep_minutes: 15,
    cook_minutes: 30,
    servings: 4,
    difficulty: "Trung bình",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    diet,
    ingredients: getIngredients(recipe),
    steps: getSteps(recipe.strInstructions, id),
    views: 0,
  });
  console.log(`Downloaded ${image}: ${title}`);
}

await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");
console.log(`Saved ${recipes.length} recipes to ${path.relative(root, recipesPath)}.`);

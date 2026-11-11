// Tim 4 mon con thieu: tiramisu, bunbo, goicuon, coffee - thu nhieu tu khoa khac
import fs from "fs";
import https from "https";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(d.slice(0, 100)));
          }
        });
      })
      .on("error", reject);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200)
          return reject(new Error("HTTP " + res.statusCode));
        const ws = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on("finish", () => resolve(dest));
      })
      .on("error", reject);
  });
}

const tries = [
  ["tiramisu", ["tiramisu cake", "masala", "dessert", "cake"]],
  ["bunbo", ["spicy beef", "beef curry", "hu tieu", "noodle soup"]],
  [
    "goicuon",
    ["summer rolls", "vietnamese rolls", "salmon rolls", "spring roll"],
  ],
  ["coffee", ["latte", "espresso", "iced coffee drink", "coffee"]],
];

const done = [];
for (const [file, kws] of tries) {
  for (const kw of kws) {
    try {
      const data = await fetchJson(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(kw)}`,
      );
      if (data.meals && data.meals.length) {
        const meal = data.meals[0];
        await download(meal.strMealThumb, `public/img/${file}.jpg`);
        done.push([file, meal.strMeal, meal.strMealThumb]);
        break;
      }
    } catch (e) {
      /* tiep */
    }
  }
}
console.log(JSON.stringify(done, null, 1));
console.log("Filled:", done.length, "/4");
process.exit(0);

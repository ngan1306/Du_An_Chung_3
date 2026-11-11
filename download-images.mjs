// Tai anh thuc te tu TheMealDB cho 20 mon an
// moi mon: [file, tu khoa tim kiem tren TheMealDB, anh du phong]
import fs from "fs";
import https from "https";

// file <-> tu khoa tieng anh
const map = [
  ["pho", "beef noodle soup", "ramen"], // pho ~ noodle soup
  ["sushi", "sushi", "sushi"],
  ["salad", "avocado salad", "salad"],
  ["chicken", "honey chicken", "roasted chicken"],
  ["tiramisu", "tiramisu", "tiramisu"],
  ["soup", "fish soup", "soup"],
  ["banhmi", "sandwich", "baguette sandwich"],
  ["comtam", "pork chop", "grilled pork rice"],
  ["bunbo", "spicy beef noodle", "bun bo"],
  ["goicuon", "spring rolls", "fresh rolls"],
  ["ramen", "ramen", "seafood noodle"],
  ["pizza", "margherita", "pizza"],
  ["padthai", "pad thai", "stir-fried noodles"],
  ["pancake", "pancake", "pancakes"],
  ["cheese", "cheese sticks", "mozzarella sticks"],
  ["beefsteak", "steak", "beef steak"],
  ["springroll", "fried wonton", "dumpling"],
  ["icecream", "ice cream", "strawberry sundae"],
  ["smoothie", "mango smoothie", "mango shake"],
  ["coffee", "iced coffee", "coffee milk"],
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return https
            .get(
              res.headers.location,
              { headers: { "User-Agent": "Mozilla/5.0" } },
              (r2) => {
                let d2 = "";
                r2.on("data", (c) => (d2 += c));
                r2.on("end", () => {
                  try {
                    resolve(JSON.parse(d2));
                  } catch (e) {
                    reject(e);
                  }
                });
              },
            )
            .on("error", reject);
        }
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error("bad json: " + d.slice(0, 80)));
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
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        )
          return download(res.headers.location, dest).then(resolve, reject);
        if (res.statusCode !== 200)
          return reject(new Error("HTTP " + res.statusCode + " " + url));
        const ws = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on("finish", () => resolve(dest));
      })
      .on("error", reject);
  });
}

const results = [];
for (const [file, kw, fallback] of map) {
  let img = null;
  for (const term of [kw, fallback]) {
    try {
      const data = await fetchJson(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`,
      );
      if (data.meals && data.meals.length) {
        img = data.meals[0].strMealThumb;
        break;
      }
    } catch (e) {
      /* thu tiep theo */
    }
  }
  if (img) {
    const dest = `public/img/${file}.jpg`;
    try {
      await download(img, dest);
      results.push([file, dest, "OK " + img.slice(-30)]);
    } catch (e) {
      results.push([file, null, "DL FAIL " + e.message]);
    }
  } else {
    results.push([file, null, "NO RESULT"]);
  }
}
console.log(JSON.stringify(results, null, 1));
// ghi file mapping de update DB
fs.writeFileSync(
  "img-map.json",
  JSON.stringify(
    results.filter((r) => r[1]),
    null,
    1,
  ),
);
console.log("Done. OK:", results.filter((r) => r[1]).length + "/20");
process.exit(0);

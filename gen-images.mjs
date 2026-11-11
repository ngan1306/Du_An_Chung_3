// Tao 20 anh SVG cho 20 mon an: gradient + emoji lon + ten mon + trang tri
import fs from "fs";

// [file, mau1, mau2, emoji, ten mon]
const dishes = [
  ["pho", "#e8590c", "#f7b267", "🍜", "Phở bò Hà Nội"],
  ["sushi", "#0b7285", "#66d9e8", "🍣", "Sushi cá hồi"],
  ["salad", "#2f9e44", "#b2f2bb", "🥗", "Salad bơ mè rang"],
  ["chicken", "#c2255c", "#faa2c1", "🍗", "Gà nướng mật ong"],
  ["tiramisu", "#5f3dc4", "#d0bfff", "🍰", "Tiramisu Ý"],
  ["soup", "#e8590c", "#ffc078", "🍲", "Canh chua cá"],
  ["banhmi", "#d9480f", "#ffd8a8", "🥖", "Bánh mì Việt Nam"],
  ["comtam", "#e67700", "#ffe8cc", "🍚", "Cơm tấm sườn nướng"],
  ["bunbo", "#a61e4d", "#fcc2d7", "🍝", "Bún bò Huế"],
  ["goicuon", "#0ca678", "#96f2d7", "🥬", "Gỏi cuốn tôm thịt"],
  ["ramen", "#d9480f", "#ffec99", "🍤", "Ramen hải sản"],
  ["pizza", "#c92a2a", "#ffc9c9", "🍕", "Pizza margherita"],
  ["padthai", "#5c940d", "#d8f5a2", "🍱", "Pad Thái tôm"],
  ["pancake", "#e8590c", "#ffe3bf", "🥞", "Pancake mật ong"],
  ["cheese", "#b197fc", "#e5dbff", "🧆", "Phô mai que"],
  ["beefsteak", "#862e9c", "#eebefa", "🥩", "Bò bít tết"],
  ["springroll", "#f08c00", "#ffe066", "🥟", "Hoành thánh chiên"],
  ["icecream", "#1971c2", "#a5d8ff", "🍦", "Kem vanilla dâu"],
  ["smoothie", "#0b7285", "#99e9f2", "🥤", "Sinh tố xoài"],
  ["coffee", "#5c3c21", "#d9b08c", "☕", "Cà phê sữa đá"],
];

const svg = ([file, c1, c2, emoji, name]) => {
  const short = name.length > 16 ? name.slice(0, 15) + "…" : name;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="plate" cx="0.5" cy="0.5" r="0.5">
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="480" height="320" fill="url(#g)"/>
  <circle cx="60" cy="50" r="90" fill="#ffffff" opacity="0.12"/>
  <circle cx="430" cy="280" r="110" fill="#ffffff" opacity="0.10"/>
  <circle cx="415" cy="45" r="40" fill="#ffffff" opacity="0.14"/>
  <ellipse cx="240" cy="160" rx="150" ry="120" fill="url(#plate)"/>
  <ellipse cx="240" cy="165" rx="105" ry="80" fill="#ffffff" opacity="0.92"/>
  <ellipse cx="240" cy="165" rx="92" ry="68" fill="#f8f5f0"/>
  <text x="240" y="188" font-size="92" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <rect x="0" y="258" width="480" height="62" fill="#000000" opacity="0.45"/>
  <text x="240" y="296" font-size="22" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Arial">${short}</text>
</svg>`;
};

fs.mkdirSync("public/img", { recursive: true });
let n = 0;
for (const d of dishes) {
  fs.writeFileSync(`public/img/${d[0]}.svg`, svg(d));
  n++;
}
console.log(`Da tao ${n} anh SVG trong public/img/`);

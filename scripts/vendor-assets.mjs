import { copyFile, mkdir } from "node:fs/promises";
const files = [
  ["jspdf/dist/jspdf.umd.min.js", "jspdf.umd.min.js"],
  ["jspdf/LICENSE", "jspdf-LICENSE.txt"],
  [
    "jspdf-autotable/dist/jspdf.plugin.autotable.min.js",
    "jspdf.plugin.autotable.min.js",
  ],
  ["jspdf-autotable/LICENSE.txt", "jspdf-autotable-LICENSE.txt"],
  ["exceljs/dist/exceljs.min.js", "exceljs.min.js"],
  ["exceljs/LICENSE", "exceljs-LICENSE.txt"],
];
await mkdir(new URL("../public/vendor/", import.meta.url), { recursive: true });
for (const [source, destination] of files) {
  await copyFile(
    new URL(`../node_modules/${source}`, import.meta.url),
    new URL(`../public/vendor/${destination}`, import.meta.url),
  );
}
console.log("Librerie export copiate da versioni bloccate nel lockfile.");

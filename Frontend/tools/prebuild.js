const fs = require("fs");
const path = require("path");

const iconsFilePath = path.join(__dirname, "..", "node_modules", "@ui5", "webcomponents-ngx", "fesm2022", "ui5-webcomponents-ngx-icons.mjs");
const dayPickerFilePath = path.join(__dirname, "..", "node_modules", "@ui5", "webcomponents", "dist", "DayPicker.js");

const patchedWeekendFn = `    _isWeekend(oDate) {
        return oDate.getDay() === 5;
    }`;

const originalWeekendFnRegex = /    _isWeekend\(oDate\)\s*\{\s*const localeData = getCachedLocaleDataInstance\(getLocale\(\)\);[\s\S]*?iWeekendEnd\)\);\s*\n\s*\}/;

fs.readFile(iconsFilePath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading the icons file:", err);
    return;
  }
  if (data.includes("/dist/AllIcons.js")) {
    return;
  }
  const modifiedContent = data.replace(/\/dist\/AllIcons/g, "/dist/AllIcons.js");
  fs.writeFile(iconsFilePath, modifiedContent, "utf8", (writeErr) => {
    if (writeErr) {
      console.error("Error writing to the icons file:", writeErr);
    }
  });
});

fs.readFile(dayPickerFilePath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading the DayPicker file:", err);
    return;
  }
  if (data.includes("return oDate.getDay() === 5;")) {
    return;
  }
  if (!originalWeekendFnRegex.test(data)) {
    console.error("DayPicker _isWeekend pattern not found — patch skipped.");
    return;
  }
  const modifiedContent = data.replace(originalWeekendFnRegex, patchedWeekendFn);
  fs.writeFile(dayPickerFilePath, modifiedContent, "utf8", (writeErr) => {
    if (writeErr) {
      console.error("Error writing to the DayPicker file:", writeErr);
    }
  });
});

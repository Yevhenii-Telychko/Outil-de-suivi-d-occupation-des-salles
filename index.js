const fs = require("fs");
const path = require("path");
const CruParser = require("./CruParser");

const directoryPath = path.join(__dirname, 'data');

const files = fs.readdirSync(directoryPath, {
    recursive: true,
    withFileTypes: true
});

// Filter left only folders
const directories = files
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(dirent.parentPath, dirent.name));

for (const directory of directories) {
    // Read the .cru file
    const cruData = fs.readFileSync(path.join(__dirname, "data/AB/edt.cru"), "utf8");
    // Parse to SlotSet
    const parser = new CruParser(); // true = show debug
    const slotSet = parser.parse(cruData);

    // Sort and inspect
    slotSet.sort();
    console.log(slotSet.toArray());
}

// Export to .ics (example Monday = 6 Jan 2025)
// const monday = new Date(2025, 10, 28);
// const ics = parser.toICalendar(slotSet, {
//     weekStartDate: monday,
//     uidDomain: "my-university.fr"
// });
//
// fs.writeFileSync("edt.ics", ics, "utf8");
// console.log("iCalendar written to edt.ics");
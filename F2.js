const fs = require('fs');
const path = require('path');
const CruParser = require('./CruParser');
const colors = require('colors');

const cruParser = new CruParser();

function run(roomCode) {
    const baseDir = path.join(__dirname, 'database', 'SujetA_data');

    if (!fs.existsSync(baseDir)) {
        console.error('Base de données introuvable !'.red);
        return;
    }

    const subDirs = fs.readdirSync(baseDir, { withFileTypes: true })
                      .filter(d => d.isDirectory())
                      .map(d => path.join(baseDir, d.name));

    let capacities = [];

    subDirs.forEach(dir => {
        const cruFile = path.join(dir, 'EDT.CRU');
        if (fs.existsSync(cruFile)) {
            const data = fs.readFileSync(cruFile, 'utf8');
            const slots = cruParser.parse(data).toArray();

            slots.forEach(slot => {
                if (slot.room && slot.room.toUpperCase() === roomCode.toUpperCase()) {
                    capacities.push(slot.capacity);
                }
            });
        }
    });

    if (capacities.length === 0) {
        console.error(`Salle "${roomCode}" introuvable dans la base de données.`.red);
    } else {
        const maxCapacity = Math.max(...capacities);
        console.log(`Salle ${roomCode.toUpperCase()} a une capacité de ${maxCapacity} places`.green);
    }
}
module.exports = { run };
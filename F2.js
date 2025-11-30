const fs = require('fs');
const path = require('path');
const CruParser = require('./CruParser');
const colors = require('colors'); //colorer pr que ca slay

const cruParser = new CruParser();

function run(roomCode) {
    const baseDir = path.join(__dirname, 'database', 'SujetA_data');

    if (!fs.existsSync(baseDir)) {
        console.error('Base de données introuvable !'.red);
        return;
    }

    //ici on va lire les sous dossiers un par un 
    const subDirs = fs.readdirSync(baseDir, { withFileTypes: true })
                      .filter(d => d.isDirectory())
                      .map(d => path.join(baseDir, d.name));

    let capacities = []; // Stocke les capacités trouvées correspondants a la salle 

    subDirs.forEach(dir => {
        const cruFile = path.join(dir, 'EDT.CRU');
        if (fs.existsSync(cruFile)) {
            const data = fs.readFileSync(cruFile, 'utf8');
            const slots = cruParser.parse(data).toArray();

            // Cherche la salle demandée
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
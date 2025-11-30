const fs = require('fs');
const path = require('path');
const CruParser = require('./CruParser');
const colors = require('colors');

const cruParser = new CruParser();

const OPEN_HOUR = 8;
const CLOSE_HOUR = 20;

const DAYS = ["L", "M", "ME", "J", "V"];

function format(h) {
    const hour = Math.floor(h); // heure d'ouverture des salles
    const min = Math.round((h - hour) * 60);  // heure de fermeture des salles
    return (hour < 10 ? "0" : "") + hour + "h" + (min > 0 ? (min < 10 ? "0" : "") + min : "");
}

// on calcule les créneaux libres à partir des cours existant
function findFreeSlots(slots) {
    if (slots.length === 0) {
        // SI on a pas de cours = tt la journée est libre
        return [`[${format(OPEN_HOUR)}-${format(CLOSE_HOUR)}]`];
    }

    // Trie les créneaux par heure de début
    slots.sort((a, b) => a.start - b.start);

    let free = [];
    let current = OPEN_HOUR;

    slots.forEach(slot => {
        if (slot.start > current) {
            free.push(`[${format(current)}-${format(slot.start)}]`);
        }
        // mettre à jour current à la fin du slot actuel
        current = Math.max(current, slot.end);
    });

    if (current < CLOSE_HOUR) {
        // dernier créneau jusqu'à la fermeture

        free.push(`[${format(current)}-${format(CLOSE_HOUR)}]`);
    }

    return free;
}

function run(roomCode) {
    const baseDir = path.join(__dirname, 'database', 'SujetA_data');

    if (!fs.existsSync(baseDir)) {
        console.error('Base de données introuvable !'.red);
        return;
    }
    // lire tous les sous-dossiers 
    const subDirs = fs.readdirSync(baseDir, { withFileTypes: true })
                      .filter(d => d.isDirectory())
                      .map(d => path.join(baseDir, d.name));

    let allSlots = []; // Tous les créneaux de la salle qu'on stock

    subDirs.forEach(dir => {
        const cruFile = path.join(dir, 'EDT.CRU');
        if (fs.existsSync(cruFile)) {
            const data = fs.readFileSync(cruFile, 'utf8');
            const parsed = cruParser.parse(data).toArray();

            parsed.forEach(slot => {
                if (slot.room && slot.room.toUpperCase() === roomCode.toUpperCase()) {
                  
                    allSlots.push({
                        day: slot.day,                           
                        start: parseInt(slot.startTime.split(':')[0]) + parseInt(slot.startTime.split(':')[1])/60,
                        end: parseInt(slot.endTime.split(':')[0]) + parseInt(slot.endTime.split(':')[1])/60
             });
                }
            });
        }
    });

    if (allSlots.length === 0) {
        console.error(`Salle "${roomCode}" introuvable dans la base ou aucun cours trouvé.`.red);
        return;
    }

    console.log(`\n Créneaux libres pour la salle ${roomCode.toUpperCase()} :\n`.yellow);
    
    // pour chaque jour, afficher les créneaux libres
    DAYS.forEach(day => {
        const slotsOfDay = allSlots.filter(s => s.day === day);

        const free = findFreeSlots(slotsOfDay);

        if (free.length === 0) {
            console.log(`${day} : aucune plage libre`.red);
        } else {
            console.log(`${day} : ${free.join(', ')}`.green);
        }
    });

    console.log();
}

module.exports = { run };

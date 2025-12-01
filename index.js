const fs = require("fs");
const colors = require('colors');
const CruParser = require("./CruParser");

const canvas = require('canvas');
const path = require("node:path");
const SlotSet = require("./SlotSet");

const cli = require('@caporal/core').default;

const cruParser = new CruParser();

function getAllSlots() {
    const baseDir = path.join(__dirname, 'data');

    if (!fs.existsSync(baseDir)) {
        console.error('Can\'t find a database !'.red);
        return;
    }

    const subDirs = fs.readdirSync(baseDir, {withFileTypes: true})
        .filter(d => d.isDirectory())
        .map(d => path.join(baseDir, d.name));

    let slotsSet = SlotSet.empty();

    subDirs.forEach(dir => {
        const cruFile = path.join(dir, 'edt.cru');
        if (fs.existsSync(cruFile)) {
            const data = fs.readFileSync(cruFile, 'utf8');
            const slots = cruParser.parse(data).toArray();

            slots.forEach(slot => {
                slotsSet.add(slot);
            });
        }
    });
    return slotsSet
}

cli
    .version('Outil de suivi d\'occupation des salles')
    .version('0.1.0')
    //Recherche de salles par cours
    .command('search-rooms', 'Search for rooms by course')
    .argument('<course>', 'The course name or code')
    .action(({args, options, logger}) => {

        logger.info(`Searching for rooms for course: ${args.course}`.blue);

        let rooms = new Set();

        let slotSet = getAllSlots();

        let filteredSlotSet = slotSet.filter((slot) => {
            return slot.courseCode === args.course;
        }).toArray();

        if (filteredSlotSet.length > 0) {
            filteredSlotSet.forEach(slot => {
                rooms.add(`${slot.room} - ${slot.capacity} places`);
            });

            logger.info(`Rooms for course "${args.course}":`.blue);
            Array.from(rooms).forEach(room => {
                logger.info(room.green);
            });
        } else {
            return logger.error(`Cours inconnu: ${args.course}`.red);
        }

    })
    //Capacité d’une salle
    .command('room-capacity', 'Check the capacity of a room')
    .argument('<file>', 'The file containing room data')
    .argument('<room>', 'The room code')
    .action(({args, logger}) => {
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }
            logger.info(`Fetching capacity for room: ${args.room}`.blue);
            let slotSet = cruParser.parse(data);
        });
    })

    //Créneaux libres d’une salle
    .command('free-slots', 'Get available slots for a room')
    .argument('<file>', 'The file containing room schedule data')
    .argument('<room>', 'The room code')
    .action(({args, options, logger}) => {
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }

            logger.info(`Getting available slots for room: ${args.room} on day: ${options.day}`.blue);
            let slotSet = cruParser.parse(data);
        });
    })

    //Salles libres pour un créneau
    .command('available-rooms', 'Find rooms available for a specific time slot')
    .argument('<file>', 'The file containing room schedule data')
    .argument('<time>', 'Time to check for available rooms (HH:MM)')
    .argument('<day>', 'Day of the week to check availability', {validator: cli.STRING, default: 'All'})
    .action(({args, options, logger}) => {
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }

            logger.info(`Finding available rooms for time: ${args.time} on day: ${options.day}`.blue);
            let slotSet = cruParser.parse(data);
        });
    })

    //Génération d’un fichier iCalendar
    .command('generate-icalendar', 'Generate an iCalendar file for the schedule')
    .argument('<file>', 'The file containing the schedule data to convert into an iCalendar')
    .option('-o, --output <output>', 'Path to save the generated iCalendar file', {
        validator: cli.STRING,
        default: './schedule.ics'
    })
    .action(({args, options, logger}) => {
        // Read file data
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }

            logger.info(`Generating iCalendar file for schedule from: ${args.file}`.blue);
            let slotSet = cruParser.parse(data);
            logger.info(`Saving to: ${options.output}`.blue);
        });
    })

    //Vérification des conflits de planning
    .command('check-conflicts', 'Check for scheduling conflicts')
    .argument('<file>', 'The file containing schedule data to check for conflicts')
    .argument('<time>', 'Time to check for conflicts')
    .action(({args, logger}) => {
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }

            logger.info(`Checking for conflicts in schedule from file: ${args.file}`.blue);
            let slotSet = cruParser.parse(data);
        });
    })

    //Statistiques d’occupation des salles
    .command('room-usage-stats', 'Get room usage statistics')
    .argument('<file>', 'The file containing room usage data')
    .action(({args, options, logger}) => {
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }

            logger.info(`Gathering room usage stats from file: ${args.file} for day: ${options.day}`.blue);
            const slotSet = cruParser.parse(data).toArray();

            if (slotSet.length === 0) {
            return logger.error("No slots found in file.".red);
        }

        // Total number of hours in a normal week (8h*5j = 40h)
        const TOTAL_AVAILABLE_HOURS = 40;

        const roomStats = {};

        slotSet.forEach(slot => {
            // Parse "HH:MM" into numbers
            const [sh, sm] = slot.startTime.split(":").map(Number);
            const [eh, em] = slot.endTime.split(":").map(Number);

            const duration = (eh * 60 + em) - (sh * 60 + sm);

            if (!roomStats[slot.room]) {
                roomStats[slot.room] = 0;
            }

            roomStats[slot.room] += duration;
        });

        logger.info("=== Room Occupancy Statistics ===".yellow);

        let sumRates = 0, roomsCount = 0;

        Object.keys(roomStats).forEach(room => {
            const usedHours = roomStats[room] / 60;
            const rate = (usedHours / TOTAL_AVAILABLE_HOURS) * 100;
            sumRates += rate;
            roomsCount++;

            logger.info(`${room}: ${rate.toFixed(2)}% occupied`.green);
        });

        const avg = sumRates / roomsCount;

        logger.info(`\nAverage occupancy rate: ${avg.toFixed(2)}%`.cyan);
    });
})
    
    //Classement des salles par capacité
    .command('rank-rooms', 'Rank rooms by their capacity')
    .argument('<file>', 'The file containing room data to rank')
    .action(({args, logger}) => {
        // Read file data
        fs.readFile(args.file, 'utf8', (err, data) => {
            if (err) {
                return logger.error(`Error reading file: ${err}`.red);
            }

            logger.info(`Ranking rooms by capacity from file: ${args.file}`.blue);
            let slotSet = cruParser.parse(data).toArray();
            if (slotSet.length === 0) {
            return logger.error("No slots found in file.".red);
        }

        const capacityMap = {};

        slotSet.forEach(slot => {
            if (!capacityMap[slot.capacity]) {
                capacityMap[slot.capacity] = new Set();
            }
            capacityMap[slot.capacity].add(slot.room);
        });

        const sortedCap = Object.keys(capacityMap).map(Number).sort((a, b) => b - a);

        logger.info("=== Room Ranking by Capacity ===".yellow);

        sortedCap.forEach(cap => {
            logger.info(`${cap} places: ${capacityMap[cap].size} room(s)`.green);
        });
    });
})
cli.run(process.argv.slice(2));

// Export to .ics (example Monday = 6 Jan 2025)
// const monday = new Date(2025, 10, 28);
// const ics = parser.toICalendar(slotSet, {
//     weekStartDate: monday,
//     uidDomain: "my-university.fr"
// });
//
// fs.writeFileSync("edt.ics", ics, "utf8");
// console.log("iCalendar written to edt.ics");
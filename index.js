const fs = require("fs");
const colors = require('colors');
const CruParser = require("./CruParser");

const path = require("node:path");
const SlotSet = require("./SlotSet");
const Slot = require("./Slot");

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
            return logger.warn(`Cours inconnu: ${args.course}`.red);
        }

    })
    //Capacité d’une salle
    .command('room-capacity', 'Check the capacity of a room')
    .argument('<room>', 'The room code')
    .action(({args, logger}) => {
        logger.info(`Fetching capacity for room: ${args.room}`.blue);
        let slotSet = getAllSlots().toArray();
        let capacities = []; // Stocke les capacités trouvées correspondants a la salle

        slotSet.forEach(slot => {
            if (slot.room && slot.room.toUpperCase() === args.room.toUpperCase()) {
                capacities.push(slot.capacity);
            }
        });

        if (capacities.length === 0) {
            console.warn(`Salle "${args.room}" introuvable dans la base de données.`.red);
        } else {
            const maxCapacity = Math.max(...capacities);
            console.log(`Salle ${args.room.toUpperCase()} a une capacité de ${maxCapacity} places`.green);
        }
    })

    //Créneaux libres d’une salle
    .command('free-slots', 'Get available slots for a room')
    .argument('<room>', 'The room code')
    .action(({args, options, logger}) => {
        logger.info(`Getting available slots for room: ${args.room}`.blue);

        const slotSet = getAllSlots();
        const filteredSlotSet = slotSet
            .filter((slot) => slot.room === args.room)
            .toArray();

        const days = ['L', 'MA', 'ME', 'J', 'V'];
        const OPEN_MINUTES = 8 * 60;
        const CLOSE_MINUTES = 20 * 60;

        const busyByDay = {};
        for (const day of days) {
            busyByDay[day] = [];
        }

        const toMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const formatTime = (minutes) => {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        const mergeIntervals = (intervals) => {
            if (intervals.length === 0) return [];
            intervals.sort((a, b) => a.start - b.start);

            const merged = [intervals[0]];
            for (let i = 1; i < intervals.length; i++) {
                const last = merged[merged.length - 1];
                const current = intervals[i];

                if (current.start <= last.end) {
                    last.end = Math.max(last.end, current.end);
                } else {
                    merged.push({...current});
                }
            }
            return merged;
        };

        filteredSlotSet.forEach(slot => {
            if (!days.includes(slot.day)) return;

            const start = toMinutes(slot.startTime);
            const end = toMinutes(slot.endTime);

            busyByDay[slot.day].push({start, end});
        });

        if (filteredSlotSet.length === 0) {
            logger.info("Aucun cours pour cette salle, toute la plage est libre (08:00-20:00).".yellow);
        }

        for (const day of days) {
            const mergedBusy = mergeIntervals(busyByDay[day]);
            const freeIntervals = [];

            let current = OPEN_MINUTES;

            for (const interval of mergedBusy) {
                if (interval.start > current) {
                    freeIntervals.push({start: current, end: interval.start});
                }
                current = Math.max(current, interval.end);
            }

            if (current < CLOSE_MINUTES) {
                freeIntervals.push({start: current, end: CLOSE_MINUTES});
            }

            if (freeIntervals.length === 0) {
                logger.info(`${day} : aucune plage libre`);
            } else {
                const freeStr = freeIntervals
                    .map(({start, end}) => `${formatTime(start)}-${formatTime(end)}`)
                    .join(', ');
                logger.info(`${day} : ${freeStr}`);
            }
        }
    })

    //Salles libres pour un créneau
    .command('available-rooms', 'Find rooms available for a specific time slot')
    .argument('<startTime>', 'Start time to check for available rooms (HH:MM)')
    .argument('<endTime>', 'End time to check for available rooms (HH:MM)')
    .argument('<day>', 'Day of the week to check availability', {validator: cli.STRING, default: 'All'})
    .action(({args, options, logger}) => {
        logger.info(`Finding available rooms for time: ${args.time} on day: ${args.day}`.blue);
        let slotSet = getAllSlots();
        const slotToReserve = new Slot({
            courseCode: "",
            lessonType: "",
            capacity: 0,
            startTime: args.startTime,
            endTime: args.endTime,
            day: args.day,
            room: "",
            subgroup: "",
            groupIndex: ""
        })
        const allRooms = [...new Set(slotSet.toArray().map(s => s.room))];
        const roomsBusy = new Set();

        slotSet.toArray().forEach(slot => {
            slotToReserve.room = slot.room;
            if (slot.overlapsSlot(slotToReserve)) {
                roomsBusy.add(slot.room);
            }
        })
        const freeRooms = allRooms.filter((room) => !roomsBusy.has(room));
        logger.info(`All available rooms from ${args.startTime} to ${args.endTime} on day: ${args.day}`.green);
        freeRooms.forEach(room => {
            logger.info(`Room ${room} `);
        })
    })

    //Génération d’un fichier iCalendar
    .command('generate-icalendar', 'Generate an iCalendar (.ics) file for a user schedule')
    .option('-c, --courses <courses>', 'Comma-separated list of course codes (ex: ME101,TP202)', {
        validator: cli.STRING
    })
    .option('--start <date>', 'Start date (YYYY-MM-DD)', {
        validator: cli.STRING,
        required: true
    })
    .option('--end <date>', 'End date (YYYY-MM-DD)', {
        validator: cli.STRING,
        required: true
    })
    .option('-o, --output <output>', 'Path to save the generated iCalendar file', {
        validator: cli.STRING,
        default: './mon_agenda.ics'
    })
    .option('--uid-domain <domain>', 'Domain used for event UIDs', {
        validator: cli.STRING,
        default: 'edt.example.fr'
    })
    .action(({options, logger}) => {
        logger.info('Generating iCalendar file for selected courses...'.blue);

        const slotSet = getAllSlots();
        if (!slotSet) {
            return logger.error('No CRU data found. Please check the data directory.'.red);
        }

        const parseDate = (value, label) => {
            if (!value) {
                throw new Error(`Missing ${label} date`);
            }
            const parts = value.split('-');
            if (parts.length !== 3) {
                throw new Error(`Invalid ${label} date format, expected YYYY-MM-DD: ${value}`);
            }
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d);
        };

        try {
            const periodStart = parseDate(options.start, 'start');
            const periodEnd = parseDate(options.end, 'end');

            if (periodEnd < periodStart) {
                throw new Error('End date must be after start date.');
            }

            let courses = null;
            if (options.courses) {
                courses = options.courses
                    .split(',')
                    .map(c => c.trim())
                    .filter(Boolean);
            }

            const ics = cruParser.toICalendar(slotSet, {
                courses,
                periodStart,
                periodEnd,
                uidDomain: options.uidDomain
            });

            if (!ics.includes('BEGIN:VEVENT')) {
                logger.warn(
                    'Aucun cours trouvé pour les paramètres demandés (cours + période). Export annulé.'
                        .yellow
                );
            }

            fs.writeFileSync(options.output, ics, 'utf8');
            logger.info(`Export réussi: ${options.output}`.green);
        } catch (err) {
            logger.error(
                `Erreur lors de la génération du fichier iCalendar: ${err.message}`.red
            );
        }
    })

    //Vérification des conflits de planning
    .command('check-conflicts', 'Check for scheduling conflicts')
    .action(({args, logger}) => {
        logger.info(`Checking for conflicts in schedule`.blue);
        let slotSet = getAllSlots().toArray();
        let isOverlap = false;
        for (let i = 0; i < slotSet.length; i++) {
            for (let j = i + 1; j < slotSet.length - 1; j++) {
                if (slotSet[i].overlapsSlot(slotSet[j])) {
                    isOverlap = true;
                    let slot1 = slotSet[i];
                    let slot2 = slotSet[j];
                    logger.warn(`Salle ${slot1.room}, ${slot1.day} ${slot1.startTime}-${slot1.endTime} chevauche ${slot2.startTime}-${slot2.endTime}`.red);
                }
            }
        }
        if (!isOverlap) {
            logger.info(`Données valides, aucune collision détectée`.green)
        }
    })

    //Statistiques d’occupation des salles
    .command('room-usage-stats', 'Get room usage statistics')
    .action(({args, options, logger}) => {


        logger.info(`Gathering room usage stats from file: ${args.file}`.blue);
        const slotSet = getAllSlots().toArray();

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
    })

    //Classement des salles par capacité
    .command('rank-rooms', 'Rank rooms by their capacity')
    .action(({args, logger}) => {
        logger.info(`Ranking rooms by capacity from file: ${args.file}`.blue);
        let slotSet = getAllSlots().toArray();
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
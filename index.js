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

const F2 = require('./F2');


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
    .argument('<room>', 'The room code')
    .action(({args, logger}) => {
        logger.info(`Fetching capacity for room: ${args.room}`.blue);
        let slotSet = getAllSlots();
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
    .argument('<file>', 'The file containing room schedule data')
    .argument('<time>', 'Time to check for available rooms (HH:MM)')
    .argument('<day>', 'Day of the week to check availability', {validator: cli.STRING, default: 'All'})
    .action(({args, options, logger}) => {
        logger.info(`Finding available rooms for time: ${args.time} on day: ${options.day}`.blue);
        let slotSet = getAllSlots();

    })

    //Génération d’un fichier iCalendar
    .command('generate-icalendar', 'Generate an iCalendar file for the schedule')
    .argument('<file>', 'The file containing the schedule data to convert into an iCalendar')
    .option('-o, --output <output>', 'Path to save the generated iCalendar file', {
        validator: cli.STRING,
        default: './schedule.ics'
    })
    .action(({args, options, logger}) => {
        logger.info(`Generating iCalendar file for schedule from: ${args.file}`.blue);
        let slotSet = getAllSlots();
        logger.info(`Saving to: ${options.output}`.blue);
    })

    //Vérification des conflits de planning
    .command('check-conflicts', 'Check for scheduling conflicts')
    .argument('<file>', 'The file containing schedule data to check for conflicts')
    .argument('<time>', 'Time to check for conflicts')
    .action(({args, logger}) => {
        logger.info(`Checking for conflicts in schedule from file: ${args.file}`.blue);
        let slotSet = getAllSlots();
    })

    //Statistiques d’occupation des salles
    .command('room-usage-stats', 'Get room usage statistics')
    .argument('<file>', 'The file containing room usage data')
    .action(({args, options, logger}) => {
        logger.info(`Gathering room usage stats from file: ${args.file} for day: ${options.day}`.blue);
        let slotSet = getAllSlots();

    })

    //Classement des salles par capacité
    .command('rank-rooms', 'Rank rooms by their capacity')
    .argument('<file>', 'The file containing room data to rank')
    .action(({args, logger}) => {
            logger.info(`Ranking rooms by capacity from file: ${args.file}`.blue);
            let slotSet = getAllSlots();
    });

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
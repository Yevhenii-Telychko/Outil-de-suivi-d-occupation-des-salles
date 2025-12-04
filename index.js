const fs = require("fs");
const colors = require("colors");
const cli = require("@caporal/core").default;
const ScheduleService = require("./ScheduleService");

const service = new ScheduleService();

function parseDate(value, label) {
    if (!value) {
        throw new Error(`Date ${label} manquante`);
    }
    const parts = value.split("-");
    if (parts.length !== 3) {
        throw new Error(`Format de date ${label} invalide, attendu AAAA-MM-JJ: ${value}`);
    }
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
}

cli
    .version("Outil de suivi d'occupation des salles")
    .version("0.2.0")

    // F1 – Recherche de salles par cours
    .command("search-rooms", "Rechercher des salles par cours")
    .argument("<course>", "Le nom ou code du cours")
    .action(({ args, logger }) => {
        logger.info(`Recherche des salles pour le cours: ${args.course}`.blue);
        try {
            const rooms = service.searchRoomsByCourse(args.course);
            logger.info(`Salles pour le cours "${args.course}":`.blue);
            rooms.forEach(r => {
                logger.info(`${r.room} - ${r.capacity} lieux`.green);
            });
        } catch (e) {
            logger.error(e.message.red);
        }
    })

    // F2 – Capacité d’une salle
    .command("room-capacity", "Vérifier la capacité d’une salle")
    .argument("<room>", "le code de salle")
    .action(({ args, logger }) => {
        logger.info(`Capacité de récupération pour la salle: ${args.room}`.blue);
        try {
            const cap = service.getRoomCapacity(args.room);
            logger.info(
                `Salle ${args.room.toUpperCase()} a une capacité de ${cap} places`.green
            );
        } catch (e) {
            logger.error(e.message.red);
        }
    })

    // F3 – Créneaux libres d’une salle
    .command("free-slots", "Obtenir des créneaux disponibles pour une salle")
    .argument("<room>", "le code de salle")
    .action(({ args, logger }) => {
        logger.info(`Obtenir des créneaux disponibles pour la salle: ${args.room}`.blue);
        try {
            const freeByDay = service.getFreeSlotsForRoom(args.room);

            Object.keys(freeByDay).forEach(day => {
                const intervals = freeByDay[day];
                if (intervals.length === 0) {
                    logger.info(`${day} : aucune plage libre`.yellow);
                } else {
                    const text = intervals
                        .map(i => `${i.start}-${i.end}`)
                        .join(", ");
                    logger.info(`${day} : ${text}`.green);
                }
            });
        } catch (e) {
            logger.error(e.message.red);
        }
    })

    // F4 – Salles libres pour un créneau
    .command("available-rooms", "Trouver des salles disponibles pour un créneau horaire spécifique")
    .argument("<startTime>", "Heure de début (HH:MM)")
    .argument("<endTime>", "Heure de fin (HH:MM)")
    .argument("<day>", "Jour de la semaine pour vérifier la disponibilité (L, MA, ME, J, V)")
    .action(({ args, logger }) => {
        logger.info(
            `Trouver des salles disponibles de ${args.startTime} à ${args.endTime} le jour: ${args.day}`.blue
        );
        try {
            const rooms = service.getAvailableRooms(args.startTime, args.endTime, args.day);
            if (rooms.length === 0) {
                logger.warn("Aucune salle disponible pour ce créneau.".yellow);
            } else {
                logger.info(
                    `Toutes les salles disponibles de ${args.startTime} à ${args.endTime} le jour : ${args.day}`.green
                );
                rooms.forEach(room => logger.info(`Salle ${room}`));
            }
        } catch (e) {
            logger.error(e.message.red);
        }
    })

    // F5 – Génération d’un fichier iCalendar
    .command("generate-icalendar", "Générer un fichier iCalendar (.ics) pour une planification utilisateur")
    .option(
        "-c, --courses <courses>",
        "Liste des codes de cours séparés par des virgules (ex: ME101, TP202)",
        { validator: cli.STRING }
    )
    .option("--start <date>", "Date de début (AAAA-MM-JJ)", {
        validator: cli.STRING,
        required: true
    })
    .option("--end <date>", "Date de fin (AAAA-MM-JJ)", {
        validator: cli.STRING,
        required: true
    })
    .option(
        "-o, --output <output>",
        "Chemin pour enregistrer le fichier iCalendar généré",
        { validator: cli.STRING, default: "./mon_agenda.ics" }
    )
    .option("--uid-domain <domain>", "Domaine utilisé pour les UID d’événements", {
        validator: cli.STRING,
        default: "edt.example.fr"
    })
    .action(({ options, logger }) => {
        logger.info("Génération du fichier iCalendar pour les cours sélectionnés...".blue);
        try {
            const periodStart = parseDate(options.start, "start");
            const periodEnd = parseDate(options.end, "end");

            let courses = null;
            if (options.courses) {
                courses = options.courses
                    .split(",")
                    .map(c => c.trim())
                    .filter(Boolean);
            }

            const ics = service.generateICalendar({
                courses,
                periodStart,
                periodEnd,
                uidDomain: options["uid-domain"]
            });

            if (!ics.includes("BEGIN:VEVENT")) {
                logger.warn(
                    "Aucun cours trouvé pour les paramètres demandés (cours + période). Export annulé."
                        .yellow
                );
            }

            fs.writeFileSync(options.output, ics, "utf8");
            logger.info(`Export réussi: ${options.output}`.green);
        } catch (e) {
            logger.error(
                `Erreur lors de la génération du fichier iCalendar: ${e.message}`.red
            );
        }
    })

    // F6 – Vérification des conflits de planning
    .command("check-conflicts", "Vérifier les conflits d’horaire")
    .action(({ logger }) => {
        logger.info("Vérification des conflits dans le calendrier".blue);
        try {
            const conflicts = service.checkConflicts();
            if (conflicts.length === 0) {
                logger.info("Données valides, aucune collision détectée".green);
            } else {
                conflicts.forEach(c => {
                    logger.warn(
                        `Salle ${c.room}, ${c.day} ` +
                        `${c.slot1.startTime}-${c.slot1.endTime} chevauche ` +
                        `${c.slot2.startTime}-${c.slot2.endTime}`.red
                    );
                });
            }
        } catch (e) {
            logger.error(e.message.red);
        }
    })

    // F7 – Statistiques d’occupation des salles
    .command("room-usage-stats", "Obtenir des statistiques sur l’utilisation de la salle")
    .action(({ logger }) => {
        logger.info("Statistiques d’utilisation de la salle de rassemblement...".blue);
        try {
            const { perRoom, average } = service.getRoomUsageStats();
            logger.info("Statistiques sur l’occupation des salles".yellow);
            Object.keys(perRoom).forEach(room => {
                logger.info(`${room}: ${perRoom[room].toFixed(2)}% occupé`.green);
            });
            logger.info(`\nTaux d'occupation moyen: ${average.toFixed(2)}%`.cyan);
        } catch (e) {
            logger.error(e.message.red);
        }
    })

    // F8 – Classement des salles par capacité
    .command("rank-rooms", "Classez les salles par leur capacité")
    .action(({ logger }) => {
        logger.info("Classement des salles par capacité...".blue);
        try {
            const ranking = service.rankRoomsByCapacity();
            ranking.forEach(item => {
                logger.info(
                    `${item.capacity} places: ${item.roomsCount} salle(s)`.green
                );
            });
        } catch (e) {
            logger.error(e.message.red);
        }
    });

cli.run(process.argv.slice(2));

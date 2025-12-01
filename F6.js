// F6.js
//
// Détecte tous les conflits d'horaires dans un tableau de slots

function convertToMinutes(t) {
    const [H, M] = t.split(":").map(Number);
    return H * 60 + M;
}

function detecterConflits(slots) {
    const conflicts = [];

    // Regroupement des cours par salle
    const byRoom = {};

    for (const slot of slots) {
        if (!byRoom[slot.room]) byRoom[slot.room] = [];
        byRoom[slot.room].push(slot);
    }

    const dayOrder = { L: 1, MA: 2, ME: 3, J: 4, V: 5 };

    for (const [room, list] of Object.entries(byRoom)) {
        // Tri par jour puis heure de début
        list.sort((a, b) => {
            if (a.day !== b.day) return dayOrder[a.day] - dayOrder[b.day];
            return convertToMinutes(a.startTime) - convertToMinutes(b.startTime);
        });

        // Détection des chevauchements
        for (let i = 0; i < list.length - 1; i++) {
            const c1 = list[i];
            const c2 = list[i + 1];

            const end1 = convertToMinutes(c1.endTime);
            const start2 = convertToMinutes(c2.startTime);

            if (end1 > start2) {
                conflicts.push(
                    `Conflit en salle ${room} : ${c1.day} ${c1.startTime}-${c1.endTime} chevauche ${c2.startTime}-${c2.endTime}`
                );
            }
        }
    }

    return conflicts;
}

module.exports = { detecterConflits };

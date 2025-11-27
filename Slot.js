const DAY_ORDER = {
    "L": 1,
    "MA": 2,
    "ME": 3,
    "J": 4,
    "V": 5,
}

class Slot {
    /**
     * @param {Object} options
     * @param {string} options.courseCode  // course code, e.g. ME01
     * @param {string} options.lessonType  // CM / TD / TP (mapped from C1 / D1 / T1)
     * @param {number} options.capacity    // numeric capacity
     * @param {string} options.day         // L, MA, ME, J, V
     * @param {string} options.startTime   // "HH:MM"
     * @param {string} options.endTime     // "HH:MM"
     * @param {string} options.room        // room code (4 chars)
     * @param {string} options.subgroup    // e.g. F1
     * @param {number|string} [options.groupIndex] // optional group index from CRU
     */
    constructor(options) {
        this.courseCode = options.courseCode;
        this.lessonType = options.lessonType;
        this.capacity = options.capacity;
        this.day = options.day;
        this.startTime = options.startTime;
        this.endTime = options.endTime;
        this.room = options.room;
        this.subgroup = options.subgroup;
        this.groupIndex = options.groupIndex;
    }

    // Helper: convert 'HH:MM' to minutes since midnight
    _timeToMinute(t) {
        const [hours, minutes] = t.split(":").map(Number);
        return hours * 60 + minutes;
    }

    // For chevauche / ordre
    getStartMinutes() {
        return this._timeToMinute(this.startTime);
    }

    getEndMinutes() {
        return this._timeToMinute(this.endTime);
    }

    /**
     * All fields must be identical.
     * @param {Slot} anotherSlot
     * @returns {boolean}
     */

    equalsSlot(anotherSlot) {
        return (
            this.courseCode === anotherSlot.courseCode &&
            this.lessonType === anotherSlot.lessonType &&
            this.capacity === anotherSlot.capacity &&
            this.day === anotherSlot.day &&
            this.startTime === anotherSlot.startTime &&
            this.endTime === anotherSlot.endTime &&
            this.room === anotherSlot.room &&
            this.subgroup === anotherSlot.subgroup &&
            this.groupIndex === anotherSlot.groupIndex
        );
    }

    /**
     * Same day AND same room AND time intervals overlap:
     * start1 < end2 && end1 > start2
     * @param {Slot} anotherSlot
     * @returns {boolean}
     */
    overlapsSlot(anotherSlot) {
        if (this.day !== anotherSlot.day) return false;
        if (this.room !== anotherSlot.room) return false;

        const start1 = this.getStartMinutes();
        const end1 = this.getEndMinutes();
        const start2 = anotherSlot.getStartMinutes();
        const end2 = anotherSlot.getEndMinutes();

        return start1 < end2 && end1 > start2;
    }

    /**
     * Sort by day (L < MA < ME < J < V), then by start time.
     * Negative if S1 < S2, positive if S1 > S2, 0 if equal.
     * @param {Slot} anotherSlot
     * @returns {number}
     */
    compareSlot(anotherSlot) {
        const j1 = DAY_ORDER[this.day] || 0;
        const j2 = DAY_ORDER[anotherSlot.day] || 0;

        if (j1 !== j2) {
            return j1 - j2;
        }
        return this.getStartMinutes() - anotherSlot.getStartMinutes();
    }
}

module.exports = Slot;

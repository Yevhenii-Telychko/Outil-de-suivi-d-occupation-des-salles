// CruParser.js

const Slot  = require("./slot");
const SlotSet = require("./SlotSet");

/**
 * Map raw lesson type (C1 / D1 / D2 / T1 / T2 / ...) to normalized type (CM / TD / TP).
 */
function mapLessonType(raw) {
    if (!raw) return raw;
    const first = raw[0].toUpperCase();
    switch (first) {
        case "C": return "CM"; // Lecture
        case "D": return "TD"; // Tutorial
        case "T": return "TP"; // Lab
        default:  return raw;
    }
}

/**
 * Parse one slot line.
 *
 * Examples from your file:
 *   1,D1,P=24,H=ME 16:00-18:00,F1,S=S104//
 *   1,T1,P=17,H=V 8:00-8:30,F1,S=EXT1//
 */
function parseSlotLine(line, currentCourseCode) {
    const slotRegex =
        /^(\d+)\s*,\s*([A-Za-z]+\d+)\s*,\s*P=\s*(\d{1,3})\s*,\s*H=\s*(L|MA|ME|J|V)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*,\s*([A-Za-z]\d)\s*,\s*S=\s*([A-Za-z0-9]{4})\/\/\s*$/;

    const m = line.match(slotRegex);
    if (!m) {
        throw new Error("Invalid slot-line: " + line);
    }

    const groupIndex    = parseInt(m[1], 10);
    const lessonTypeRaw = m[2];
    const capacity      = parseInt(m[3], 10);
    const day           = m[4];
    const startTime     = m[5];
    const endTime       = m[6];
    const subgroup      = m[7];
    const room          = m[8];

    const lessonType = mapLessonType(lessonTypeRaw);

    return new Slot({
        courseCode: currentCourseCode,
        lessonType,
        capacity,
        day,
        startTime,
        endTime,
        room,
        subgroup,
        groupIndex
    });
}

class CruParser {
    /**
     * @param {boolean} showDebug - if true, logs parsed courses and slots
     */
    constructor(showDebug = false) {
        this.showDebug = showDebug;
    }

    /**
     * Parse CRU content into a SlotSet.
     *
     * - Ignores header text before first real course.
     * - Ignores example course like "+UVUV" (no digit in code).
     * - Ignores footer line "Page générée en ...".
     *
     * @param {string} data - raw contents of the .cru file
     * @returns {SlotSet}
     */
    parse(data) {
        const lines = data.split(/\r?\n/);
        const slotSet = SlotSet.empty();

        let currentCourseCode = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line === "") continue;

            // Explicitly skip "Page générée en ..." footer
            if (line.startsWith("Page ")) {
                if (this.showDebug) {
                    console.log("Skipping footer line:", line);
                }
                continue;
            }

            // Course header: lines starting with '+'
            if (line.startsWith("+")) {
                const courseCode = line.slice(1).trim();

                // Ignore example headers like "+UVUV" (no digits at all)
                if (!/\d/.test(courseCode)) {
                    if (this.showDebug) {
                        console.log("Ignoring example course header:", courseCode);
                    }
                    currentCourseCode = null;
                    continue;
                }

                currentCourseCode = courseCode;
                if (this.showDebug) {
                    console.log("Course:", currentCourseCode);
                }
                continue;
            }

            // Lines that look like slot lines should start with "digits,"
            const looksLikeSlot = /^\d+\s*,/.test(line);

            // No active course and not a slot → header / comment → skip
            if (!currentCourseCode && !looksLikeSlot) {
                if (this.showDebug) {
                    console.log("Skipping non-course, non-slot line:", line);
                }
                continue;
            }

            // We have a course and the line looks like a slot → parse
            if (currentCourseCode && looksLikeSlot) {
                try {
                    const slot = parseSlotLine(line, currentCourseCode);
                    if (this.showDebug) {
                        console.log("  Slot:", slot);
                    }
                    slotSet.add(slot);
                } catch (err) {
                    if (this.showDebug) {
                        console.warn(
                            "Skipping invalid slot line:",
                            line,
                            "| error:",
                            err.message
                        );
                    }
                }
                continue;
            }

            // Anything else (random text between stuff) → skip
            if (this.showDebug) {
                console.log("Skipping line:", line);
            }
        }

        return slotSet;
    }

    /**
     * Export a SlotSet to an iCalendar (.ics) string.
     *
     * Options:
     *   - weekStartDate: Date of the Monday of the reference week.
     *       L  -> +0 days
     *       MA -> +1
     *       ME -> +2
     *       J  -> +3
     *       V  -> +4
     *   - uidDomain: domain used in UID (default: "example.com")
     *
     * @param {SlotSet} slotSet
     * @param {Object} [options]
     * @param {Date} [options.weekStartDate]
     * @param {string} [options.uidDomain]
     * @returns {string} iCalendar string
     */
    toICalendar(slotSet, options = {}) {
        const weekStartDate = options.weekStartDate || new Date();
        const uidDomain = options.uidDomain || "example.com";

        const items = slotSet.toArray();

        let lines = [];
        lines.push("BEGIN:VCALENDAR");
        lines.push("VERSION:2.0");

        items.forEach((slot, index) => {
            lines = lines.concat(
                this._slotToVEvent(slot, index, weekStartDate, uidDomain)
            );
        });

        lines.push("END:VCALENDAR");

        return lines.join("\r\n") + "\r\n";
    }

    _dayOffset(day) {
        switch (day) {
            case "L":  return 0;
            case "MA": return 1;
            case "ME": return 2;
            case "J":  return 3;
            case "V":  return 4;
            default:   return 0;
        }
    }

    _formatDateTime(dt) {
        const year = dt.getFullYear();
        const month = dt.getMonth() + 1;
        const day = dt.getDate();
        const hh = dt.getHours();
        const mm = dt.getMinutes();
        const ss = dt.getSeconds();

        const pad2 = n => (n < 10 ? "0" + n : "" + n);

        return (
            year.toString().padStart(4, "0") +
            pad2(month) +
            pad2(day) +
            "T" +
            pad2(hh) +
            pad2(mm) +
            pad2(ss)
        );
    }

    _parseTimeToDate(baseDate, dayCode, timeStr) {
        const offset = this._dayOffset(dayCode);
        const dt = new Date(baseDate.getTime());
        dt.setDate(baseDate.getDate() + offset);

        const [hhStr, mmStr] = timeStr.split(":");
        const hh = parseInt(hhStr, 10);
        const mm = parseInt(mmStr, 10);
        dt.setHours(hh, mm, 0, 0);
        return dt;
    }

    _slotToVEvent(slot, index, weekStartDate, uidDomain) {
        const dtStart = this._parseTimeToDate(
            weekStartDate,
            slot.day,
            slot.startTime
        );
        const dtEnd = this._parseTimeToDate(
            weekStartDate,
            slot.day,
            slot.endTime
        );

        const dtStartStr = this._formatDateTime(dtStart);
        const dtEndStr = this._formatDateTime(dtEnd);

        const uid = `cru-${slot.courseCode}-${slot.day}-${index}@${uidDomain}`;

        const summary =
            `${slot.courseCode} ${slot.lessonType}` +
            (slot.subgroup ? ` (${slot.subgroup})` : "");

        const location = slot.room || "";

        return [
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTART:${dtStartStr}`,
            `DTEND:${dtEndStr}`,
            `SUMMARY:${summary}`,
            `LOCATION:${location}`,
            "END:VEVENT"
        ];
    }
}

module.exports = CruParser;

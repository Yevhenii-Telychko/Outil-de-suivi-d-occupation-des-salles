// CruParser.js

const Slot = require("./Slot");
const SlotSet = require("./SlotSet");

/**
 * Map raw lesson type (C1 / D1 / D2 / T1 / T2 / ...) to normalized type (CM / TD / TP).
 */
function mapLessonType(raw) {
    if (!raw) return raw;
    const first = raw[0].toUpperCase();
    switch (first) {
        case "C":
            return "CM"; // Lecture
        case "D":
            return "TD"; // Tutorial
        case "T":
            return "TP"; // Lab
        default:
            return raw;
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

    const groupIndex = parseInt(m[1], 10);
    const lessonTypeRaw = m[2];
    const capacity = parseInt(m[3], 10);
    const day = m[4];
    const startTime = m[5];
    const endTime = m[6];
    const subgroup = m[7];
    const room = m[8];

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
     * Export a SlotSet to an iCalendar (.ics) string for a given user.
     *
     * Options:
     *   - courses: array of course codes to keep (e.g. ["ME101", "TP202"])
     *   - periodStart: Date (start of export period, inclusive)
     *   - periodEnd:   Date (end of export period, inclusive)
     *   - uidDomain:   domain used in UID (default: "example.com")
     *
     * @param {SlotSet} slotSet
     * @param {Object} [options]
     * @param {string[]} [options.courses]
     * @param {Date} [options.periodStart]
     * @param {Date} [options.periodEnd]
     * @param {string} [options.uidDomain]
     * @returns {string} iCalendar string
     */
    toICalendar(slotSet, options = {}) {
        const uidDomain = options.uidDomain || "example.com";

        const periodStart = options.periodStart || new Date();
        const periodEnd = options.periodEnd || new Date(periodStart.getTime());

        const courses =
            options.courses && options.courses.length
                ? new Set(options.courses)
                : null;

        // Filtrer les créneaux pour ne garder que ceux de l'utilisateur
        const items = slotSet
            .filter(slot => !courses || courses.has(slot.courseCode))
            .sort()
            .toArray();

        let lines = [];
        lines.push("BEGIN:VCALENDAR");
        lines.push("VERSION:2.0");
        lines.push("PRODID:-//UTT//CRU Export//FR");
        lines.push("CALSCALE:GREGORIAN");

        const dtStamp = this._formatDateTime(new Date());

        items.forEach((slot, index) => {
            const veventLines = this._slotToVEvent(
                slot,
                index,
                uidDomain,
                dtStamp,
                periodStart,
                periodEnd
            );
            if (veventLines.length > 0) {
                lines = lines.concat(veventLines);
            }
        });

        lines.push("END:VCALENDAR");

        return lines.join("\r\n") + "\r\n";
    }



    /**
     * Map "L"/"MA"/"ME"/"J"/"V" to JS getDay() index (0 = Sunday, 1 = Monday, ...)
     */
    _dayCodeToJsDow(day) {
        switch (day) {
            case "L":
                return 1;
            case "MA":
                return 2;
            case "ME":
                return 3;
            case "J":
                return 4;
            case "V":
                return 5;
            default:
                return 1;
        }
    }

    /**
     * Map "L"/"MA"/"ME"/"J"/"V" to iCalendar BYDAY code.
     */
    _dayCodeToICal(day) {
        switch (day) {
            case "L":
                return "MO";
            case "MA":
                return "TU";
            case "ME":
                return "WE";
            case "J":
                return "TH";
            case "V":
                return "FR";
            default:
                return "MO";
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

    /**
     * Compute first occurrence of a slot in the requested period:
     * the first date >= periodStart matching the slot day, with given time.
     */
    _computeFirstOccurrence(periodStart, dayCode, timeStr) {
        const targetDow = this._dayCodeToJsDow(dayCode);
        const startDow = periodStart.getDay(); // 0..6

        let delta = targetDow - startDow;
        if (delta < 0) delta += 7;

        const dt = new Date(periodStart.getTime());
        dt.setDate(periodStart.getDate() + delta);

        const [hhStr, mmStr] = timeStr.split(":");
        const hh = parseInt(hhStr, 10);
        const mm = parseInt(mmStr, 10);

        dt.setHours(hh, mm, 0, 0);
        return dt;
    }

    /**
     * Escape TEXT values according to RFC 5545 (\, ; , newlines).
     */
    _escapeText(text) {
        if (text == null) return "";
        return String(text)
            .replace(/\\/g, "\\\\")
            .replace(/;/g, "\\;")
            .replace(/,/g, "\\,")
            .replace(/\r\n|\n|\r/g, "\\n");
    }

    /**
     * Convert one Slot to a VEVENT block with weekly RRULE in the given period.
     */
    _slotToVEvent(slot, index, uidDomain, dtStamp, periodStart, periodEnd) {
        // First occurrence of this slot in the requested period
        const dtStart = this._computeFirstOccurrence(
            periodStart,
            slot.day,
            slot.startTime
        );

        // If the first occurrence is after the end of the period, no event
        if (dtStart > periodEnd) {
            return [];
        }

        // End = same day, slot end time
        const dtEnd = new Date(dtStart.getTime());
        const [ehStr, emStr] = slot.endTime.split(":");
        const eh = parseInt(ehStr, 10);
        const em = parseInt(emStr, 10);
        dtEnd.setHours(eh, em, 0, 0);

        const dtStartStr = this._formatDateTime(dtStart);
        const dtEndStr = this._formatDateTime(dtEnd);

        // UID unique par créneau
        const uid = `cru-${slot.courseCode}-${slot.day}-${slot.startTime}-${index}@${uidDomain}`;

        const summary = this._escapeText(
            `${slot.courseCode} ${slot.lessonType}` +
            (slot.subgroup ? ` (${slot.subgroup})` : "")
        );
        const location = this._escapeText(slot.room || "");

        // RRULE jusqu'à la fin de la période (23:59:59)
        const until = new Date(periodEnd.getTime());
        until.setHours(23, 59, 59, 0);
        const untilStr = this._formatDateTime(until);
        const byDay = this._dayCodeToICal(slot.day);

        return [
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${dtStamp}`,
            `DTSTART:${dtStartStr}`,
            `DTEND:${dtEndStr}`,
            `SUMMARY:${summary}`,
            `LOCATION:${location}`,
            `RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${byDay}`,
            "END:VEVENT"
        ];
    }
}

module.exports = CruParser;

const Slot = require("../Slot");
const SlotSet = require("../SlotSet");
const CruParser = require("../CruParser");

describe("Program Semantic testing of CRU schedule", function () {

    beforeAll(function () {
        // Deux créneaux dans la même salle
        this.slot1 = new Slot({
            courseCode: "ME01",
            lessonType: "TD",
            capacity: 24,
            day: "L",
            startTime: "10:00",
            endTime: "12:00",
            room: "S101",
            subgroup: "F1",
            groupIndex: 1,
        });

        this.slot2 = new Slot({
            courseCode: "ME01",
            lessonType: "TD",
            capacity: 24,
            day: "L",
            startTime: "11:00",
            endTime: "13:00",
            room: "S101",
            subgroup: "F1",
            groupIndex: 1,
        });

        this.slot3 = new Slot({
            courseCode: "ME01",
            lessonType: "TD",
            capacity: 24,
            day: "MA",
            startTime: "10:00",
            endTime: "12:00",
            room: "S101",
            subgroup: "F1",
            groupIndex: 1,
        });

        this.set = SlotSet.empty();
        this.set.add(this.slot1).add(this.slot2);
    });

    it("can create a new Slot", function () {
        expect(this.slot1).toBeDefined();
        expect(this.slot1.courseCode).toBe("ME01");
        expect(this.slot1).toEqual(
            jasmine.objectContaining({ room: "S101", day: "L" })
        );
    });

    it("equalsSlot returns true only when all fields match", function () {
        // Créneau identique pour tester l’égalité complète
        const clone = new Slot({
            courseCode: "ME01",
            lessonType: "TD",
            capacity: 24,
            day: "L",
            startTime: "10:00",
            endTime: "12:00",
            room: "S101",
            subgroup: "F1",
            groupIndex: 1,
        });

        expect(this.slot1.equalsSlot(clone)).toBeTrue();

        // Même créneau mais salle différente → doit être considéré différent
        const different = new Slot({
            courseCode: "ME01",
            lessonType: "TD",
            capacity: 24,
            day: "L",
            startTime: "10:00",
            endTime: "12:00",
            room: "S102", // salle différente
            subgroup: "F1",
            groupIndex: 1,
        });

        expect(this.slot1.equalsSlot(different)).toBeFalse();
    });

    it("detects overlapping slots in the same room and day (chevauche)", function () {
        // slot1 : 10:00–12:00, slot2 : 11:00–13:00 → se chevauchent
        expect(this.slot1.overlapsSlot(this.slot2)).toBeTrue();

        // Jours différents → pas de chevauchement
        expect(this.slot1.overlapsSlot(this.slot3)).toBeFalse();
    });

    it("SlotSet.add preserves uniqueness of slots", function () {
        const sizeBefore = this.set.toArray().length;
        // Ajouter un créneau identique → la taille ne doit pas augmenter
        this.set.add(this.slot1);
        const sizeAfter = this.set.toArray().length;

        expect(sizeAfter).toBe(sizeBefore);
    });

    it("SlotSet.filter returns a subset with the given predicate", function () {
        // Filtrer uniquement les créneaux du lundi
        const onlyMonday = this.set.filter((s) => s.day === "L");
        const arr = onlyMonday.toArray();

        expect(arr.length).toBe(2);
        arr.forEach((s) => expect(s.day).toBe("L"));
    });

    it("can export parsed slots to a valid iCalendar VEVENT", function () {
        const parser = new CruParser();

        const cruSample =
            "+ME01\r\n" +
            "1,D1,P=24,H=L 10:00-12:00,F1,S=S101//\r\n" +
            "Page générée en 0.01s\r\n";

        const slotSet = parser.parse(cruSample);
        const slots = slotSet.toArray();
        expect(slots.length).toBe(1);

        // 06/01/2025 = lundi
        const periodStart = new Date(2025, 0, 6);
        // 10/01/2025 = vendredi
        const periodEnd = new Date(2025, 0, 10);

        // Fixer la date système pour vérifier DTSTAMP
        jasmine.clock().install();
        const now = new Date(2025, 0, 1, 12, 0, 0);
        jasmine.clock().mockDate(now);

        const ics = parser.toICalendar(slotSet, {
            courses: ["ME01"],
            periodStart,
            periodEnd,
            uidDomain: "example.test",
        });

        jasmine.clock().uninstall();

        expect(ics).toContain("BEGIN:VEVENT");
        expect(ics).toContain("END:VEVENT");
        expect(ics).toContain("SUMMARY:ME01 TD (F1)");
        expect(ics).toContain("LOCATION:S101");
        expect(ics).toContain("RRULE:FREQ=WEEKLY");
        expect(ics).toContain("BYDAY=MO");  // vérifier que 'L' → 'MO'
    });

});

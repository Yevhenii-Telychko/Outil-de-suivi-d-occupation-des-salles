// spec/parser_syntactic_spec.js

const CruParser = require("../CruParser");
const Slot = require("../Slot");

describe("Program Syntactic testing of CruParser", function () {

    beforeAll(function () {
        this.parser = new CruParser();
    });

    it("can parse a single valid slot line from CRU input", function () {
        const input =
            "+ME01\r\n" +
            "1,D1,P=24,H=L 08:00-10:00,F1,S=S101//\r\n";

        const slotSet = this.parser.parse(input);
        const slots = slotSet.toArray();

        expect(slots.length).toBe(1);
        const s = slots[0];

        expect(s.courseCode).toBe("ME01");
        // D1 → TD
        expect(s.lessonType).toBe("TD");
        expect(s.capacity).toBe(24);
        expect(s.day).toBe("L");
        expect(s.startTime).toBe("08:00");
        expect(s.endTime).toBe("10:00");
        expect(s.subgroup).toBe("F1");
        expect(s.room).toBe("S101");
    });

    it("ignores example course headers without digits (+UVUV)", function () {
        const input =
            "+UVUV\r\n" + // doit être ignoré
            "+ME01\r\n" +
            "1,T1,P=18,H=MA 10:00-12:00,F2,S=S202//\r\n";

        const slotSet = this.parser.parse(input);
        const slots = slotSet.toArray();

        expect(slots.length).toBe(1);
        expect(slots[0].courseCode).toBe("ME01");
        // T1 → TP
        expect(slots[0].lessonType).toBe("TP");
    });

    it("ignores footer line 'Page générée en ...'", function () {
        const input =
            "+ME01\r\n" +
            "1,C1,P=30,H=ME 14:00-16:00,F1,S=S303//\r\n" +
            "Page générée en 0.01s\r\n";

        const slotSet = this.parser.parse(input);
        const slots = slotSet.toArray();

        expect(slots.length).toBe(1);
        expect(slots[0].courseCode).toBe("ME01");
        expect(slots[0].room).toBe("S303");
    });

    it("skips lines that do not match slot regex", function () {
        const input =
            "+ME01\r\n" +
            "This is not a slot line\r\n" + // ligne non conforme → ignorée
            "1,D1,P=24,H=L 08:00-10:00,F1,S=S101//\r\n";

        const slotSet = this.parser.parse(input);
        const slots = slotSet.toArray();

        expect(slots.length).toBe(1);
        expect(slots[0].room).toBe("S101");
    });

    it("handles several slots for the same course in order", function () {
        const input =
            "+ME01\r\n" +
            "1,D1,P=24,H=L 08:00-10:00,F1,S=S101//\r\n" +
            "2,T1,P=18,H=L 10:00-12:00,F2,S=S102//\r\n";

        const slotSet = this.parser.parse(input);
        const slots = slotSet.toArray();

        expect(slots.length).toBe(2);

        // Vérifie que le parser conserve l'ordre du fichier
        expect(slots[0].startTime).toBe("08:00");
        expect(slots[1].startTime).toBe("10:00");

        // Vérifie la conversion des types de cours
        expect(slots[0].lessonType).toBe("TD"); // D1
        expect(slots[1].lessonType).toBe("TP"); // T1
    });

    it("can create a Slot programmatically (type Créneau) matching the semantic spec", function () {
        const s = new Slot({
            courseCode: "MC01",
            lessonType: "CM",
            capacity: 48,
            day: "V",
            startTime: "16:00",
            endTime: "18:00",
            room: "S404",
            subgroup: "F1",
            groupIndex: 1
        });

        expect(s).toBeDefined();
        expect(s.courseCode).toBe("MC01");
        expect(s.capacity).toBe(48);
        expect(s.day).toBe("V");
        expect(s.startTime).toBe("16:00");
        expect(s.endTime).toBe("18:00");
        expect(s.room).toBe("S404");
    });
});

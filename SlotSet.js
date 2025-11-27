const {Slot} = require("./slot");

class SlotSet {
    constructor() {
        /** @type {Slot[]} */
        this._items = [];
    }

    static empty() {
        return new SlotSet();
    }

    add(slot) {
        if (!this.contains(slot)) {
            this._items.push(slot);
        }
        return this;
    }

    contains(slot) {
        return this._items.some(s => s.equalsSlot(slot));
    }

    remove(slot) {
        this._items = this._items.filter(s => !s.equalsSlot(slot));
        return this;
    }

    filter(predicate) {
        const res = new SlotSet();
        this._items.forEach(s => {
            if (predicate(s)) res.add(s);
        });
        return res;
    }

    sort() {
        this._items.sort((a, b) => a.compareSlot(b));
        return this;
    }

    toArray() {
        return this._items.slice();
    }
}

module.exports = SlotSet;

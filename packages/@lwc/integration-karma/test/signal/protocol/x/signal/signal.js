export class Signal {
    subscribers = new Set();

    constructor(initialValue) {
        this._value = initialValue;
    }

    set value(newValue) {
        this._value = newValue;
        this.notify();
    }

    get value() {
        return this._value;
    }

    subscribe(onUpdate) {
        this.subscribers.add(onUpdate);
        return () => {
            this.subscribers.delete(onUpdate);
        };
    }

    notify() {
        for (const subscriber of this.subscribers) {
            subscriber();
        }
    }

    getSubscriberCount() {
        return this.subscribers.size;
    }
}

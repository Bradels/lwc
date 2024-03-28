import { LightningElement } from 'lwc';

export default class extends LightningElement {
    counter = 0;

    connectedCallback(): void {
        console.log('connected counter');
    }
    renderedCallback(): void {
        console.log('rendered counter');
    }
    disconnectedCallback(): void {
        console.log('disconnected counter');
    }
    increment() {
        console.log(this.counter++);
    }
    decrement() {
        console.log(this.counter--);
    }
}

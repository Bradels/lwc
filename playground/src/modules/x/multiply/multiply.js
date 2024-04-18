import { LightningElement, api, track, wire } from 'lwc';
import { multiply } from './wire-adapter';

export default class extends LightningElement {
    @api message;

    @track inputs = { first: 0, second: 0 };

    @wire(multiply, { first: '$inputs.first', second: '$inputs.second' }) product;

    handleInput(event) {
        this.inputs[event.target.name] = event.target.value;
    }
}

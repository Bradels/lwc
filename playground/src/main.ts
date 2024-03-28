import { createElement } from 'lwc';
// This is a problem that we'll need to fix...
import App from './modules/x/app/app';

const elm = createElement('x-app', { is: App });
document.body.appendChild(elm);

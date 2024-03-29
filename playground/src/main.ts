import { createElement } from 'lwc';
// This currently resolves to /src/modules/x/app/index.ts rather than app.ts
import App from 'x/app';

const elm = createElement('x-app', { is: App });
document.body.appendChild(elm);

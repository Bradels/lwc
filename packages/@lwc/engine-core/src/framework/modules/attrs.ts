/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import {
    isNull,
    isUndefined,
    StringCharCodeAt,
    XML_NAMESPACE,
    XLINK_NAMESPACE,
    kebabCaseToCamelCase,
} from '@lwc/shared';
import { RendererAPI } from '../renderer';

import { EmptyObject } from '../utils';
import { VBaseElement, VStatic } from '../vnodes';

const ColonCharCode = 58;

export function patchAttributes(
    oldVnode: VBaseElement | null,
    vnode: VBaseElement,
    renderer: RendererAPI
) {
    const { attrs, external } = vnode.data;
    if (isUndefined(attrs)) {
        return;
    }

    const oldAttrs = isNull(oldVnode) ? EmptyObject : oldVnode.data.attrs;

    // Attrs may be the same due to the static content optimization, so we can skip diffing
    if (oldAttrs === attrs) {
        return;
    }

    const { elm } = vnode;
    const { setAttribute, removeAttribute, setProperty } = renderer;
    for (const key in attrs) {
        const cur = attrs[key];
        const old = oldAttrs[key];

        if (old !== cur) {
            let propName: string;
            // For external custom elements, sniff to see if the attr should be considered a prop.
            // Use kebabCaseToCamelCase directly because we don't want to set props like `ariaLabel` or `tabIndex`
            // on a custom element versus just using the more reliable attribute format.
            if (external && (propName = kebabCaseToCamelCase(key)) in elm!) {
                setProperty(elm, propName, cur);
            } else if (StringCharCodeAt.call(key, 3) === ColonCharCode) {
                // Assume xml namespace
                setAttribute(elm, key, cur as string, XML_NAMESPACE);
            } else if (StringCharCodeAt.call(key, 5) === ColonCharCode) {
                // Assume xlink namespace
                setAttribute(elm, key, cur as string, XLINK_NAMESPACE);
            } else if (isNull(cur) || isUndefined(cur)) {
                removeAttribute(elm, key);
            } else {
                setAttribute(elm, key, cur as string);
            }
        }
    }
}

export function patchSlotAssignment(
    oldVnode: VBaseElement | VStatic | null,
    vnode: VBaseElement | VStatic,
    renderer: RendererAPI
) {
    if (oldVnode?.slotAssignment === vnode.slotAssignment) {
        return;
    }

    const { elm } = vnode;
    const { setAttribute, removeAttribute } = renderer;

    if (
        isUndefined(vnode.slotAssignment) ||
        isNull(vnode.slotAssignment)
        // jtu-todo: verify if the string check should be used, it could be a breaking change if before it would log the slot attribute without any value
        // (isString(vnode.slotName) && !vnode.slotName.length)
        // Empty string assignments should be removed IMO but for backwards compat they will remain as
        // a stand alone `slot` attribute on the element.
    ) {
        // This should also look for an empty string value? Need to verify previous behavior to get an answer
        removeAttribute(elm, 'slot');
    } else {
        setAttribute(elm, 'slot', vnode.slotAssignment);
    }
}

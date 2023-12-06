import { createElement } from 'lwc';
import { extractDataIds } from 'test-utils';

import LightContainer from './x/lightContainer/lightContainer';

const commentNode = document.createComment(' comments being forwarded ');

describe('slot forwarding', () => {
    let nodes;
    let lightContainer;
    beforeAll(() => {
        lightContainer = createElement('x-light-container', { is: LightContainer });
        document.body.appendChild(lightContainer);
        nodes = extractDataIds(lightContainer);
    });

    afterAll(() => {
        document.body.removeChild(lightContainer);
    });

    it('should correctly forward slot assignments - light > light slot', () => {
        const lightLightLeaf = nodes['light-light-leaf'];
        // Note these include the vFragmentBookend elements
        expect(lightLightLeaf.children.length).toBe(5);

        const slotContent = Array.from(lightLightLeaf.children);
        const upperSlotContent = slotContent.slice(0, 2);
        // Lower content is now mapped to upper slot
        expect(upperSlotContent[0].tagName.toLowerCase()).toBe('x-shadow-dom-element');
        expect(upperSlotContent[1].innerText).toEqual('Lower slot forwarded content');

        // Upper content is now mapped to lower slot
        const lowerSlotContent = slotContent.slice(2, 4);
        expect(lowerSlotContent[0].tagName.toLowerCase()).toEqual('x-light-dom-element');
        expect(lowerSlotContent[1].innerText).toEqual('Upper slot forwarded content');

        // Default slot content is mapped to `defaultSlotReassigned` slot
        const remappedDefaultSlotContent = slotContent.slice(4, 5);
        expect(remappedDefaultSlotContent[0].innerText).toEqual(
            'Static vnode default slot forwarded'
        );

        // Text and comments always mapped to the default slot
        expect(
            lightLightLeaf.childNodes[process.env.API_VERSION > 59 ? 12 : 5].textContent
        ).toEqual('Text being forwarded');
        expect(lightLightLeaf.childNodes[process.env.API_VERSION > 59 ? 13 : 6]).toEqual(
            commentNode
        );
    });

    it('should correctly forward slot assignments - light > shadow slot', () => {
        const lightShadowLeaf = nodes['light-shadow-leaf'];
        expect(lightShadowLeaf.shadowRoot.children.length).toBe(4);

        const slots = extractDataIds(lightShadowLeaf);
        const upperSlotContent = slots['upper-slot'].assignedNodes();
        expect(upperSlotContent[0].getAttribute('slot')).toBe('upper');
        expect(upperSlotContent[0].tagName.toLowerCase()).toBe('x-shadow-dom-element');
        expect(upperSlotContent[1].getAttribute('slot')).toBe('upper');
        expect(upperSlotContent[1].innerText).toEqual('Lower slot forwarded content');

        const lowerSlotContent = slots['lower-slot'].assignedNodes();
        expect(lowerSlotContent[0].getAttribute('slot')).toBe('lower');
        expect(lowerSlotContent[0].tagName.toLowerCase()).toEqual('x-light-dom-element');
        expect(lowerSlotContent[1].getAttribute('slot')).toBe('lower');
        expect(lowerSlotContent[1].innerText).toEqual('Upper slot forwarded content');

        const reassginedDefaultSlot = slots['default-slot-reassigned'].assignedNodes();
        // Verify static vnode `slot` attribute is reassigned
        expect(reassginedDefaultSlot[0].getAttribute('slot')).toBe('defaultSlotReassigned');
        expect(reassginedDefaultSlot[0].innerText).toEqual('Static vnode default slot forwarded');

        const defaultSlotContent = slots['default-slot'].assignedNodes();
        expect(defaultSlotContent[0].textContent).toEqual('Text being forwarded');
        if (!process.env.NATIVE_SHADOW) {
            // Native shadow doesn't slot comments
            expect(defaultSlotContent[1]).toEqual(commentNode);
        }
    });

    it('should correctly forward slot assignments - shadow > light slot', () => {
        const shadowLightLeaf = nodes['shadow-light-leaf'];
        expect(shadowLightLeaf.children.length).toBe(3);

        const slots = extractDataIds(shadowLightLeaf);
        const upperSlot = slots['upper-slot'];
        // In this test, the shadow slot is passed directly to the light DOM slot which will cause the
        // slot attribute to be remapped to the slot attribute on the light DOM slot.
        // Verify the slot attribute was correctly updated.
        expect(upperSlot.hasAttribute('slot')).toBe(false);

        const upperSlotContent = upperSlot.assignedNodes();
        // Note that because the shadow slot is passed, the slot element is what's updated.
        // Verify that the children have not been modified.
        expect(upperSlotContent[0].getAttribute('slot')).toBe('lower');
        expect(upperSlotContent[0].tagName.toLowerCase()).toBe('x-shadow-dom-element');
        expect(upperSlotContent[1].getAttribute('slot')).toBe('lower');
        expect(upperSlotContent[1].innerText).toEqual('Lower slot forwarded content');

        const lowerSlot = slots['lower-slot'];
        expect(lowerSlot.hasAttribute('slot')).toBe(false);

        const lowerSlotContent = lowerSlot.assignedNodes();
        expect(lowerSlotContent[0].getAttribute('slot')).toBe('upper');
        expect(lowerSlotContent[0].tagName.toLowerCase()).toEqual('x-light-dom-element');
        expect(lowerSlotContent[1].getAttribute('slot')).toBe('upper');
        expect(lowerSlotContent[1].innerText).toEqual('Upper slot forwarded content');

        const defaultSlot = slots['default-slot'];
        expect(defaultSlot.hasAttribute('slot')).toBe(false);

        // Note since the content forwarded to the default shadow slot are wrapped in an actual slot element,
        // all content inside of it is forwarded together.
        // This is in contrast to the above test where the static element is re-parented to reassginedDefaultSlot
        const defaultSlotContent = defaultSlot.assignedNodes();
        expect(defaultSlotContent[0].textContent).toEqual('Text being forwarded');
        if (!process.env.NATIVE_SHADOW) {
            // Native shadow doesn't slot comments
            expect(defaultSlotContent[1]).toEqual(commentNode);
        }
        expect(defaultSlotContent[process.env.NATIVE_SHADOW ? 1 : 2].innerText).toEqual(
            'Static vnode default slot forwarded'
        );
    });

    it('should correctly forward slot assignments - shadow > shadow slot', () => {
        const shadowShadowLeaf = nodes['shadow-shadow-leaf'];
        expect(shadowShadowLeaf.children.length).toBe(3);

        const slots = extractDataIds(shadowShadowLeaf);
        const upperLeafSlot = slots['upper-slot'];
        // Verify the slot element is not replaced with children at the leaf
        expect(upperLeafSlot.tagName.toLowerCase()).toEqual('slot');
        expect(upperLeafSlot.getAttribute('name')).toEqual('upper');

        const upperForwardedSlot = upperLeafSlot.assignedNodes();
        expect(upperForwardedSlot.length).toEqual(1);
        // Verify slot was not modified, ie:
        // <slot slot="lower" name="upper"></slot>
        expect(upperForwardedSlot[0].tagName.toLowerCase()).toEqual('slot');
        expect(upperForwardedSlot[0].getAttribute('slot')).toEqual('upper');
        expect(upperForwardedSlot[0].getAttribute('name')).toEqual('lower');

        const upperSlotContent = upperForwardedSlot[0].assignedNodes();
        expect(upperSlotContent.length).toEqual(2);
        expect(upperSlotContent[0].getAttribute('slot')).toBe('lower');
        expect(upperSlotContent[0].tagName.toLowerCase()).toBe('x-shadow-dom-element');
        expect(upperSlotContent[1].getAttribute('slot')).toBe('lower');
        expect(upperSlotContent[1].innerText).toEqual('Lower slot forwarded content');

        const lowerLeafSlot = slots['lower-slot'];
        // Verify the slot element is not replaced with children at the leaf
        expect(lowerLeafSlot.tagName.toLowerCase()).toEqual('slot');
        expect(lowerLeafSlot.getAttribute('name')).toEqual('lower');

        const lowerForwardedSlot = lowerLeafSlot.assignedNodes();
        expect(lowerForwardedSlot.length).toEqual(1);
        // Verify slot was not modified, ie:
        // <slot slot="upper" name="lower"></slot>
        expect(lowerForwardedSlot[0].tagName.toLowerCase()).toEqual('slot');
        expect(lowerForwardedSlot[0].getAttribute('slot')).toEqual('lower');
        expect(lowerForwardedSlot[0].getAttribute('name')).toEqual('upper');

        const lowerSlotContent = lowerForwardedSlot[0].assignedNodes();
        expect(lowerSlotContent.length).toEqual(2);
        expect(lowerSlotContent[0].getAttribute('slot')).toBe('upper');
        expect(lowerSlotContent[0].tagName.toLowerCase()).toEqual('x-light-dom-element');
        expect(lowerSlotContent[1].getAttribute('slot')).toBe('upper');
        expect(lowerSlotContent[1].innerText).toEqual('Upper slot forwarded content');

        const defaultLeafSlot = slots['default-slot'];
        expect(defaultLeafSlot.hasAttribute('slot')).toBe(false);

        const defaultForwardedSlot = defaultLeafSlot.assignedNodes();
        // No slots were reassigned to the default leaf slot because they are remapped at the forwarded slot
        expect(defaultForwardedSlot.length).toEqual(0);

        const defaultRemappedLeafSlot = slots['default-slot-reassigned'];
        expect(defaultRemappedLeafSlot.tagName.toLowerCase()).toEqual('slot');
        expect(defaultRemappedLeafSlot.getAttribute('name')).toEqual('defaultSlotReassigned');

        const defaultRemappedForwardedSlot = defaultRemappedLeafSlot.assignedNodes();
        expect(defaultRemappedForwardedSlot.length).toEqual(1);

        // Verify slot was not modified, ie:
        // <slot slot="defaultSlotReassigned">Default slot not yet forwarded</slot>
        expect(defaultRemappedForwardedSlot[0].tagName.toLowerCase()).toEqual('slot');
        expect(defaultRemappedForwardedSlot[0].getAttribute('slot')).toEqual(
            'defaultSlotReassigned'
        );

        const defaultRemappedSlotContent = defaultRemappedForwardedSlot[0].assignedNodes();
        expect(defaultRemappedSlotContent.length).toEqual(process.env.NATIVE_SHADOW ? 2 : 3);
        expect(defaultRemappedSlotContent[0].textContent).toEqual('Text being forwarded');
        if (!process.env.NATIVE_SHADOW) {
            // Native shadow doesn't slot comments
            expect(defaultRemappedSlotContent[1]).toEqual(commentNode);
        }
        expect(defaultRemappedSlotContent[process.env.NATIVE_SHADOW ? 1 : 2].innerText).toEqual(
            'Static vnode default slot forwarded'
        );
    });
});

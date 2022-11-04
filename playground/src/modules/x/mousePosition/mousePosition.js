import { signal, computed } from "@preact/signals-core";

export const pos = signal({ x: 0, y: 0 });

document.addEventListener('mousemove', evt => {
    pos.value = {
        x: evt.clientX,
        y: evt.clientY,
    }
});

export const sumOfXAndY = computed(() => pos.value.x + pos.value.y)
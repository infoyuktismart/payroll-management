/**
 * Converts a color string to RGB format using a temporary canvas.
 * This handles 'oklch' and other modern color formats that html2canvas might not support.
 */
export const sanitizeDomColors = (element) => {
    // Store original styles to restore later
    const restoreOperations = [];

    // Helper to convert any color to RGB
    const toRgb = (color) => {
        if (!color || color === 'transparent' || color === 'currentcolor') return color;
        // If it's already safe, return it (optimization)
        if (!color.includes('oklch') && !color.includes('lab') && !color.includes('lch')) return color;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
            return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        } catch {
            return color;
        }
    };

    const processNode = (node) => {
        if (node.nodeType !== 1) return; // Element nodes only

        // Check if element is visible
        if (node.style.display === 'none' || node.style.visibility === 'hidden') return;

        const computed = window.getComputedStyle(node);
        const style = node.style;

        // Properties to sanitize
        const props = [
            'color',
            'backgroundColor',
            'borderColor',
            'borderTopColor',
            'borderBottomColor',
            'borderLeftColor',
            'borderRightColor',
            'outlineColor',
            'textDecorationColor'
        ];

        // Store original inline style
        const originalStyle = node.getAttribute('style');
        restoreOperations.push(() => {
            if (originalStyle) {
                node.setAttribute('style', originalStyle);
            } else {
                node.removeAttribute('style');
            }
        });

        // Apply sanitized colors
        props.forEach(prop => {
            const val = computed[prop];
            if (val && (val.includes('oklch') || val.includes('lab') || val.includes('lch'))) {
                style[prop] = toRgb(val);
                style.setProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase(), toRgb(val), 'important');
            }
        });

        // Recursively process children
        Array.from(node.children).forEach(processNode);
    };

    processNode(element);

    // Return a function to revert changes
    return () => {
        restoreOperations.forEach(restore => restore());
    };
};

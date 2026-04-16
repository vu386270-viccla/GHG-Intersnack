export const downloadSvgAsPng = (svgElement: SVGSVGElement | null, filename: string, scale = 3) => {
    if (!svgElement) {
        console.warn('downloadSvgAsPng: SVG element is null');
        return;
    }

    const serializer = new XMLSerializer();
    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

    // Extract proper dimensions. Often viewBox provides the base coordinate system width/height
    let baseW = svgElement.clientWidth;
    let baseH = svgElement.clientHeight;
    const viewBox = svgElement.getAttribute('viewBox');

    if ((!baseW || !baseH || baseW < 50 || baseH < 50) && viewBox) {
        const parts = viewBox.split(/[\s,]+/);
        if (parts.length >= 4) {
            baseW = parseFloat(parts[2]);
            baseH = parseFloat(parts[3]);
        }
    }

    // Safety fallback if no size is detected at all
    baseW = baseW || 800;
    baseH = baseH || 500;

    // We explicitly apply pixel dimensions to the cloned SVG to ensure it scales predictably in the Image tag
    svgClone.setAttribute('width', String(baseW));
    svgClone.setAttribute('height', String(baseH));

    // Add xmlns if missing so it's a valid standalone SVG
    if (!svgClone.getAttribute('xmlns')) {
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    const svgString = serializer.serializeToString(svgClone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const canvas = document.createElement('canvas');
    canvas.width = baseW * scale;
    canvas.height = baseH * scale;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
        if (ctx) {
            // SVGs have transparent backgrounds, fill white to make standard PNGs readable
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png', 1.0);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
        console.error('downloadSvgAsPng: Error loading SVG into Image', e);
        URL.revokeObjectURL(url);
    };

    img.src = url;
};

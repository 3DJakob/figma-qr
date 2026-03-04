import qrGen from "qrcode-generator";

type GenerateMsg = {
  type: "generate";
  url: string;
  size: number; // target size in px
  ecc: "L" | "M" | "Q" | "H";
};

type QrMode = "Numeric" | "Alphanumeric" | "Byte";

figma.showUI(__html__, { width: 320, height: 530 });

figma.ui.onmessage = (msg: GenerateMsg) => {
  if (msg.type !== "generate") return;

  const url = (msg.url || "").trim();
  if (!url) {
    figma.ui.postMessage({ type: "error", message: "Please enter a URL." });
    return;
  }

  const size = clampInt(msg.size, 64, 2048, 256);
  const ecc = msg.ecc ?? "M";

  try {
    // typeNumber 0 lets lib pick a suitable version
    const qr = qrGen(0, ecc);
    const mode = pickQrMode(url);
    qr.addData(url, mode);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const totalModules = moduleCount;

    // Build an SVG where each dark module is a 1x1 rect in module-space.
    // Then we scale to desired pixel size inside Figma.
    let rects = "";
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          const x = c;
          const y = r;
          rects += `<rect x="${x}" y="${y}" width="1" height="1" />`;
        }
      }
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges">
        <rect x="0" y="0" width="${totalModules}" height="${totalModules}" fill="#fff"/>
        <g fill="#000">
          ${rects}
        </g>
      </svg>
    `.trim();

    const node = figma.createNodeFromSvg(svg);

    // createNodeFromSvg returns a Frame containing the imported vector(s)
    // We'll group/flatten to a single vector if possible.
    // The first child is often a Vector or Group.
    const imported = node;
    imported.name = `QR: ${truncate(url, 32)}`;

    // Move to viewport center-ish
    const center = figma.viewport.center;
    imported.x = center.x - imported.width / 2;
    imported.y = center.y - imported.height / 2;

    // Scale to requested pixel size (keeping aspect ratio)
    const scale = size / Math.max(imported.width, imported.height);
    imported.rescale(scale);

    figma.currentPage.appendChild(imported);
    figma.currentPage.selection = [imported];
    figma.viewport.scrollAndZoomIntoView([imported]);
  } catch (e: any) {
    figma.ui.postMessage({
      type: "error",
      message: `Failed to generate QR: ${String(e?.message ?? e)}`,
    });
  }
};

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function pickQrMode(text: string): QrMode {
  if (/^[0-9]+$/.test(text)) return "Numeric";
  if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) return "Alphanumeric";
  return "Byte";
}

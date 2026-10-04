import { jsPDF } from 'jspdf';
import { Product, RodBlueprintSpecs } from '../types';
import { fmt, todayISO, formatDiameterMm, parseDiameterToInches } from './helpers';
import { recordExport } from './exportManager';
import { triggerUniversalDownload } from './universalDownloader';

/**
 * Converts an SVG element to high-resolution PNG Data URL via Canvas
 */
export async function svgElementToDataUrl(
  svgElement: SVGElement,
  width = 1200,
  height = 700
): Promise<string> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const URL = window.URL || window.webkitURL || window;
  const blobURL = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Deep blueprint background
        ctx.fillStyle = '#060c18';
        ctx.fillRect(0, 0, width, height);

        // Technical grid overlay
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        const gridSize = 24;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(blobURL);
        resolve(canvas.toDataURL('image/png', 0.95));
      } else {
        URL.revokeObjectURL(blobURL);
        resolve('');
      }
    };
    img.onerror = err => {
      URL.revokeObjectURL(blobURL);
      reject(err);
    };
    img.src = blobURL;
  });
}

/**
 * Exports complete Rod Blueprint Specification Sheet as high-resolution PDF
 */
export async function exportRodBlueprintPDF(options: {
  product: Product;
  specs: RodBlueprintSpecs;
  companyName?: string;
  svgElement?: SVGElement | null;
}): Promise<boolean> {
  const { product, specs, companyName = 'Falcon Rod Maker & Engineering Works', svgElement } = options;

  // Initialize Landscape A4 (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 10;
  const drawingNo = `FALCON-DWG-${product.id}-${Date.now().toString().slice(-6)}`;
  const dateStr = todayISO();

  // 1. Engineering Drawing Border (Double Outer Lines)
  doc.setDrawColor(245, 183, 0); // Amber border
  doc.setLineWidth(0.8);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  doc.setDrawColor(56, 189, 248); // Cyan inner thin border
  doc.setLineWidth(0.3);
  doc.rect(margin + 1.5, margin + 1.5, pageWidth - margin * 2 - 3, pageHeight - margin * 2 - 3);

  // 2. Top Header Title Block
  doc.setFillColor(15, 23, 42); // Dark slate header
  doc.rect(margin + 2, margin + 2, pageWidth - margin * 2 - 4, 18, 'F');

  doc.setTextColor(245, 183, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), margin + 6, margin + 9);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PRECISION MECHANICAL ENGINEERING • FAN DOWN-ROD CAD BLUEPRINT SPECIFICATION', margin + 6, margin + 15);

  // Header Right Metadata
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(56, 189, 248);
  doc.text(`DOC: ${drawingNo}`, pageWidth - margin - 6, margin + 8, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(`DATE: ${dateStr} • SCALE: 1:1 CAD`, pageWidth - margin - 6, margin + 14, { align: 'right' });

  // 3. Blueprint Graphic Container (Left Side, 165mm wide)
  const canvasX = margin + 4;
  const canvasY = margin + 23;
  const canvasW = 166;
  const canvasH = 125;

  // Background for Drawing
  doc.setFillColor(6, 12, 24);
  doc.rect(canvasX, canvasY, canvasW, canvasH, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.rect(canvasX, canvasY, canvasW, canvasH, 'S');

  // Try capturing SVG directly, fallback to vector representation
  let imageCaptured = false;
  if (svgElement) {
    try {
      const dataUrl = await svgElementToDataUrl(svgElement, 1200, 800);
      if (dataUrl) {
        doc.addImage(dataUrl, 'PNG', canvasX, canvasY, canvasW, canvasH);
        imageCaptured = true;
      }
    } catch (e) {
      console.warn('SVG direct capture failed, using procedural vector rendering', e);
    }
  }

  // Fallback vector drawing if SVG element wasn't supplied or failed capture
  if (!imageCaptured) {
    const centerY = canvasY + canvasH / 2 - 6;
    const clampedLength = Math.max(1, Math.min(240, specs.lengthInches || 24));
    const lenRatio = Math.log10(clampedLength) / Math.log10(240);
    const pipeScaleW = Math.round(50 + lenRatio * 90);
    const pipeStartX = canvasX + (canvasW - pipeScaleW) / 2;
    const diaInches = parseDiameterToInches(specs.diameterInches);
    const pipeH = Math.max(6, Math.min(26, Math.round(6 + Math.sqrt(Math.max(0.1, diaInches) / 0.125) * 3.5)));

    // Centerline Axis
    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(0.3);
    doc.line(canvasX + 10, centerY, canvasX + canvasW - 10, centerY);

    // Pipe Body
    doc.setFillColor(30, 41, 59);
    doc.rect(pipeStartX, centerY - pipeH / 2, pipeScaleW, pipeH, 'F');
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.6);
    doc.rect(pipeStartX, centerY - pipeH / 2, pipeScaleW, pipeH, 'S');

    // Clamps or Bare ends
    if (specs.hasTopClamp) {
      doc.setFillColor(245, 183, 0);
      doc.rect(pipeStartX - 7, centerY - 10, 7, 20, 'F');
      doc.setFillColor(6, 12, 24);
      doc.circle(pipeStartX - 3.5, centerY, specs.holeSizeMm / 4, 'F');
    }
    if (specs.hasBottomClamp) {
      doc.setFillColor(245, 183, 0);
      doc.rect(pipeStartX + pipeScaleW, centerY - 10, 8, 20, 'F');
      doc.setFillColor(6, 12, 24);
      doc.circle(pipeStartX + pipeScaleW + 4, centerY - 3, specs.holeSizeMm / 4, 'F');
      doc.circle(pipeStartX + pipeScaleW + 4, centerY + 3, specs.holeSizeMm / 4, 'F');
    }

    // Dimension Callouts
    doc.setDrawColor(245, 183, 0);
    doc.setLineWidth(0.4);
    doc.line(pipeStartX, centerY + 20, pipeStartX + pipeScaleW, centerY + 20);
    doc.line(pipeStartX, centerY + 16, pipeStartX, centerY + 24);
    doc.line(pipeStartX + pipeScaleW, centerY + 16, pipeStartX + pipeScaleW, centerY + 24);

    doc.setTextColor(245, 183, 0);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text(`LENGTH = ${specs.lengthInches}" (${Math.round(specs.lengthInches * 25.4)} mm)`, canvasX + canvasW / 2, centerY + 28, { align: 'center' });
  }

  // Overlay Badge on CAD drawing
  doc.setFillColor(15, 23, 42);
  doc.rect(canvasX + 3, canvasY + 3, 48, 7, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.text(`CAD DRAWING • Ø${specs.diameterInches} OD`, canvasX + 5, canvasY + 7.5);

  // 4. Right Side: Technical Specifications Matrix (105mm wide)
  const specX = canvasX + canvasW + 4;
  const specY = margin + 23;
  const specW = pageWidth - margin - specX - 4;

  // Title Box
  doc.setFillColor(30, 41, 59);
  doc.rect(specX, specY, specW, 8, 'F');
  doc.setDrawColor(245, 183, 0);
  doc.setLineWidth(0.4);
  doc.rect(specX, specY, specW, 8, 'S');

  doc.setTextColor(245, 183, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ENGINEERING PARAMETERS', specX + specW / 2, specY + 5.5, { align: 'center' });

  // Specs Table Rows
  const specsRows: [string, string][] = [
    ['Product Name', product.name],
    ['Application Type', specs.rodType === 'pedestal' ? 'Pedestal Extension Rod' : 'Ceiling Fan Down-Rod'],
    ['Nominal Length', `${specs.lengthInches}" (${Math.round(specs.lengthInches * 25.4)} mm${specs.lengthInches >= 39.37 ? ` / ${(specs.lengthInches * 0.0254).toFixed(2)} m` : ''}) • ${(specs.lengthInches / 12).toFixed(1)} ft`],
    ['Outer Diameter (OD)', `Ø ${specs.diameterInches} (${formatDiameterMm(specs.diameterInches)} mm)`],
    ['Wall Gauge / Steel', `${specs.gauge} (Heavy Cold Rolled)`],
    ['Clamp Bore Size', `${specs.clampSize || specs.diameterInches || '3/4"'} (Precision Stamped)`],
    ['Clamp Stamping Gauge', `${specs.clampGauge || '16 Gauge'} (High Tensile)`],
    [
      'Threading Spec',
      specs.threadType === 'without_thread' || !specs.threadType
        ? 'Without Thread (Plain / Bolted)'
        : `With Threads (${specs.threadStandard || 'BSPT'} - ${
            specs.threadType === 'both_ends'
              ? 'Both Ends'
              : specs.threadType === 'top_only'
              ? 'Top End'
              : 'Bottom End'
          })`
    ],
    ['Top Clamp Collar', specs.hasTopClamp ? `Standard Shackle (${specs.clampSize || '3/4"'})` : 'Without Clamp (Bare Tube)'],
    ['Bottom Motor Coupler', specs.hasBottomClamp ? `Coupler Fitted (${specs.clampSize || '3/4"'})` : 'Without Clamp (Bare Tube)'],
    ['Garter Safety Pin', specs.hasGarterPin !== false ? `Fitted (Ø${specs.garterPinDiameterMm || 3.2}mm × ${specs.garterPinLengthMm || 45}mm ${specs.garterPinType === 'hairpin_r_clip' ? 'R-Clip' : specs.garterPinType === 'through_bolt_locknut' ? 'Bolt+Nut' : 'DIN 94 Cotter'})` : 'Omitted (None)'],
    ['Through-Hole Diameter', `Ø ${specs.holeSizeMm} mm (Tolerance ±0.2mm)`],
    ['Top Hole Count', `${specs.topHoleCount} Hole${specs.topHoleCount !== 1 ? 's' : ''}`],
    ['Bottom Hole Count', `${specs.bottomHoleCount} Dual Hole${specs.bottomHoleCount !== 1 ? 's' : ''}`],
    ['Safety Cotter Slit', specs.hasSafetySlit ? 'Molded Anti-Rotation Slit' : 'Omitted (Direct Bolt)'],
    ['Surface Powder Coat', specs.finishColor || 'Matt Black Heat-Treated'],
    ['Catalog Price', `Rs ${fmt(product.price)} / piece`]
  ];

  let currentY = specY + 11;
  const rowHeight = 6.6;

  specsRows.forEach(([label, val], idx) => {
    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(specX, currentY - 4.5, specW, rowHeight, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(specX, currentY + 2.6, specX + specW, currentY + 2.6);

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);
    doc.text(label, specX + 2.5, currentY);

    // Value
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.2);
    if (label.includes('Clamp') && val.includes('Without')) {
      doc.setTextColor(217, 119, 6); // Amber for without clamp
    } else if (label.includes('Threading') && val.includes('With Threads')) {
      doc.setTextColor(234, 88, 12); // Orange for threaded
    } else if (label.includes('Through-Hole')) {
      doc.setTextColor(2, 132, 199); // Sky blue for holes
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(val, specX + specW - 2.5, currentY, { align: 'right' });

    currentY += rowHeight;
  });

  // 5. Bottom Workshop Approval & Verification Title Block (Spans full width)
  const bottomY = pageHeight - margin - 26;
  const bottomW = pageWidth - margin * 2 - 4;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin + 2, bottomY, bottomW, 24, 'F');
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.4);
  doc.rect(margin + 2, bottomY, bottomW, 24, 'S');

  // Divider lines inside title block
  doc.setDrawColor(51, 65, 85);
  doc.line(margin + 60, bottomY, margin + 60, bottomY + 24);
  doc.line(margin + 130, bottomY, margin + 130, bottomY + 24);
  doc.line(margin + 200, bottomY, margin + 200, bottomY + 24);

  // Box 1: Design & CAD Info
  doc.setTextColor(245, 183, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ENGINEERING DESIGNER', margin + 6, bottomY + 5);
  doc.setTextColor(241, 245, 249);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text('CAD Station: Falcon Studio v4.2', margin + 6, bottomY + 11);
  doc.text(`Drawing ID: ${drawingNo}`, margin + 6, bottomY + 16);
  doc.text('Tolerances: Linear ±0.5mm', margin + 6, bottomY + 21);

  // Box 2: Quality Inspection & Standards
  doc.setTextColor(245, 183, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('QUALITY ASSURANCE', margin + 64, bottomY + 5);
  doc.setTextColor(241, 245, 249);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text('Material: M.S. Seamless Steel', margin + 64, bottomY + 11);
  doc.text(`Tube Gauge: ${specs.gauge}`, margin + 64, bottomY + 16);
  doc.text('Cert: ISO-9001 Factory Grade', margin + 64, bottomY + 21);

  // Box 3: Clamping & Assembly Notes
  doc.setTextColor(245, 183, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ASSEMBLY SPECIFICATION', margin + 134, bottomY + 5);
  doc.setTextColor(241, 245, 249);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Clamp: ${specs.clampSize || specs.diameterInches || '3/4"'} (${specs.clampGauge || '16G'})`, margin + 134, bottomY + 11);
  doc.text(`Threads: ${specs.threadType === 'without_thread' || !specs.threadType ? 'Without Thread' : `With Threads (${specs.threadStandard || 'BSPT'})`}`, margin + 134, bottomY + 16);
  doc.text(`Fasteners: M${specs.holeSizeMm} Grade 8.8`, margin + 134, bottomY + 21);

  // Box 4: Production Approval Sign-off
  doc.setTextColor(245, 183, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('WORKSHOP AUTHORIZATION', margin + 204, bottomY + 5);
  doc.setTextColor(56, 189, 248);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('[ APPROVED FOR FABRICATION ]', margin + 204, bottomY + 11);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text(`Supervisor Sign: _________________`, margin + 204, bottomY + 16);
  doc.text(`Production Date: ${dateStr}`, margin + 204, bottomY + 21);

  // Save and Export the PDF
  const cleanFileName = `Falcon_Rod_Blueprint_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${specs.lengthInches}in.pdf`;
  const pdfBlob = doc.output('blob');
  const pdfDataUrl = doc.output('datauristring');

  triggerUniversalDownload({
    fileName: cleanFileName,
    content: pdfBlob,
    dataUrl: pdfDataUrl,
    mimeType: 'application/pdf',
    format: 'pdf',
    title: `${product.name} CAD Blueprint`
  });

  recordExport({
    title: `${product.name} (${specs.lengthInches}") Blueprint (PDF)`,
    category: 'blueprint',
    format: 'pdf',
    fileName: cleanFileName,
    fileSize: '~180 KB',
    dataUrl: pdfDataUrl,
    description: `Engineering CAD blueprint and technical specification sheet for ${product.name} (${specs.lengthInches}", ${specs.gauge}, ${specs.hasTopClamp && specs.hasBottomClamp ? 'Dual Clamps' : !specs.hasTopClamp && !specs.hasBottomClamp ? 'Without Clamps' : 'Single Clamp'}).`
  });

  return true;
}

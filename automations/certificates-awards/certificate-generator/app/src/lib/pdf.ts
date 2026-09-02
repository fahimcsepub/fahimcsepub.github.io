import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import libreRegularUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff?url';
import libreBoldUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff?url';
import libreItalicUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff?url';
import sourceRegularUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff?url';
import sourceBoldUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff?url';
import bengaliRegularUrl from '@fontsource/noto-serif-bengali/files/noto-serif-bengali-bengali-400-normal.woff?url';
import bengaliBoldUrl from '@fontsource/noto-serif-bengali/files/noto-serif-bengali-bengali-700-normal.woff?url';
import type { CertificateRecord, CertificateTemplateId, RenderOptions } from '../types';
import {
  containsBengali,
  formatDisplayDate,
  generateCitation,
  getCategoryLabel,
  getRecordTemplateId,
} from './certificate';

export const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

export const PUB_CLASSIC_RULE_STYLE = {
  awardRuleHeight: 1,
  awardRuleOpticalCenterFactor: 0.35,
  recipientRuleHeight: 1,
} as const;

interface AssetBytes {
  background: Uint8Array;
  logo: Uint8Array;
  seal: Uint8Array;
  libreRegular: Uint8Array;
  libreBold: Uint8Array;
  libreItalic: Uint8Array;
  sourceRegular: Uint8Array;
  sourceBold: Uint8Array;
  bengaliRegular: Uint8Array;
  bengaliBold: Uint8Array;
}

const assetCache = new Map<string, Promise<AssetBytes>>();

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load certificate asset: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function assetUrl(base: string, filename: string): string {
  return new URL(filename, base.endsWith('/') ? base : `${base}/`).href;
}

function loadAssets(baseUrl: string, templateId: CertificateTemplateId): Promise<AssetBytes> {
  const cacheKey = `${baseUrl}:${templateId}`;
  if (!assetCache.has(cacheKey)) {
    const visualAssets = templateId === 'pub-classic'
      ? ['pub_classic_border.png', 'pub_cse_logo_blue.png', 'pub_classic_seal.png']
      : ['modern_vintage_blank_background.png', 'cse_department_logo_charcoal_gold.png', 'modern_vintage_seal.png'];
    assetCache.set(
      cacheKey,
      Promise.all([
        fetchBytes(assetUrl(baseUrl, visualAssets[0])),
        fetchBytes(assetUrl(baseUrl, visualAssets[1])),
        fetchBytes(assetUrl(baseUrl, visualAssets[2])),
        fetchBytes(libreRegularUrl),
        fetchBytes(libreBoldUrl),
        fetchBytes(libreItalicUrl),
        fetchBytes(sourceRegularUrl),
        fetchBytes(sourceBoldUrl),
        fetchBytes(bengaliRegularUrl),
        fetchBytes(bengaliBoldUrl),
      ]).then(
        ([background, logo, seal, libreRegular, libreBold, libreItalic, sourceRegular, sourceBold, bengaliRegular, bengaliBold]) => ({
          background,
          logo,
          seal,
          libreRegular,
          libreBold,
          libreItalic,
          sourceRegular,
          sourceBold,
          bengaliRegular,
          bengaliBold,
        }),
      ),
    );
  }
  return assetCache.get(cacheKey)!;
}

function centerX(text: string, font: PDFFont, size: number, pageWidth = A4_LANDSCAPE[0]): number {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const character of [...word]) {
    if (font.widthOfTextAtSize(current + character, size) <= maxWidth) current += character;
    else {
      if (current) chunks.push(current);
      current = character;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).flatMap((word) =>
    font.widthOfTextAtSize(word, size) > maxWidth ? splitLongWord(word, font, size, maxWidth) : [word],
  );
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function balanceWrappedLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineCount: number,
): string[] {
  if (lineCount <= 1) return wrapText(text, font, size, maxWidth);
  const words = text.trim().split(/\s+/).flatMap((word) =>
    font.widthOfTextAtSize(word, size) > maxWidth ? splitLongWord(word, font, size, maxWidth) : [word],
  );
  if (words.length <= lineCount) return words;
  const wordWidths = words.map((word) => font.widthOfTextAtSize(word, size));
  const spaceWidth = font.widthOfTextAtSize(' ', size);
  const totalWidth = wordWidths.reduce((sum, width) => sum + width, 0)
    + Math.max(0, words.length - lineCount) * spaceWidth;
  const targetWidth = totalWidth / lineCount;
  const costs = Array.from({ length: lineCount + 1 }, () => Array(words.length + 1).fill(Number.POSITIVE_INFINITY));
  const breaks = Array.from({ length: lineCount + 1 }, () => Array(words.length + 1).fill(-1));
  costs[0][0] = 0;

  for (let line = 1; line <= lineCount; line += 1) {
    for (let end = line; end <= words.length; end += 1) {
      let width = 0;
      for (let start = end - 1; start >= line - 1; start -= 1) {
        width = wordWidths[start] + (start === end - 1 ? 0 : spaceWidth + width);
        if (width > maxWidth) break;
        const previous = costs[line - 1][start];
        if (!Number.isFinite(previous)) continue;
        const cost = previous + (width - targetWidth) ** 2;
        if (cost < costs[line][end]) {
          costs[line][end] = cost;
          breaks[line][end] = start;
        }
      }
    }
  }

  if (!Number.isFinite(costs[lineCount][words.length])) return wrapText(text, font, size, maxWidth);
  const lines: string[] = [];
  let end = words.length;
  for (let line = lineCount; line > 0; line -= 1) {
    const start = breaks[line][end];
    lines.unshift(words.slice(start, end).join(' '));
    end = start;
  }
  return lines;
}

function fitLines(
  text: string,
  font: PDFFont,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
): { lines: string[]; size: number } {
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const lines = wrapText(text, font, size, maxWidth);
    if (lines.length <= maxLines) {
      return { lines: balanceWrappedLines(text, font, size, maxWidth, lines.length), size };
    }
  }
  throw new Error(`Text is too long to fit in ${maxLines} line${maxLines === 1 ? '' : 's'}.`);
}

function drawCenteredLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  startY: number,
  lineHeight: number,
  color = rgb(0.15, 0.21, 0.23),
) {
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: centerX(line, font, size),
      y: startY - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function trackedTextWidth(text: string, font: PDFFont, size: number, tracking: number) {
  const characters = Array.from(text);
  return characters.reduce((total, character) => total + font.widthOfTextAtSize(character, size), 0)
    + Math.max(0, characters.length - 1) * tracking;
}

function drawTrackedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  tracking: number,
  color: ReturnType<typeof rgb>,
) {
  let cursor = x;
  Array.from(text).forEach((character) => {
    page.drawText(character, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(character, size) + tracking;
  });
}

function drawCenteredTrackedText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  tracking: number,
  color: ReturnType<typeof rgb>,
) {
  drawTrackedText(page, text, (page.getWidth() - trackedTextWidth(text, font, size, tracking)) / 2, y, font, size, tracking, color);
}

function dataUrlBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('Signature image must be a PNG or JPEG data URL.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mime: match[1].toLowerCase(), bytes };
}

async function drawSignature(
  pdf: PDFDocument,
  page: PDFPage,
  dataUrl: string | undefined,
  box: { x: number; y: number; width: number; height: number },
) {
  if (!dataUrl) return;
  const { mime, bytes } = dataUrlBytes(dataUrl);
  const image = mime.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const bounds = image.scaleToFit(box.width, box.height);
  page.drawImage(image, {
    x: box.x + (box.width - bounds.width) / 2,
    y: box.y + (box.height - bounds.height) / 2,
    width: bounds.width,
    height: bounds.height,
  });
}

export async function generateCertificatePdf(
  record: CertificateRecord,
  options: RenderOptions,
): Promise<Uint8Array> {
  const templateId = getRecordTemplateId(record);
  const assets = await loadAssets(options.assetBaseUrl, templateId);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  document.setTitle(`${getCategoryLabel(record, options.settings)} - ${record.recipientName}`);
  document.setAuthor(options.settings.departmentName);
  document.setSubject(generateCitation(record, options.settings));
  document.setProducer('PUB Dept. CSE Automations');
  document.setCreationDate(new Date());

  const [width, height] = A4_LANDSCAPE;
  const page = document.addPage([width, height]);
  const [background, logo, seal] = await Promise.all([
    document.embedPng(assets.background),
    document.embedPng(assets.logo),
    document.embedPng(assets.seal),
  ]);
  const [libreRegular, libreBold, libreItalic, sourceRegular, sourceBold, bengaliRegular, bengaliBold] = await Promise.all([
    document.embedFont(assets.libreRegular, { subset: true }),
    document.embedFont(assets.libreBold, { subset: true }),
    document.embedFont(assets.libreItalic, { subset: true }),
    document.embedFont(assets.sourceRegular, { subset: true }),
    document.embedFont(assets.sourceBold, { subset: true }),
    document.embedFont(assets.bengaliRegular, { subset: true }),
    document.embedFont(assets.bengaliBold, { subset: true }),
  ]);

  if (templateId === 'pub-classic') {
    const scaleX = width / 1122;
    const scaleY = height / 794;
    const fromPpt = (left: number, top: number, boxWidth: number, boxHeight: number) => ({
      x: left * scaleX,
      y: height - (top + boxHeight) * scaleY,
      width: boxWidth * scaleX,
      height: boxHeight * scaleY,
    });
    const baseline = (top: number, sourceFontSize: number, inset = 2.67) => (
      height - (top + inset + sourceFontSize) * scaleY
    );
    const paper = rgb(246 / 255, 243 / 255, 236 / 255);
    const blue = rgb(18 / 255, 58 / 255, 95 / 255);
    const titleInk = rgb(31 / 255, 43 / 255, 53 / 255);
    const mutedBlue = rgb(90 / 255, 108 / 255, 120 / 255);
    const gold = rgb(138 / 255, 110 / 255, 54 / 255);
    const ornamentGold = rgb(169 / 255, 136 / 255, 74 / 255);
    const softGold = rgb(201 / 255, 191 / 255, 166 / 255);
    const metadataLabel = rgb(140 / 255, 146 / 255, 150 / 255);
    const metadataText = rgb(42 / 255, 48 / 255, 51 / 255);
    const signatureInk = rgb(63 / 255, 82 / 255, 96 / 255);
    const signatoryInk = rgb(34 / 255, 48 / 255, 60 / 255);

    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    page.drawImage(background, { x: 0, y: 0, width, height });
    page.drawImage(logo, fromPpt(513, 86, 96, 96));

    const drawRightAligned = (
      text: string,
      right: number,
      y: number,
      font: PDFFont,
      size: number,
      color: ReturnType<typeof rgb>,
      tracking = 0,
    ) => drawTrackedText(
      page,
      text,
      right * scaleX - trackedTextWidth(text, font, size, tracking),
      y,
      font,
      size,
      tracking,
      color,
    );

    drawRightAligned('CERTIFICATE NO.', 884.4, baseline(98.4, 9.51), sourceBold, 9.51 * scaleY, metadataLabel, 1);
    drawRightAligned(record.certificateNumber, 1020, baseline(96, 12) + 1.8, libreRegular, 7.2, metadataText);
    drawRightAligned('DATE', 884.4, baseline(119.4, 9.51), sourceBold, 9.51 * scaleY, metadataLabel, 1);
    drawRightAligned(formatDisplayDate(record.issueDate), 1020, baseline(117, 12) + 1.8, libreRegular, 7.2, metadataText);

    const university = options.settings.universityName.toUpperCase();
    const department = options.settings.departmentName.toUpperCase();
    const title = options.settings.certificateTitle.toUpperCase();
    const universityFit = fitLines(university, libreBold, 740.82 * scaleX, 1, 11.25, 9);
    drawCenteredLines(page, universityFit.lines, libreBold, universityFit.size, baseline(190, 21) + 4.5, 18, blue);
    const departmentFit = fitLines(department, sourceBold, 425.12 * scaleX, 1, 11.51 * scaleY, 7.5 * scaleY);
    drawCenteredTrackedText(page, department, baseline(221.15, 11.51), sourceBold, departmentFit.size, 1.85, mutedBlue);

    const leftOrnament = fromPpt(521, 261.45, 30, 1);
    const rightOrnament = fromPpt(571, 261.45, 30, 1);
    page.drawRectangle({ ...leftOrnament, color: ornamentGold });
    page.drawRectangle({ ...rightOrnament, color: ornamentGold });
    const diamond = fromPpt(559, 259.95, 4, 4);
    page.drawRectangle({
      x: diamond.x + diamond.width / 2,
      y: diamond.y,
      width: diamond.width,
      height: diamond.height,
      rotate: degrees(45),
      color: ornamentGold,
    });

    const titleFit = fitLines(title, libreRegular, 929.86 * scaleX, 1, 25.2, 20);
    drawCenteredLines(page, titleFit.lines, libreRegular, titleFit.size, baseline(279.95, 42) + 6.3, 32, titleInk);

    const subtitle = getCategoryLabel(record, options.settings).toUpperCase();
    const subtitleFit = fitLines(subtitle, sourceBold, 270 * scaleX, 1, 12.51 * scaleY, 7.5 * scaleY);
    const subtitleTracking = 1.6;
    const subtitleWidth = trackedTextWidth(subtitle, sourceBold, subtitleFit.size, subtitleTracking);
    const subtitleY = baseline(340.3, 12.51);
    const ruleHeight = PUB_CLASSIC_RULE_STYLE.awardRuleHeight;
    const ruleY = subtitleY
      + subtitleFit.size * PUB_CLASSIC_RULE_STYLE.awardRuleOpticalCenterFactor
      - ruleHeight / 2;
    const ruleWidth = 46 * scaleX;
    const ruleGap = 7 * scaleX;
    page.drawRectangle({ x: width / 2 - subtitleWidth / 2 - ruleGap - ruleWidth, y: ruleY, width: ruleWidth, height: ruleHeight, color: softGold });
    page.drawRectangle({ x: width / 2 + subtitleWidth / 2 + ruleGap, y: ruleY, width: ruleWidth, height: ruleHeight, color: softGold });
    drawCenteredTrackedText(page, subtitle, subtitleY, sourceBold, subtitleFit.size, subtitleTracking, gold);

    drawCenteredLines(
      page,
      ['This certificate is proudly presented to'],
      libreItalic,
      9.35,
      baseline(375.9, 14) + 1.15,
      12,
      mutedBlue,
    );

    const nameFont = containsBengali(record.recipientName) ? bengaliBold : libreBold;
    const fittedName = fitLines(record.recipientName.trim(), nameFont, 566.47 * scaleX, 2, 24.75, 16.5);
    const nameStart = fittedName.lines.length === 1
      ? baseline(403.5, 43) + (43 * scaleY - fittedName.size)
      : baseline(403.5, 27) + (27 * scaleY - fittedName.size);
    drawCenteredLines(page, fittedName.lines, nameFont, fittedName.size, nameStart, fittedName.size * 1.14, blue);
    const nameRule = fromPpt(281, 465.38, 560, 1);
    const recipientRuleHeight = PUB_CLASSIC_RULE_STYLE.recipientRuleHeight;
    page.drawRectangle({
      ...nameRule,
      y: nameRule.y - (recipientRuleHeight - nameRule.height) / 2,
      height: recipientRuleHeight,
      color: rgb(217 / 255, 211 / 255, 198 / 255),
    });

    const citation = generateCitation(record, options.settings);
    const citationFont = containsBengali(citation) ? bengaliRegular : libreItalic;
    const fittedCitation = fitLines(citation, citationFont, 727.18 * scaleX, 3, 14 * scaleY, 8.5 * scaleY);
    const citationStart = baseline(515.5, 14) - 7.5 + (fittedCitation.lines.length === 3 ? 5 : 0);
    drawCenteredLines(
      page,
      fittedCitation.lines,
      citationFont,
      fittedCitation.size,
      citationStart,
      fittedCitation.size * 1.35,
      gold,
    );

    const leftSignatureRule = fromPpt(96, 669.2, 300, 1);
    const rightSignatureRule = fromPpt(726, 669.2, 300, 1);
    const leftSignatureBox = fromPpt(96, 615, 300, 48);
    const rightSignatureBox = fromPpt(726, 615, 300, 48);
    const centeredSignatureBox = fromPpt(401, 597.8, 320, 48);
    const signatureCenters = record.signatureLayout === 'one'
      ? [width / 2]
      : [leftSignatureRule.x + leftSignatureRule.width / 2, rightSignatureRule.x + rightSignatureRule.width / 2];
    const signatureLabels = record.signatureLayout === 'one'
      ? [options.settings.signatoryOneLabel]
      : [options.settings.signatoryOneLabel, options.settings.signatoryTwoLabel];
    if (record.signatureMode === 'digital') {
      await drawSignature(
        document,
        page,
        options.signatures?.first,
        record.signatureLayout === 'one' ? centeredSignatureBox : leftSignatureBox,
      );
      if (record.signatureLayout === 'two') {
        await drawSignature(document, page, options.signatures?.second, rightSignatureBox);
      }
    }
    signatureCenters.forEach((center, index) => {
      const lineWidth = (record.signatureLayout === 'one' ? 320 : 300) * scaleX;
      const lineY = record.signatureLayout === 'one' ? fromPpt(401, 651.8, 320, 1).y : leftSignatureRule.y;
      page.drawRectangle({ x: center - lineWidth / 2, y: lineY, width: lineWidth, height: scaleY, color: signatureInk });
      const label = signatureLabels[index];
      const fitted = fitLines(label, libreRegular, lineWidth, 2, record.signatureLayout === 'one' ? 10.13 : 7.5, 6);
      const labelY = record.signatureLayout === 'one'
        ? baseline(663.8, 13.51) + (13.51 * scaleY - fitted.size)
        : baseline(681.2, 13.51) + (13.51 * scaleY - fitted.size);
      fitted.lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: center - libreRegular.widthOfTextAtSize(line, fitted.size) / 2,
          y: labelY - lineIndex * fitted.size * 1.15,
          size: fitted.size,
          font: libreRegular,
          color: signatoryInk,
        });
      });
    });

    if (record.signatureLayout === 'one') {
      const departmentContext = options.settings.departmentName.replace(/^Department of\s+/i, '').toUpperCase();
      drawCenteredTrackedText(
        page,
        departmentContext,
        baseline(683.6, 10.51),
        sourceRegular,
        6.5,
        1.05,
        rgb(124 / 255, 133 / 255, 139 / 255),
      );
    } else {
      page.drawImage(seal, fromPpt(532, 638, 58, 58));
    }
    return document.save({ useObjectStreams: true });
  }

  const scaleX = width / 1123;
  const scaleY = height / 794;
  const fromPpt = (left: number, top: number, boxWidth: number, boxHeight: number) => ({
    x: left * scaleX,
    y: height - (top + boxHeight) * scaleY,
    width: boxWidth * scaleX,
    height: boxHeight * scaleY,
  });

  page.drawImage(background, { x: 0, y: 0, width, height });
  page.drawImage(logo, fromPpt(521, 66, 81, 81));

  const charcoal = rgb(0.15, 0.21, 0.23);
  const muted = rgb(0.35, 0.42, 0.44);
  const gold = rgb(0.67, 0.45, 0.09);
  const ivory = rgb(0.969, 0.953, 0.918);
  const university = options.settings.universityName.toUpperCase();
  const department = options.settings.departmentName.toUpperCase();
  const title = options.settings.certificateTitle.toUpperCase();

  const numberText = `Certificate No.: ${record.certificateNumber}`;
  const metadataRight = 1024 * scaleX;
  page.drawText(numberText, {
    x: metadataRight - sourceRegular.widthOfTextAtSize(numberText, 7.5),
    y: 519,
    size: 7.5,
    font: sourceRegular,
    color: muted,
  });
  const dateText = `Date: ${formatDisplayDate(record.issueDate)}`;
  page.drawText(dateText, {
    x: metadataRight - sourceRegular.widthOfTextAtSize(dateText, 7.5),
    y: 503.2,
    size: 7.5,
    font: sourceRegular,
    color: muted,
  });

  const universityFit = fitLines(university, libreBold, 580, 1, 15, 12.5);
  drawCenteredLines(page, universityFit.lines, libreBold, universityFit.size, 463, 18, charcoal);
  const departmentFit = fitLines(department, sourceBold, 550, 1, 9.5, 8);
  drawCenteredLines(page, departmentFit.lines, sourceBold, departmentFit.size, 441, 12, muted);

  const titleFit = fitLines(title, libreRegular, 662, 1, 27.5, 20);
  drawCenteredLines(page, titleFit.lines, libreRegular, titleFit.size, 395, 30, charcoal);
  const titleRule = fromPpt(386, 288, 351, 2);
  page.drawRectangle({ x: titleRule.x, y: titleRule.y, width: titleRule.width, height: titleRule.height, color: gold });

  const subtitle = getCategoryLabel(record, options.settings).toUpperCase();
  const subtitleFit = fitLines(subtitle, sourceBold, 235, 1, 7.6, 6.4);
  const subtitleWidth = sourceBold.widthOfTextAtSize(subtitle, subtitleFit.size);
  page.drawRectangle({ x: width / 2 - subtitleWidth / 2 - 9, y: 373.2, width: subtitleWidth + 18, height: 11.8, color: ivory });
  drawCenteredLines(page, [subtitle], sourceBold, subtitleFit.size, 375.8, 9, gold);
  drawCenteredLines(
    page,
    ['This certificate is proudly presented to'],
    libreRegular,
    12.75,
    354.7,
    14,
    muted,
  );

  const nameFont = containsBengali(record.recipientName) ? bengaliBold : libreBold;
  const fittedName = fitLines(record.recipientName.trim(), nameFont, 594, 2, containsBengali(record.recipientName) ? 24 : 26.25, 16);
  const nameStart = fittedName.lines.length === 1 ? 311 : 321;
  drawCenteredLines(page, fittedName.lines, nameFont, fittedName.size, nameStart, fittedName.size * 1.2, charcoal);
  const nameRule = fromPpt(260, 400, 603, 1.5);
  page.drawRectangle({ x: nameRule.x, y: nameRule.y, width: nameRule.width, height: nameRule.height, color: charcoal });

  const citation = generateCitation(record, options.settings);
  const citationFont = containsBengali(citation) ? bengaliRegular : libreRegular;
  const renderedCitationFont = containsBengali(citation) ? citationFont : libreItalic;
  const fittedCitation = fitLines(citation, renderedCitationFont, 630, 3, 12.25, 8.5);
  const citationStart = fittedCitation.lines.length === 1 ? 245 : fittedCitation.lines.length === 2 ? 251 : 257;
  drawCenteredLines(
    page,
    fittedCitation.lines,
    renderedCitationFont,
    fittedCitation.size,
    citationStart,
    fittedCitation.size * 1.45,
    gold,
  );

  const leftSignatureRule = fromPpt(145, 612, 242, 1.25);
  const rightSignatureRule = fromPpt(736, 612, 242, 1.25);
  const leftSignatureBox = fromPpt(126, 557, 280, 48);
  const rightSignatureBox = fromPpt(717, 557, 280, 48);
  const centeredSignatureBox = fromPpt(421.5, 557, 280, 48);
  const signatureCenters = record.signatureLayout === 'one'
    ? [width / 2]
    : [leftSignatureRule.x + leftSignatureRule.width / 2, rightSignatureRule.x + rightSignatureRule.width / 2];
  const signatureLabels = record.signatureLayout === 'one'
    ? [options.settings.signatoryOneLabel]
    : [options.settings.signatoryOneLabel, options.settings.signatoryTwoLabel];
  if (record.signatureMode === 'digital') {
    await drawSignature(
      document,
      page,
      options.signatures?.first,
      record.signatureLayout === 'one' ? centeredSignatureBox : leftSignatureBox,
    );
    if (record.signatureLayout === 'two') {
      await drawSignature(document, page, options.signatures?.second, rightSignatureBox);
    }
  }
  signatureCenters.forEach((center, index) => {
    const lineWidth = 242 * scaleX;
    const lineY = leftSignatureRule.y;
    page.drawRectangle({ x: center - lineWidth / 2, y: lineY, width: lineWidth, height: 1.25 * scaleY, color: charcoal });
    const label = signatureLabels[index];
    const fitted = fitLines(label, libreBold, record.signatureLayout === 'one' ? 248 : 238, 2, 10.5, 7.2);
    fitted.lines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: center - libreBold.widthOfTextAtSize(line, fitted.size) / 2,
        y: 116.2 - lineIndex * 10,
        size: fitted.size,
        font: libreBold,
        color: charcoal,
      });
    });
  });

  if (record.signatureLayout === 'two') {
    page.drawImage(seal, fromPpt(518, 564, 87, 87));
  }

  return document.save({ useObjectStreams: true });
}

export async function combineCertificatePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const combined = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(file);
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  }
  combined.setTitle('CSE Certificates');
  combined.setProducer('PUB Dept. CSE Automations');
  return combined.save({ useObjectStreams: true });
}

import { LAYOUT_OPTIONS, THEME_OPTIONS } from "./config.js?v=fit-22";

const HEADING_PATTERN = /^#{1,6}\s/;
const BLOCKQUOTE_PATTERN = /^>\s?/;
const CODE_FENCE_PATTERN = /^```/;
const HORIZONTAL_RULE_PATTERN = /^(-{3,}|\*{3,}|_{3,})$/;
const INLINE_IMAGE_PATTERN = /!\[([^\]]*)\]\(((?:[^()\s]+|\([^)]*\))+)(?:\s+"([^"]+)")?\)/;
const INLINE_IMAGE_GLOBAL_PATTERN = /!\[([^\]]*)\]\(((?:[^()\s]+|\([^)]*\))+)(?:\s+"([^"]+)")?\)/g;
const INLINE_LINK_GLOBAL_PATTERN = /\[([^\]]+)\]\(((?:[^()\s]+|\([^)]*\))+)\)/g;
const AUTO_SPLIT_THRESHOLD = 160;
const ASCII_DIAGRAM_PATTERN = /[┌┐└┘├┤┬┴┼─│▼▲▶◀→←↑↓]/;

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function sanitizeUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed, window.location.href);
    const allowedProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);
    return allowedProtocols.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderLink(label, rawUrl) {
  const safeUrl = sanitizeUrl(rawUrl);
  const safeLabel = parseInlineMarkdown(label);

  if (!safeUrl) {
    return safeLabel;
  }

  return `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
}

function renderImage(altText, rawUrl, title = "") {
  const safeUrl = sanitizeUrl(rawUrl);

  if (!safeUrl) {
    return `<span class="inline-image-fallback">${escapeHtml(altText || "Image")}</span>`;
  }

  const alt = escapeAttribute(altText || "");
  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
  return `<img src="${escapeAttribute(safeUrl)}" alt="${alt}"${titleAttribute} loading="lazy" />`;
}

export function parseInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(INLINE_IMAGE_GLOBAL_PATTERN, (_, alt, url, title) => renderImage(alt, url, title))
    .replace(INLINE_LINK_GLOBAL_PATTERN, (_, label, url) => renderLink(label, url))
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function splitSlides(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const slides = [];
  let buffer = [];
  let inCodeBlock = false;
  let inNotesBlock = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (CODE_FENCE_PATTERN.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      buffer.push(line);
      return;
    }

    if (!inCodeBlock && trimmed === ":::notes") {
      inNotesBlock = true;
      buffer.push(line);
      return;
    }

    if (!inCodeBlock && inNotesBlock && trimmed === ":::") {
      inNotesBlock = false;
      buffer.push(line);
      return;
    }

    const previousLine = index > 0 ? lines[index - 1].trim() : "";
    const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : "";
    const canSplit =
      !inCodeBlock &&
      !inNotesBlock &&
      trimmed === "---" &&
      (!previousLine || index === 0) &&
      (!nextLine || index === lines.length - 1);

    if (canSplit) {
      const slide = buffer.join("\n").trim();
      if (slide) {
        slides.push(slide);
      }
      buffer = [];
      return;
    }

    buffer.push(line);
  });

  const finalSlide = buffer.join("\n").trim();
  if (finalSlide) {
    slides.push(finalSlide);
  }

  return slides;
}

function isBlankLine(line) {
  return !line || !line.trim();
}

function getIndentLevel(line) {
  const match = line.match(/^\s*/);
  return match ? match[0].replace(/\t/g, "    ").length : 0;
}

function isListItem(line) {
  return /^(\s*)([-*]|\d+\.)\s+/.test(line);
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);
}

function splitTableRow(line, parser = parseInlineMarkdown) {
  const normalized = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => parser(cell.trim()));
}

function parseTable(lines, startIndex) {
  if (startIndex + 1 >= lines.length) {
    return null;
  }

  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];

  if (!headerLine.includes("|") || !isTableSeparator(separatorLine)) {
    return null;
  }

  const headerCells = splitTableRow(headerLine);
  const bodyRows = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlankLine(line) || !line.includes("|")) {
      break;
    }
    bodyRows.push(splitTableRow(line));
    index += 1;
  }

  const headerMarkup = headerCells.map((cell) => `<th>${cell}</th>`).join("");
  const bodyMarkup = bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  return {
    html: `<table><thead><tr>${headerMarkup}</tr></thead><tbody>${bodyMarkup}</tbody></table>`,
    nextIndex: index,
  };
}

function isMarkdownBlockBoundary(lines, index, { stopOnImage = false } = {}) {
  const trimmed = lines[index].trim();
  if (!trimmed || trimmed === "+++") {
    return true;
  }
  if (
    HEADING_PATTERN.test(trimmed) ||
    BLOCKQUOTE_PATTERN.test(trimmed) ||
    CODE_FENCE_PATTERN.test(trimmed) ||
    HORIZONTAL_RULE_PATTERN.test(trimmed) ||
    isListItem(lines[index]) ||
    Boolean(parseTable(lines, index))
  ) {
    return true;
  }
  return stopOnImage && INLINE_IMAGE_PATTERN.test(lines[index]);
}

function parseList(lines, startIndex, parentIndent = 0) {
  const stack = [];
  let html = "";
  let index = startIndex;

  function closeLists(targetDepth = 0) {
    while (stack.length > targetDepth) {
      html += "</li>";
      html += `</${stack.pop().type}>`;
    }
  }

  while (index < lines.length) {
    const line = lines[index];

    if (isBlankLine(line)) {
      index += 1;
      continue;
    }

    const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (!match) {
      break;
    }

    const indent = getIndentLevel(line);
    if (indent < parentIndent) {
      break;
    }

    const type = /\d+\./.test(match[2]) ? "ol" : "ul";
    const content = match[3];

    if (!stack.length || indent > stack[stack.length - 1].indent) {
      html += `<${type}>`;
      stack.push({ indent, type });
    } else {
      while (stack.length && indent < stack[stack.length - 1].indent) {
        html += "</li>";
        html += `</${stack.pop().type}>`;
      }

      if (!stack.length || stack[stack.length - 1].type !== type || indent !== stack[stack.length - 1].indent) {
        if (stack.length && indent === stack[stack.length - 1].indent) {
          html += "</li>";
          html += `</${stack.pop().type}>`;
        }
        html += `<${type}>`;
        stack.push({ indent, type });
      } else {
        html += "</li>";
      }
    }

    html += `<li>${parseInlineMarkdown(content)}`;
    index += 1;
  }

  closeLists(0);

  return { html, nextIndex: index };
}

function parseMarkdownContent(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "+++") {
      html.push('<div class="layout-divider" aria-hidden="true"></div>');
      index += 1;
      continue;
    }

    if (CODE_FENCE_PATTERN.test(trimmed)) {
      const language = trimmed.slice(3).trim().toLowerCase();
      const codeBuffer = [];
      index += 1;

      while (index < lines.length && !CODE_FENCE_PATTERN.test(lines[index].trim())) {
        codeBuffer.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const code = codeBuffer.join("\n");

      if (language === "mermaid") {
        html.push(`<div class="mermaid">${escapeHtml(code)}</div>`);
        continue;
      }

      const preClass = ASCII_DIAGRAM_PATTERN.test(code) ? ' class="diagram-code"' : "";
      const languageClass = language ? ` class="language-${escapeAttribute(language)}"` : "";
      html.push(`<pre${preClass}><code${languageClass}>${escapeHtml(code)}</code></pre>`);
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      html.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (isListItem(rawLine)) {
      const list = parseList(lines, index, getIndentLevel(rawLine));
      html.push(list.html);
      index = list.nextIndex;
      continue;
    }

    if (HEADING_PATTERN.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)[0].length, 6);
      const content = trimmed.replace(/^#{1,6}\s/, "");
      html.push(`<h${level}>${parseInlineMarkdown(content)}</h${level}>`);
      index += 1;
      continue;
    }

    if (BLOCKQUOTE_PATTERN.test(trimmed)) {
      const quoteLines = [];

      while (index < lines.length && BLOCKQUOTE_PATTERN.test(lines[index].trim())) {
        quoteLines.push(parseInlineMarkdown(lines[index].trim().replace(/^>\s?/, "")));
        index += 1;
      }

      html.push(`<blockquote>${quoteLines.join("<br />")}</blockquote>`);
      continue;
    }

    if (HORIZONTAL_RULE_PATTERN.test(trimmed)) {
      html.push("<hr />");
      index += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length) {
      const currentTrimmed = lines[index].trim();
      if (isMarkdownBlockBoundary(lines, index)) {
        break;
      }
      paragraphLines.push(currentTrimmed);
      index += 1;
    }

    html.push(`<p>${parseInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return html.join("");
}

function parseSpeakerNotes(markdown) {
  const notesMatch = markdown.match(/(?:^|\n):::notes\s*\n([\s\S]*?)\n:::(?=\n|$)/);
  return notesMatch ? notesMatch[1].trim() : "";
}

function removeSpeakerNotes(markdown) {
  return markdown.replace(/(?:^|\n):::notes\s*\n[\s\S]*?\n:::(?=\n|$)/g, "\n").trim();
}

function parseSlideConfig(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const metadata = {};
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const configMatch = trimmed.match(/^(layout|theme)\s*:\s*(.+)$/i);
    if (!configMatch) {
      break;
    }

    metadata[configMatch[1].toLowerCase()] = configMatch[2].trim().toLowerCase();
    index += 1;
  }

  const content = lines.slice(index).join("\n").trim();
  const layout = LAYOUT_OPTIONS.has(metadata.layout) ? metadata.layout : "default";
  const theme = Object.hasOwn(THEME_OPTIONS, metadata.theme) ? metadata.theme : null;

  return { content, layout, theme };
}

function getSlideDirectiveLines(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const directives = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      if (directives.length) {
        directives.push("");
      }
      index += 1;
      continue;
    }

    if (!/^(layout|theme)\s*:/i.test(trimmed)) {
      break;
    }

    if (/^theme\s*:/i.test(trimmed)) {
      directives.push(lineWithoutLayout(lines[index]));
    }

    index += 1;
  }

  return directives.filter((line, lineIndex, all) => line || lineIndex < all.length - 1);
}

function lineWithoutLayout(line) {
  return /^layout\s*:/i.test(line.trim()) ? "" : line;
}

function splitDenseContent(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const chunks = [];
  let current = [];
  let parentHeading = "";

  function hasContent(buffer) {
    return buffer.some((line) => line.trim());
  }

  function hasBodyContent(buffer) {
    return buffer.some((line) => {
      const trimmed = line.trim();
      return trimmed && !/^#{2,4}\s+/.test(trimmed);
    });
  }

  function pushCurrent() {
    const chunk = current.join("\n").trim();
    if (chunk) {
      chunks.push(chunk);
    }
    current = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isSectionHeading = /^#{2,4}\s+/.test(trimmed);

    if (/^##\s+/.test(trimmed)) {
      parentHeading = line;
    }

    if (isSectionHeading && hasBodyContent(current)) {
      pushCurrent();
      if (/^#{3,4}\s+/.test(trimmed) && parentHeading && parentHeading !== line) {
        current.push(parentHeading, "");
      }
    }

    current.push(line);
  });

  pushCurrent();

  const refinedChunks = chunks.flatMap(splitOversizedChunk);
  return refinedChunks.length > 1 ? refinedChunks : [content];
}

function splitOversizedChunk(chunk) {
  if (getContentDensityScore(chunk) <= AUTO_SPLIT_THRESHOLD) {
    return [chunk];
  }

  const lines = chunk.replace(/\r\n/g, "\n").split("\n");
  const context = [];
  let bodyStartIndex = 0;

  while (bodyStartIndex < lines.length) {
    const trimmed = lines[bodyStartIndex].trim();
    if (!trimmed || /^#{2,4}\s+/.test(trimmed)) {
      context.push(lines[bodyStartIndex]);
      bodyStartIndex += 1;
      continue;
    }
    break;
  }

  const bodyBlocks = splitIntoMarkdownBlocks(lines.slice(bodyStartIndex)).flatMap(splitLargeTableBlock);
  const prefix = context.join("\n").trim();
  const chunks = [];
  let current = prefix;

  bodyBlocks.forEach((block) => {
    const nextChunk = [current, block].filter(Boolean).join("\n\n");
    if (
      current &&
      current !== prefix &&
      getContentDensityScore(nextChunk) > AUTO_SPLIT_THRESHOLD
    ) {
      chunks.push(current);
      current = [prefix, block].filter(Boolean).join("\n\n");
    } else {
      current = nextChunk;
    }
  });

  if (current.trim()) {
    chunks.push(current);
  }

  return chunks.filter((item) => item.trim());
}

function splitIntoMarkdownBlocks(lines) {
  const blocks = [];
  let current = [];
  let inCodeBlock = false;

  function pushCurrent() {
    const block = current.join("\n").trim();
    if (block) {
      blocks.push(block);
    }
    current = [];
  }

  lines.forEach((line) => {
    if (CODE_FENCE_PATTERN.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      current.push(line);
      if (!inCodeBlock) {
        pushCurrent();
      }
      return;
    }

    if (!inCodeBlock && !line.trim()) {
      pushCurrent();
      return;
    }
    current.push(line);
  });

  pushCurrent();
  return blocks;
}

function splitLargeTableBlock(block) {
  const lines = block.split("\n");
  const separatorIndex = lines.findIndex((line) => isTableSeparator(line));

  if (separatorIndex <= 0 || lines.length <= separatorIndex + 5) {
    return [block];
  }

  const header = lines.slice(0, separatorIndex + 1);
  const rows = lines.slice(separatorIndex + 1);
  const rowGroups = [];

  for (let index = 0; index < rows.length; index += 4) {
    rowGroups.push([...header, ...rows.slice(index, index + 4)].join("\n"));
  }

  return rowGroups;
}

function expandDenseSlide(part) {
  const notes = parseSpeakerNotes(part);
  const noteFree = removeSpeakerNotes(part);
  const config = parseSlideConfig(noteFree);
  const score = getContentDensityScore(config.content);

  if (config.layout !== "default" || score <= AUTO_SPLIT_THRESHOLD) {
    return [part];
  }

  const chunks = splitDenseContent(config.content).filter(
    (chunk) => getContentDensityScore(chunk) > 0,
  );

  if (chunks.length <= 1) {
    return [part];
  }

  const directives = getSlideDirectiveLines(noteFree);
  const directivePrefix = directives.length ? `${directives.join("\n").trim()}\n\n` : "";

  return chunks.map((chunk, index) => {
    const notesBlock =
      index === 0 && notes ? `\n\n:::notes\n${notes}\n:::` : "";
    return `${directivePrefix}${chunk}${notesBlock}`.trim();
  });
}

function parseMarkdownForExport(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "+++") {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (CODE_FENCE_PATTERN.test(trimmed)) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !CODE_FENCE_PATTERN.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: "code", language, text: codeLines.join("\n") });
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      const header = splitTableRow(lines[index], stripInlineMarkdown);
      const rows = [];
      let rowIndex = index + 2;
      while (rowIndex < lines.length) {
        const line = lines[rowIndex];
        if (isBlankLine(line) || !line.includes("|")) {
          break;
        }
        rows.push(splitTableRow(line, stripInlineMarkdown));
        rowIndex += 1;
      }
      blocks.push({ type: "table", header, rows });
      index = rowIndex;
      continue;
    }

    const imageMatch = rawLine.match(INLINE_IMAGE_PATTERN);
    if (imageMatch) {
      blocks.push({
        type: "image",
        alt: imageMatch[1],
        src: sanitizeUrl(imageMatch[2]),
      });
      index += 1;
      continue;
    }

    if (isListItem(rawLine)) {
      const items = [];
      while (index < lines.length && isListItem(lines[index])) {
        const match = lines[index].match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        items.push({
          level: Math.floor(getIndentLevel(lines[index]) / 2),
          text: stripInlineMarkdown(match[3]),
          ordered: /\d+\./.test(match[2]),
        });
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (HEADING_PATTERN.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)[0].length, 6);
      blocks.push({
        type: "heading",
        level,
        text: stripInlineMarkdown(trimmed.replace(/^#{1,6}\s/, "")),
      });
      index += 1;
      continue;
    }

    if (BLOCKQUOTE_PATTERN.test(trimmed)) {
      const quote = [];
      while (index < lines.length && BLOCKQUOTE_PATTERN.test(lines[index].trim())) {
        quote.push(stripInlineMarkdown(lines[index].trim().replace(/^>\s?/, "")));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    const paragraphLines = [stripInlineMarkdown(trimmed)];
    index += 1;
    while (index < lines.length) {
      const currentTrimmed = lines[index].trim();
      if (isMarkdownBlockBoundary(lines, index, { stopOnImage: true })) {
        break;
      }
      paragraphLines.push(stripInlineMarkdown(currentTrimmed));
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

export function stripInlineMarkdown(text) {
  return String(text || "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function getSlideTitle(markdown, index) {
  const heading = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line));

  return heading ? heading.replace(/^#{1,3}\s+/, "") : `Slide ${index + 1}`;
}

function buildSlideMarkup(html, layout) {
  if (layout === "two-column") {
    const parts = html.split('<div class="layout-divider" aria-hidden="true"></div>');
    if (parts.length > 1) {
      const left = parts.shift();
      const right = parts.join("");
      return `<div class="slide-columns"><div class="slide-column">${left}</div><div class="slide-column">${right}</div></div>`;
    }
  }

  if (layout === "image-left") {
    const imageMatch = html.match(/<img\b[^>]*>/);
    if (imageMatch) {
      const imageMarkup = imageMatch[0];
      const contentMarkup = html.replace(imageMarkup, "");
      return `<div class="slide-media-layout"><div class="slide-media">${imageMarkup}</div><div class="slide-copy">${contentMarkup}</div></div>`;
    }
  }

  if (layout === "full-bleed") {
    return `<div class="slide-full-bleed">${html}</div>`;
  }

  return html;
}

function getContentDensityScore(markdown) {
  const lines = markdown.split("\n");
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  const bullets = lines.filter((line) => /^(\s*)([-*]|\d+\.)\s+/.test(line)).length;
  const headings = lines.filter((line) => /^#{1,6}\s+/.test(line)).length;
  const tables = lines.filter((line) => line.includes("|")).length;
  const images = (markdown.match(/!\[[^\]]*\]\(/g) || []).length;

  return words + bullets * 6 + headings * 4 + tables * 3 + images * 10;
}

function getDensityLabel(score) {
  if (score > 160) {
    return "crowded";
  }
  if (score > 95) {
    return "busy";
  }
  return "balanced";
}

export function getDensityAdvice(label) {
  if (label === "crowded") {
    return "This slide is likely too dense. Consider splitting it or trimming the copy.";
  }
  if (label === "busy") {
    return "This slide is getting full. Tighten the copy or switch to a stronger layout.";
  }
  return "";
}

export function buildSlides(markdown, globalTheme = "warm") {
  return splitSlides(markdown).flatMap(expandDenseSlide).map((part, index) => {
    const notes = parseSpeakerNotes(part);
    const noteFree = removeSpeakerNotes(part);
    const config = parseSlideConfig(noteFree);
    const html = parseMarkdownContent(config.content);
    const densityScore = getContentDensityScore(config.content);
    const blocks = parseMarkdownForExport(config.content);

    return {
      raw: part,
      content: config.content,
      notes,
      html,
      markup: buildSlideMarkup(html, config.layout),
      title: getSlideTitle(config.content, index),
      layout: config.layout,
      theme: config.theme || globalTheme,
      densityScore,
      densityLabel: getDensityLabel(densityScore),
      blocks,
    };
  });
}

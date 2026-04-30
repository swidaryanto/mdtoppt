const sampleMarkdown = `layout: title
theme: warm

# MD to PPT

Turn simple markdown into a polished presentation without leaving Markdown.

:::notes
Open with the promise: writing and presenting can happen in one flow.
:::

---

layout: two-column

## How it works

- Write or paste markdown on the left
- Separate slides with \`---\`
- Add slide directives at the top when needed

+++

## Conventions

- Use \`layout: two-column\` or \`layout: quote\`
- Add \`theme: graphite\` per slide when needed
- Write speaker notes in a \`:::notes\` block

:::notes
Point out that layouts are opt-in. A plain slide still works.
:::

---

layout: quote
theme: graphite

> Good slides remove friction.
> They make the point easy to see.

Septian Widaryanto

---

layout: image-left
theme: spruce

## Visual support

![Presentation workspace](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80)

- Put the image anywhere in the slide
- The image-left layout pulls it into a visual column
- Notes stay out of the exported slide

---

layout: full-bleed

![Abstract gradients](https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80)

---

## Dense slide example

| Area | What changed | Why it matters |
| --- | --- | --- |
| Layouts | Title, quote, two-column, image-left | Better narrative control |
| Notes | Dedicated speaker notes block | Cleaner slide surface |
| Export | Markdown, session, and PPTX output | Easier handoff and iteration |
| Persistence | URL state and draft recovery | Deck survives refresh |

1. Keep one idea per slide
2. Let the warning state catch content that is too crowded
3. Split heavy slides before presenting`;

const STORAGE_KEY = "mdtoppt-session";
const SESSION_VERSION = 1;
const PPTX_CDN = "https://unpkg.com/pptxgenjs/dist/pptxgen.bundle.js";

const markdownInput = document.querySelector("#markdown-input");
const fileInput = document.querySelector("#markdown-file");
const sessionFileInput = document.querySelector("#session-file");
const loadSampleButton = document.querySelector("#load-sample");
const copyButton = document.querySelector("#copy-markdown");
const exportMarkdownButton = document.querySelector("#export-markdown");
const exportSessionButton = document.querySelector("#export-session");
const exportPptxButton = document.querySelector("#export-pptx");
const themeSelect = document.querySelector("#theme-select");
const prevButton = document.querySelector("#prev-slide");
const nextButton = document.querySelector("#next-slide");
const presentButton = document.querySelector("#present-mode");
const printButton = document.querySelector("#print-deck");
const slideStage = document.querySelector("#slide-stage");
const slideStrip = document.querySelector("#slide-strip");
const slideCount = document.querySelector("#slide-count");
const slidePosition = document.querySelector("#slide-position");
const slideLayout = document.querySelector("#slide-layout");
const slideDensity = document.querySelector("#slide-density");
const overflowWarning = document.querySelector("#overflow-warning");
const speakerNotes = document.querySelector("#speaker-notes");
const slideCardTemplate = document.querySelector("#slide-card-template");
const dropZone = document.querySelector("#drop-zone");

const THEME_OPTIONS = {
  warm: {
    label: "Warm Paper",
    background: "F8F2E8",
    surface: "FFFDF8",
    text: "221F1A",
    muted: "6F665A",
    accent: "D7643B",
  },
  graphite: {
    label: "Graphite",
    background: "171C24",
    surface: "242B36",
    text: "F4F7FB",
    muted: "B8C4D3",
    accent: "8FC7FF",
  },
  spruce: {
    label: "Spruce",
    background: "EAF5EE",
    surface: "F6FBF8",
    text: "1D372B",
    muted: "557061",
    accent: "2F8D61",
  },
};

const LAYOUT_OPTIONS = new Set(["default", "title", "two-column", "quote", "image-left", "full-bleed"]);

const state = {
  slides: [],
  currentIndex: 0,
  globalTheme: "warm",
  markdown: "",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
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

function parseInlineMarkdown(text) {
  const escaped = escapeHtml(text);
  const inlineImagePattern = /!\[([^\]]*)\]\(((?:[^()\s]+|\([^)]*\))+)(?:\s+"([^"]+)")?\)/g;
  const inlineLinkPattern = /\[([^\]]+)\]\(((?:[^()\s]+|\([^)]*\))+)\)/g;

  return escaped
    .replace(inlineImagePattern, (_, alt, url, title) => renderImage(alt, url, title))
    .replace(inlineLinkPattern, (_, label, url) => renderLink(label, url))
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

    if (/^```/.test(trimmed)) {
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
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function splitTableRow(line) {
  const normalized = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => parseInlineMarkdown(cell.trim()));
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

    if (/^```/.test(trimmed)) {
      const language = trimmed.slice(3).trim();
      const codeBuffer = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeBuffer.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const languageClass = language ? ` class="language-${escapeAttribute(language)}"` : "";
      html.push(`<pre><code${languageClass}>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
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

    if (/^#{1,6}\s/.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)[0].length, 6);
      const content = trimmed.replace(/^#{1,6}\s/, "");
      html.push(`<h${level}>${parseInlineMarkdown(content)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(parseInlineMarkdown(lines[index].trim().replace(/^>\s?/, "")));
        index += 1;
      }

      html.push(`<blockquote>${quoteLines.join("<br />")}</blockquote>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      html.push("<hr />");
      index += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (
        !nextTrimmed ||
        nextTrimmed === "+++" ||
        /^#{1,6}\s/.test(nextTrimmed) ||
        /^>\s?/.test(nextTrimmed) ||
        /^```/.test(nextTrimmed) ||
        isListItem(lines[index]) ||
        parseTable(lines, index) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrimmed)
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
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

    if (/^```/.test(trimmed)) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
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
      const header = splitTableRow(lines[index]).map(stripInlineMarkdown);
      const rows = [];
      let rowIndex = index + 2;
      while (rowIndex < lines.length) {
        const line = lines[rowIndex];
        if (isBlankLine(line) || !line.includes("|")) {
          break;
        }
        rows.push(splitTableRow(line).map(stripInlineMarkdown));
        rowIndex += 1;
      }
      blocks.push({ type: "table", header, rows });
      index = rowIndex;
      continue;
    }

    const imageMatch = rawLine.match(/!\[([^\]]*)\]\(((?:[^()\s]+|\([^)]*\))+)(?:\s+"([^"]+)")?\)/);
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

    if (/^#{1,6}\s/.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)[0].length, 6);
      blocks.push({
        type: "heading",
        level,
        text: stripInlineMarkdown(trimmed.replace(/^#{1,6}\s/, "")),
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(stripInlineMarkdown(lines[index].trim().replace(/^>\s?/, "")));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    const paragraphLines = [stripInlineMarkdown(trimmed)];
    index += 1;
    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (
        !nextTrimmed ||
        nextTrimmed === "+++" ||
        /^#{1,6}\s/.test(nextTrimmed) ||
        /^>\s?/.test(nextTrimmed) ||
        /^```/.test(nextTrimmed) ||
        isListItem(lines[index]) ||
        parseTable(lines, index)
      ) {
        break;
      }
      const inlineImage = lines[index].match(/!\[([^\]]*)\]\(((?:[^()\s]+|\([^)]*\))+)(?:\s+"([^"]+)")?\)/);
      if (inlineImage) {
        break;
      }
      paragraphLines.push(stripInlineMarkdown(nextTrimmed));
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function stripInlineMarkdown(text) {
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

function getDensityAdvice(label) {
  if (label === "crowded") {
    return "This slide is likely too dense. Consider splitting it or trimming the copy.";
  }
  if (label === "busy") {
    return "This slide is getting full. Tighten the copy or switch to a stronger layout.";
  }
  return "";
}

function buildSlides(markdown) {
  return splitSlides(markdown).map((part, index) => {
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
      theme: config.theme || state.globalTheme,
      densityScore,
      densityLabel: getDensityLabel(densityScore),
      blocks,
    };
  });
}

function buildSessionPayload() {
  return {
    version: SESSION_VERSION,
    markdown: markdownInput.value,
    globalTheme: state.globalTheme,
    currentIndex: state.currentIndex,
    updatedAt: new Date().toISOString(),
  };
}

function writeSessionToStorage() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSessionPayload()));
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

function readSessionFromStorage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function updateUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set("theme", state.globalTheme);
  url.searchParams.set("slide", String(state.currentIndex + 1));
  window.history.replaceState({}, "", url);
}

function readUrlState() {
  const url = new URL(window.location.href);
  const theme = url.searchParams.get("theme");
  const slide = Number.parseInt(url.searchParams.get("slide") || "", 10);

  return {
    theme: Object.hasOwn(THEME_OPTIONS, theme) ? theme : null,
    slideIndex: Number.isFinite(slide) && slide > 0 ? slide - 1 : null,
  };
}

function applySession(session = {}) {
  state.globalTheme = Object.hasOwn(THEME_OPTIONS, session.globalTheme) ? session.globalTheme : "warm";
  state.currentIndex = Number.isInteger(session.currentIndex) ? Math.max(0, session.currentIndex) : 0;
  state.markdown = typeof session.markdown === "string" ? session.markdown : sampleMarkdown;
  markdownInput.value = state.markdown;
  themeSelect.value = state.globalTheme;
}

function createDownload(filename, content, type) {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function slugify(value) {
  return String(value || "deck")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "deck";
}

function getDeckFilename(extension) {
  const firstTitle = state.slides[0]?.title || "md-to-ppt-deck";
  return `${slugify(firstTitle)}.${extension}`;
}

async function loadMarkdownFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  markdownInput.value = text;
  state.currentIndex = 0;
  render();
}

async function loadSessionFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  const session = JSON.parse(text);
  applySession(session);
  render();
}

function getOnboardingMarkup() {
  return `
    <div class="empty-state onboarding-state">
      <div>
        <strong>Start with a simple markdown deck.</strong>
        <p>Write a heading, add bullets, split slides with <code>---</code>, and layer in layouts only when you need them.</p>
        <div class="onboarding-grid">
          <div class="onboarding-card">
            <p class="onboarding-label">Heading</p>
            <pre><code># Opening slide</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Bullets</p>
            <pre><code>- Point one
- Point two</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Quote</p>
            <pre><code>layout: quote

> Clear slides guide attention.</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Code</p>
            <pre><code>\`\`\`js
console.log("Hello");
\`\`\`</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Image</p>
            <pre><code>![Alt text](https://...)</code></pre>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateSpeakerNotes(slide) {
  if (!slide || !slide.notes) {
    speakerNotes.innerHTML = `
      <p class="support-label">Speaker notes</p>
      <p class="support-empty">No notes for this slide yet.</p>
    `;
    return;
  }

  const notesHtml = slide.notes
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p>${parseInlineMarkdown(line)}</p>`)
    .join("");

  speakerNotes.innerHTML = `
    <p class="support-label">Speaker notes</p>
    <div class="speaker-notes-copy">${notesHtml}</div>
  `;
}

function updateOverflowWarning(slide) {
  const slideElement = slideStage.querySelector(".slide");
  if (!slide || !slideElement) {
    overflowWarning.hidden = true;
    overflowWarning.textContent = "";
    return;
  }

  const hasOverflow = slideElement.scrollHeight > slideElement.clientHeight + 8;
  const densityAdvice = getDensityAdvice(slide.densityLabel);

  if (!hasOverflow && !densityAdvice) {
    overflowWarning.hidden = true;
    overflowWarning.textContent = "";
    return;
  }

  const message = hasOverflow
    ? "Content is overflowing this slide. Reduce copy, split the slide, or pick a stronger layout."
    : densityAdvice;

  overflowWarning.hidden = false;
  overflowWarning.textContent = message;
  overflowWarning.dataset.state = hasOverflow ? "overflow" : "dense";
}

function renderStage() {
  if (!state.slides.length) {
    slideStage.innerHTML = getOnboardingMarkup();
    slideCount.textContent = "0 slides";
    slidePosition.textContent = "Slide 0 / 0";
    slideLayout.textContent = "Layout: default";
    slideDensity.textContent = "Density: balanced";
    slideDensity.dataset.state = "balanced";
    slideStage.dataset.theme = state.globalTheme;
    overflowWarning.hidden = true;
    overflowWarning.textContent = "";
    updateSpeakerNotes(null);
    prevButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  const slide = state.slides[state.currentIndex];
  slideStage.dataset.theme = slide.theme;
  slideStage.innerHTML = `<div class="slide slide-layout-${slide.layout}" data-density="${slide.densityLabel}">${slide.markup}</div>`;
  slideCount.textContent = `${state.slides.length} ${state.slides.length === 1 ? "slide" : "slides"}`;
  slidePosition.textContent = `Slide ${state.currentIndex + 1} / ${state.slides.length}`;
  slideLayout.textContent = `Layout: ${slide.layout}`;
  slideDensity.textContent = `Density: ${slide.densityLabel}`;
  slideDensity.dataset.state = slide.densityLabel;
  updateSpeakerNotes(slide);
  prevButton.disabled = state.currentIndex === 0;
  nextButton.disabled = state.currentIndex === state.slides.length - 1;

  window.requestAnimationFrame(() => {
    updateOverflowWarning(slide);
  });
}

function renderStrip() {
  slideStrip.innerHTML = "";

  state.slides.forEach((slide, index) => {
    const slideCard = slideCardTemplate.content.firstElementChild.cloneNode(true);
    slideCard.querySelector(".slide-thumb-index").textContent = `Slide ${index + 1}`;
    slideCard.querySelector(".slide-thumb-title").textContent = slide.title;
    slideCard.classList.toggle("active", index === state.currentIndex);
    slideCard.dataset.theme = slide.theme;
    slideCard.dataset.layout = slide.layout;
    slideCard.dataset.density = slide.densityLabel;
    slideCard.addEventListener("click", () => {
      state.currentIndex = index;
      render();
    });
    slideStrip.appendChild(slideCard);
  });
}

function syncDerivedState() {
  state.markdown = markdownInput.value;
  state.slides = buildSlides(state.markdown);
  if (state.currentIndex > state.slides.length - 1) {
    state.currentIndex = Math.max(0, state.slides.length - 1);
  }
}

function render() {
  syncDerivedState();
  renderStage();
  renderStrip();
  writeSessionToStorage();
  updateUrlState();
}

function setTemporaryButtonText(button, nextText, resetText = button.dataset.defaultLabel || button.textContent) {
  const original = resetText;
  button.textContent = nextText;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

function getThemeTokens(themeName) {
  return THEME_OPTIONS[themeName] || THEME_OPTIONS.warm;
}

function addTextBlock(pptSlide, text, options = {}) {
  pptSlide.addText(text, {
    margin: 0,
    breakLine: false,
    ...options,
  });
}

function addMarkdownBlocksToPpt(pptSlide, blocks, themeName, frame) {
  const theme = getThemeTokens(themeName);
  let y = frame.y;

  blocks.forEach((block) => {
    if (y > frame.y + frame.h - 0.35) {
      return;
    }

    if (block.type === "heading") {
      const sizeMap = { 1: 24, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 };
      addTextBlock(pptSlide, block.text, {
        x: frame.x,
        y,
        w: frame.w,
        h: 0.5,
        fontSize: sizeMap[block.level] || 12,
        bold: true,
        color: theme.text,
      });
      y += block.level === 1 ? 0.7 : 0.5;
      return;
    }

    if (block.type === "paragraph") {
      addTextBlock(pptSlide, block.text, {
        x: frame.x,
        y,
        w: frame.w,
        h: 0.45,
        fontSize: 12,
        color: theme.text,
      });
      y += 0.45;
      return;
    }

    if (block.type === "quote") {
      addTextBlock(pptSlide, block.text, {
        x: frame.x,
        y,
        w: frame.w,
        h: 0.7,
        fontSize: 19,
        italic: true,
        color: theme.text,
      });
      y += 0.8;
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item) => {
        addTextBlock(pptSlide, item.text, {
          x: frame.x,
          y,
          w: frame.w,
          h: 0.32,
          fontSize: 11,
          color: theme.text,
          bullet: { indent: Math.max(10, 12 + item.level * 10) },
          hanging: 2,
        });
        y += 0.3;
      });
      y += 0.1;
      return;
    }

    if (block.type === "code") {
      pptSlide.addText(block.text, {
        x: frame.x,
        y,
        w: frame.w,
        h: Math.min(1.6, Math.max(0.5, block.text.split("\n").length * 0.22)),
        fontFace: "Courier New",
        fontSize: 9,
        color: "F8EFE5",
        fill: { color: "1E1A17" },
        margin: 0.12,
      });
      y += Math.min(1.75, Math.max(0.6, block.text.split("\n").length * 0.24));
      return;
    }

    if (block.type === "table") {
      const rows = [block.header, ...block.rows];
      pptSlide.addTable(rows, {
        x: frame.x,
        y,
        w: frame.w,
        fontSize: 9,
        color: theme.text,
        border: { pt: 1, color: "D9D2C5" },
        fill: themeName === "graphite" ? "242B36" : "FFFDF8",
      });
      y += Math.min(1.6, 0.42 + rows.length * 0.22);
      return;
    }

    if (block.type === "image" && block.src) {
      pptSlide.addImage({
        path: block.src,
        x: frame.x,
        y,
        w: frame.w,
        h: Math.min(2.3, frame.h * 0.45),
      });
      y += Math.min(2.45, frame.h * 0.47);
    }
  });
}

function getFirstImage(blocks) {
  return blocks.find((block) => block.type === "image" && block.src);
}

function getFirstHeading(blocks) {
  return blocks.find((block) => block.type === "heading");
}

function getFirstParagraph(blocks) {
  return blocks.find((block) => block.type === "paragraph");
}

async function ensurePptxLibrary() {
  if (window.PptxGenJS) {
    return window.PptxGenJS;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PPTX_CDN;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.PptxGenJS;
}

async function exportDeckAsPptx() {
  if (!state.slides.length) {
    setTemporaryButtonText(exportPptxButton, "No slides");
    return;
  }

  const PptxGenJS = await ensurePptxLibrary();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Septian Widaryanto";
  pptx.company = "widaryanto.com";
  pptx.subject = "Markdown presentation";
  pptx.title = state.slides[0]?.title || "MD to PPT deck";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  state.slides.forEach((slide) => {
    const theme = getThemeTokens(slide.theme);
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: theme.background };

    if (slide.notes && typeof pptSlide.addNotes === "function") {
      pptSlide.addNotes(slide.notes);
    }

    if (slide.layout === "full-bleed" && getFirstImage(slide.blocks)?.src) {
      pptSlide.addImage({
        path: getFirstImage(slide.blocks).src,
        x: 0,
        y: 0,
        w: 13.333,
        h: 7.5,
      });
      return;
    }

    if (slide.layout === "title") {
      const heading = getFirstHeading(slide.blocks);
      const paragraph = getFirstParagraph(slide.blocks);
      if (heading) {
        addTextBlock(pptSlide, heading.text, {
          x: 0.85,
          y: 2.0,
          w: 7.2,
          h: 1.2,
          fontSize: 28,
          bold: true,
          color: theme.text,
        });
      }
      if (paragraph) {
        addTextBlock(pptSlide, paragraph.text, {
          x: 0.9,
          y: 3.35,
          w: 5.7,
          h: 0.6,
          fontSize: 13,
          color: theme.muted,
        });
      }
      return;
    }

    if (slide.layout === "quote") {
      const quote = slide.blocks.find((block) => block.type === "quote");
      const attribution = slide.blocks.find((block) => block.type === "paragraph");
      if (quote) {
        addTextBlock(pptSlide, quote.text, {
          x: 1.0,
          y: 2.1,
          w: 10.8,
          h: 1.2,
          fontSize: 24,
          italic: true,
          color: theme.text,
          align: "center",
        });
      }
      if (attribution) {
        addTextBlock(pptSlide, attribution.text, {
          x: 4.2,
          y: 4.85,
          w: 4.8,
          h: 0.4,
          fontSize: 11,
          color: theme.muted,
          align: "center",
        });
      }
      return;
    }

    if (slide.layout === "two-column") {
      const dividerIndex = slide.blocks.findIndex((block) => block.type === "divider");
      const leftBlocks = dividerIndex >= 0 ? slide.blocks.slice(0, dividerIndex) : slide.blocks;
      const rightBlocks = dividerIndex >= 0 ? slide.blocks.slice(dividerIndex + 1) : [];
      addMarkdownBlocksToPpt(pptSlide, leftBlocks, slide.theme, { x: 0.75, y: 0.75, w: 5.75, h: 6 });
      addMarkdownBlocksToPpt(pptSlide, rightBlocks, slide.theme, { x: 6.85, y: 0.75, w: 5.75, h: 6 });
      return;
    }

    if (slide.layout === "image-left" && getFirstImage(slide.blocks)?.src) {
      const image = getFirstImage(slide.blocks);
      const textBlocks = slide.blocks.filter((block) => block !== image);
      pptSlide.addImage({
        path: image.src,
        x: 0.7,
        y: 0.9,
        w: 5.2,
        h: 5.5,
      });
      addMarkdownBlocksToPpt(pptSlide, textBlocks, slide.theme, { x: 6.3, y: 0.9, w: 6.0, h: 5.7 });
      return;
    }

    addMarkdownBlocksToPpt(pptSlide, slide.blocks, slide.theme, { x: 0.85, y: 0.8, w: 11.6, h: 5.95 });
  });

  exportPptxButton.disabled = true;
  exportPptxButton.textContent = "Exporting...";
  try {
    await pptx.writeFile({ fileName: getDeckFilename("pptx") });
    setTemporaryButtonText(exportPptxButton, "PPTX ready", "Export `.pptx`");
  } finally {
    exportPptxButton.disabled = false;
    exportPptxButton.textContent = "Export `.pptx`";
  }
}

function restoreInitialSession() {
  const storedSession = readSessionFromStorage();
  const urlState = readUrlState();

  applySession(storedSession || { markdown: sampleMarkdown, globalTheme: "warm", currentIndex: 0 });

  if (urlState.theme) {
    state.globalTheme = urlState.theme;
    themeSelect.value = urlState.theme;
  }

  if (Number.isInteger(urlState.slideIndex)) {
    state.currentIndex = Math.max(0, urlState.slideIndex);
  }
}

markdownInput.addEventListener("input", render);

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  await loadMarkdownFile(file);
  fileInput.value = "";
});

sessionFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    await loadSessionFile(file);
    setTemporaryButtonText(exportSessionButton, "Session loaded", "Export session");
  } catch {
    setTemporaryButtonText(exportSessionButton, "Load failed", "Export session");
  }
  sessionFileInput.value = "";
});

loadSampleButton.addEventListener("click", () => {
  applySession({ markdown: sampleMarkdown, globalTheme: "warm", currentIndex: 0 });
  render();
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(markdownInput.value);
    setTemporaryButtonText(copyButton, "Copied", "Copy text");
  } catch {
    setTemporaryButtonText(copyButton, "Copy failed", "Copy text");
  }
});

exportMarkdownButton.addEventListener("click", () => {
  createDownload(getDeckFilename("md"), markdownInput.value, "text/markdown;charset=utf-8");
});

exportSessionButton.addEventListener("click", () => {
  createDownload(
    getDeckFilename("session.json"),
    JSON.stringify(buildSessionPayload(), null, 2),
    "application/json;charset=utf-8",
  );
});

exportPptxButton.addEventListener("click", async () => {
  try {
    await exportDeckAsPptx();
  } catch {
    setTemporaryButtonText(exportPptxButton, "Export failed", "Export `.pptx`");
  }
});

themeSelect.addEventListener("change", () => {
  state.globalTheme = themeSelect.value;
  render();
});

prevButton.addEventListener("click", () => {
  state.currentIndex = Math.max(0, state.currentIndex - 1);
  render();
});

nextButton.addEventListener("click", () => {
  state.currentIndex = Math.min(state.slides.length - 1, state.currentIndex + 1);
  render();
});

presentButton.addEventListener("click", async () => {
  document.body.classList.toggle("presenting");

  if (document.body.classList.contains("presenting")) {
    try {
      if (document.fullscreenElement !== document.documentElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can fail silently in some browsers. Present mode still works.
    }
    presentButton.textContent = "Exit present";
  } else {
    presentButton.textContent = "Present";
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("presenting")) {
    document.body.classList.remove("presenting");
    presentButton.textContent = "Present";
  }
});

printButton.addEventListener("click", () => {
  const currentMarkup = slideStage.innerHTML;
  const currentTheme = slideStage.dataset.theme;
  const printMarkup = state.slides
    .map(
      (slide) => `
        <article class="slide-stage print-slide" data-theme="${escapeAttribute(slide.theme)}">
          <div class="slide slide-layout-${slide.layout}" data-density="${slide.densityLabel}">
            ${slide.markup}
          </div>
        </article>`,
    )
    .join("");

  slideStage.innerHTML = `${currentMarkup}<section class="print-deck">${printMarkup}</section>`;
  window.print();
  slideStage.dataset.theme = currentTheme;
  slideStage.innerHTML = currentMarkup;
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "dragend", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer.files;
  await loadMarkdownFile(file);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("presenting")) {
    document.body.classList.remove("presenting");
    presentButton.textContent = "Present";
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    return;
  }

  if (event.key === "ArrowRight") {
    nextButton.click();
  }

  if (event.key === "ArrowLeft") {
    prevButton.click();
  }
});

restoreInitialSession();
render();

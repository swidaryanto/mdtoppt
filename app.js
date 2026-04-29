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
| Density | Heuristic plus overflow checks | Faster editing feedback |
| Themes | Warm, graphite, spruce | More intentional exports |

1. Keep one idea per slide
2. Let the warning state catch content that is too crowded
3. Split heavy slides before presenting`;

const markdownInput = document.querySelector("#markdown-input");
const fileInput = document.querySelector("#markdown-file");
const loadSampleButton = document.querySelector("#load-sample");
const copyButton = document.querySelector("#copy-markdown");
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
  warm: "Warm Paper",
  graphite: "Graphite",
  spruce: "Spruce",
};

const LAYOUT_OPTIONS = new Set(["default", "title", "two-column", "quote", "image-left", "full-bleed"]);

const state = {
  slides: [],
  currentIndex: 0,
  globalTheme: "warm",
};

markdownInput.value = sampleMarkdown;
themeSelect.value = state.globalTheme;

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
    };
  });
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
    slideStage.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No slides yet.</strong>
          <p>Add markdown or upload a file to get started.</p>
        </div>
      </div>
    `;
    slideCount.textContent = "0 slides";
    slidePosition.textContent = "Slide 0 / 0";
    slideLayout.textContent = "Layout: default";
    slideDensity.textContent = "Density: balanced";
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

function render() {
  state.slides = buildSlides(markdownInput.value);
  if (state.currentIndex > state.slides.length - 1) {
    state.currentIndex = Math.max(0, state.slides.length - 1);
  }
  renderStage();
  renderStrip();
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

markdownInput.addEventListener("input", render);

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  await loadMarkdownFile(file);
});

loadSampleButton.addEventListener("click", () => {
  markdownInput.value = sampleMarkdown;
  state.currentIndex = 0;
  render();
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(markdownInput.value);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy text";
    }, 1200);
  } catch {
    copyButton.textContent = "Copy failed";
    window.setTimeout(() => {
      copyButton.textContent = "Copy text";
    }, 1200);
  }
});

themeSelect.addEventListener("change", () => {
  state.globalTheme = themeSelect.value;
  render();
});

prevButton.addEventListener("click", () => {
  state.currentIndex = Math.max(0, state.currentIndex - 1);
  renderStage();
  renderStrip();
});

nextButton.addEventListener("click", () => {
  state.currentIndex = Math.min(state.slides.length - 1, state.currentIndex + 1);
  renderStage();
  renderStrip();
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

render();

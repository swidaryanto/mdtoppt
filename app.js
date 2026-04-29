const sampleMarkdown = `# MD to PPT

Turn simple markdown into a clean presentation.

---

## How it works

- Write or paste markdown on the left
- Separate slides with \`---\`
- Upload a \`.md\` file when you already have content

---

## Good slide habits

1. Keep one idea per slide
2. Use short bullets
3. Let headings do the heavy lifting

---

## Example code

\`\`\`js
const message = "Hello from markdown";
console.log(message);
\`\`\`

---

## Final slide

[Present clearly](https://www.widaryanto.com) with less setup.`;

const markdownInput = document.querySelector("#markdown-input");
const fileInput = document.querySelector("#markdown-file");
const loadSampleButton = document.querySelector("#load-sample");
const copyButton = document.querySelector("#copy-markdown");
const prevButton = document.querySelector("#prev-slide");
const nextButton = document.querySelector("#next-slide");
const presentButton = document.querySelector("#present-mode");
const printButton = document.querySelector("#print-deck");
const slideStage = document.querySelector("#slide-stage");
const slideStrip = document.querySelector("#slide-strip");
const slideCount = document.querySelector("#slide-count");
const slidePosition = document.querySelector("#slide-position");
const slideCardTemplate = document.querySelector("#slide-card-template");
const dropZone = document.querySelector("#drop-zone");

const state = {
  slides: [],
  currentIndex: 0,
};

markdownInput.value = sampleMarkdown;

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

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      buffer.push(line);
      return;
    }

    const previousLine = index > 0 ? lines[index - 1].trim() : "";
    const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : "";
    const canSplit =
      !inCodeBlock &&
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

function parseMarkdownSlide(markdown) {
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

function getSlideTitle(markdown, index) {
  const heading = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line));

  return heading ? heading.replace(/^#{1,3}\s+/, "") : `Slide ${index + 1}`;
}

function buildSlides(markdown) {
  return splitSlides(markdown).map((part, index) => ({
      raw: part,
      html: parseMarkdownSlide(part),
      title: getSlideTitle(part, index),
    }));
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
    prevButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  const slide = state.slides[state.currentIndex];
  slideStage.innerHTML = `<div class="slide">${slide.html}</div>`;
  slideCount.textContent = `${state.slides.length} ${state.slides.length === 1 ? "slide" : "slides"}`;
  slidePosition.textContent = `Slide ${state.currentIndex + 1} / ${state.slides.length}`;
  prevButton.disabled = state.currentIndex === 0;
  nextButton.disabled = state.currentIndex === state.slides.length - 1;
}

function renderStrip() {
  slideStrip.innerHTML = "";

  state.slides.forEach((slide, index) => {
    const slideCard = slideCardTemplate.content.firstElementChild.cloneNode(true);
    slideCard.querySelector(".slide-thumb-index").textContent = `Slide ${index + 1}`;
    slideCard.querySelector(".slide-thumb-title").textContent = slide.title;
    slideCard.classList.toggle("active", index === state.currentIndex);
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
  const printMarkup = state.slides
    .map((slide) => `<article class="slide-stage print-slide"><div class="slide">${slide.html}</div></article>`)
    .join("");

  slideStage.innerHTML = `${currentMarkup}<section class="print-deck">${printMarkup}</section>`;
  window.print();
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

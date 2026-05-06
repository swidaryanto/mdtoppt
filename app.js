import { sampleMarkdown, THEME_OPTIONS } from "./config.js";
import { buildSlides, escapeAttribute, getDensityAdvice, parseInlineMarkdown } from "./markdown.js";
import { exportDeckAsPptx } from "./pptx-export.js";
import {
  buildSessionPayload,
  createDownload,
  readSessionFromStorage,
  readUrlState,
  slugify,
  updateUrlState,
  writeSessionToStorage,
} from "./session.js";

const elements = {
  markdownInput: document.querySelector("#markdown-input"),
  fileInput: document.querySelector("#markdown-file"),
  sessionFileInput: document.querySelector("#session-file"),
  loadSampleButton: document.querySelector("#load-sample"),
  copyButton: document.querySelector("#copy-markdown"),
  exportMarkdownButton: document.querySelector("#export-markdown"),
  exportSessionButton: document.querySelector("#export-session"),
  exportPptxButton: document.querySelector("#export-pptx"),
  themeSelect: document.querySelector("#theme-select"),
  prevButton: document.querySelector("#prev-slide"),
  nextButton: document.querySelector("#next-slide"),
  presentButton: document.querySelector("#present-mode"),
  printButton: document.querySelector("#print-deck"),
  slideStage: document.querySelector("#slide-stage"),
  slideStrip: document.querySelector("#slide-strip"),
  slideCount: document.querySelector("#slide-count"),
  slidePosition: document.querySelector("#slide-position"),
  slideLayout: document.querySelector("#slide-layout"),
  slideDensity: document.querySelector("#slide-density"),
  overflowWarning: document.querySelector("#overflow-warning"),
  speakerNotes: document.querySelector("#speaker-notes"),
  slideCardTemplate: document.querySelector("#slide-card-template"),
  dropZone: document.querySelector("#drop-zone"),
};

const state = {
  slides: [],
  currentIndex: 0,
  globalTheme: "warm",
  markdown: "",
};

function populateThemeSelect() {
  elements.themeSelect.innerHTML = Object.entries(THEME_OPTIONS)
    .map(([value, theme]) => `<option value="${escapeAttribute(value)}">${theme.label}</option>`)
    .join("");
}

function applySession(session = {}) {
  state.globalTheme = Object.hasOwn(THEME_OPTIONS, session.globalTheme) ? session.globalTheme : "warm";
  state.currentIndex = Number.isInteger(session.currentIndex) ? Math.max(0, session.currentIndex) : 0;
  state.markdown = typeof session.markdown === "string" ? session.markdown : sampleMarkdown;
  elements.markdownInput.value = state.markdown;
  elements.themeSelect.value = state.globalTheme;
}

function getDeckFilename(extension) {
  const firstTitle = state.slides[0]?.title || "md-to-ppt-deck";
  return `${slugify(firstTitle)}.${extension}`;
}

function getSessionPayload() {
  return buildSessionPayload({
    markdown: elements.markdownInput.value,
    globalTheme: state.globalTheme,
    currentIndex: state.currentIndex,
  });
}

function setTemporaryButtonText(button, nextText, resetText = button.dataset.defaultLabel || button.textContent) {
  const original = resetText;
  button.textContent = nextText;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
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
    elements.speakerNotes.innerHTML = `
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

  elements.speakerNotes.innerHTML = `
    <p class="support-label">Speaker notes</p>
    <div class="speaker-notes-copy">${notesHtml}</div>
  `;
}

function updateOverflowWarning(slide) {
  const slideElement = elements.slideStage.querySelector(".slide");
  if (!slide || !slideElement) {
    elements.overflowWarning.hidden = true;
    elements.overflowWarning.textContent = "";
    return;
  }

  const hasOverflow = slideElement.scrollHeight > slideElement.clientHeight + 8;
  const densityAdvice = getDensityAdvice(slide.densityLabel);

  if (!hasOverflow && !densityAdvice) {
    elements.overflowWarning.hidden = true;
    elements.overflowWarning.textContent = "";
    return;
  }

  elements.overflowWarning.hidden = false;
  elements.overflowWarning.textContent = hasOverflow
    ? "Content is overflowing this slide. Reduce copy, split the slide, or pick a stronger layout."
    : densityAdvice;
  elements.overflowWarning.dataset.state = hasOverflow ? "overflow" : "dense";
}

function renderEmptyStage() {
  elements.slideStage.innerHTML = getOnboardingMarkup();
  elements.slideCount.textContent = "0 slides";
  elements.slidePosition.textContent = "Slide 0 / 0";
  elements.slideLayout.textContent = "Layout: default";
  elements.slideDensity.textContent = "Density: balanced";
  elements.slideDensity.dataset.state = "balanced";
  elements.slideStage.dataset.theme = state.globalTheme;
  elements.overflowWarning.hidden = true;
  elements.overflowWarning.textContent = "";
  updateSpeakerNotes(null);
  elements.prevButton.disabled = true;
  elements.nextButton.disabled = true;
}

function renderStage() {
  if (!state.slides.length) {
    renderEmptyStage();
    return;
  }

  const slide = state.slides[state.currentIndex];
  elements.slideStage.dataset.theme = slide.theme;
  elements.slideStage.innerHTML = `<div class="slide slide-layout-${slide.layout}" data-density="${slide.densityLabel}">${slide.markup}</div>`;
  elements.slideCount.textContent = `${state.slides.length} ${state.slides.length === 1 ? "slide" : "slides"}`;
  elements.slidePosition.textContent = `Slide ${state.currentIndex + 1} / ${state.slides.length}`;
  elements.slideLayout.textContent = `Layout: ${slide.layout}`;
  elements.slideDensity.textContent = `Density: ${slide.densityLabel}`;
  elements.slideDensity.dataset.state = slide.densityLabel;
  updateSpeakerNotes(slide);
  elements.prevButton.disabled = state.currentIndex === 0;
  elements.nextButton.disabled = state.currentIndex === state.slides.length - 1;

  window.requestAnimationFrame(() => {
    updateOverflowWarning(slide);
  });
}

function renderStrip() {
  elements.slideStrip.innerHTML = "";

  state.slides.forEach((slide, index) => {
    const slideCard = elements.slideCardTemplate.content.firstElementChild.cloneNode(true);
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
    elements.slideStrip.appendChild(slideCard);
  });
}

function syncDerivedState() {
  state.markdown = elements.markdownInput.value;
  state.slides = buildSlides(state.markdown, state.globalTheme);
  if (state.currentIndex > state.slides.length - 1) {
    state.currentIndex = Math.max(0, state.slides.length - 1);
  }
}

function render() {
  syncDerivedState();
  renderStage();
  renderStrip();
  writeSessionToStorage(getSessionPayload());
  updateUrlState(state);
}

async function loadMarkdownFile(file) {
  if (!file) {
    return;
  }

  elements.markdownInput.value = await file.text();
  state.currentIndex = 0;
  render();
}

async function loadSessionFile(file) {
  if (!file) {
    return;
  }

  const session = JSON.parse(await file.text());
  applySession(session);
  render();
}

function restoreInitialSession() {
  const storedSession = readSessionFromStorage();
  const urlState = readUrlState();

  applySession(storedSession || { markdown: sampleMarkdown, globalTheme: "warm", currentIndex: 0 });

  if (urlState.theme) {
    state.globalTheme = urlState.theme;
    elements.themeSelect.value = urlState.theme;
  }

  if (Number.isInteger(urlState.slideIndex)) {
    state.currentIndex = Math.max(0, urlState.slideIndex);
  }
}

function bindEditorEvents() {
  elements.markdownInput.addEventListener("input", render);

  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    await loadMarkdownFile(file);
    elements.fileInput.value = "";
  });

  elements.sessionFileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    try {
      await loadSessionFile(file);
      setTemporaryButtonText(elements.exportSessionButton, "Session loaded", "Export session");
    } catch {
      setTemporaryButtonText(elements.exportSessionButton, "Load failed", "Export session");
    }
    elements.sessionFileInput.value = "";
  });

  elements.loadSampleButton.addEventListener("click", () => {
    applySession({ markdown: sampleMarkdown, globalTheme: "warm", currentIndex: 0 });
    render();
  });

  elements.copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.markdownInput.value);
      setTemporaryButtonText(elements.copyButton, "Copied", "Copy text");
    } catch {
      setTemporaryButtonText(elements.copyButton, "Copy failed", "Copy text");
    }
  });
}

function bindExportEvents() {
  elements.exportMarkdownButton.addEventListener("click", () => {
    createDownload(getDeckFilename("md"), elements.markdownInput.value, "text/markdown;charset=utf-8");
  });

  elements.exportSessionButton.addEventListener("click", () => {
    createDownload(
      getDeckFilename("session.json"),
      JSON.stringify(getSessionPayload(), null, 2),
      "application/json;charset=utf-8",
    );
  });

  elements.exportPptxButton.addEventListener("click", async () => {
    if (!state.slides.length) {
      setTemporaryButtonText(elements.exportPptxButton, "No slides");
      return;
    }

    elements.exportPptxButton.disabled = true;
    elements.exportPptxButton.textContent = "Exporting...";
    try {
      await exportDeckAsPptx(state.slides, getDeckFilename("pptx"));
      setTemporaryButtonText(elements.exportPptxButton, "PPTX ready", "Export `.pptx`");
    } catch {
      setTemporaryButtonText(elements.exportPptxButton, "Export failed", "Export `.pptx`");
    } finally {
      elements.exportPptxButton.disabled = false;
      elements.exportPptxButton.textContent = "Export `.pptx`";
    }
  });

  elements.printButton.addEventListener("click", () => {
    const currentMarkup = elements.slideStage.innerHTML;
    const currentTheme = elements.slideStage.dataset.theme;
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

    elements.slideStage.innerHTML = `${currentMarkup}<section class="print-deck">${printMarkup}</section>`;
    window.print();
    elements.slideStage.dataset.theme = currentTheme;
    elements.slideStage.innerHTML = currentMarkup;
  });
}

function bindPresentationEvents() {
  elements.themeSelect.addEventListener("change", () => {
    state.globalTheme = elements.themeSelect.value;
    render();
  });

  elements.prevButton.addEventListener("click", () => {
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    render();
  });

  elements.nextButton.addEventListener("click", () => {
    state.currentIndex = Math.min(state.slides.length - 1, state.currentIndex + 1);
    render();
  });

  elements.presentButton.addEventListener("click", async () => {
    document.body.classList.toggle("presenting");

    if (document.body.classList.contains("presenting")) {
      try {
        if (document.fullscreenElement !== document.documentElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen can fail silently in some browsers. Present mode still works.
      }
      elements.presentButton.textContent = "Exit present";
    } else {
      elements.presentButton.textContent = "Present";
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("presenting")) {
      document.body.classList.remove("presenting");
      elements.presentButton.textContent = "Present";
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("presenting")) {
      document.body.classList.remove("presenting");
      elements.presentButton.textContent = "Present";
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      return;
    }

    if (event.key === "ArrowRight") {
      elements.nextButton.click();
    }

    if (event.key === "ArrowLeft") {
      elements.prevButton.click();
    }
  });
}

function bindDropZoneEvents() {
  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("drag-over");
    });
  });

  elements.dropZone.addEventListener("drop", async (event) => {
    const [file] = event.dataTransfer.files;
    await loadMarkdownFile(file);
  });
}

function init() {
  populateThemeSelect();
  bindEditorEvents();
  bindExportEvents();
  bindPresentationEvents();
  bindDropZoneEvents();
  restoreInitialSession();
  render();
}

init();

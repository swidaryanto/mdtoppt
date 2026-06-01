import { sampleMarkdown, THEME_OPTIONS } from "./config.js";
import {
  buildSlides,
  escapeAttribute,
  parseInlineMarkdown,
} from "./markdown.js?v=fit-2";
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

/* ── Element References ───────────────────────────────────────── */

const elements = {
  markdownInput: document.querySelector("#markdown-input"),
  fileInput: document.querySelector("#markdown-file"),
  sessionFileInput: document.querySelector("#session-file"),
  loadSampleButton: document.querySelector("#load-sample"),
  copyButton: document.querySelector("#copy-markdown"),
  exportMarkdownButton: document.querySelector("#export-markdown"),
  exportSessionButton: document.querySelector("#export-session"),
  exportPptxButton: document.querySelector("#export-pptx"),
  themeLabel: document.querySelector("#theme-label"),
  themeMenu: document.querySelector("#theme-menu"),
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
  speakerNotes: document.querySelector("#speaker-notes"),
  notesToggle: document.querySelector("#notes-toggle"),
  helpToggle: document.querySelector("#toggle-help"),
  helpPanel: document.querySelector("#help-panel"),
  slideCardTemplate: document.querySelector("#slide-card-template"),
  dropZone: document.querySelector("#drop-zone"),
};

/* ── State ────────────────────────────────────────────────────── */

const state = {
  slides: [],
  currentIndex: 0,
  globalTheme: "warm",
  markdown: "",
  notesOpen: false,
  helpOpen: false,
};

/* ── Theme Select ─────────────────────────────────────────────── */

function populateThemeSelect() {
  elements.themeMenu.innerHTML = Object.entries(THEME_OPTIONS)
    .map(
      ([value, theme]) =>
        `<button class="dropdown-item" type="button" data-theme="${escapeAttribute(value)}">${theme.label}</button>`,
    )
    .join("");

  elements.themeMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-theme]");
    if (!item) return;
    state.globalTheme = item.dataset.theme;
    elements.themeLabel.textContent = THEME_OPTIONS[state.globalTheme].label;
    elements.themeMenu.closest("[data-dropdown]").removeAttribute("data-open");
    render();
  });
}

/* ── Session ──────────────────────────────────────────────────── */

function applySession(session = {}) {
  state.globalTheme = Object.hasOwn(THEME_OPTIONS, session.globalTheme)
    ? session.globalTheme
    : "warm";
  state.currentIndex = Number.isInteger(session.currentIndex)
    ? Math.max(0, session.currentIndex)
    : 0;
  state.markdown =
    typeof session.markdown === "string" ? session.markdown : sampleMarkdown;
  elements.markdownInput.value = state.markdown;
  elements.themeLabel.textContent = THEME_OPTIONS[state.globalTheme].label;
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

/* ── Toast Helper ─────────────────────────────────────────────── */

function showToast(button, message, duration = 1400) {
  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;

  // Find the text node (skip icon SVGs)
  const textNodes = Array.from(button.childNodes).filter(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
  );
  const target = textNodes.length > 0 ? textNodes[0] : button;

  const prev = target.textContent;
  target.textContent = message;
  window.setTimeout(() => {
    target.textContent = prev;
    delete button.dataset.originalText;
  }, duration);
}

/* ── Onboarding ───────────────────────────────────────────────── */

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
            <p class="onboarding-label">Split</p>
            <pre><code>---</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Quote</p>
            <pre><code>layout: quote

> Clear slides.</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Code</p>
            <pre><code>\`\`\`js
console.log("Hi");
\`\`\`</code></pre>
          </div>
          <div class="onboarding-card">
            <p class="onboarding-label">Notes</p>
            <pre><code>:::notes
Talk track.
:::</code></pre>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ── Speaker Notes ────────────────────────────────────────────── */

function updateSpeakerNotes(slide) {
  if (!slide || !slide.notes) {
    elements.speakerNotes.innerHTML = `
      <p class="support-empty">No notes for this slide yet.</p>
    `;
    return;
  }

  const notesHtml = slide.notes
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p>${parseInlineMarkdown(line)}</p>`)
    .join("");

  elements.speakerNotes.innerHTML = `<div class="speaker-notes-copy">${notesHtml}</div>`;
}

/* ── Render ───────────────────────────────────────────────────── */

function renderEmptyStage() {
  elements.slideStage.innerHTML = getOnboardingMarkup();
  elements.slideCount.textContent = "0 slides";
  elements.slidePosition.textContent = "0 / 0";
  elements.slideLayout.textContent = "default";
  elements.slideDensity.hidden = true;
  elements.slideStage.dataset.theme = state.globalTheme;
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

  // Badges
  elements.slideCount.textContent = `${state.slides.length} ${state.slides.length === 1 ? "slide" : "slides"}`;
  elements.slidePosition.textContent = `${state.currentIndex + 1} / ${state.slides.length}`;
  elements.slideLayout.textContent = slide.layout;

  // Density badge — only show when not "balanced"
  if (slide.densityLabel === "balanced") {
    elements.slideDensity.hidden = true;
  } else {
    elements.slideDensity.hidden = false;
    elements.slideDensity.textContent = slide.densityLabel;
    elements.slideDensity.dataset.state = slide.densityLabel;
  }

  updateSpeakerNotes(slide);
  elements.prevButton.disabled = state.currentIndex === 0;
  elements.nextButton.disabled = state.currentIndex === state.slides.length - 1;
}

function renderStrip() {
  elements.slideStrip.innerHTML = "";

  state.slides.forEach((slide, index) => {
    const slideCard =
      elements.slideCardTemplate.content.firstElementChild.cloneNode(true);
    slideCard.querySelector(".slide-thumb-index").textContent =
      `Slide ${index + 1}`;
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

/* ── File Loading ─────────────────────────────────────────────── */

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

/* ── Restore Session ──────────────────────────────────────────── */

function restoreInitialSession() {
  const storedSession = readSessionFromStorage();
  const urlState = readUrlState();

  applySession(
    storedSession || {
      markdown: sampleMarkdown,
      globalTheme: "warm",
      currentIndex: 0,
    },
  );

  if (urlState.theme) {
    state.globalTheme = urlState.theme;
    elements.themeLabel.textContent = THEME_OPTIONS[state.globalTheme].label;
  }

  if (Number.isInteger(urlState.slideIndex)) {
    state.currentIndex = Math.max(0, urlState.slideIndex);
  }
}

/* ── Dropdown Behavior ────────────────────────────────────────── */

function initDropdowns() {
  const dropdowns = document.querySelectorAll("[data-dropdown]");

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector("[data-dropdown-trigger]");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.hasAttribute("data-open");

      // Close all other dropdowns
      dropdowns.forEach((d) => d.removeAttribute("data-open"));

      if (!isOpen) {
        dropdown.setAttribute("data-open", "");
      }
    });
  });

  // Close dropdowns on outside click
  document.addEventListener("click", () => {
    dropdowns.forEach((d) => d.removeAttribute("data-open"));
  });

  // Close dropdowns on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdowns.forEach((d) => d.removeAttribute("data-open"));
    }
  });

  // Prevent dropdown menu clicks from closing
  document.querySelectorAll(".dropdown-menu").forEach((menu) => {
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close after a dropdown item is clicked (except labels for file inputs)
      if (
        e.target.closest(".dropdown-item") &&
        !e.target.closest("label[for]")
      ) {
        dropdowns.forEach((d) => d.removeAttribute("data-open"));
      }
    });
  });
}

/* ── Editor Events ────────────────────────────────────────────── */

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
      showToast(elements.exportSessionButton, "Session loaded");
    } catch {
      showToast(elements.exportSessionButton, "Load failed");
    }
    elements.sessionFileInput.value = "";
  });

  elements.loadSampleButton.addEventListener("click", () => {
    applySession({
      markdown: sampleMarkdown,
      globalTheme: "warm",
      currentIndex: 0,
    });
    render();
  });

  elements.copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.markdownInput.value);
      showToast(elements.copyButton, "Copied!");
    } catch {
      showToast(elements.copyButton, "Copy failed");
    }
  });
}

/* ── Export Events ────────────────────────────────────────────── */

function bindExportEvents() {
  elements.exportMarkdownButton.addEventListener("click", () => {
    createDownload(
      getDeckFilename("md"),
      elements.markdownInput.value,
      "text/markdown;charset=utf-8",
    );
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
      showToast(elements.exportPptxButton, "No slides");
      return;
    }

    elements.exportPptxButton.disabled = true;
    showToast(elements.exportPptxButton, "Exporting...");
    try {
      await exportDeckAsPptx(state.slides, getDeckFilename("pptx"));
      showToast(elements.exportPptxButton, "PPTX ready!");
    } catch {
      showToast(elements.exportPptxButton, "Export failed");
    } finally {
      elements.exportPptxButton.disabled = false;
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

/* ── Presentation Events ──────────────────────────────────────── */

function bindPresentationEvents() {
  elements.prevButton.addEventListener("click", () => {
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    render();
  });

  elements.nextButton.addEventListener("click", () => {
    state.currentIndex = Math.min(
      state.slides.length - 1,
      state.currentIndex + 1,
    );
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
        // Fullscreen can fail silently
      }
    } else {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (
      !document.fullscreenElement &&
      document.body.classList.contains("presenting")
    ) {
      document.body.classList.remove("presenting");
    }
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.body.classList.contains("presenting")
    ) {
      document.body.classList.remove("presenting");
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

/* ── Speaker Notes Toggle ─────────────────────────────────────── */

function bindNotesToggle() {
  elements.notesToggle.addEventListener("click", () => {
    state.notesOpen = !state.notesOpen;
    elements.speakerNotes.hidden = !state.notesOpen;
    elements.notesToggle.parentElement.classList.toggle(
      "notes-open",
      state.notesOpen,
    );
  });
}

/* ── Help Toggle ──────────────────────────────────────────────── */

function bindHelpToggle() {
  elements.helpToggle.addEventListener("click", () => {
    state.helpOpen = !state.helpOpen;
    elements.helpPanel.hidden = !state.helpOpen;
  });
}

/* ── Drop Zone ────────────────────────────────────────────────── */

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

/* ── Init ─────────────────────────────────────────────────────── */

function init() {
  populateThemeSelect();
  initDropdowns();
  bindEditorEvents();
  bindExportEvents();
  bindPresentationEvents();
  bindNotesToggle();
  bindHelpToggle();
  bindDropZoneEvents();
  restoreInitialSession();
  render();
}

init();

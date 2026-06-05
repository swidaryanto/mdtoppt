import { PPTX_CDN, THEME_OPTIONS } from "./config.js?v=fit-22";

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
        fill: theme.surface,
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

export async function exportDeckAsPptx(slides, fileName) {
  const PptxGenJS = await ensurePptxLibrary();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Septian Widaryanto";
  pptx.company = "widaryanto.com";
  pptx.subject = "Markdown presentation";
  pptx.title = slides[0]?.title || "MD to PPT deck";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  slides.forEach((slide) => {
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

  await pptx.writeFile({ fileName });
}

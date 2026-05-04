# mdtoppt

Turn Markdown into presentation slides with live preview, theme control, and export workflows.

## What it includes

- Live slide preview from Markdown
- Slide splitting with `---`
- Layout directives: `title`, `two-column`, `quote`, `image-left`, `full-bleed`
- Speaker notes via `:::notes ... :::`
- Theme controls: `warm`, `graphite`, `spruce`
- Export options:
  - Print / PDF
  - Raw Markdown (`.md`)
  - Session file (`.json`)
  - PowerPoint (`.pptx`) with PptxGenJS
- Session persistence with `localStorage` and URL state (`?theme=&slide=`)

## Slide syntax example

```md
layout: two-column
theme: spruce

# Slide title

Left column content

+++

## Right side

- Bullet one
- Bullet two

:::notes
Talk track for this slide.
:::
```

## Run locally

Run a local static server from this folder:

```sh
python3 -m http.server 8001 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8001/` in your browser.

## Tech

- Plain HTML, CSS, and JavaScript
- [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) for `.pptx` export

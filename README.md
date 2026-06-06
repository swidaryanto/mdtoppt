# mdtoppt

Turn Markdown into presentation slides with live preview, theme control, and export workflows.

## What it includes

- Live slide preview from Markdown
- Slide splitting with `---`
- Layout directives: `title`, `two-column`, `quote`, `image-left`, `full-bleed`
- Speaker notes via `:::notes ... :::`
- Theme controls: `warm`, `hypepedia`, `spruce`, `cobalt`, `clay`, `nocturne`
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

## Tech

- Plain HTML, CSS, and JavaScript
- [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) for `.pptx` export

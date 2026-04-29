# MD to PPT

A lightweight Markdown-to-presentation tool built as a simple single-page app.

## What it does

- Write or paste Markdown and preview slides instantly
- Split slides with `---`
- Use slide layouts like `title`, `two-column`, `quote`, `image-left`, and `full-bleed`
- Add speaker notes with a `:::notes` block
- Switch themes for a more polished presentation look

## Slide conventions

```md
layout: two-column
theme: spruce

# Slide title

Left column content

+++

Right column content

:::notes
Speaker notes go here
:::
```

## Local usage

Open [index.html](./index.html) in a browser and start editing the Markdown input.

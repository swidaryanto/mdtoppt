export const sampleMarkdown = `layout: title
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

export const STORAGE_KEY = "mdtoppt-session";
export const SESSION_VERSION = 1;
export const PPTX_CDN = "https://unpkg.com/pptxgenjs/dist/pptxgen.bundle.js";

export const THEME_OPTIONS = {
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

export const LAYOUT_OPTIONS = new Set(["default", "title", "two-column", "quote", "image-left", "full-bleed"]);

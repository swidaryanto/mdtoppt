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
- Add \`theme: hypepedia\` per slide when needed
- Write speaker notes in a \`:::notes\` block

:::notes
Point out that layouts are opt-in. A plain slide still works.
:::

---

layout: quote
theme: hypepedia

> Good slides remove friction.
> They make the point easy to see.

Septian Widaryanto

---

theme: hypepedia

## Visual support

- Keep the same Hypepedia background treatment
- Use dark green text for better contrast
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
  hypepedia: {
    label: "Hypepedia",
    background: "D6F1EB",
    surface: "FFFFFF",
    text: "1F473D",
    muted: "47776B",
    accent: "8ECEBE",
  },
  spruce: {
    label: "Spruce",
    background: "EAF5EE",
    surface: "F6FBF8",
    text: "1D372B",
    muted: "557061",
    accent: "2F8D61",
  },
  cobalt: {
    label: "Cobalt",
    background: "EAF0FF",
    surface: "F8FAFF",
    text: "1E2C52",
    muted: "5D6F9A",
    accent: "3B6EF3",
  },
  clay: {
    label: "Clay",
    background: "F8EEE7",
    surface: "FFF9F5",
    text: "40241C",
    muted: "876357",
    accent: "C86D4A",
  },
  nocturne: {
    label: "Nocturne",
    background: "141826",
    surface: "1F2536",
    text: "EEF2FF",
    muted: "9EA9C7",
    accent: "8D7DFF",
  },
};

export const LAYOUT_OPTIONS = new Set(["default", "title", "two-column", "quote", "image-left", "full-bleed"]);

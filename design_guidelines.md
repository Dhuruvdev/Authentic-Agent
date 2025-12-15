# NothingHide - Design Guidelines

## Design Approach

**System Selected**: Minimal Professional Design inspired by security-focused products (1Password, Stripe, Linear)

**Core Principles**:
- Trust through transparency and restraint
- Information clarity over visual flourish
- Professional credibility
- Progressive disclosure of complexity

---

## Typography

**Font Stack**: System font stack for performance and familiarity
- Primary: `ui-sans-serif, system-ui, -apple-system, sans-serif`
- Monospace (for technical data): `ui-monospace, monospace`

**Scale**:
- Hero/Display: `text-4xl` (36px) - `font-semibold`
- Page Title: `text-2xl` (24px) - `font-semibold`
- Section Headings: `text-lg` (18px) - `font-medium`
- Body Text: `text-base` (16px) - `font-normal`
- Secondary/Meta: `text-sm` (14px) - `font-normal`
- Technical Details: `text-xs` (12px) - `font-mono`

---

## Layout System

**Spacing Primitives**: Consistent tailwind units of **4, 6, 8, 12, 16**
- Tight spacing: `p-4`, `gap-4`, `space-y-4`
- Standard spacing: `p-6`, `gap-6`, `my-8`
- Generous spacing: `p-12`, `py-16`

**Container Strategy**:
- Full-width viewport with centered content: `max-w-4xl mx-auto px-6`
- Single-column layout (no multi-column grids - information hierarchy matters)
- Vertical rhythm: `space-y-8` between major sections

---

## Component Library

### Input Section
- Large, prominent input field (`h-16`, `text-lg`)
- Clear placeholder text indicating accepted formats
- Single action button below input
- Input type toggles (Email/Username/Image URL) as subtle pill buttons above

### Real-Time Chain Feed
- Minimal progress indicator (not a fake terminal)
- Simple line-by-line event list with timestamps
- Icon indicators for status: processing, complete, error
- Container: `border`, subtle background, `rounded-lg`, `p-6`

### Results Display
- Card-based layout for each module result (NH-Breach, NH-Correlate, etc.)
- Clear severity indicators (Low/Medium/High) with minimal visual treatment
- Expandable details sections using disclosure patterns
- Metadata displayed in definition lists (`dl`, `dt`, `dd`)

### Verdict Section
- Prominent exposure score (large number: `text-6xl`)
- Risk level badge
- Plain-language summary paragraph
- Actionable recommendations as numbered list

### Transparency Layer
- Persistent footer/bottom section
- Collapsible "How This Works" panel
- Data sources list
- Legal scope statement in readable prose

### Demo Mode Toggle
- Simple switch in header
- Clear "DEMO DATA" badge when active

---

## Visual Elements

**Borders & Dividers**: Subtle separators (`border-gray-200`)
**Shadows**: Minimal elevation (`shadow-sm` for cards)
**Rounding**: Consistent `rounded-lg` for major containers, `rounded-md` for buttons
**Icons**: Heroicons (outline style) via CDN - minimal, only for status/category indicators

---

## Animations

**Strictly Minimal**:
- Input focus states (subtle glow)
- Chain feed items: simple fade-in as they appear
- NO loading spinners, pulsing effects, or terminal animations
- Disclosure panels: simple height transition

---

## Page Structure

**Single-Page Layout**:
1. **Header** (sticky): Logo + Demo toggle + transparency link
2. **Hero Section**: Brief value statement + disclaimer (NOT a large image hero - this is a utility)
3. **Input Section**: Input field + type selector + scan button
4. **Progress Feed**: Appears during scan, collapses when complete
5. **Results Section**: Modular cards for each analysis component
6. **Verdict Section**: Aggregated score + recommendations
7. **Transparency Footer**: Permanent legal disclaimers + "How This Works"

**Viewport**: Natural content flow - no forced 100vh sections. Each section sized by content.

---

## Trust Indicators

- Prominent legal disclaimers (not hidden in fine print)
- "Last updated" timestamps on all results
- Clear "Data Sources" attribution
- Explicit "What We Checked" / "What We Didn't Check" sections

---

## Images

**No decorative images.** This is a professional security tool.
- Optional: Small trust badge icons (lock, shield) only if they serve functional purpose
- No hero background images
- No illustrations
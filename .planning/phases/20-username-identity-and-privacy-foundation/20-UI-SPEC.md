---
phase: 20
slug: username-identity-and-privacy-foundation
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-18
---

# Phase 20 - UI Design Contract

> Visual and interaction contract for the username signup field and mandatory existing-user setup gate. Generated inline because this thread forbids subagents.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react for field/action icons; existing react-icons social auth icons remain unchanged |
| Font | Existing app font stack through Tailwind/global CSS |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline icon/text gaps, error message offset |
| sm | 8px | Label-to-input spacing, compact stack spacing |
| md | 16px | Field group gaps, card inner rhythm |
| lg | 24px | Form section spacing, submit-to-divider spacing |
| xl | 32px | Auth card padding on mobile and desktop |
| 2xl | 48px | Page vertical breathing room when viewport allows |
| 3xl | 64px | Reserved for wide desktop page centering only |

Exceptions: none. Fixed-format controls must not shift when validation text appears.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 14px | 500 | 1.4 |
| Helper/Error | 13px | 400 or 500 for root errors | 1.4 |
| Heading | 24px | 700 | 1.25 |
| Brand title | 30px | 700 | 1.2 |

Letter spacing remains `0`. Do not scale font size with viewport width.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#030712` | Page background and deep auth surface context |
| Secondary (30%) | `#111827` | Inputs, auth card surface, setup surface |
| Border | `#374151` | Field borders, dividers, low-emphasis separation |
| Text | `#F9FAFB` | Primary text |
| Muted text | `#9CA3AF` | Helper text, secondary account copy |
| Accent (10%) | `#22C55E` | Focus ring, primary submit button, active links |
| Destructive | `#EF4444` | Validation errors and root error borders only |

Accent reserved for: primary CTA, focused username/email/password inputs, account links, and success-ready states. Do not apply accent to every icon or decorative element.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Signup username label | Username |
| Signup username placeholder | ahmed.musa |
| Signup username helper | Use 3-24 letters, numbers, dots, or underscores. |
| Signup primary CTA | Create account |
| Setup page heading | Choose your username |
| Setup page body | Pick the name people will use to find you in Chatify. |
| Setup primary CTA | Save username |
| Setup success | Username saved |
| Required error | Enter a username. |
| Invalid error | Use 3-24 letters, numbers, dots, or underscores. |
| Duplicate error | That username is taken. Try another one. |
| Reserved error | Choose a different username. |
| Already-set error | This account already has a username. |

Copy stays functional and short. Do not add feature marketing, keyboard-shortcut explanations, or long onboarding text inside the app.

---

## Screen Contracts

### Signup Username Field

- Add a username field between the name row and email field.
- Use a single full-width field with a user/at-style lucide icon on the left.
- Keep the first/last name two-column layout on desktop and collapse it to one column on narrow mobile if needed.
- Preserve the existing signup OAuth section, footer link, and submission pattern.
- Field states:
  - default: dark input, muted placeholder, border `#374151`
  - focus: green border and 1px green ring
  - invalid: red border and one-line inline error below the field
  - disabled/submitting: existing disabled opacity pattern

### Mandatory Username Setup Page

- Add a protected setup route such as `/setup-username`.
- Layout is a centered account setup surface, not a landing page.
- Reuse the Chatify mark and dark auth visual language, but do not add new decorative blobs or extra marketing sections.
- Surface contains:
  - Chatify mark
  - heading
  - one body sentence
  - username field
  - primary submit button
  - root error/status region
- No skip, back-to-chat, or "later" action is allowed for a user missing username.
- Users with a username who navigate to setup should be redirected to chat.

---

## Interaction Contract

- Route gating happens after auth initialization and before chat renders.
- Authenticated users missing `username` are redirected from `/` and future protected discovery/group routes to `/setup-username`.
- `/setup-username` is protected by authentication but is the allowed exception for users missing username.
- Successful setup updates auth state, invalidates/refetches logged-user data if needed, and navigates to `/`.
- Signup submission sends normalized-compatible username input with the rest of the existing signup payload.
- Duplicate/validation errors from the backend map to the username field when possible; unknown setup errors show in the root error region.
- Loading states must keep button dimensions stable and expose readable busy state text to assistive tech.

---

## Accessibility Contract

- Every username input has a visible `label` connected with `htmlFor`.
- Helper text and validation errors are associated with the input via `aria-describedby`.
- Invalid fields set `aria-invalid="true"`.
- Root errors use `role="alert"` or an equivalent live region.
- The password visibility button keeps its existing icon behavior but must include an accessible name.
- Social auth buttons must keep title/accessible labels.
- Keyboard users can tab through every control in visual order, submit with Enter, and see a visible focus state.
- Color cannot be the only error signal; error copy must render as text.

---

## Responsive Contract

- Signup and setup surfaces must fit at 320px width without horizontal scrolling.
- Text inside buttons and fields must not overflow. Use stable padding, wrapping where needed, and no viewport-scaled fonts.
- Auth cards remain max-width `32rem` or narrower; setup can be max-width `28rem` because it has one field.
- On short viewports, page content may scroll; primary controls remain reachable.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registries | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS - Copy is short, action-oriented, and maps every expected username error to a user-facing message.
- [x] Dimension 2 Visuals: PASS - Contract preserves current auth visual language and avoids broad redesign.
- [x] Dimension 3 Color: PASS - Palette defines neutral surfaces, green action/focus accent, and red errors without using accent everywhere.
- [x] Dimension 4 Typography: PASS - Fixed sizes and line heights are specified with no viewport-scaling.
- [x] Dimension 5 Spacing: PASS - 4px-based tokens cover form and setup surfaces.
- [x] Dimension 6 Registry Safety: PASS - No external UI registry blocks are introduced.

**Approval:** approved 2026-06-18

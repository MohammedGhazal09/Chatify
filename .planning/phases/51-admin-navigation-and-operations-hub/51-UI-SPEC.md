# Phase 51 UI Spec

## Surface

Route: `/admin`

## Layout

- Full-height operations page using the existing chat theme variables.
- Header includes:
  - Back-to-chat icon button.
  - Eyebrow: `Admin operations`.
  - Title: `Operations hub`.
  - Short generated/health summary area is not required.
- Main content:
  - Two primary cards in a responsive grid:
    - Moderation queue.
    - Delivery health.
  - Cards include a small status strip, a few aggregate metrics, and a direct link.
  - Mobile stacks cards in one column.
  - RTL preserves readable ordering and spacing.

## States

- Admin with loaded summaries.
- Admin with loading summaries.
- Admin with summary error, while cards remain navigable.
- Non-admin restricted state.

## Accessibility

- The page has one `h1`.
- Cards are labelled sections with real links.
- Icon-only controls must have accessible names.
- No text should overlap or require horizontal scroll at `390x844`.

## Recommendation

Use simple rectangular cards with radius no larger than the existing chat radius. Keep the page operational, not marketing-style.

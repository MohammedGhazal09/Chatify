# Phase 38 UI Spec - Bounded Spaces And Channels

## Objective

Add a compact spaces workspace inside the existing messenger so users can create private spaces, browse channels, and use the existing conversation pane for channel messages.

## Recommendation

Use a restrained operational layout: a Conversations/Spaces switch in the sidebar, a space list, a channel list for the selected space, and the existing timeline/composer for selected channel messages. Do not build a landing page, directory, or decorative community surface.

## In Scope

- Sidebar switch between Conversations and Spaces.
- Empty spaces state with one clear create action.
- Create space dialog with name, optional description, and username member input.
- Selected space header with member count and create-channel action for owner/admin.
- Channel list with selected state and unread indicators.
- Channel message view using existing `ConversationPane`.
- Access-denied and loading/error states.

## Out Of Scope

- Public browse/discover pages.
- Invite-link management UI.
- Bot/integration marketplace UI.
- Thread panels, channel categories, voice rooms, or forum posts.
- Full responsive visual audit; component tests and build are required, screenshots recommended before release.

## UI Requirements

- Keep controls dense and scannable; this is a work surface, not a marketing surface.
- Use existing chat tokens, radii, buttons, focus states, and list-item density.
- Use icon buttons for create/settings where familiar icons exist, with accessible labels.
- Text must fit in sidebar rows and channel headers on mobile and desktop.
- Empty states should be factual and actionable, not sample content.
- Account email must not appear in space creation, member lists, channel lists, or reports.

## Acceptance Criteria

- [ ] Spaces mode is reachable from the existing chat shell.
- [ ] Create-space and create-channel controls are visible only when appropriate.
- [ ] Channel selection renders the existing timeline/composer path.
- [ ] Empty/loading/error/access-denied states are covered by tests.
- [ ] Long space/channel names remain bounded without overlapping controls.

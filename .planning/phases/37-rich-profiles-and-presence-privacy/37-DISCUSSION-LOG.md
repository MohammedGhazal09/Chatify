# Phase 37 Discussion Log - Rich Profiles And Presence Privacy

## Decisions

- Recommendation: keep Phase 37 text-only. Bio and status fields are enough for useful contact-card richness without adding link moderation or directory risk.
- Recommendation: expose profile bio/status only through existing authenticated contact and username surfaces; do not add global discovery.
- Recommendation: preserve existing `showOnlineStatus` and `showLastSeen` fields for compatibility and add `showProfileStatus` for status visibility.
- Recommendation: treat hidden online presence as offline and call-unreachable for other users, rather than omitting broadcasts and leaving stale UI.
- Recommendation: keep account email visible only to the signed-in user in Settings.

## Open Questions Resolved By Defaults

- Bio length: 160 characters, because it is enough for a compact chat contact card and easy to display in side panels.
- Status length: 80 characters, because it needs to fit headers/detail panels without crowding message controls.
- Visibility defaults: visible by default to preserve existing behavior and avoid surprising users after migration.
- Blocked users: no presence or last-seen visibility across HTTP or Socket.IO paths.

## Deferred

- Per-conversation visibility rules.
- Rich profile links or external social handles.
- Profile search/ranking.
- Cross-tenant or public directory behavior.

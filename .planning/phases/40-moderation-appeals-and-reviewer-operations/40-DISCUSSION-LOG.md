# Phase 40 Discussion Log

## Decision: Keep Appeals Embedded In Reports

Recommendation: embed appeals in `AbuseReport`.

Rationale: enforcement decisions already live on reports with audit trail entries. Embedding appeals keeps state transitions local, avoids a second collection, and supports the current scope of one open appeal per report/user.

## Decision: User Surface Lives In Settings

Recommendation: add a compact account-safety section in Settings.

Rationale: appeals are account-level safety controls, not chat-message composition behavior. Settings already contains account, privacy, portability, and session controls.

## Decision: Metrics Are Count-Only

Recommendation: operations summary should include status counts, appeal counts, assignment counts, and oldest/open aging only.

Rationale: reviewer workload visibility does not need message text, report details, emails, tokens, or reporter identities.

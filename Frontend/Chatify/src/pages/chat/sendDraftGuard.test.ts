import { describe, expect, it } from 'vitest';
import type { ComposerAttachmentDraft } from '../../types/chat';
import { buildSendDraftKey } from './sendDraftGuard';

const makeDraft = (overrides: Partial<ComposerAttachmentDraft> = {}): ComposerAttachmentDraft => {
  const file = new File(['hello'], overrides.displayName ?? 'message-states-spec.pdf', {
    type: overrides.mimeType ?? 'application/pdf',
  });

  Object.defineProperty(file, 'lastModified', {
    configurable: true,
    value: 123,
  });

  return {
    id: 'draft-1',
    file,
    displayName: file.name,
    mimeType: file.type,
    size: file.size,
    kind: 'file',
    ...overrides,
  };
};

describe('buildSendDraftKey', () => {
  it('creates the same key for the same chat, trimmed text, and attachment identity', () => {
    expect(buildSendDraftKey('chat-1', '  hello  ', [makeDraft()])).toBe(
      buildSendDraftKey('chat-1', 'hello', [makeDraft()])
    );
  });

  it('changes the key when the chat, text, or attachment changes', () => {
    const base = buildSendDraftKey('chat-1', 'hello', [makeDraft()]);

    expect(buildSendDraftKey('chat-2', 'hello', [makeDraft()])).not.toBe(base);
    expect(buildSendDraftKey('chat-1', 'hello again', [makeDraft()])).not.toBe(base);
    expect(buildSendDraftKey('chat-1', 'hello', [makeDraft({ displayName: 'delivery-metrics.xlsx' })])).not.toBe(base);
  });
});

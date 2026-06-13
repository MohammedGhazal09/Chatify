import type { ComposerAttachmentDraft } from '../../types/chat';

const attachmentIdentityPart = (attachment: ComposerAttachmentDraft, index: number) => {
  const { file } = attachment;
  return [
    index,
    attachment.displayName,
    file.name,
    file.size,
    file.type,
    file.lastModified,
  ].join(':');
};

export const buildSendDraftKey = (
  chatId: string,
  text: string,
  attachments: ComposerAttachmentDraft[]
) => [
  chatId,
  text.trim(),
  attachments.map(attachmentIdentityPart).join('|'),
].join('\n');

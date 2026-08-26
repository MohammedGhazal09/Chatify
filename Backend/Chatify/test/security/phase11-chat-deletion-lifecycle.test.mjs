import { describe, expect, it } from 'vitest';

import Attachment from '../../Models/attachmentModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { getAttachmentBucket } from '../../Services/attachmentStorageService.mjs';
import { reconcileUploadStorage } from '../../Services/uploadLifecycleService.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachText } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

describe('Phase 11 conversation upload lifecycle', () => {
  it('removes message records and schedules every attachment for physical deletion when a chat is deleted', async () => {
    const owner = await signupWithAgent({ firstName: 'Delete', lastName: 'Owner' });
    const peer = await signupWithAgent({ firstName: 'Delete', lastName: 'Peer' });
    const chat = await createDirectChat([owner.user, peer.user]);
    const created = await attachText(
      owner.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', 'attachment removed with its conversation')
        .field('clientMessageId', 'phase11-chat-delete'),
      'conversation.txt',
      'private conversation attachment'
    ).expect(201);
    const messageId = created.body.data.message._id;
    const attachmentId = created.body.data.message.attachments[0].attachmentId;
    const storedAttachment = await Attachment.findById(attachmentId).lean();

    await owner.agent
      .delete(`/api/chat/${chat._id}`)
      .expect(200);

    expect(await Message.findById(messageId)).toBeNull();
    expect(await Attachment.findById(attachmentId)).toMatchObject({
      status: 'deleted',
    });

    const cleanup = await reconcileUploadStorage({
      now: new Date(Date.now() + 1_000),
      orphanGraceMs: 0,
    });

    expect(cleanup.deletedAttachmentRecords).toBeGreaterThanOrEqual(1);
    expect(await Attachment.findById(attachmentId)).toBeNull();
    expect(await getAttachmentBucket()
      .find({ _id: storedAttachment.storageFileId })
      .toArray()).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachPdf, attachText } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const createAttachmentMessage = (agent, chatId, clientMessageId, attachFn) => (
  attachFn(
    agent
      .post('/api/message/new-message')
      .field('chatId', chatId)
      .field('text', `message ${clientMessageId}`)
      .field('clientMessageId', clientMessageId)
  )
);

describe('shared attachment assets', () => {
  it('lists protected shared assets by kind without storage internals', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Shared', lastName: 'One' });
    const memberTwo = await signupWithAgent({ firstName: 'Shared', lastName: 'Two' });
    const chat = await createDirectChat([memberOne.user, memberTwo.user]);

    await createAttachmentMessage(memberOne.agent, chat._id.toString(), 'shared-file-1', attachPdf).expect(201);
    await createAttachmentMessage(memberOne.agent, chat._id.toString(), 'shared-file-2', attachText).expect(201);

    const response = await memberTwo.agent
      .get(`/api/message/${chat._id}/shared-assets?kind=file&limit=1`)
      .expect(200);

    expect(response.body.data.assets).toHaveLength(1);
    expect(response.body.data.assets[0]).toMatchObject({
      chatId: chat._id.toString(),
      kind: 'file',
      status: 'active',
    });
    expect(response.body.data.assets[0]).not.toHaveProperty('storageFileId');
    expect(response.body.data.assets[0]).not.toHaveProperty('hash');
    expect(response.body.data.cursor.hasMore).toBe(true);
    expect(response.body.data.cursor.nextCursor).toEqual(expect.any(String));
  });

  it('filters hidden and deleted attachment messages out of shared assets', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Visible', lastName: 'One' });
    const memberTwo = await signupWithAgent({ firstName: 'Visible', lastName: 'Two' });
    const chat = await createDirectChat([memberOne.user, memberTwo.user]);

    const visible = await createAttachmentMessage(memberOne.agent, chat._id.toString(), 'visible-file', attachPdf).expect(201);
    const hidden = await createAttachmentMessage(memberOne.agent, chat._id.toString(), 'hidden-file', attachText).expect(201);

    await memberTwo.agent
      .delete(`/api/message/${hidden.body.data.message._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);

    const response = await memberTwo.agent
      .get(`/api/message/${chat._id}/shared-assets?kind=file`)
      .expect(200);

    expect(response.body.data.assets.map((asset) => asset.messageId)).toEqual([
      visible.body.data.message._id,
    ]);
  });
});

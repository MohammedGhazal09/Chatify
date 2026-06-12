import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachPdf } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupAttachmentAccessScenario = async () => {
  const memberOne = await signupWithAgent({ firstName: 'Access', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Access', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Access', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const response = await attachPdf(
    memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chat._id.toString())
      .field('text', 'private attachment')
      .field('clientMessageId', 'attachment-access')
  ).expect(201);
  const message = response.body.data.message;
  const attachmentId = message.attachments[0].attachmentId;

  return { memberOne, memberTwo, outsider, chat, message, attachmentId };
};

describe('attachment authorization', () => {
  it('allows members to preview and download through protected routes only', async () => {
    const { memberTwo, attachmentId } = await setupAttachmentAccessScenario();

    const preview = await memberTwo.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(200);
    const download = await memberTwo.agent
      .get(`/api/message/attachments/${attachmentId}/download`)
      .expect(200);

    expect(preview.headers['content-type']).toMatch(/application\/pdf/);
    expect(preview.headers['content-disposition']).toMatch(/^inline/);
    expect(download.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('rejects non-members without leaking private attachment details', async () => {
    const { outsider, attachmentId, chat } = await setupAttachmentAccessScenario();

    const preview = await outsider.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(403);
    await outsider.agent
      .get(`/api/message/attachments/${attachmentId}/download`)
      .expect(403);
    await outsider.agent
      .get(`/api/message/${chat._id}/shared-assets?kind=file`)
      .expect(403);

    expect(preview.body.message).toMatch(/attachment not found/i);
  });

  it('respects delete-for-self and delete-for-everyone visibility', async () => {
    const { memberOne, memberTwo, message, attachmentId } = await setupAttachmentAccessScenario();

    await memberTwo.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);
    await memberTwo.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(404);
    await memberOne.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(200);

    await memberOne.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);
    await memberOne.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(404);
  });
});

import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import {
  tinyPdfBuffer,
  tinyTextBuffer,
} from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupScenario = async () => {
  const memberOne = await signupWithAgent({ firstName: 'Upload', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Upload', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Upload', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  return { memberOne, outsider, chat };
};

const multipartMessage = ({ actor, chatId, clientMessageId }) => actor.agent
  .post('/api/message/new-message')
  .set('X-Chat-Id', chatId)
  .field('chatId', chatId)
  .field('text', 'bounded upload')
  .field('clientMessageId', clientMessageId);

describe('message multipart upload boundary', () => {
  it('requires an authorized chat header before multipart bytes are accepted', async () => {
    const { memberOne, outsider, chat } = await setupScenario();
    const chatId = chat._id.toString();

    await memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chatId)
      .field('text', 'missing header')
      .field('clientMessageId', 'missing-upload-chat-header')
      .attach('attachments', tinyTextBuffer(), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    await multipartMessage({
      actor: outsider,
      chatId,
      clientMessageId: 'unauthorized-upload-chat-header',
    })
      .attach('attachments', tinyTextBuffer(), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(403);

    await multipartMessage({
      actor: memberOne,
      chatId,
      clientMessageId: 'authorized-upload-chat-header',
    })
      .attach('attachments', tinyTextBuffer(), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(201);
  });

  it('rejects PDF and OOXML containers instead of relying on incomplete active-content scanning', async () => {
    const { memberOne, chat } = await setupScenario();
    const chatId = chat._id.toString();

    const pdf = await multipartMessage({
      actor: memberOne,
      chatId,
      clientMessageId: 'reject-complex-pdf',
    })
      .attach('attachments', tinyPdfBuffer(), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    const docx = await multipartMessage({
      actor: memberOne,
      chatId,
      clientMessageId: 'reject-complex-docx',
    })
      .attach('attachments', Buffer.from('PK\u0003\u0004'), {
        filename: 'document.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .expect(400);

    expect(pdf.body.code).toBe('ATTACHMENT_TYPE_UNSUPPORTED');
    expect(docx.body.code).toBe('ATTACHMENT_TYPE_UNSUPPORTED');
  });
});

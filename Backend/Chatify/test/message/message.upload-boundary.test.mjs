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
  .field('chatId', chatId)
  .field('text', 'bounded upload')
  .field('clientMessageId', clientMessageId);

describe('message multipart upload boundary', () => {
  it('authorizes the leading chat field before any attachment is stored', async () => {
    const { memberOne, outsider, chat } = await setupScenario();
    const chatId = chat._id.toString();

    await multipartMessage({
      actor: memberOne,
      chatId,
      clientMessageId: 'authorized-leading-chat-field',
    })
      .attach('attachments', tinyTextBuffer(), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    await multipartMessage({
      actor: outsider,
      chatId,
      clientMessageId: 'unauthorized-leading-chat-field',
    })
      .attach('attachments', tinyTextBuffer(), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(403);

    const outOfOrder = await memberOne.agent
      .post('/api/message/new-message')
      .attach('attachments', tinyTextBuffer(), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .field('chatId', chatId)
      .field('text', 'chat id arrived too late')
      .field('clientMessageId', 'out-of-order-chat-field')
      .expect(400);

    expect(outOfOrder.body.code).toBe('UPLOAD_CHAT_ID_REQUIRED');
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

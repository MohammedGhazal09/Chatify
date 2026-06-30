import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

describe('CSRF protection', () => {
  it('issues a readable CSRF cookie for the shared frontend client', async () => {
    const { agent } = await signupWithAgent({ firstName: 'Csrf', lastName: 'Cookie' }, { autoCsrf: false });

    const response = await agent
      .get('/api/csrf-token')
      .expect(204);

    const csrfCookie = response.headers['set-cookie']
      .find((cookie) => cookie.startsWith('XSRF-TOKEN='));

    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
  });

  it('rejects unsafe auth, chat, and message requests without a valid CSRF token', async () => {
    const requester = await signupWithAgent(
      { firstName: 'Csrf', lastName: 'Requester' },
      { autoCsrf: false }
    );

    await requester.agent
      .post('/api/auth/logout')
      .expect(403);

    await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetUsername: 'nobody' })
      .expect(403);

    await requester.agent
      .post('/api/chat/create-group-chat')
      .send({ chatName: 'CSRF group', memberUsernames: ['nobody', 'nobody2'] })
      .expect(403);

    await requester.agent
      .post('/api/message/batch/unread-counts')
      .send({ chatIds: [] })
      .expect(403);
  });

  it('allows valid-token chat and message mutations to reach normal route behavior', async () => {
    const requester = await signupWithAgent(
      { firstName: 'Csrf', lastName: 'Requester' },
      { autoCsrf: false }
    );
    const target = await signupWithAgent({ firstName: 'Csrf', lastName: 'Target' });
    const groupMember = await signupWithAgent({ firstName: 'Csrf', lastName: 'GroupMember' });
    const groupMemberTwo = await signupWithAgent({ firstName: 'Csrf', lastName: 'GroupMemberTwo' });
    const csrfToken = await getCsrfForAgent(requester.agent);
    const chat = await createDirectChat([requester.user, target.user]);

    const chatResponse = await requester.agent
      .post('/api/chat/create-new-chat')
      .set('X-CSRF-Token', csrfToken)
      .send({ targetUsername: target.user.username })
      .expect(200);

    const groupResponse = await requester.agent
      .post('/api/chat/create-group-chat')
      .set('X-CSRF-Token', csrfToken)
      .send({
        chatName: 'CSRF group',
        memberUsernames: [groupMember.user.username, groupMemberTwo.user.username],
      })
      .expect(201);

    const messageResponse = await requester.agent
      .post('/api/message/new-message')
      .set('X-CSRF-Token', csrfToken)
      .send({
        chatId: chatResponse.body.data.chat._id,
        text: 'CSRF-protected message',
        clientMessageId: 'csrf-protected-message',
      })
      .expect(201);

    expect(chatResponse.body.data.chat._id).toBe(chat._id.toString());
    expect(messageResponse.body.data.message.text).toBe('CSRF-protected message');
    expect(groupResponse.body.data.chat.isGroupChat).toBe(true);
  });

  it('keeps safe authenticated reads exempt from CSRF headers', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Csrf', lastName: 'ReaderOne' });
    const memberTwo = await signupWithAgent({ firstName: 'Csrf', lastName: 'ReaderTwo' });

    await createDirectChat([memberOne.user, memberTwo.user]);

    await memberOne.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
  });
});

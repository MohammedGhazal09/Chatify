import { afterEach, describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachVoice } from '../fixtures/attachments.mjs';
import { getCsrfForAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketAsUser,
  emitWithAck,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];

const validIdentityMark = (overrides = {}) => ({
  label: 'Relay Grid',
  initials: 'RG',
  paletteId: 'teal',
  patternId: 'rings',
  accentId: 'mint',
  ...overrides,
});

const trackSocket = (socket) => {
  sockets.push(socket);
  return socket;
};

const waitForNoSocketEvent = (socket, eventName, timeoutMs = 250) => {
  return new Promise((resolve) => {
    let payload;

    const onEvent = (eventPayload) => {
      payload = eventPayload;
    };

    socket.once(eventName, onEvent);

    setTimeout(() => {
      socket.off(eventName, onEvent);
      resolve(payload);
    }, timeoutMs);
  });
};

const setupVoiceIdentitySocketScenario = async () => {
  const server = await startSocketTestServer();
  servers.push(server);

  const memberOne = await connectSocketAsUser(server.url, { firstName: 'Voice', lastName: 'One' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'Voice', lastName: 'Two' });
  const nonMember = await connectSocketAsUser(server.url, { firstName: 'Voice', lastName: 'Outside' });

  trackSocket(memberOne.socket);
  trackSocket(memberTwo.socket);
  trackSocket(nonMember.socket);

  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const chatId = chat._id.toString();

  await emitWithAck(memberOne.socket, 'chat:join', chatId);
  await emitWithAck(memberTwo.socket, 'chat:join', chatId);

  return { memberOne, memberTwo, nonMember, chatId };
};

afterEach(async () => {
  sockets.splice(0).forEach((socket) => {
    if (socket.connected || socket.active) {
      socket.disconnect();
    }
  });

  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe('Socket.IO voice and identity room contract', () => {
  it('emits persisted voice summaries only to chat-room members', async () => {
    const { memberOne, memberTwo, nonMember, chatId } = await setupVoiceIdentitySocketScenario();
    const memberEventPromise = waitForSocketEvent(memberTwo.socket, 'message:new');
    const nonMemberEventPromise = waitForNoSocketEvent(nonMember.socket, 'message:new');

    const response = await attachVoice(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chatId)
        .field('text', '')
        .field('clientMessageId', 'socket-voice-client-1'),
      { durationSeconds: 6.25 }
    ).expect(201);
    const memberEvent = await memberEventPromise;
    const nonMemberEvent = await nonMemberEventPromise;

    expect(memberEvent).toMatchObject({
      _id: response.body.data.message._id,
      chatId,
      clientMessageId: 'socket-voice-client-1',
      text: '',
      attachments: [
        expect.objectContaining({
          displayName: 'voice-message.webm',
          kind: 'voice',
          durationSeconds: 6.25,
          status: 'active',
        }),
      ],
    });
    expect(memberEvent.attachments[0]).not.toHaveProperty('storageFileId');
    expect(memberEvent.attachments[0]).not.toHaveProperty('hash');
    expect(nonMemberEvent).toBeUndefined();
  });

  it('emits abstract identity updates only to users sharing a chat', async () => {
    const { memberOne, memberTwo, nonMember } = await setupVoiceIdentitySocketScenario();
    const memberEventPromise = waitForSocketEvent(memberTwo.socket, 'user:identity-updated');
    const nonMemberEventPromise = waitForNoSocketEvent(nonMember.socket, 'user:identity-updated');
    const csrfToken = await getCsrfForAgent(memberOne.agent);

    const response = await memberOne.agent
      .patch('/api/user/identity')
      .set('X-CSRF-Token', csrfToken)
      .send(validIdentityMark({ label: 'Signal Grid', initials: 'SG' }))
      .expect(200);
    const memberEvent = await memberEventPromise;
    const nonMemberEvent = await nonMemberEventPromise;

    expect(memberEvent).toMatchObject({
      userId: memberOne.user._id.toString(),
      user: {
        _id: memberOne.user._id.toString(),
        identityMark: {
          source: 'custom',
          label: 'Signal Grid',
          initials: 'SG',
        },
      },
      chatIds: expect.any(Array),
    });
    expect(memberEvent.user.identityMark).toEqual(response.body.data.user.identityMark);
    expect(nonMemberEvent).toBeUndefined();
  });
});

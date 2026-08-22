import { describe, expect, it } from 'vitest';

import { createDirectChat } from '../fixtures/chats.mjs';
import { attachText } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

describe('Phase 11 multipart diagnostic', () => {
  it('reports the response body for a safe text attachment', async () => {
    const sender = await signupWithAgent({ firstName: 'Diagnostic', lastName: 'Sender' });
    const peer = await signupWithAgent({ firstName: 'Diagnostic', lastName: 'Peer' });
    const chat = await createDirectChat([sender.user, peer.user]);

    const response = await attachText(
      sender.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', 'safe diagnostic attachment')
        .field('clientMessageId', 'phase11-safe-diagnostic'),
      'diagnostic.txt',
      'safe notes'
    );

    console.error('PHASE11_MULTIPART_DIAGNOSTIC', JSON.stringify({
      status: response.status,
      body: response.body,
    }));
    expect(response.status).toBe(201);
  });
});

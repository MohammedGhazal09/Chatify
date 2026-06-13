import { describe, expect, it } from 'vitest';
import CallSession from '../../Models/callSessionModel.mjs';
import Message from '../../Models/messageModel.mjs';
import {
  createCallActivityForSession,
  serializeCallActivityMessage,
} from '../../Utils/callSessionState.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupCallActivityScenario = async () => {
  await Message.init();
  await CallSession.init();

  const caller = await signupWithAgent({ firstName: 'Call', lastName: 'Caller' });
  const callee = await signupWithAgent({ firstName: 'Call', lastName: 'Callee' });
  const chat = await createDirectChat([caller.user, callee.user]);

  return { caller, callee, chat };
};

const createEndedSession = async ({ caller, callee, chat, overrides = {} }) => CallSession.create({
  callId: overrides.callId ?? 'call-activity-1',
  chatId: chat._id,
  callerId: caller.user._id,
  calleeId: callee.user._id,
  mode: overrides.mode ?? 'video',
  status: overrides.status ?? 'ended',
  startedAt: overrides.startedAt ?? new Date('2026-06-13T10:00:00.000Z'),
  ringingAt: overrides.ringingAt ?? new Date('2026-06-13T10:00:01.000Z'),
  answeredAt: overrides.answeredAt ?? new Date('2026-06-13T10:00:05.000Z'),
  endedAt: overrides.endedAt ?? new Date('2026-06-13T10:02:10.000Z'),
  endedReason: overrides.endedReason ?? 'ended',
  durationSeconds: overrides.durationSeconds ?? 125,
  deliveredTo: overrides.deliveredTo ?? [callee.user._id],
});

describe('call activity messages', () => {
  it('creates one metadata-only call activity record for an ended call', async () => {
    const scenario = await setupCallActivityScenario();
    const session = await createEndedSession(scenario);

    const activity = await createCallActivityForSession(session);
    const duplicateActivity = await createCallActivityForSession(session);
    const serialized = serializeCallActivityMessage(activity);
    const serializedText = JSON.stringify(serialized).toLowerCase();

    expect(activity._id.toString()).toBe(duplicateActivity._id.toString());
    await expect(Message.countDocuments({
      chatId: scenario.chat._id,
      messageType: 'call',
      'callActivity.callId': session.callId,
    })).resolves.toBe(1);
    expect(serialized).toMatchObject({
      text: '',
      messageType: 'call',
      chatId: scenario.chat._id.toString(),
      sender: scenario.caller.user._id.toString(),
      callActivity: {
        callId: session.callId,
        callerId: scenario.caller.user._id.toString(),
        calleeId: scenario.callee.user._id.toString(),
        mode: 'video',
        result: 'ended',
        durationSeconds: 125,
      },
    });
    expect(serialized.callActivity.startedAt).toBe('2026-06-13T10:00:00.000Z');
    expect(serialized.callActivity.answeredAt).toBe('2026-06-13T10:00:05.000Z');
    expect(serialized.callActivity.endedAt).toBe('2026-06-13T10:02:10.000Z');
    expect(serializedText).not.toMatch(/sdp|ice|candidate|device|microphone|camera|token|cookie/);
  });

  it('does not create missed-call activity when the callee never received the incoming call', async () => {
    const scenario = await setupCallActivityScenario();
    const session = await createEndedSession({
      ...scenario,
      overrides: {
        callId: 'call-missed-unreached',
        mode: 'audio',
        status: 'missed',
        endedReason: 'missed',
        answeredAt: undefined,
        durationSeconds: undefined,
        deliveredTo: [],
      },
    });

    await expect(createCallActivityForSession(session)).resolves.toBeNull();
    await expect(Message.countDocuments({
      chatId: scenario.chat._id,
      messageType: 'call',
      'callActivity.callId': session.callId,
    })).resolves.toBe(0);
  });
});

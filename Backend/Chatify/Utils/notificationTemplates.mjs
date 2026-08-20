export const NOTIFICATION_TEMPLATE_KEYS = Object.freeze({
  MESSAGE_GENERIC: 'message.generic',
  MESSAGE_ENCRYPTED: 'message.encrypted',
  MESSAGE_CHANNEL_GENERIC: 'message.channel.generic',
});

export const NOTIFICATION_CONTEXT_KINDS = Object.freeze({
  DIRECT: 'direct',
  GROUP: 'group',
  SPACE_CHANNEL: 'space_channel',
});

const NOTIFICATION_CONTEXT_KIND_VALUES = Object.values(NOTIFICATION_CONTEXT_KINDS);

const normalizeContextText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
};

export const serializeNotificationContext = (context = {}) => {
  const conversationKind = NOTIFICATION_CONTEXT_KIND_VALUES.includes(context.conversationKind)
    ? context.conversationKind
    : null;
  const serialized = {};

  if (conversationKind) {
    serialized.conversationKind = conversationKind;
  }

  const spaceId = normalizeContextText(context.spaceId, 48);
  const channelId = normalizeContextText(context.channelId, 48);
  const channelName = normalizeContextText(context.channelName, 80);

  if (spaceId) {
    serialized.spaceId = spaceId;
  }

  if (channelId) {
    serialized.channelId = channelId;
  }

  if (channelName) {
    serialized.channelName = channelName;
  }

  return serialized;
};

export const buildMessageNotificationTemplate = () => ({
  templateKey: NOTIFICATION_TEMPLATE_KEYS.MESSAGE_GENERIC,
  title: 'New Chatify message',
  body: 'Open Chatify to read it.',
  subject: 'New Chatify message',
  textContent: 'You have a new Chatify message. Open Chatify to read it.',
  htmlContent: '<p>You have a new Chatify message.</p><p>Open Chatify to read it.</p>',
});

export const buildEncryptedMessageNotificationTemplate = () => ({
  templateKey: NOTIFICATION_TEMPLATE_KEYS.MESSAGE_ENCRYPTED,
  title: 'New encrypted Chatify message',
  body: 'Open Chatify on a device with the conversation secret to read it.',
  subject: 'New encrypted Chatify message',
  textContent: 'You have a new encrypted Chatify message. Open Chatify on a device with the conversation secret to read it.',
  htmlContent: '<p>You have a new encrypted Chatify message.</p><p>Open Chatify on a device with the conversation secret to read it.</p>',
});

export const buildChannelMessageNotificationTemplate = () => ({
  templateKey: NOTIFICATION_TEMPLATE_KEYS.MESSAGE_CHANNEL_GENERIC,
  title: 'New Chatify channel message',
  body: 'Open Chatify to read it.',
  subject: 'New Chatify channel message',
  textContent: 'You have a new Chatify channel message. Open Chatify to read it.',
  htmlContent: '<p>You have a new Chatify channel message.</p><p>Open Chatify to read it.</p>',
});

export const serializeOutboxPayload = (template, context = {}) => {
  const serializedContext = serializeNotificationContext(context);

  return {
    templateKey: template.templateKey,
    title: template.title,
    body: template.body,
    subject: template.subject,
    textContent: template.textContent,
    htmlContent: template.htmlContent,
    ...(Object.keys(serializedContext).length > 0 ? { context: serializedContext } : {}),
  };
};

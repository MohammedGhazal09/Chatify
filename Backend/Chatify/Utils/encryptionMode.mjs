export const CHAT_ENCRYPTION_MODES = Object.freeze({
  STANDARD: 'standard',
  E2EE_V1: 'e2ee_v1',
});

export const normalizeChatEncryptionMode = (value) => (
  value === CHAT_ENCRYPTION_MODES.E2EE_V1
    ? CHAT_ENCRYPTION_MODES.E2EE_V1
    : CHAT_ENCRYPTION_MODES.STANDARD
);

export const isEncryptedConversation = (value) => (
  normalizeChatEncryptionMode(value) === CHAT_ENCRYPTION_MODES.E2EE_V1
);

export const buildDirectChatKey = (members = [], encryptionMode = CHAT_ENCRYPTION_MODES.STANDARD) => {
  const memberKey = members
    .map((member) => member?.toString())
    .filter(Boolean)
    .sort()
    .join(":");

  if (!memberKey) {
    return "";
  }

  return normalizeChatEncryptionMode(encryptionMode) === CHAT_ENCRYPTION_MODES.E2EE_V1
    ? `${CHAT_ENCRYPTION_MODES.E2EE_V1}:${memberKey}`
    : memberKey;
};

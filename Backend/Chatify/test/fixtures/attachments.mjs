export const tinyPdfBuffer = () => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

export const tinyTextBuffer = (text = 'attachment fixture') => Buffer.from(text, 'utf8');

export const tinyVoiceBuffer = (text = 'voice fixture') => Buffer.from(text, 'utf8');

export const tinyDetectedWebmVoiceBuffer = () => Buffer.from([
  0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0xF7, 0x81,
  0x01, 0x42, 0xF2, 0x81, 0x04, 0x42, 0xF3, 0x81, 0x08, 0x42, 0x82, 0x84,
  0x77, 0x65, 0x62, 0x6D, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02,
]);

export const attachPdf = (request, filename = 'message-states-spec.pdf') => (
  request.attach('attachments', tinyPdfBuffer(), {
    filename,
    contentType: 'application/pdf',
  })
);

export const attachText = (request, filename = 'retry-logic-notes.txt', text = 'retry logic notes') => (
  request.attach('attachments', tinyTextBuffer(text), {
    filename,
    contentType: 'text/plain',
  })
);

export const attachVoice = (
  request,
  {
    filename = 'voice-message.webm',
    contentType = 'audio/webm;codecs=opus',
    durationSeconds = 2.5,
    text = 'voice fixture',
    buffer = tinyVoiceBuffer(text),
  } = {}
) => (
  request
    .field('attachmentMetadata', JSON.stringify([{ durationSeconds }]))
    .attach('attachments', buffer, {
      filename,
      contentType,
    })
);

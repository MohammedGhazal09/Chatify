export const tinyPdfBuffer = () => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

export const tinyTextBuffer = (text = 'attachment fixture') => Buffer.from(text, 'utf8');

export const tinyVoiceBuffer = (text = 'voice fixture') => Buffer.from(text, 'utf8');

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
  } = {}
) => (
  request
    .field('attachmentMetadata', JSON.stringify([{ durationSeconds }]))
    .attach('attachments', tinyVoiceBuffer(text), {
      filename,
      contentType,
    })
);

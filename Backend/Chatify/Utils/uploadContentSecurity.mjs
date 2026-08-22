const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_METADATA_MARKERS = new Set([0xe1, 0xed, 0xfe]);
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'XMP ']);
const SAFE_INLINE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
]);

const IMAGE_LIMITS = Object.freeze({
  attachment: Object.freeze({ maxWidth: 8_192, maxHeight: 8_192, maxPixels: 40_000_000 }),
  'profile-image': Object.freeze({ maxWidth: 4_096, maxHeight: 4_096, maxPixels: 16_000_000 }),
});

const ACTIVE_PDF_PATTERN = /\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|RichMedia|XFA)\b/i;
const ACTIVE_OFFICE_PATTERN = /(?:vbaProject\.bin|\/(?:embeddings|activeX|externalLinks)\/|oleObject|TargetMode\s*=\s*["']External["'])/i;
const ACTIVE_TEXT_PATTERN = /(?:<\s*(?:script|html|svg|iframe|object|embed)\b|<!doctype\s+html|javascript\s*:|data\s*:\s*text\/html)/i;
const SPREADSHEET_FORMULA_PATTERN = /(?:^|[\r\n])\s*[=+@]\s*(?:cmd|powershell|hyperlink|webservice|dde|http|https|file|\\\\)/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const failure = (code, message) => ({
  ok: false,
  code,
  message,
  statusCode: 400,
});

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0
        ? 0xedb88320 ^ (value >>> 1)
        : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const buildPngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const hasNonPaddingBytes = (buffer) => buffer.some((byte) => ![
  0x00, 0x09, 0x0a, 0x0d, 0x20,
].includes(byte));

const validateDimensions = (dimensions, purpose) => {
  if (!dimensions) return failure('UPLOAD_IMAGE_MALFORMED', 'Image dimensions could not be verified');
  const { width, height } = dimensions;
  const limits = IMAGE_LIMITS[purpose] ?? IMAGE_LIMITS.attachment;
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width < 1
    || height < 1
  ) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'Image dimensions are invalid');
  }
  if (width > limits.maxWidth || height > limits.maxHeight || width * height > limits.maxPixels) {
    return failure('UPLOAD_IMAGE_DIMENSIONS_EXCEEDED', 'Image dimensions exceed the safe processing limit');
  }
  return { ok: true, width, height };
};

const sanitizePng = (buffer, purpose) => {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'PNG structure is invalid');
  }

  const chunks = [];
  let offset = 8;
  let dimensions = null;
  let iendEnd = null;
  let metadataStripped = false;
  let chunkCount = 0;

  while (offset + 12 <= buffer.length) {
    chunkCount += 1;
    if (chunkCount > 10_000) return failure('UPLOAD_IMAGE_MALFORMED', 'PNG has too many chunks');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) return failure('UPLOAD_IMAGE_MALFORMED', 'PNG chunk is truncated');
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      if (data.length !== 13 || dimensions) return failure('UPLOAD_IMAGE_MALFORMED', 'PNG IHDR is invalid');
      dimensions = { width: data.readUInt32BE(0), height: data.readUInt32BE(4) };
    }

    if (PNG_METADATA_CHUNKS.has(type)) {
      metadataStripped = true;
    } else {
      chunks.push(buildPngChunk(type, data));
    }

    offset = chunkEnd;
    if (type === 'IEND') {
      iendEnd = chunkEnd;
      break;
    }
  }

  if (!dimensions || iendEnd === null) return failure('UPLOAD_IMAGE_MALFORMED', 'PNG is incomplete');
  if (iendEnd < buffer.length && hasNonPaddingBytes(buffer.subarray(iendEnd))) {
    return failure('UPLOAD_POLYGLOT_REJECTED', 'Image contains trailing active content');
  }

  const dimensionResult = validateDimensions(dimensions, purpose);
  if (!dimensionResult.ok) return dimensionResult;

  return {
    ok: true,
    buffer: Buffer.concat([PNG_SIGNATURE, ...chunks]),
    dimensions,
    metadataStripped,
  };
};

const isStandaloneJpegMarker = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);
const isSofMarker = (marker) => (
  (marker >= 0xc0 && marker <= 0xc3)
  || (marker >= 0xc5 && marker <= 0xc7)
  || (marker >= 0xc9 && marker <= 0xcb)
  || (marker >= 0xcd && marker <= 0xcf)
);

const sanitizeJpeg = (buffer, purpose) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG structure is invalid');
  }

  const segments = [buffer.subarray(0, 2)];
  let offset = 2;
  let dimensions = null;
  let metadataStripped = false;
  let sawEnd = false;

  while (offset < buffer.length) {
    const markerStart = offset;
    if (buffer[offset] !== 0xff) return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG marker is invalid');
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG marker is truncated');
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9) {
      segments.push(buffer.subarray(markerStart, offset));
      sawEnd = true;
      if (offset < buffer.length && hasNonPaddingBytes(buffer.subarray(offset))) {
        return failure('UPLOAD_POLYGLOT_REJECTED', 'Image contains trailing active content');
      }
      break;
    }

    if (isStandaloneJpegMarker(marker)) {
      segments.push(buffer.subarray(markerStart, offset));
      continue;
    }

    if (offset + 2 > buffer.length) return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG segment is truncated');
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) {
      return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG segment length is invalid');
    }
    const segmentEnd = offset + length;

    if (isSofMarker(marker) && length >= 7) {
      dimensions = {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    if (marker === 0xda) {
      const eoiIndex = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
      if (eoiIndex < segmentEnd - 2) return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG scan is incomplete');
      segments.push(buffer.subarray(markerStart, eoiIndex + 2));
      sawEnd = true;
      if (eoiIndex + 2 < buffer.length && hasNonPaddingBytes(buffer.subarray(eoiIndex + 2))) {
        return failure('UPLOAD_POLYGLOT_REJECTED', 'Image contains trailing active content');
      }
      break;
    }

    if (JPEG_METADATA_MARKERS.has(marker)) {
      metadataStripped = true;
    } else {
      segments.push(buffer.subarray(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }

  if (!sawEnd) return failure('UPLOAD_IMAGE_MALFORMED', 'JPEG is incomplete');
  const dimensionResult = validateDimensions(dimensions, purpose);
  if (!dimensionResult.ok) return dimensionResult;

  return {
    ok: true,
    buffer: Buffer.concat(segments),
    dimensions,
    metadataStripped,
  };
};

const readUint24LE = (buffer, offset) => (
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
);

const getWebpDimensions = (type, data) => {
  if (type === 'VP8X' && data.length >= 10) {
    return {
      width: readUint24LE(data, 4) + 1,
      height: readUint24LE(data, 7) + 1,
    };
  }
  if (type === 'VP8 ' && data.length >= 10) {
    const signatureIndex = data.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
    if (signatureIndex >= 0 && signatureIndex + 7 <= data.length) {
      return {
        width: data.readUInt16LE(signatureIndex + 3) & 0x3fff,
        height: data.readUInt16LE(signatureIndex + 5) & 0x3fff,
      };
    }
  }
  if (type === 'VP8L' && data.length >= 5 && data[0] === 0x2f) {
    const bits = data.readUInt32LE(1);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  return null;
};

const buildWebpChunk = (type, data) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length, 0);
  return Buffer.concat([
    Buffer.from(type, 'ascii'),
    size,
    data,
    data.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0),
  ]);
};

const sanitizeWebp = (buffer, purpose) => {
  if (
    buffer.length < 20
    || buffer.subarray(0, 4).toString('ascii') !== 'RIFF'
    || buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'WebP structure is invalid');
  }

  const declaredEnd = buffer.readUInt32LE(4) + 8;
  if (declaredEnd > buffer.length) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'WebP container length exceeds the received bytes');
  }
  if (declaredEnd < buffer.length && hasNonPaddingBytes(buffer.subarray(declaredEnd))) {
    return failure('UPLOAD_POLYGLOT_REJECTED', 'Image contains trailing active content');
  }

  const chunks = [];
  let offset = 12;
  let dimensions = null;
  let metadataStripped = false;

  while (offset + 8 <= declaredEnd) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    const chunkEnd = dataEnd + (size % 2);
    if (chunkEnd > declaredEnd) return failure('UPLOAD_IMAGE_MALFORMED', 'WebP chunk is truncated');
    let data = Buffer.from(buffer.subarray(dataStart, dataEnd));
    dimensions ??= getWebpDimensions(type, data);

    if (WEBP_METADATA_CHUNKS.has(type)) {
      metadataStripped = true;
    } else {
      if (type === 'VP8X' && metadataStripped === false && data.length >= 1) {
        data = Buffer.from(data);
      }
      chunks.push({ type, data });
    }
    offset = chunkEnd;
  }

  if (offset !== declaredEnd) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'WebP container has incomplete trailing bytes');
  }

  if (metadataStripped) {
    const vp8x = chunks.find((chunk) => chunk.type === 'VP8X');
    if (vp8x?.data?.length >= 1) vp8x.data[0] &= ~0x0c;
  }

  const dimensionResult = validateDimensions(dimensions, purpose);
  if (!dimensionResult.ok) return dimensionResult;
  const chunkBuffers = chunks.map((chunk) => buildWebpChunk(chunk.type, chunk.data));
  const payload = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunkBuffers]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(payload.length, 0);

  return {
    ok: true,
    buffer: Buffer.concat([Buffer.from('RIFF', 'ascii'), size, payload]),
    dimensions,
    metadataStripped,
  };
};

const sanitizeGif = (buffer, purpose) => {
  if (buffer.length < 14 || !['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
    return failure('UPLOAD_IMAGE_MALFORMED', 'GIF structure is invalid');
  }
  const trailer = buffer.lastIndexOf(0x3b);
  if (trailer < 0) return failure('UPLOAD_IMAGE_MALFORMED', 'GIF is incomplete');
  if (trailer + 1 < buffer.length && hasNonPaddingBytes(buffer.subarray(trailer + 1))) {
    return failure('UPLOAD_POLYGLOT_REJECTED', 'Image contains trailing active content');
  }
  const dimensions = { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  const dimensionResult = validateDimensions(dimensions, purpose);
  if (!dimensionResult.ok) return dimensionResult;
  return {
    ok: true,
    buffer: buffer.subarray(0, trailer + 1),
    dimensions,
    metadataStripped: false,
  };
};

const sanitizeImage = ({ buffer, mimeType, purpose }) => {
  if (mimeType === 'image/png') return sanitizePng(buffer, purpose);
  if (mimeType === 'image/jpeg') return sanitizeJpeg(buffer, purpose);
  if (mimeType === 'image/webp') return sanitizeWebp(buffer, purpose);
  if (mimeType === 'image/gif') return sanitizeGif(buffer, purpose);
  return failure('UPLOAD_IMAGE_MALFORMED', 'Image type is not supported');
};

const validatePdf = (buffer) => {
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'))) {
    return failure('UPLOAD_DOCUMENT_MALFORMED', 'PDF signature is invalid');
  }
  const text = buffer.toString('latin1');
  if (ACTIVE_PDF_PATTERN.test(text)) {
    return failure('UPLOAD_ACTIVE_CONTENT_REJECTED', 'PDF contains active or embedded content');
  }
  return { ok: true, buffer, dimensions: null, metadataStripped: false };
};

const validateOfficeDocument = (buffer) => {
  if (buffer.length < 4 || !buffer.subarray(0, 2).equals(Buffer.from('PK', 'ascii'))) {
    return failure('UPLOAD_DOCUMENT_MALFORMED', 'Office document container is invalid');
  }
  const text = buffer.toString('latin1');
  if (ACTIVE_OFFICE_PATTERN.test(text)) {
    return failure('UPLOAD_ACTIVE_CONTENT_REJECTED', 'Office document contains macros, embedded objects, or external links');
  }
  return { ok: true, buffer, dimensions: null, metadataStripped: false };
};

const validateTextDocument = (buffer, extension) => {
  if (buffer.includes(0)) return failure('UPLOAD_TEXT_INVALID', 'Text attachment contains binary content');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return failure('UPLOAD_TEXT_INVALID', 'Text attachment is not valid UTF-8');
  }
  if (ACTIVE_TEXT_PATTERN.test(text)) {
    return failure('UPLOAD_ACTIVE_CONTENT_REJECTED', 'Text attachment contains active browser content');
  }
  if (extension === 'csv' && SPREADSHEET_FORMULA_PATTERN.test(text)) {
    return failure('UPLOAD_ACTIVE_CONTENT_REJECTED', 'CSV attachment contains an unsafe spreadsheet formula');
  }
  return { ok: true, buffer, dimensions: null, metadataStripped: false };
};

export const validateAndSanitizeUploadContent = async ({
  buffer,
  mimeType,
  extension = '',
  purpose = 'attachment',
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return failure('UPLOAD_EMPTY', 'Upload is empty');
  }
  const normalizedMime = String(mimeType ?? '').split(';')[0].trim().toLowerCase();
  const normalizedExtension = String(extension ?? '').replace(/^\./, '').trim().toLowerCase();

  let result;
  if (normalizedMime.startsWith('image/')) {
    result = sanitizeImage({ buffer, mimeType: normalizedMime, purpose });
  } else if (normalizedMime === 'application/pdf' || normalizedExtension === 'pdf') {
    result = validatePdf(buffer);
  } else if (normalizedExtension === 'docx' || normalizedExtension === 'xlsx') {
    result = validateOfficeDocument(buffer);
  } else if (normalizedExtension === 'txt' || normalizedExtension === 'csv' || normalizedMime.startsWith('text/')) {
    result = validateTextDocument(buffer, normalizedExtension);
  } else {
    result = { ok: true, buffer, dimensions: null, metadataStripped: false };
  }

  if (!result.ok) return result;
  return {
    ...result,
    size: result.buffer.length,
    inlineAllowed: SAFE_INLINE_MIME_TYPES.has(normalizedMime),
  };
};

const sanitizeDownloadName = (value) => {
  const raw = String(value ?? 'attachment')
    .replace(CONTROL_CHARS, '')
    .replace(/[\\/]/g, '_')
    .replace(/[";]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return (raw || 'attachment').slice(0, 140);
};

export const buildSecureUploadHeaders = ({
  mimeType,
  displayName,
  mode = 'download',
} = {}) => {
  const normalizedMime = String(mimeType ?? 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const filename = sanitizeDownloadName(displayName);
  const disposition = mode === 'preview' && SAFE_INLINE_MIME_TYPES.has(normalizedMime)
    ? 'inline'
    : 'attachment';

  return {
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${disposition}; filename="${filename}"`,
  };
};
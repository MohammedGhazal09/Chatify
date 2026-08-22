import path from 'node:path';
import { TextDecoder } from 'node:util';

export const MAX_UPLOAD_IMAGE_DIMENSION = 10_000;
export const MAX_UPLOAD_IMAGE_PIXELS = 40_000_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_LOCAL_FILE_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_END_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const UPLOAD_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const BIDI_CONTROL_PATTERN = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const ACTIVE_INNER_EXTENSIONS = new Set([
  'asp', 'aspx', 'bat', 'cjs', 'cmd', 'com', 'exe', 'hta', 'htm', 'html',
  'jar', 'js', 'jsp', 'mjs', 'msi', 'php', 'ps1', 'scr', 'sh', 'svg',
  'xhtml', 'xml', 'docm', 'dotm', 'xlsm', 'xltm', 'pptm', 'potm',
]);
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'iCCP', 'iTXt', 'tEXt', 'tIME', 'zTXt']);
const JPEG_METADATA_MARKERS = new Set([0xe1, 0xe2, 0xed, 0xfe]);
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'ICCP', 'XMP ']);
const PDF_ACTIVE_PATTERNS = [
  /\/AA\b/i,
  /\/AcroForm\b/i,
  /\/EmbeddedFile\b/i,
  /\/ImportData\b/i,
  /\/JavaScript\b/i,
  /\/JS\b/i,
  /\/Launch\b/i,
  /\/OpenAction\b/i,
  /\/RichMedia\b/i,
  /\/SubmitForm\b/i,
  /\/XFA\b/i,
];

const asBuffer = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value ?? []);
const fail = (reason) => ({ ok: false, reason });
const pass = (details = {}) => ({ ok: true, ...details });

const validateDimensions = (width, height) => {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    return fail('malformed');
  }

  if (
    width > MAX_UPLOAD_IMAGE_DIMENSION
    || height > MAX_UPLOAD_IMAGE_DIMENSION
    || width * height > MAX_UPLOAD_IMAGE_PIXELS
  ) {
    return fail('dimensions');
  }

  return pass({ width, height });
};

const parsePng = (input) => {
  const buffer = asBuffer(input);

  if (buffer.length < PNG_SIGNATURE.length + 25 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return fail('malformed');
  }

  let offset = 8;
  let dimensions = null;
  let sawImageData = false;
  let sawIend = false;
  let metadataRemoved = false;
  const retainedChunks = [PNG_SIGNATURE];

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) return fail('malformed');

    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;

    if (length > buffer.length || dataEnd < dataStart || chunkEnd > buffer.length) {
      return fail('malformed');
    }

    const type = buffer.subarray(typeStart, dataStart).toString('ascii');
    const data = buffer.subarray(dataStart, dataEnd);

    if (!/^[A-Za-z]{4}$/.test(type)) return fail('malformed');

    if (type === 'IHDR') {
      if (dimensions || length !== 13 || offset !== 8) return fail('malformed');
      dimensions = validateDimensions(data.readUInt32BE(0), data.readUInt32BE(4));
      if (!dimensions.ok) return dimensions;
    } else if (!dimensions) {
      return fail('malformed');
    }

    if (type === 'IDAT') sawImageData = true;

    if (type === 'IEND') {
      if (length !== 0 || !dimensions || !sawImageData) return fail('malformed');
      sawIend = true;
      retainedChunks.push(buffer.subarray(offset, chunkEnd));
      if (chunkEnd !== buffer.length) return fail('polyglot');
      offset = chunkEnd;
      break;
    }

    if (PNG_METADATA_CHUNKS.has(type)) {
      metadataRemoved = true;
    } else {
      retainedChunks.push(buffer.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  if (!sawIend || !dimensions || offset !== buffer.length) return fail('malformed');

  return pass({
    buffer: metadataRemoved ? Buffer.concat(retainedChunks) : buffer,
    width: dimensions.width,
    height: dimensions.height,
    metadataRemoved,
    imageType: 'png',
  });
};

const isStandaloneJpegMarker = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
const isJpegSofMarker = (marker) => (
  (marker >= 0xc0 && marker <= 0xc3)
  || (marker >= 0xc5 && marker <= 0xc7)
  || (marker >= 0xc9 && marker <= 0xcb)
  || (marker >= 0xcd && marker <= 0xcf)
);

const parseJpeg = (input) => {
  const buffer = asBuffer(input);

  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return fail('malformed');
  }

  const retained = [buffer.subarray(0, 2)];
  let offset = 2;
  let dimensions = null;
  let metadataRemoved = false;
  let completed = false;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return fail('malformed');

    const markerStart = offset;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return fail('malformed');

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9) {
      retained.push(buffer.subarray(markerStart, offset));
      if (offset !== buffer.length) return fail('polyglot');
      completed = true;
      break;
    }

    if (marker === 0xd8 || isStandaloneJpegMarker(marker)) {
      retained.push(buffer.subarray(markerStart, offset));
      continue;
    }

    if (offset + 2 > buffer.length) return fail('malformed');
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2) return fail('malformed');
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > buffer.length) return fail('malformed');

    if (isJpegSofMarker(marker)) {
      if (segmentLength < 7) return fail('malformed');
      dimensions = validateDimensions(
        buffer.readUInt16BE(offset + 5),
        buffer.readUInt16BE(offset + 3)
      );
      if (!dimensions.ok) return dimensions;
    }

    if (marker === 0xda) {
      retained.push(buffer.subarray(markerStart, segmentEnd));
      const eoiOffset = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
      if (eoiOffset < segmentEnd || eoiOffset + 2 !== buffer.length) {
        return eoiOffset >= 0 ? fail('polyglot') : fail('malformed');
      }
      retained.push(buffer.subarray(segmentEnd, buffer.length));
      completed = true;
      offset = buffer.length;
      break;
    }

    if (JPEG_METADATA_MARKERS.has(marker)) {
      metadataRemoved = true;
    } else {
      retained.push(buffer.subarray(markerStart, segmentEnd));
    }

    offset = segmentEnd;
  }

  if (!completed || !dimensions) return fail('malformed');

  return pass({
    buffer: metadataRemoved ? Buffer.concat(retained) : buffer,
    width: dimensions.width,
    height: dimensions.height,
    metadataRemoved,
    imageType: 'jpeg',
  });
};

const skipGifSubBlocks = (buffer, start) => {
  let offset = start;

  while (offset < buffer.length) {
    const size = buffer[offset];
    offset += 1;
    if (size === 0) return offset;
    if (offset + size > buffer.length) return null;
    offset += size;
  }

  return null;
};

const parseGif = (input) => {
  const buffer = asBuffer(input);
  const signature = buffer.subarray(0, 6).toString('ascii');

  if (buffer.length < 14 || !['GIF87a', 'GIF89a'].includes(signature)) {
    return fail('malformed');
  }

  const dimensions = validateDimensions(buffer.readUInt16LE(6), buffer.readUInt16LE(8));
  if (!dimensions.ok) return dimensions;

  let offset = 13;
  const globalColorTableFlag = (buffer[10] & 0x80) !== 0;
  if (globalColorTableFlag) {
    offset += 3 * (2 ** ((buffer[10] & 0x07) + 1));
  }
  if (offset > buffer.length) return fail('malformed');

  while (offset < buffer.length) {
    const marker = buffer[offset];

    if (marker === 0x3b) {
      if (offset + 1 !== buffer.length) return fail('polyglot');
      return pass({
        buffer,
        width: dimensions.width,
        height: dimensions.height,
        metadataRemoved: false,
        imageType: 'gif',
      });
    }

    if (marker === 0x21) {
      if (offset + 2 > buffer.length) return fail('malformed');
      const nextOffset = skipGifSubBlocks(buffer, offset + 2);
      if (nextOffset === null) return fail('malformed');
      offset = nextOffset;
      continue;
    }

    if (marker === 0x2c) {
      if (offset + 10 > buffer.length) return fail('malformed');
      const localColorTableFlag = (buffer[offset + 9] & 0x80) !== 0;
      offset += 10;
      if (localColorTableFlag) {
        offset += 3 * (2 ** ((buffer[offset - 1] & 0x07) + 1));
      }
      if (offset + 1 > buffer.length) return fail('malformed');
      offset += 1;
      const nextOffset = skipGifSubBlocks(buffer, offset);
      if (nextOffset === null) return fail('malformed');
      offset = nextOffset;
      continue;
    }

    return fail('malformed');
  }

  return fail('malformed');
};

const readUInt24LE = (buffer, offset) => (
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
);

const parseWebpDimensions = (type, data) => {
  if (type === 'VP8X') {
    if (data.length < 10) return fail('malformed');
    return validateDimensions(
      readUInt24LE(data, 4) + 1,
      readUInt24LE(data, 7) + 1
    );
  }

  if (type === 'VP8 ') {
    if (data.length < 10 || !data.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      return fail('malformed');
    }
    return validateDimensions(
      data.readUInt16LE(6) & 0x3fff,
      data.readUInt16LE(8) & 0x3fff
    );
  }

  if (type === 'VP8L') {
    if (data.length < 5 || data[0] !== 0x2f) return fail('malformed');
    const bits = data.readUInt32LE(1);
    return validateDimensions(
      (bits & 0x3fff) + 1,
      ((bits >>> 14) & 0x3fff) + 1
    );
  }

  return null;
};

const makeRiff = (chunks) => {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 4, 'ascii');
  return Buffer.concat([header, body]);
};

const parseWebp = (input) => {
  const inputBuffer = asBuffer(input);

  if (
    inputBuffer.length < 20
    || inputBuffer.subarray(0, 4).toString('ascii') !== 'RIFF'
    || inputBuffer.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return fail('malformed');
  }

  const declaredSize = inputBuffer.readUInt32LE(4) + 8;
  if (declaredSize > inputBuffer.length || declaredSize < 20) return fail('malformed');

  const trailing = inputBuffer.subarray(declaredSize);
  if (trailing.length > 3 || trailing.some((byte) => byte !== 0)) return fail('polyglot');
  const buffer = inputBuffer.subarray(0, declaredSize);

  let offset = 12;
  let dimensions = null;
  let metadataRemoved = false;
  const retainedChunks = [];

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) return fail('malformed');
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    const paddedEnd = dataEnd + (size % 2);

    if (dataEnd < dataStart || paddedEnd > buffer.length) return fail('malformed');
    const data = buffer.subarray(dataStart, dataEnd);
    const candidateDimensions = parseWebpDimensions(type, data);
    if (candidateDimensions) {
      if (!candidateDimensions.ok) return candidateDimensions;
      dimensions ??= candidateDimensions;
    }

    if (WEBP_METADATA_CHUNKS.has(type)) {
      metadataRemoved = true;
    } else {
      const chunk = Buffer.from(buffer.subarray(offset, paddedEnd));
      if (type === 'VP8X' && chunk.length >= 18) chunk[8] &= ~0x2c;
      retainedChunks.push(chunk);
    }

    offset = paddedEnd;
  }

  if (!dimensions || offset !== buffer.length) return fail('malformed');

  return pass({
    buffer: metadataRemoved ? makeRiff(retainedChunks) : buffer,
    width: dimensions.width,
    height: dimensions.height,
    metadataRemoved,
    imageType: 'webp',
  });
};

export const inspectImageUpload = ({ buffer: input, mimeType = '' }) => {
  const buffer = asBuffer(input);
  let result;

  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    result = parsePng(buffer);
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    result = parseJpeg(buffer);
  } else if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
    result = parseGif(buffer);
  } else if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    result = parseWebp(buffer);
  } else {
    return fail('malformed');
  }

  if (!result.ok) return result;

  const expectedMime = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  }[result.imageType];

  if (mimeType && expectedMime && mimeType !== expectedMime) return fail('malformed');
  return { ...result, mimeType: expectedMime };
};

export const inspectPdfUpload = (input) => {
  const buffer = asBuffer(input);
  if (buffer.length < 16 || !buffer.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'))) {
    return fail('malformed');
  }

  const text = buffer.toString('latin1');
  const eofOffset = text.lastIndexOf('%%EOF');
  if (eofOffset < 0 || !/\d+\s+\d+\s+obj\b/i.test(text)) return fail('malformed');

  const trailing = text.slice(eofOffset + 5);
  if (!/^\s*$/.test(trailing)) return fail('polyglot');
  if (PDF_ACTIVE_PATTERNS.some((pattern) => pattern.test(text))) return fail('active');

  return pass({ buffer, metadataRemoved: false });
};

export const inspectTextUpload = (input) => {
  const buffer = asBuffer(input);
  if (buffer.includes(0x00)) return fail('text');

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return fail('text');
  }

  return pass({ buffer, metadataRemoved: false });
};

const containsAscii = (buffer, value) => buffer.indexOf(Buffer.from(value, 'ascii')) >= 0;

export const inspectDocumentUpload = ({ buffer: input, extension }) => {
  const buffer = asBuffer(input);
  const normalizedExtension = String(extension ?? '').toLowerCase();

  if (['doc', 'xls'].includes(normalizedExtension)) {
    return buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE)
      ? pass({ buffer, metadataRemoved: false })
      : fail('container');
  }

  if (!['docx', 'xlsx'].includes(normalizedExtension)) return fail('container');
  if (!buffer.subarray(0, 4).equals(ZIP_LOCAL_FILE_SIGNATURE)) return fail('container');
  if (buffer.lastIndexOf(ZIP_END_SIGNATURE) < 0) return fail('container');
  if (!containsAscii(buffer, '[Content_Types].xml')) return fail('container');

  const expectedRoot = normalizedExtension === 'docx' ? 'word/' : 'xl/';
  if (!containsAscii(buffer, expectedRoot)) return fail('container');
  if (
    containsAscii(buffer, 'vbaProject.bin')
    || containsAscii(buffer, 'application/vnd.ms-office.vbaProject')
    || containsAscii(buffer, '<script')
  ) {
    return fail('active');
  }

  return pass({ buffer, metadataRemoved: false });
};

export const inspectVoiceUpload = ({ buffer: input, extension }) => {
  const buffer = asBuffer(input);
  const normalizedExtension = String(extension ?? '').toLowerCase();

  if (normalizedExtension === 'webm') {
    if (!buffer.subarray(0, WEBM_SIGNATURE.length).equals(WEBM_SIGNATURE)) return fail('container');
    if (!buffer.subarray(0, Math.min(buffer.length, 256)).includes(Buffer.from('webm', 'ascii'))) {
      return fail('container');
    }
    return pass({ buffer, container: 'webm' });
  }

  if (['ogg', 'opus'].includes(normalizedExtension)) {
    if (buffer.length < 27 || buffer.subarray(0, 4).toString('ascii') !== 'OggS' || buffer[4] !== 0) {
      return fail('container');
    }
    return pass({ buffer, container: 'ogg' });
  }

  return fail('container');
};

export const isDeceptiveUploadFilename = (filename) => {
  if (typeof filename !== 'string') return true;

  const normalized = filename.normalize('NFKC').trim();
  if (
    normalized.length < 1
    || normalized.length > 255
    || UPLOAD_CONTROL_PATTERN.test(normalized)
    || BIDI_CONTROL_PATTERN.test(normalized)
    || normalized.includes('/')
    || normalized.includes('\\')
    || path.basename(normalized) !== normalized
    || normalized === '.'
    || normalized === '..'
  ) {
    return true;
  }

  const segments = normalized.toLowerCase().split('.').filter(Boolean);
  return segments.slice(0, -1).some((segment) => ACTIVE_INNER_EXTENSIONS.has(segment));
};

export const sanitizeUploadFilename = (filename, fallback = 'attachment') => {
  const normalized = typeof filename === 'string'
    ? filename.normalize('NFKC').trim()
    : '';
  const basename = path.basename(normalized.replace(/[\\/]+/g, '_'));
  const withoutControls = basename
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, '')
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '')
    .replace(/[^a-zA-Z0-9._()\- ]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 180)
    .trim();

  return withoutControls || fallback;
};

const encodeDispositionFilename = (filename) => encodeURIComponent(filename)
  .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

export const buildPrivateFileHeaders = ({
  disposition = 'attachment',
  filename = 'attachment',
  mimeType = 'application/octet-stream',
  size,
} = {}) => {
  const safeDisposition = disposition === 'inline' ? 'inline' : 'attachment';
  const safeFilename = sanitizeUploadFilename(filename);
  const asciiFilename = safeFilename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const headers = {
    'Content-Type': mimeType,
    'Content-Disposition': `${safeDisposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodeDispositionFilename(safeFilename)}`,
    'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };

  if (Number.isSafeInteger(size) && size >= 0) headers['Content-Length'] = String(size);
  return headers;
};

import { inflateRawSync } from 'node:zlib';

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const MAX_ZIP_COMMENT_BYTES = 65_535;
const MAX_ARCHIVE_ENTRIES = 500;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_INSPECTED_XML_BYTES = 2 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MIN_RATIO_CHECK_BYTES = 1024 * 1024;

const ACTIVE_ENTRY_PATTERN = /(?:^|\/)(?:vbaProject\.bin|embeddings\/|activeX\/|externalLinks\/|oleObject\d*\.(?:bin|xml)|customUI\/)/i;
const ACTIVE_XML_PATTERN = /(?:TargetMode\s*=\s*["']External["']|<(?:\w+:)?(?:oleObject|object|script)\b|\b(?:DDEAUTO|INCLUDETEXT|INCLUDEPICTURE)\b|application\/vnd\.ms-office\.vbaProject)/i;

const failure = (code, message) => ({
  ok: false,
  code,
  message,
  statusCode: 400,
});

const findEndOfCentralDirectory = (buffer) => {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const minimumOffset = Math.max(0, buffer.length - (22 + MAX_ZIP_COMMENT_BYTES));
  const offset = buffer.lastIndexOf(signature);
  return offset >= minimumOffset ? offset : -1;
};

const decodeEntryName = (buffer, utf8) => buffer.toString(utf8 ? 'utf8' : 'latin1');

const normalizeEntryName = (value) => value.replace(/\\/g, '/');

const hasUnsafeArchivePath = (name) => {
  if (!name || name.includes('\0') || name.startsWith('/') || /^[a-z]:\//i.test(name)) {
    return true;
  }
  return name.split('/').some((segment) => segment === '..');
};

const isInspectableXml = (name) => (
  name.toLowerCase() === '[content_types].xml'
  || name.toLowerCase().endsWith('.xml')
  || name.toLowerCase().endsWith('.rels')
);

const readCentralDirectory = (buffer) => {
  const endOffset = findEndOfCentralDirectory(buffer);
  if (endOffset < 0 || endOffset + 22 > buffer.length) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document ZIP directory is missing');
  }

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDiskNumber = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  const commentLength = buffer.readUInt16LE(endOffset + 20);

  if (
    diskNumber !== 0
    || centralDiskNumber !== 0
    || entriesOnDisk !== entryCount
    || entryCount === 0xffff
    || centralSize === 0xffffffff
    || centralOffset === 0xffffffff
  ) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Multi-disk and ZIP64 office documents are not accepted');
  }
  if (entryCount < 1 || entryCount > MAX_ARCHIVE_ENTRIES) {
    return failure('UPLOAD_ARCHIVE_BOMB_REJECTED', 'Office document contains too many archive entries');
  }
  if (endOffset + 22 + commentLength > buffer.length) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document ZIP comment is truncated');
  }
  if (centralOffset + centralSize > endOffset || centralOffset < 0) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document ZIP directory is invalid');
  }

  const entries = [];
  const names = new Set();
  let offset = centralOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralOffset + centralSize || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_FILE_SIGNATURE) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document central directory entry is invalid');
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const diskStart = buffer.readUInt16LE(offset + 34);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + nameLength + extraLength + commentSize;

    if (entryEnd > centralOffset + centralSize || nameLength < 1) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document archive entry is truncated');
    }
    if (diskStart !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'ZIP64 office document entries are not accepted');
    }
    if ((flags & 0x0001) !== 0) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Encrypted office document entries are not accepted');
    }
    if (![0, 8].includes(method)) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document uses an unsupported compression method');
    }

    const rawName = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = normalizeEntryName(decodeEntryName(rawName, (flags & 0x0800) !== 0));

    if (hasUnsafeArchivePath(name)) {
      return failure('UPLOAD_ARCHIVE_PATH_REJECTED', 'Office document contains an unsafe archive path');
    }
    if (names.has(name.toLowerCase())) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document contains duplicate archive entries');
    }
    names.add(name.toLowerCase());

    totalUncompressed += uncompressedSize;
    if (!Number.isSafeInteger(totalUncompressed) || totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      return failure('UPLOAD_ARCHIVE_BOMB_REJECTED', 'Office document expands beyond the safe archive limit');
    }
    if (
      uncompressedSize >= MIN_RATIO_CHECK_BYTES
      && (compressedSize === 0 || uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO)
    ) {
      return failure('UPLOAD_ARCHIVE_BOMB_REJECTED', 'Office document compression ratio exceeds the safe limit');
    }

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = entryEnd;
  }

  if (offset !== centralOffset + centralSize) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document central directory size does not match its entries');
  }

  return { ok: true, entries, names };
};

const readEntryBytes = (buffer, entry) => {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_LOCAL_FILE_SIGNATURE) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document local archive entry is invalid');
  }

  const localMethod = buffer.readUInt16LE(offset + 8);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (localMethod !== entry.method || dataEnd > buffer.length) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document entry data is truncated');
  }

  const compressed = buffer.subarray(dataStart, dataEnd);
  if (entry.method === 0) {
    if (compressed.length !== entry.uncompressedSize) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Stored office document entry has an invalid size');
    }
    return { ok: true, buffer: Buffer.from(compressed) };
  }

  if (entry.uncompressedSize > MAX_INSPECTED_XML_BYTES) {
    return failure('UPLOAD_ARCHIVE_BOMB_REJECTED', 'Inspectable office document XML exceeds the safe limit');
  }

  try {
    const inflated = inflateRawSync(compressed, {
      maxOutputLength: Math.min(entry.uncompressedSize, MAX_INSPECTED_XML_BYTES),
    });
    if (inflated.length !== entry.uncompressedSize) {
      return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document entry size does not match its directory record');
    }
    return { ok: true, buffer: inflated };
  } catch {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document entry could not be decompressed safely');
  }
};

const getRequiredMainPart = (extension) => (
  extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml'
);

export const validateOfficeDocumentContainer = ({ buffer, extension } = {}) => {
  if (!Buffer.isBuffer(buffer) || !['docx', 'xlsx'].includes(extension)) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document container is invalid');
  }

  const directory = readCentralDirectory(buffer);
  if (!directory.ok) return directory;

  if (
    !directory.names.has('[content_types].xml')
    || !directory.names.has(getRequiredMainPart(extension))
  ) {
    return failure('UPLOAD_ARCHIVE_MALFORMED', 'Office document is missing required package parts');
  }

  for (const entry of directory.entries) {
    if (ACTIVE_ENTRY_PATTERN.test(entry.name)) {
      return failure('UPLOAD_ACTIVE_CONTENT_REJECTED', 'Office document contains macros, embedded objects, or external-link parts');
    }

    if (!isInspectableXml(entry.name)) continue;
    const content = readEntryBytes(buffer, entry);
    if (!content.ok) return content;

    const text = content.buffer.toString('utf8');
    if (ACTIVE_XML_PATTERN.test(text)) {
      return failure('UPLOAD_ACTIVE_CONTENT_REJECTED', 'Office document XML contains active or externally linked content');
    }
  }

  return {
    ok: true,
    buffer,
    entryCount: directory.entries.length,
  };
};

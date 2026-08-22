import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_ERROR_CODES,
  validateIncomingAttachments,
} from '../../Utils/attachmentValidation.mjs';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const buildZip = (entries) => {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const plain = Buffer.from(entry.content ?? '', 'utf8');
    const method = entry.compress === false ? 0 : 8;
    const compressed = method === 8 ? deflateRawSync(plain) : plain;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(plain.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(plain.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);

    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
};

const makeDocxFile = (buffer, name = 'document.docx') => ({
  originalname: name,
  mimetype: DOCX_MIME,
  size: buffer.length,
  buffer,
});

const baseEntries = [
  {
    name: '[Content_Types].xml',
    content: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  },
  {
    name: 'word/document.xml',
    content: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  },
];

describe('Phase 11 OOXML container security', () => {
  it('accepts a bounded, inactive DOCX ZIP container', async () => {
    const result = await validateIncomingAttachments([
      makeDocxFile(buildZip(baseEntries)),
    ]);

    expect(result).toMatchObject({
      ok: true,
      attachments: [
        expect.objectContaining({
          mimeType: DOCX_MIME,
          originalExtension: 'docx',
        }),
      ],
    });
  });

  it('rejects external OOXML relationships and embedded active objects', async () => {
    const externalRelationship = buildZip([
      ...baseEntries,
      {
        name: 'word/_rels/document.xml.rels',
        content: '<Relationships><Relationship TargetMode="External" Target="http://169.254.169.254/latest/meta-data"/></Relationships>',
      },
    ]);
    const embeddedObject = buildZip([
      ...baseEntries,
      { name: 'word/embeddings/oleObject1.bin', content: 'embedded-object' },
    ]);

    await expect(validateIncomingAttachments([
      makeDocxFile(externalRelationship, 'external.docx'),
    ])).resolves.toMatchObject({
      ok: false,
      code: ATTACHMENT_ERROR_CODES.ACTIVE_CONTENT_REJECTED,
    });
    await expect(validateIncomingAttachments([
      makeDocxFile(embeddedObject, 'embedded.docx'),
    ])).resolves.toMatchObject({
      ok: false,
      code: ATTACHMENT_ERROR_CODES.ACTIVE_CONTENT_REJECTED,
    });
  });

  it('rejects archive traversal and high-ratio decompression bombs', async () => {
    const traversal = buildZip([
      ...baseEntries,
      { name: '../outside.xml', content: '<outside/>' },
    ]);
    const bomb = buildZip([
      ...baseEntries,
      { name: 'word/large.xml', content: 'A'.repeat(5 * 1024 * 1024) },
    ]);

    await expect(validateIncomingAttachments([
      makeDocxFile(traversal, 'traversal.docx'),
    ])).resolves.toMatchObject({
      ok: false,
      code: ATTACHMENT_ERROR_CODES.ARCHIVE_PATH_REJECTED,
    });
    await expect(validateIncomingAttachments([
      makeDocxFile(bomb, 'bomb.docx'),
    ])).resolves.toMatchObject({
      ok: false,
      code: ATTACHMENT_ERROR_CODES.ARCHIVE_BOMB_REJECTED,
    });
  });
});

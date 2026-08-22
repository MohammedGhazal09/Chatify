#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const outputDirectory = path.join(root, 'docs/security/audit/phase-11');
const jsonPath = path.join(outputDirectory, 'upload-policy.json');
const markdownPath = path.join(outputDirectory, 'upload-policy.md');

const sourceFiles = [
  'Backend/Chatify/Controller/messageController.mjs',
  'Backend/Chatify/Controller/userController.mjs',
  'Backend/Chatify/Middlewares/privateFileResponse.mjs',
  'Backend/Chatify/Models/attachmentModel.mjs',
  'Backend/Chatify/Models/chatModel.mjs',
  'Backend/Chatify/Models/messageModel.mjs',
  'Backend/Chatify/Routes/messageRouter.mjs',
  'Backend/Chatify/Routes/userRouter.mjs',
  'Backend/Chatify/Services/attachmentLifecycleService.mjs',
  'Backend/Chatify/Services/attachmentStorageService.mjs',
  'Backend/Chatify/Services/profileImageStorageService.mjs',
  'Backend/Chatify/Utils/attachmentValidation.mjs',
  'Backend/Chatify/Utils/profileImageValidation.mjs',
  'Backend/Chatify/Utils/uploadSecurity.mjs',
  'Backend/Chatify/server.mjs',
];

const readSources = async () => Object.fromEntries(await Promise.all(
  sourceFiles.map(async (relativePath) => [
    relativePath,
    await readFile(path.join(root, relativePath), 'utf8'),
  ])
));

const findExtensions = (source) => [...source.matchAll(/^\s*'(\.[a-z0-9]+)':/gm)]
  .map((match) => match[1]);

const buildPolicy = async () => {
  const sources = await readSources();
  const uploadSecurity = sources['Backend/Chatify/Utils/uploadSecurity.mjs'];
  const attachmentValidation = sources['Backend/Chatify/Utils/attachmentValidation.mjs'];
  const profileValidation = sources['Backend/Chatify/Utils/profileImageValidation.mjs'];
  const privateResponse = sources['Backend/Chatify/Middlewares/privateFileResponse.mjs'];
  const messageController = sources['Backend/Chatify/Controller/messageController.mjs'];
  const userController = sources['Backend/Chatify/Controller/userController.mjs'];
  const messageRouter = sources['Backend/Chatify/Routes/messageRouter.mjs'];
  const lifecycle = sources['Backend/Chatify/Services/attachmentLifecycleService.mjs'];
  const messageModel = sources['Backend/Chatify/Models/messageModel.mjs'];
  const chatModel = sources['Backend/Chatify/Models/chatModel.mjs'];
  const server = sources['Backend/Chatify/server.mjs'];
  const runtimeUploadSources = sourceFiles
    .map((relativePath) => sources[relativePath])
    .join('\n');
  const acceptedExtensions = [...new Set([
    ...findExtensions(attachmentValidation),
    ...findExtensions(profileValidation),
  ])].sort();
  const cloudinaryDetected = /cloudinary/i.test(runtimeUploadSources);
  const antivirusDetected = /clamav|clamscan|malware[ -]?scan|virus[ -]?scan/i.test(runtimeUploadSources);

  const controls = {
    filenameAndTypeAgreement: (
      uploadSecurity.includes('isDeceptiveUploadFilename')
      && attachmentValidation.includes('fileTypeFromBuffer')
      && profileValidation.includes('fileTypeFromBuffer')
    ),
    activeContentRejection: (
      uploadSecurity.includes('PDF_ACTIVE_PATTERNS')
      && attachmentValidation.includes('ATTACHMENT_ACTIVE_CONTENT')
    ),
    polyglotRejection: (
      uploadSecurity.includes("fail('polyglot')")
      && attachmentValidation.includes('ATTACHMENT_POLYGLOT_REJECTED')
      && profileValidation.includes('PROFILE_IMAGE_POLYGLOT_REJECTED')
    ),
    imageDimensionAndPixelLimits: (
      uploadSecurity.includes('MAX_UPLOAD_IMAGE_DIMENSION = 10_000')
      && uploadSecurity.includes('MAX_UPLOAD_IMAGE_PIXELS = 40_000_000')
    ),
    imageMetadataSanitization: (
      uploadSecurity.includes('PNG_METADATA_CHUNKS')
      && uploadSecurity.includes('JPEG_METADATA_MARKERS')
      && uploadSecurity.includes('WEBP_METADATA_CHUNKS')
    ),
    aggregateUploadLimit: attachmentValidation.includes(
      'MAX_ATTACHMENT_BATCH_SIZE_BYTES = 20 * 1024 * 1024'
    ),
    voiceContainerValidation: (
      uploadSecurity.includes('inspectVoiceUpload')
      && attachmentValidation.includes("inspection: 'voice'")
    ),
    privateDeliveryHeaders: (
      privateResponse.includes('buildPrivateFileHeaders')
      && uploadSecurity.includes('X-Content-Type-Options')
      && uploadSecurity.includes('Content-Security-Policy')
      && uploadSecurity.includes('Cross-Origin-Resource-Policy')
    ),
    currentAuthorizationAtDelivery: (
      messageRouter.includes('requireAttachmentMembership')
      && messageController.includes('loadVisibleAttachmentForUser')
      && messageController.includes('canUserSeeMessage')
    ),
    failedWriteCleanup: (
      messageController.includes('cleanupStoredAttachments')
      && userController.includes('deleteProfileImageFile')
    ),
    messageDeletionStorageCleanup: (
      lifecycle.includes('purgeAttachmentsForMessage')
      && messageModel.includes('purgeAttachmentsForMessage')
    ),
    chatDeletionStorageCleanup: (
      lifecycle.includes('purgeChatUploadsAndMessages')
      && chatModel.includes('purgeChatUploadsAndMessages')
    ),
    retryableOrphanCleanup: (
      lifecycle.includes('cleanupAttachmentOrphans')
      && lifecycle.includes('PENDING_CLEANUP')
      && server.includes('startAttachmentCleanupWorker')
    ),
  };

  const boundaries = {
    storageProvider: 'mongodb-gridfs',
    attachmentBucket: 'chatifyAttachments',
    profileImageBucket: 'chatifyProfileImages',
    cloudinaryDetected,
    antivirusDetected,
    malwareControl: 'deterministic allowlisting, structure inspection, active-content rejection, and lifecycle cleanup',
    residualDecision: 'External antivirus or content-moderation scanning is not implemented and must not be represented as executed evidence.',
  };

  const exitGate = {
    typeAndFilenameValidation: controls.filenameAndTypeAgreement,
    activeAndPolyglotContentRejected: controls.activeContentRejection && controls.polyglotRejection,
    resourceLimitsEnforced: controls.imageDimensionAndPixelLimits && controls.aggregateUploadLimit,
    metadataPrivacyEnforced: controls.imageMetadataSanitization,
    privateDeliveryEnforced: controls.privateDeliveryHeaders && controls.currentAuthorizationAtDelivery,
    lifecycleCleanupEnforced: (
      controls.failedWriteCleanup
      && controls.messageDeletionStorageCleanup
      && controls.chatDeletionStorageCleanup
      && controls.retryableOrphanCleanup
    ),
    providerBoundaryAccurate: boundaries.storageProvider === 'mongodb-gridfs' && !boundaries.cloudinaryDetected,
    malwareBoundaryAccurate: !boundaries.antivirusDetected,
  };

  return {
    schemaVersion: 1,
    phase: 11,
    title: 'Uploads, attachments, and active-content controls',
    sourceFiles,
    acceptedExtensions,
    limits: {
      attachmentsPerMessage: 5,
      attachmentBytes: 10 * 1024 * 1024,
      aggregateAttachmentBytes: 20 * 1024 * 1024,
      profileImageBytes: 2 * 1024 * 1024,
      maximumImageDimension: 10_000,
      maximumImagePixels: 40_000_000,
      cleanupBatchSize: 50,
      minimumCleanupIntervalMs: 60_000,
    },
    controls,
    boundaries,
    exitGate,
    ok: Object.values(exitGate).every(Boolean),
  };
};

const buildMarkdown = (policy) => {
  const rows = Object.entries(policy.controls)
    .map(([control, enabled]) => `| ${control} | ${enabled ? 'yes' : 'no'} |`)
    .join('\n');
  const exitRows = Object.entries(policy.exitGate)
    .map(([gate, passed]) => `| ${gate} | ${passed ? 'passed' : 'failed'} |`)
    .join('\n');

  return `# Chatify Security Audit — Phase 11 Upload Policy\n\n`
    + `This document is generated deterministically from the repository-owned upload implementation. Run \`npm run security:phase11:generate\` after changing upload surfaces and \`npm run security:phase11:check\` to detect drift.\n\n`
    + `## Scope and provider boundary\n\n`
    + `- Primary upload storage: **${policy.boundaries.storageProvider}**.\n`
    + `- Attachment bucket: **${policy.boundaries.attachmentBucket}**.\n`
    + `- Profile-image bucket: **${policy.boundaries.profileImageBucket}**.\n`
    + `- Cloudinary detected in the runtime upload path: **${policy.boundaries.cloudinaryDetected ? 'yes' : 'no'}**.\n`
    + `- External antivirus detected: **${policy.boundaries.antivirusDetected ? 'yes' : 'no'}**.\n`
    + `- Implemented malware boundary: ${policy.boundaries.malwareControl}.\n`
    + `- Residual decision: ${policy.boundaries.residualDecision}\n\n`
    + `## Resource limits\n\n`
    + `| Limit | Value |\n| --- | ---: |\n`
    + `| Attachments per message | ${policy.limits.attachmentsPerMessage} |\n`
    + `| Per attachment | ${policy.limits.attachmentBytes} bytes |\n`
    + `| Aggregate attachments | ${policy.limits.aggregateAttachmentBytes} bytes |\n`
    + `| Profile image | ${policy.limits.profileImageBytes} bytes |\n`
    + `| Maximum image dimension | ${policy.limits.maximumImageDimension} pixels |\n`
    + `| Maximum image pixels | ${policy.limits.maximumImagePixels} |\n`
    + `| Cleanup batch | ${policy.limits.cleanupBatchSize} |\n`
    + `| Minimum cleanup interval | ${policy.limits.minimumCleanupIntervalMs} ms |\n\n`
    + `## Accepted extensions\n\n${policy.acceptedExtensions.map((extension) => `- \`${extension}\``).join('\n')}\n\n`
    + `## Source-backed controls\n\n| Control | Present |\n| --- | --- |\n${rows}\n\n`
    + `## Exit gate\n\n| Gate | Result |\n| --- | --- |\n${exitRows}\n\n`
    + `Overall result: **${policy.ok ? 'passed' : 'failed'}**.\n`;
};

const policy = await buildPolicy();
const json = `${JSON.stringify(policy, null, 2)}\n`;
const markdown = buildMarkdown(policy);
const mode = process.argv.includes('--write')
  ? 'write'
  : process.argv.includes('--check')
    ? 'check'
    : null;

if (!mode) {
  console.error('Use --write or --check');
  process.exit(2);
}

if (mode === 'write') {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, json),
    writeFile(markdownPath, markdown),
  ]);
  console.log('Phase 11 upload policy generated.');
} else {
  const [storedJson, storedMarkdown] = await Promise.all([
    readFile(jsonPath, 'utf8'),
    readFile(markdownPath, 'utf8'),
  ]);

  if (storedJson !== json || storedMarkdown !== markdown) {
    console.error('Phase 11 upload policy drift detected. Run npm run security:phase11:generate.');
    process.exit(1);
  }

  if (!policy.ok) {
    console.error('Phase 11 upload policy exit gate failed.');
    process.exit(1);
  }

  console.log('Phase 11 upload policy is current and all exit gates pass.');
}

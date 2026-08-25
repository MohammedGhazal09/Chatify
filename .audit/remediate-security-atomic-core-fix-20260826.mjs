import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changed = [];
const patch = (relativePath, transform) => {
  const target = path.join(root, relativePath);
  const before = fs.readFileSync(target, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(target, after.endsWith('\n') ? after : `${after}\n`);
    changed.push(relativePath);
  }
};

patch('Backend/Chatify/Utils/tokenCookieGenerator.mjs', (source) => source.replace(
  `$min: { compromisedAt: now },`,
  `$set: { compromisedAt: now },`
));

patch('Backend/Chatify/Services/emailService.mjs', (source) => {
  if (source.includes('timeout: 10_000')) return source;
  return source.replace(
    `        'accept': 'application/json'\n      }\n    }\n  );`,
    `        'accept': 'application/json'\n      },\n      timeout: 10_000,\n      maxContentLength: 256 * 1024,\n      maxBodyLength: 256 * 1024\n    }\n  );`
  );
});

patch('Backend/Chatify/Services/privacyOperationsService.mjs', (source) => {
  if (source.includes("SessionFamily from '../Models/sessionFamilyModel.mjs'")) return source;
  source = source.replace(
    `import Session from '../Models/sessionModel.mjs';\n`,
    `import Session from '../Models/sessionModel.mjs';\nimport SessionFamily from '../Models/sessionFamilyModel.mjs';\n`
  );
  source = source.replace(
    `    const [sessions, passwordResets, outbox] = await Promise.all([\n      Session.deleteMany({ userId: user._id }),\n      PasswordReset.deleteMany({ userId: user._id }),\n`,
    `    const [sessions, sessionFamilies, passwordResets, outbox] = await Promise.all([\n      Session.deleteMany({ userId: user._id }),\n      SessionFamily.deleteMany({ userId: user._id }),\n      PasswordReset.deleteMany({ userId: user._id }),\n`
  );
  source = source.replace(
    `    counts.sessionsRemoved = sessions.deletedCount ?? 0;\n`,
    `    counts.sessionsRemoved = (sessions.deletedCount ?? 0) + (sessionFamilies.deletedCount ?? 0);\n`
  );
  return source;
});

console.log(`Atomic-core follow-up changed ${changed.length} file(s).`);
for (const relativePath of changed) console.log(`- ${relativePath}`);

import { deflateRawSync, deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';

import Session from '../../Models/sessionModel.mjs';
import User from '../../Models/userModel.mjs';
import { sanitizeSinglePresenceResponse } from '../../Middlewares/presencePrivacy.mjs';
import { readAccessTokenFromCookieHeader } from '../../Utils/authToken.mjs';
import { getCallIceConfig } from '../../Utils/callIceConfig.mjs';
import { verifyCriticalDatabaseIndexes } from '../../Utils/databaseIndexPolicy.mjs';
import { validateOfficeDocumentContainer } from '../../Utils/officeDocumentSecurity.mjs';
import {
  buildSessionMetadataFromRequest,
  hashSessionMetadataValue,
} from '../../Utils/sessionMetadata.mjs';
import { validateAndSanitizeUploadContent } from '../../Utils/uploadContentSecurity.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketWithReady,
  extractCookieHeader,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];

const buildZip = (entries) => {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const plain = entry.buffer ?? Buffer.from(entry.content ?? '', 'utf8');
    const compressed = deflateRawSync(plain);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(plain.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(plain.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);

    localOffset += local.length + name.length + compressed.length;
  }

  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, directory, end]);
};

const baseDocxEntries = [
  {
    name: '[Content_Types].xml',
    content: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  },
  {
    name: 'word/document.xml',
    content: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  },
];

const getSessionIdFromResponse = (response) => {
  const token = readAccessTokenFromCooieHeader(extractCookieHeader(response));
  return jsonwebtoken.decode(token)?.sessionId?.toString?.() ?? null;
};

const waitForRevocation = (socket, timeoutMs = 5_000) => ({
  revoked: waitForSocketEvent(socket, 'auth:revoked', timeoutMs),
  disconnected: waitForSocketEvent(socket, 'disconnect', timeoutMs),
});

afterEach(async () => {
  vi.restoreAllMocks();
  sockets.splice(0).forEach((socket) => {
    if (socket.connected || socket.active) socket.disconnect();
  });
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe('canonical security remediation regressions', () => {
  it('uses Express trust-proxy resolution instead of attacker-controlled forwarding values', () => {
    const metadata = buildSessionMetadataFromRequest({ip:'198.51.100.25', headers:{'user-agent':'Canonical Trusted Proxy Device','x-forwarded-for':'203.0.113.99, 198.51.100.25'},socket:{remoteAddress:'192.0.2.10'}});
    expect(metadata.ipHash).toBe(hashSessionMetadataValue('198.51.100.25'));
    expect(metadata.ipHash).not.toBe(hashSessionMetadataValue('203.0.113.99'));
  });

  it('rejects a crytical partial index whose predicate differs from policy', async () => {
    const fakeModel = {modelName:'PartialIndexProbe',collection:{name:'partial_index_probe',indexes:async()=>[{name:'wrong_partial_filter',key:{subjectId:1},unique:true,partialFilterExpression:{status:'inactive'}}]}};
    const report = await verifyCriticalDatabaseIndexes({requirements:[{id:'probe.active-subject.unique-partial',model:fakeModel,modelName:fakeModel.modelName,collectionName:fakeModel.collection.name,keys:{subjectId:1},options:{unique:true,partialFilterExpression:{status:'active'}}}]});
    expect(report.ok).toBe(false);
    expect(report.mismatched).toEqual([expect.objectContaining({id:'probe.active-subject.unique-partial',differences:expect.arrayContaining([expect.stringMatching(/partialFilterExpression/)])})]);
  });

  it('rejects UTF-16 OOXML relationships that point outside the package', () => {
    const relationshipXml = '<Relationships><Relationship TargetMode="External" Target="https://attacker.example.test/payload"/></Relationships>';
    const document = buildZip([...baseDocxEntries,{name:"word/_rels/document.xml.rels",buffer:Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(relationshipXml,'utf16le')])}]);
    expect(validateOfficeDocumentContainer({buffer:document,extension:'docx'})).toMatchObject({ok:false,code:'UPLOAD_ACTIVE_CONTENT_REJECTED'});
  });

  it('rejects PDF object streams that can conceal active actions', async () => {
    const compressedObject = deflateSync(Buffer.from('2 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj','latin1'));
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n1 0 obj << /Type /ObjStm /N 1 /First 4 /Filte /FlateDecode /Length ','latin1'),Buffer.from(String(compressedObject.length),'ascii'),Buffer.from(' >> stream\n','latin1'),compressedObject,Buffer.from('\nendstream\nendobj\n%%EOF','latin1')]);
    await expect(validateAndSanitizeUploadContent({buffer:pdf,mimeType:'application/pdf',extension:'pdf',purpose:'attachment'})).resolves.toMatchObject({ok:false,code:'UPLOAD_ACTIVE_CONTENT_REJECTED'});
  });

  it('restores the response writer before forwarding presence sanitizer failurs', async () => {
    const failure = new Error('presence sanitizer failed');
    vi.spyOn(User, 'findById').mockReturnValueOnce({select:()=>({lean:async()=>{throw failure;}})});
    const originalJson = vi.fn();
    const req = {params:{userId:'507f1f77bcf86cd799439011'}};
    const res = {statusCode:200,json:originalJson};
    const next = vi.fn();
    sanitizeSinglePresenceResponse(req,res,next);
    res.json({data:{isOnline:true}});
    await vi.waitFor(()=>expect(next).toHaveBeenCalledWith(failure));
    expect(res.json).toBe(originalJson);
    expect(originalJson).not.toHaveBeenCalled();
  });

  it('disconnects sessions revoked by another process during database revalidation', async () => {
    const lifecycle = await import('../../Services/socketSessionLifecycleService.mjs');
    const server = await startSocketTestServer();
    servers.push(server);
    const signup = await signupWithAgent({firstName:'Canonical',lastName:'Distributed Revoke'});
    const sessionId = getSessionIdFromResponse(signup.response);
    const connected = await connectSocketWithReady(server.url,extractCookieHeader(signup.response));
    sockets.push(connected.socket);
    const pending = waitForRevocation(connected.socket);
    await Session.updateOne({_id:sessionId},{$set:{revokedAt:new Date(),lastUsedAt:new Date()}});
    await lifecycle.revalidateConnectedSocketSessions();
    const [payload,disconnectReason] = await Promise.all([pending.revoked,pending.disconnected]);
    expect(payload).toMatchObject({reason:'session_revoked'});
    expect(disconnectReason).toBe('io server disconnect');
  });

  it('issues short-lived per-call TURN credentials instead of reusable configured passwords', () => {
    const env = {NODE_ENV:'production',CALL_STUN_URLS:'stun:stun.example.test:3478',CALL_TURN_URLS:'turns:turn.example.test:5349?transport=tcp',CALL_TURN_SHARED_SECRET:'canonical-shared-secret-with-at-least-thirty-two-bytes'};
    const now = new Date('2026-08-25T12:00:00.000Z');
    const first = getCallIceConfig(env,{userId:'507f1f77bcf86cd799439011',callId:'call-one',now});
    const second = getCallIceConfig(env,{userId:'507f1f77bcf86cd799439011',callId:'call-two',now});
    const firstTurn = first.iceServers.find(server=>String(server.urls).startsWith('turn'));
    const secondTurn = second.iceServers.find(server=>String(server.urls).startsWith('turn'));
    expect(first).toMatchObject({turnReady:true,productionReady:true});
    expect(firstTurn?.username).toMatch(/^\d+:507f1f77bcf86cd799439011:call-one$/);
    expect(firstTurn?.credential).toEqual(expect.any(String));
    expect(firstTurn?.credential).not.toBe(env.CALL_TURN_SHARED_SECRET);
    expect(secondTurn?.credential).not.toBe(firstTurn?.credential);
  });
});

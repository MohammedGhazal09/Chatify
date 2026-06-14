import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  (globalThis as typeof globalThis & { __mockRTCPeerConnections?: unknown[] }).__mockRTCPeerConnections = [];
});

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0);
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
}

Object.defineProperty(window, 'isSecureContext', {
  value: true,
  configurable: true,
});

class MockMediaStreamTrack {
  id: string;
  kind: string;
  enabled = true;
  stop = vi.fn();

  constructor(kind = 'audio', id = `${kind}-track`) {
    this.kind = kind;
    this.id = id;
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio');
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track);
  }
}

class MockRTCPeerConnection {
  connectionState: RTCPeerConnectionState = 'new';
  ontrack: RTCPeerConnection['ontrack'] = null;
  onicecandidate: RTCPeerConnection['onicecandidate'] = null;
  onconnectionstatechange: RTCPeerConnection['onconnectionstatechange'] = null;

  private remoteDescription: RTCSessionDescriptionInit | null = null;

  addTrack = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'mock-offer' }) as RTCSessionDescriptionInit);
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'mock-answer' }) as RTCSessionDescriptionInit);
  setLocalDescription = vi.fn(async () => undefined);
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description;
  });
  addIceCandidate = vi.fn(async () => {
    if (!this.remoteDescription) {
      throw new DOMException('Remote description not set', 'InvalidStateError');
    }
  });
  close = vi.fn(() => {
    this.connectionState = 'closed';
  });

  constructor() {
    const connections = (globalThis as typeof globalThis & { __mockRTCPeerConnections?: MockRTCPeerConnection[] }).__mockRTCPeerConnections ?? [];
    connections.push(this);
    (globalThis as typeof globalThis & { __mockRTCPeerConnections?: MockRTCPeerConnection[] }).__mockRTCPeerConnections = connections;
  }
}

Object.defineProperty(globalThis, 'MediaStream', {
  value: MockMediaStream,
  configurable: true,
});

Object.defineProperty(globalThis, 'MediaStreamTrack', {
  value: MockMediaStreamTrack,
  configurable: true,
});

Object.defineProperty(globalThis, 'RTCPeerConnection', {
  value: MockRTCPeerConnection,
  configurable: true,
});

const createMockStream = (mode: 'audio' | 'video' = 'audio') => new MockMediaStream([
  new MockMediaStreamTrack('audio', 'audio-track'),
  ...(mode === 'video' ? [new MockMediaStreamTrack('video', 'video-track')] : []),
]);

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
      const wantsVideo = Boolean(constraints.video);
      return createMockStream(wantsVideo ? 'video' : 'audio');
    }),
  },
  configurable: true,
});

import type { CallIceConfig, CallMode } from '../types/chat';

export type ChatifyPeerState = 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed';

export interface MediaRequestResult {
  stream: MediaStream;
  mode: CallMode;
  audioFallback: boolean;
}

export interface WebRtcSessionOptions {
  iceConfig?: CallIceConfig | null;
  localStream: MediaStream;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onStateChange?: (state: ChatifyPeerState) => void;
}

export const isSecureCallContext = () => (
  typeof window !== 'undefined'
  && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
);

export const isWebRTCSupported = () => (
  typeof navigator !== 'undefined'
  && Boolean(navigator.mediaDevices?.getUserMedia)
  && typeof RTCPeerConnection !== 'undefined'
  && isSecureCallContext()
);

export const mapPeerConnectionState = (state: RTCPeerConnectionState): ChatifyPeerState => {
  if (state === 'connected') {
    return 'connected';
  }

  if (state === 'disconnected') {
    return 'reconnecting';
  }

  if (state === 'failed') {
    return 'failed';
  }

  if (state === 'closed') {
    return 'closed';
  }

  return 'connecting';
};

export const stopMediaStream = (stream?: MediaStream | null) => {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
};

export const requestCallMedia = async (mode: CallMode): Promise<MediaRequestResult> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('media_not_supported');
  }

  const constraints = mode === 'audio'
    ? { audio: true, video: false }
    : { audio: true, video: true };

  return {
    stream: await navigator.mediaDevices.getUserMedia(constraints),
    mode,
    audioFallback: false,
  };
};

export class WebRtcCallSession {
  private readonly peerConnection: RTCPeerConnection;

  private readonly remoteStream = new MediaStream();

  private readonly pendingIceCandidates: RTCIceCandidateInit[] = [];

  private remoteDescriptionReady = false;

  constructor(options: WebRtcSessionOptions) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: options.iceConfig?.iceServers ?? [],
    });

    options.localStream.getTracks().forEach((track) => {
      this.peerConnection.addTrack(track, options.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          this.remoteStream.addTrack(track);
        }
      });
      options.onRemoteStream?.(this.remoteStream);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        options.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      options.onStateChange?.(mapPeerConnectionState(this.peerConnection.connectionState));
    };
  }

  private async flushPendingIceCandidates() {
    if (!this.remoteDescriptionReady || this.pendingIceCandidates.length === 0) {
      return;
    }

    const queuedCandidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates.length = 0;

    for (const candidate of queuedCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  async createOffer() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(offer);
    this.remoteDescriptionReady = true;
    await this.flushPendingIceCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(answer);
    this.remoteDescriptionReady = true;
    await this.flushPendingIceCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.remoteDescriptionReady) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  close() {
    this.pendingIceCandidates.length = 0;
    this.remoteDescriptionReady = false;
    this.peerConnection.close();
  }
}

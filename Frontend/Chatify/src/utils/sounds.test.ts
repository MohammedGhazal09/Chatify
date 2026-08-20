import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  cancelScheduledValues = vi.fn(() => this);
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
}

class MockOscillatorNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

const audioMocks = {
  contexts: [] as MockAudioContext[],
  gains: [] as MockGainNode[],
  oscillators: [] as MockOscillatorNode[],
};

class MockAudioContext {
  currentTime = 100;
  destination = {};
  state: AudioContextState = 'running';
  resume = vi.fn(async () => {
    this.state = 'running';
  });

  constructor() {
    audioMocks.contexts.push(this);
  }

  createGain() {
    const gain = new MockGainNode();
    audioMocks.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createOscillator() {
    const oscillator = new MockOscillatorNode();
    audioMocks.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }
}

const installMockAudioContext = (value: unknown) => {
  Object.defineProperty(window, 'AudioContext', {
    value,
    configurable: true,
  });
  Object.defineProperty(window, 'webkitAudioContext', {
    value: undefined,
    configurable: true,
  });
};

const importSounds = async () => {
  vi.resetModules();
  return import('./sounds');
};

describe('sounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    audioMocks.contexts = [];
    audioMocks.gains = [];
    audioMocks.oscillators = [];
    installMockAudioContext(MockAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts a soft outgoing call tone loop', async () => {
    const { startCallToneLoop } = await importSounds();

    const stopTone = startCallToneLoop('outgoing');

    expect(audioMocks.contexts).toHaveLength(1);
    expect(audioMocks.oscillators).toHaveLength(2);
    expect(audioMocks.oscillators[0]?.type).toBe('sine');
    expect(audioMocks.oscillators[1]?.type).toBe('triangle');
    expect(audioMocks.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
    expect(audioMocks.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(554, expect.any(Number));

    vi.advanceTimersByTime(1800);

    expect(audioMocks.oscillators).toHaveLength(4);
    stopTone();
  });

  it('stops the call tone loop and prevents future repeats', async () => {
    const { startCallToneLoop } = await importSounds();

    const stopTone = startCallToneLoop('incoming');

    expect(audioMocks.oscillators).toHaveLength(2);

    stopTone();
    vi.advanceTimersByTime(1800);

    expect(audioMocks.oscillators).toHaveLength(2);
    expect(audioMocks.oscillators[0]?.stop).toHaveBeenCalled();
    expect(audioMocks.oscillators[1]?.stop).toHaveBeenCalled();
  });

  it('returns a safe cleanup when Web Audio is unavailable', async () => {
    installMockAudioContext(undefined);
    const { startCallToneLoop } = await importSounds();

    expect(() => startCallToneLoop('outgoing')()).not.toThrow();
    expect(audioMocks.contexts).toHaveLength(0);
  });

  it('keeps existing notification and call-ended sounds available', async () => {
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { playCallEndedSound, playNotificationSound } = await importSounds();

    playNotificationSound();
    playCallEndedSound();

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(audioMocks.oscillators).toHaveLength(3);
  });
});

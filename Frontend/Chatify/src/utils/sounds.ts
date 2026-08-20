// Notification sound utility
let notificationSound: HTMLAudioElement | null = null;
let callEndedAudioContext: AudioContext | null = null;
let callToneAudioContext: AudioContext | null = null;
export const LEGACY_SOUND_STORAGE_KEY = 'chatify_sound_enabled';

export type CallToneVariant = 'outgoing' | 'incoming';

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

interface ToneNodePair {
  oscillator: OscillatorNode;
  gain: GainNode;
}

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext ?? null;
};

const resumeContext = (context: AudioContext) => {
  if (context.state === 'suspended') {
    try {
      void context.resume().catch(() => undefined);
    } catch {
      // Browsers can reject audio startup until a gesture; sounds are optional.
    }
  }
};

export const playNotificationSound = () => {
  if (!notificationSound) {
    // Use a subtle notification sound (base64 encoded simple beep)
    notificationSound = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVIxL22q0dOibSwVO5Tr3qBYLR8TcLvp56VkQCgNWqXk8ql+Wj4aCVuGy/C8h2tJNAxVdcXwu41yUjkIT2624LuKdl5CChxPm9runICCXjQNABdYdoqchYBqYVUkBAMMSHKFsLqZgpyFYikBAB5VYWRtfpiTjId5XkUdAAoVNVJ1kbOtlpp8cWxBJAAdNlFjdYydnJqRiYV9aFMxDwsSN1htjKaglZaPi4l+b1s6HgsQNVVmh6KhmpSRjIqCdGRNOR8MEixIX3yYopuWkY2KhXxuXUcwHQwPNlhri5+emp+TjoqFe29hSzYhDhRCYnqQnp+en5ONiYR8c2ZTO0kUIRpPZ3qOl5qYmp6ai4aAgHJkVUNBMyINJFBmeYuUl5mamJiKhIF/c2dXSUU5MA0dQF55houTlpqalYuGgn50aVtOS0Q5IA0fRWR+houSkpWWloqGgX91al9RTUI5Hw0bPl55hIiOkJGVk4qGgX51bGBUTkU8MA8WN1l0g4eKj5GRk4qFgX51bWNYUklBNQ4cP194gYWIi4yPk4mFgX51bWZcU0pDOjAOFzhVcoGEh4qMjpCGhIF9dW5lXVVMRTsxHhI0TG6Bg4iKi46RjYaBfnZtZl1YUEk/OCMTKkdqi4SKjpKSj4mFfnhvZl5WTklBNCINKEhxg4eKjI6Pkol+fHVuZl5WUUQ9MjAOF0Fmf4GEhoiNj4yIfHl0bWRdV1BKQD0+LBgjQWN9g4aKjI+OjYl/e3RuZFtWUEpBOjIqDBYzVXl+goaKjpGPiIR7dW1mX1lTTUY9NS8cFDFRdH2BhIiMjo+JhIF6c2tkXlpTTkdBOzInGhAyUnR7f4OHi4+PhH97dnBpZF1YUEtGPzYrJhUUPFt5fYCDhouOjoiBe3Zxa2ZgWlVOSEE6Ni0fFhQ8Wnl9f4KGi46Lhn57dW9pY11XUURBODR='
    );
    notificationSound.volume = 0.3;
  }

  notificationSound.currentTime = 0;
  notificationSound.play().catch(() => {
    // Autoplay might be blocked, silently fail
  });
};

const getCallEndedAudioContext = () => {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  callEndedAudioContext ??= new AudioContextConstructor();
  resumeContext(callEndedAudioContext);

  return callEndedAudioContext;
};

const playCallEndedTone = (
  context: AudioContext,
  options: {
    offset: number;
    duration: number;
    fromFrequency: number;
    toFrequency: number;
    type: OscillatorType;
    volume: number;
  }
) => {
  const startAt = context.currentTime + options.offset;
  const endAt = startAt + options.duration;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.fromFrequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(options.toFrequency, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(options.volume, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
};

export const playCallEndedSound = () => {
  const context = getCallEndedAudioContext();

  if (!context) {
    playNotificationSound();
    return;
  }

  try {
    [
      { offset: 0.00, duration: 0.16, fromFrequency: 880, toFrequency: 660, type: 'triangle' as const, volume: 0.16 },
      { offset: 0.11, duration: 0.18, fromFrequency: 660, toFrequency: 494, type: 'sine' as const, volume: 0.13 },
      { offset: 0.25, duration: 0.24, fromFrequency: 523, toFrequency: 392, type: 'triangle' as const, volume: 0.11 },
    ].forEach((tone) => playCallEndedTone(context, tone));
  } catch {
    playNotificationSound();
  }
};

const getCallToneAudioContext = () => {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  callToneAudioContext ??= new AudioContextConstructor();
  resumeContext(callToneAudioContext);

  return callToneAudioContext;
};

const getCallTonePattern = (variant: CallToneVariant) => (
  variant === 'incoming'
    ? [
        { offset: 0.00, duration: 0.22, frequency: 659, type: 'triangle' as const, volume: 0.075 },
        { offset: 0.31, duration: 0.24, frequency: 523, type: 'sine' as const, volume: 0.065 },
      ]
    : [
        { offset: 0.00, duration: 0.2, frequency: 440, type: 'sine' as const, volume: 0.06 },
        { offset: 0.28, duration: 0.24, frequency: 554, type: 'triangle' as const, volume: 0.07 },
      ]
);

const scheduleCallTone = (context: AudioContext, variant: CallToneVariant) => {
  const nodes: ToneNodePair[] = [];
  const phraseStart = context.currentTime + 0.02;

  getCallTonePattern(variant).forEach((tone) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = phraseStart + tone.offset;
    const endAt = startAt + tone.duration;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(tone.volume, startAt + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.03);
    nodes.push({ oscillator, gain });
  });

  return () => {
    const fadeAt = context.currentTime;

    nodes.forEach(({ oscillator, gain }) => {
      try {
        gain.gain.cancelScheduledValues(fadeAt);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), fadeAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, fadeAt + 0.05);
        oscillator.stop(fadeAt + 0.06);
      } catch {
        // The tone may already have ended; cleanup should stay silent.
      }
    });
  };
};

export const startCallToneLoop = (variant: CallToneVariant): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  let context: AudioContext | null = null;
  try {
    context = getCallToneAudioContext();
  } catch {
    return () => undefined;
  }

  if (!context) {
    return () => undefined;
  }

  const activeToneCleanups = new Set<() => void>();
  let isStopped = false;
  let loopId: number | null = null;

  const playPhrase = () => {
    if (isStopped) {
      return;
    }

    try {
      const cleanupTone = scheduleCallTone(context, variant);
      activeToneCleanups.add(cleanupTone);
      window.setTimeout(() => {
        activeToneCleanups.delete(cleanupTone);
      }, 900);
    } catch {
      return;
    }

    loopId = window.setTimeout(playPhrase, 1800);
  };

  playPhrase();

  return () => {
    isStopped = true;

    if (loopId !== null) {
      window.clearTimeout(loopId);
      loopId = null;
    }

    activeToneCleanups.forEach((cleanupTone) => cleanupTone());
    activeToneCleanups.clear();
  };
};

// Check if user has enabled sound notifications
export const isSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return window.localStorage.getItem(LEGACY_SOUND_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LEGACY_SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore localStorage failures; sound preference can still be held by caller state.
  }
};

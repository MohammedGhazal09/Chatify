import { useState, useCallback } from 'react';
import { setSoundEnabled, isSoundEnabled } from '../utils/sounds';
import useLocalStorage from '../hooks/useLocalStorage';
import type { ChatTheme, ChatThemePreference } from '../pages/chat/hooks/useChatTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatTheme?: ChatTheme;
  chatThemePreference?: ChatThemePreference;
  isChatThemeForced?: boolean;
  onChatThemePreferenceChange?: (preference: ChatThemePreference) => void;
}

const themeOptions: Array<{ value: ChatThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SettingsModal = ({
  isOpen,
  onClose,
  chatTheme = 'dark',
  chatThemePreference = 'system',
  isChatThemeForced = false,
  onChatThemePreferenceChange,
}: SettingsModalProps) => {
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled());
  const [enterToSend, setEnterToSend] = useLocalStorage('chatify_enter_to_send', true);

  const handleSoundToggle = useCallback(() => {
    const newValue = !soundEnabled;
    setSoundEnabledState(newValue);
    setSoundEnabled(newValue);
  }, [soundEnabled]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-[var(--chat-shadow)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--chat-border)] p-4">
          <h2 className="text-lg font-semibold text-[var(--chat-text)]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--chat-radius-md)] p-1 text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Sound Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--chat-text)]">Sound Notifications</p>
              <p className="text-xs text-[var(--chat-text-muted)]">Play sound when receiving messages</p>
            </div>
            <button
              type="button"
              onClick={handleSoundToggle}
              className={`cursor-pointer relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                soundEnabled ? 'bg-[var(--chat-accent)]' : 'bg-[var(--chat-panel-subtle)]'
              }`}
              aria-label="Toggle sound notifications"
              aria-pressed={soundEnabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Enter to Send */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--chat-text)]">Enter to Send</p>
              <p className="text-xs text-[var(--chat-text-muted)]">Press Enter to send messages</p>
            </div>
            <button
              type="button"
              onClick={() => setEnterToSend(!enterToSend)}
              className={`cursor-pointer relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                enterToSend ? 'bg-[var(--chat-accent)]' : 'bg-[var(--chat-panel-subtle)]'
              }`}
              aria-label="Toggle Enter to Send"
              aria-pressed={enterToSend}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  enterToSend ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {onChatThemePreferenceChange && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--chat-text)]">Chat theme</legend>
              <div
                className="grid grid-cols-3 gap-1 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-1"
                aria-label={`Chat theme preference. Current theme ${chatTheme}.`}
              >
                {themeOptions.map((option) => {
                  const isSelected = chatThemePreference === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChatThemePreferenceChange(option.value)}
                      className={`min-h-9 rounded-[var(--chat-radius-sm)] px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                        isSelected
                          ? 'bg-[var(--chat-panel-elevated)] text-[var(--chat-accent)] shadow-sm'
                          : 'text-[var(--chat-text-muted)] hover:text-[var(--chat-text)]'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {isChatThemeForced && (
                <p className="text-xs text-[var(--chat-warning)]">
                  Theme is forced for visual verification.
                </p>
              )}
            </fieldset>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--chat-border)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer w-full rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 py-2 font-semibold text-[var(--chat-own-text)] transition-colors hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

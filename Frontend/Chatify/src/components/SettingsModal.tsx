import { useState, useCallback } from 'react';
import { setSoundEnabled, isSoundEnabled } from '../utils/sounds';
import useLocalStorage from '../hooks/useLocalStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
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
      <div className="relative z-10 w-full max-w-md mx-4 bg-slate-900 rounded-xl shadow-2xl border border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
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
              <p className="text-sm font-medium text-slate-100">Sound Notifications</p>
              <p className="text-xs text-slate-400">Play sound when receiving messages</p>
            </div>
            <button
              onClick={handleSoundToggle}
              className={`cursor-pointer relative w-11 h-6 rounded-full transition-colors ${
                soundEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
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
              <p className="text-sm font-medium text-slate-100">Enter to Send</p>
              <p className="text-xs text-slate-400">Press Enter to send messages</p>
            </div>
            <button
              onClick={() => setEnterToSend(!enterToSend)}
              className={`cursor-pointer relative w-11 h-6 rounded-full transition-colors ${
                enterToSend ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  enterToSend ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="cursor-pointer w-full py-2 px-4 bg-emerald-500 text-emerald-950 font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

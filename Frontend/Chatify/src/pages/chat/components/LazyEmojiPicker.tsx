import { lazy, Suspense } from 'react';

interface EmojiClickData {
  emoji: string;
}

interface LazyEmojiPickerProps {
  width: number;
  height: number;
  onEmojiClick: (emoji: EmojiClickData) => void;
}

const EmojiPicker = lazy(async () => {
  const module = await import('emoji-picker-react');
  const Picker = module.default;
  const Theme = module.Theme;

  return {
    default: (props: LazyEmojiPickerProps) => (
      <Picker theme={Theme.DARK} {...props} />
    ),
  };
});

const LazyEmojiPicker = (props: LazyEmojiPickerProps) => {
  return (
    <Suspense fallback={<div className="rounded-lg border border-[#2E363C] bg-[#20262B] p-4 text-sm text-[#A8B3AF]">Loading emoji…</div>}>
      <EmojiPicker {...props} />
    </Suspense>
  );
};

export default LazyEmojiPicker;

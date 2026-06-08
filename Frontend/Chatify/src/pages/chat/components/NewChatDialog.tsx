import type { FormEvent } from 'react';

interface NewChatDialogProps {
  isOpen: boolean;
  email: string;
  error: string | null;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const NewChatDialog = ({
  isOpen,
  email,
  error,
  isSubmitting,
  onEmailChange,
  onSubmit,
}: NewChatDialogProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <form onSubmit={onSubmit} className="border-b border-slate-800 px-4 py-3 space-y-2">
      <label htmlFor="new-chat-email" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Start a chat by email
      </label>
      <div className="flex gap-2">
        <input
          id="new-chat-email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="friend@example.com"
          required
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Adding...' : 'Add'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </form>
  );
};

export default NewChatDialog;

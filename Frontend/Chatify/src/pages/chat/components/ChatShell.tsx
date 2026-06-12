import type { ReactNode } from 'react';

interface ChatShellProps {
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  sidebar: ReactNode;
  conversation: ReactNode;
  rightRail?: ReactNode;
  overlays?: ReactNode;
}

const ChatShell = ({ isSidebarOpen, onCloseSidebar, sidebar, conversation, rightRail, overlays }: ChatShellProps) => {
  return (
    <div
      data-testid="chat-shell"
      className="chat-shell grid h-[100dvh] w-screen max-w-screen overflow-hidden bg-[var(--chat-bg)] text-[var(--chat-text)]"
    >
      <button
        type="button"
        aria-label="Close chat list"
        className={`chat-overlay fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 md:hidden ${
          isSidebarOpen ? 'show pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onCloseSidebar}
      />
      {sidebar}
      <section
        data-testid="conversation-pane"
        className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-[var(--chat-bg)]"
      >
        {conversation}
      </section>
      {rightRail}
      {overlays}
    </div>
  );
};

export default ChatShell;

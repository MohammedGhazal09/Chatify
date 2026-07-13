import type { ReactNode } from 'react';

interface ChatShellProps {
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  isRightRailOpen?: boolean;
  sidebar: ReactNode;
  conversation: ReactNode;
  rightRail?: ReactNode;
  overlays?: ReactNode;
}

const ChatShell = ({
  isSidebarOpen,
  onCloseSidebar,
  isRightRailOpen = false,
  sidebar,
  conversation,
  rightRail,
  overlays,
}: ChatShellProps) => {
  return (
    <div
      data-testid="chat-shell"
      data-right-rail={isRightRailOpen ? 'open' : 'closed'}
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
        className="chat-conversation-panel flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-[var(--chat-bg)]"
      >
        {conversation}
      </section>
      {rightRail}
      {overlays}
    </div>
  );
};

export default ChatShell;

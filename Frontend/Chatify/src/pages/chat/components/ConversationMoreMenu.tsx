import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Ban, Bell, BellOff, Download, Info, Phone, Search, ShieldCheck, Video } from 'lucide-react';
import type { ConversationControls } from '../../../types/chat';

interface ConversationMoreMenuProps {
  isOpen: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  conversationControls?: ConversationControls;
  canExport: boolean;
  isMuted?: boolean;
  isActionPending: boolean;
  callDisabledReason?: string | null;
  videoCallDisabledReason?: string | null;
  onOpenDetails: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onSearchMessages: () => void;
  onExportChat: () => void;
  onToggleMute?: () => void;
  onBlockUser: () => void;
  onUnblockUser: () => void;
  onClose: () => void;
}

type MenuItemTone = 'default' | 'danger' | 'success';

const MENU_WIDTH = 260;
const VIEWPORT_GAP = 12;

const getMenuPosition = (anchor: HTMLElement | null) => {
  if (!anchor || typeof window === 'undefined') {
    return { top: 88, left: VIEWPORT_GAP };
  }

  const rect = anchor.getBoundingClientRect();
  const left = Math.min(
    Math.max(VIEWPORT_GAP, rect.right - MENU_WIDTH),
    window.innerWidth - MENU_WIDTH - VIEWPORT_GAP
  );
  const top = Math.min(rect.bottom + 8, window.innerHeight - VIEWPORT_GAP);

  return { top, left };
};

const ConversationMoreMenu = ({
  isOpen,
  anchorRef,
  conversationControls,
  canExport,
  isMuted = false,
  isActionPending,
  callDisabledReason,
  videoCallDisabledReason,
  onOpenDetails,
  onStartAudioCall,
  onStartVideoCall,
  onSearchMessages,
  onExportChat,
  onToggleMute,
  onBlockUser,
  onUnblockUser,
  onClose,
}: ConversationMoreMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => getMenuPosition(anchorRef.current));

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePosition = () => setPosition(getMenuPosition(anchorRef.current));
    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const focusTarget = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    window.requestAnimationFrame(() => {
      focusTarget?.focus();
    });

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const canBlock = Boolean(conversationControls?.canBlockUser);
  const canUnblock = Boolean(conversationControls?.canUnblockUser);
  const isDirectChat = conversationControls?.isDirectChat ?? false;

  const runAndClose = (action: () => void, closeAfterAction = true) => {
    action();
    if (closeAfterAction) {
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Conversation actions"
      className="fixed z-[70] w-[260px] overflow-hidden rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] py-1 text-sm text-[var(--chat-text)] shadow-[var(--chat-shadow)]"
      style={{ top: position.top, left: position.left }}
      onClick={(event) => event.stopPropagation()}
    >
      <MenuItem
        icon={<Info aria-hidden="true" className="h-4 w-4" />}
        label="Conversation details"
        onSelect={() => runAndClose(onOpenDetails)}
      />
      <MenuItem
        icon={<Search aria-hidden="true" className="h-4 w-4" />}
        label="Search messages"
        onSelect={() => runAndClose(onSearchMessages)}
      />
      <MenuItem
        icon={<Download aria-hidden="true" className="h-4 w-4" />}
        label="Export chat"
        disabled={!canExport}
        title={canExport ? undefined : 'No messages to export'}
        onSelect={() => runAndClose(onExportChat)}
      />
      <MenuItem
        icon={isMuted ? <Bell aria-hidden="true" className="h-4 w-4" /> : <BellOff aria-hidden="true" className="h-4 w-4" />}
        label={isMuted ? 'Unmute conversation' : 'Mute conversation'}
        title={isMuted ? 'Restore sound and browser alerts for this conversation' : 'Suppress sound and browser alerts for this conversation'}
        onSelect={() => runAndClose(onToggleMute ?? (() => undefined))}
      />
      <MenuDivider />
      <MenuItem
        icon={<Phone aria-hidden="true" className="h-4 w-4" />}
        label="Call"
        disabled={Boolean(callDisabledReason)}
        title={callDisabledReason ?? 'Start audio call'}
        onSelect={() => runAndClose(onStartAudioCall)}
      />
      <MenuItem
        icon={<Video aria-hidden="true" className="h-4 w-4" />}
        label="Video call"
        disabled={Boolean(videoCallDisabledReason)}
        title={videoCallDisabledReason ?? 'Start video call'}
        onSelect={() => runAndClose(onStartVideoCall)}
      />
      <MenuDivider />
      {canUnblock ? (
        <MenuItem
          icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
          label="Unblock user"
          tone="success"
          disabled={isActionPending}
          onSelect={() => runAndClose(onUnblockUser, false)}
        />
      ) : (
        <MenuItem
          icon={<Ban aria-hidden="true" className="h-4 w-4" />}
          label="Block user"
          tone="danger"
          disabled={!isDirectChat || !canBlock || isActionPending}
          title={!isDirectChat ? 'Blocking is only available for direct chats' : undefined}
          onSelect={() => runAndClose(onBlockUser, false)}
        />
      )}
    </div>
  );
};

const MenuDivider = () => (
  <div className="my-1 border-t border-[var(--chat-border)]" role="separator" />
);

const MenuItem = ({
  icon,
  label,
  tone = 'default',
  disabled = false,
  title,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  tone?: MenuItemTone;
  disabled?: boolean;
  title?: string;
  onSelect?: () => void;
}) => {
  const descriptionId = useId();
  const hasDisabledDescription = disabled && Boolean(title);
  const toneClass = tone === 'danger'
    ? 'text-[var(--chat-danger)] enabled:hover:bg-[color-mix(in_srgb,var(--chat-danger)_10%,var(--chat-panel-subtle))]'
    : tone === 'success'
      ? 'text-[var(--chat-success)] enabled:hover:bg-[color-mix(in_srgb,var(--chat-success)_10%,var(--chat-panel-subtle))]'
      : 'text-[var(--chat-text)] enabled:hover:bg-[var(--chat-panel-subtle)] enabled:hover:text-[var(--chat-accent)]';

  return (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      disabled={disabled}
      title={title}
      aria-describedby={hasDisabledDescription ? descriptionId : undefined}
      onClick={onSelect}
      className={`flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left font-medium disabled:cursor-not-allowed disabled:text-[var(--chat-text-soft)] disabled:opacity-60 focus:outline-none focus-visible:bg-[var(--chat-panel-subtle)] ${toneClass}`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hasDisabledDescription && (
          <span id={descriptionId} className="mt-0.5 block whitespace-normal text-xs font-normal leading-4 text-[var(--chat-text-soft)]">
            {title}
          </span>
        )}
      </span>
    </button>
  );
};

export default ConversationMoreMenu;

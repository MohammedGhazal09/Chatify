import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AttachmentPreviewModal from './AttachmentPreviewModal';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

const pdfAttachment = {
  attachmentId: 'pdf-1',
  displayName: 'security-review.pdf',
  mimeType: 'application/pdf',
  size: 512,
  kind: 'file' as const,
  status: 'active' as const,
};

const imageAttachment = {
  attachmentId: 'image-1',
  displayName: 'safe-image.png',
  mimeType: 'image/png',
  size: 128,
  kind: 'media' as const,
  status: 'active' as const,
};

describe('AttachmentPreviewModal security', () => {
  it('never embeds PDF attachments and offers the protected download instead', () => {
    const { container } = render(
      <AttachmentPreviewModal attachment={pdfAttachment} onClose={vi.fn()} />
    );

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.getByText('Download the file to open it locally.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download security-review.pdf' })).toHaveAttribute(
      'href',
      'https://backend.test/api/message/attachments/pdf-1/download'
    );
  });

  it('continues to render allowlisted images through the protected preview route', () => {
    render(
      <AttachmentPreviewModal attachment={imageAttachment} onClose={vi.fn()} />
    );

    expect(screen.getByRole('img', { name: 'safe-image.png' })).toHaveAttribute(
      'src',
      'https://backend.test/api/message/attachments/image-1/preview'
    );
    expect(screen.getByRole('img', { name: 'safe-image.png' })).toHaveAttribute(
      'crossorigin',
      'use-credentials'
    );
  });
});

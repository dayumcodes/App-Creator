import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Modal from '../Modal';

const mockOnClose = vi.fn();

describe('Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.body.style
    Object.defineProperty(document.body, 'style', {
      value: { overflow: '' },
      writable: true,
    });
  });

  it('renders modal with children', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('renders modal with title', () => {
    render(
      <Modal onClose={mockOnClose} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(
      <Modal onClose={mockOnClose} size="small">
        <div>Content</div>
      </Modal>
    );

    expect(document.querySelector('.modal-small')).toBeInTheDocument();

    rerender(
      <Modal onClose={mockOnClose} size="medium">
        <div>Content</div>
      </Modal>
    );

    expect(document.querySelector('.modal-medium')).toBeInTheDocument();

    rerender(
      <Modal onClose={mockOnClose} size="large">
        <div>Content</div>
      </Modal>
    );

    expect(document.querySelector('.modal-large')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Modal onClose={mockOnClose} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    const backdrop = document.querySelector('.modal-backdrop');
    fireEvent.click(backdrop!);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    const modal = document.querySelector('.modal');
    fireEvent.click(modal!);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when other keys are pressed', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Space' });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('sets body overflow to hidden when mounted', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when unmounted', () => {
    const { unmount } = render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('unset');
  });

  it('renders without title header when no title provided', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    expect(screen.queryByText('Close modal')).not.toBeInTheDocument();
    expect(document.querySelector('.modal-header')).not.toBeInTheDocument();
  });

  it('defaults to medium size when no size specified', () => {
    render(
      <Modal onClose={mockOnClose}>
        <div>Modal content</div>
      </Modal>
    );

    expect(document.querySelector('.modal-medium')).toBeInTheDocument();
  });
});
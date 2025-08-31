/**
 * Tests for enhanced SearchBar component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar, { SearchBarProps } from '../SearchBar';

describe('SearchSuggestions', () => {
  const defaultProps = {
    query: '',
    suggestions: ['Taylor Swift', 'Ed Sheeran', 'Billie Eilish'],
    history: ['Previous Search 1', 'Previous Search 2'],
    isVisible: true,
    onSuggestionSelect: jest.fn(),
    onHistoryItemSelect: jest.fn(),
    onClearHistory: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders suggestions and history when visible', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Check for history section
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText('Previous Search 1')).toBeInTheDocument();
    expect(screen.getByText('Previous Search 2')).toBeInTheDocument();

    // Check for suggestions section
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Taylor Swift')).toBeInTheDocument();
    expect(screen.getByText('Ed Sheeran')).toBeInTheDocument();
    expect(screen.getByText('Billie Eilish')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(<SearchSuggestions {...defaultProps} isVisible={false} />);

    expect(screen.queryByText('Recent Searches')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
  });

  it('does not render when no suggestions or history', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        suggestions={[]}
        history={[]}
      />
    );

    expect(screen.queryByText('Recent Searches')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
  });

  it('calls onHistoryItemSelect when history item is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchSuggestions {...defaultProps} />);

    await user.click(screen.getByText('Previous Search 1'));

    expect(defaultProps.onHistoryItemSelect).toHaveBeenCalledWith('Previous Search 1');
  });

  it('calls onSuggestionSelect when suggestion is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchSuggestions {...defaultProps} />);

    await user.click(screen.getByText('Taylor Swift'));

    expect(defaultProps.onSuggestionSelect).toHaveBeenCalledWith('Taylor Swift');
  });

  it('calls onClearHistory when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchSuggestions {...defaultProps} />);

    await user.click(screen.getByText('Clear'));

    expect(defaultProps.onClearHistory).toHaveBeenCalled();
  });

  it('does not show clear button when onClearHistory is not provided', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        onClearHistory={undefined}
      />
    );

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('highlights matching text in suggestions', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        query="taylor"
        suggestions={['Taylor Swift']}
      />
    );

    const highlightedText = screen.getByText('taylor');
    expect(highlightedText).toHaveClass('suggestion-highlight');
  });

  it('handles keyboard navigation', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Simulate ArrowDown key
    fireEvent.keyDown(document, { key: 'ArrowDown' });

    // First item should be selected
    const firstItem = screen.getByText('Previous Search 1').closest('.suggestion-item');
    expect(firstItem).toHaveClass('selected');
  });

  it('handles Enter key to select item', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Navigate to first item and press Enter
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(defaultProps.onHistoryItemSelect).toHaveBeenCalledWith('Previous Search 1');
  });

  it('handles Escape key to clear selection', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Navigate to first item
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    
    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    // No item should be selected
    const items = screen.getAllByRole('option');
    items.forEach(item => {
      expect(item).not.toHaveClass('selected');
    });
  });

  it('cycles through items with arrow keys', () => {
    render(<SearchSuggestions {...defaultProps} />);

    const totalItems = defaultProps.history.length + defaultProps.suggestions.length;

    // Navigate down through all items
    for (let i = 0; i < totalItems; i++) {
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    }

    // Should cycle back to first item
    const firstItem = screen.getByText('Previous Search 1').closest('.suggestion-item');
    expect(firstItem).toHaveClass('selected');
  });

  it('navigates up with ArrowUp key', () => {
    render(<SearchSuggestions {...defaultProps} />);

    // Press ArrowUp (should go to last item)
    fireEvent.keyDown(document, { key: 'ArrowUp' });

    const lastSuggestion = screen.getByText('Billie Eilish').closest('.suggestion-item');
    expect(lastSuggestion).toHaveClass('selected');
  });

  it('updates selection on mouse enter', async () => {
    const user = userEvent.setup();
    render(<SearchSuggestions {...defaultProps} />);

    const suggestionItem = screen.getByText('Taylor Swift').closest('.suggestion-item');
    
    await user.hover(suggestionItem!);

    expect(suggestionItem).toHaveClass('selected');
  });

  it('clears selection on mouse leave', async () => {
    const user = userEvent.setup();
    render(<SearchSuggestions {...defaultProps} />);

    const suggestionItem = screen.getByText('Taylor Swift').closest('.suggestion-item');
    
    await user.hover(suggestionItem!);
    expect(suggestionItem).toHaveClass('selected');

    await user.unhover(suggestionItem!);
    expect(suggestionItem).not.toHaveClass('selected');
  });

  it('respects maxSuggestions prop', () => {
    const manySuggestions = Array.from({ length: 20 }, (_, i) => `Suggestion ${i + 1}`);
    
    render(
      <SearchSuggestions
        {...defaultProps}
        suggestions={manySuggestions}
        maxSuggestions={3}
      />
    );

    // Should only show 3 suggestions (excluding duplicates with history)
    const suggestionItems = screen.getAllByText(/Suggestion \d+/);
    expect(suggestionItems.length).toBeLessThanOrEqual(3);
  });

  it('respects maxHistoryItems prop', () => {
    const manyHistoryItems = Array.from({ length: 10 }, (_, i) => `History ${i + 1}`);
    
    render(
      <SearchSuggestions
        {...defaultProps}
        history={manyHistoryItems}
        maxHistoryItems={3}
      />
    );

    const historyItems = screen.getAllByText(/History \d+/);
    expect(historyItems.length).toBeLessThanOrEqual(3);
  });

  it('filters out suggestions that are already in history', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        history={['Taylor Swift', 'Ed Sheeran']}
        suggestions={['Taylor Swift', 'Ed Sheeran', 'Billie Eilish']}
      />
    );

    // Taylor Swift and Ed Sheeran should only appear in history section
    const taylorElements = screen.getAllByText('Taylor Swift');
    const edElements = screen.getAllByText('Ed Sheeran');
    
    expect(taylorElements).toHaveLength(1); // Only in history
    expect(edElements).toHaveLength(1); // Only in history
    
    // Billie Eilish should appear in suggestions
    expect(screen.getByText('Billie Eilish')).toBeInTheDocument();
  });

  it('shows no suggestions message when query exists but no results', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        query="nonexistent query"
        suggestions={[]}
        history={[]}
      />
    );

    expect(screen.getByText('No suggestions found')).toBeInTheDocument();
  });

  it('does not show suggestions section header when no history exists', () => {
    render(
      <SearchSuggestions
        {...defaultProps}
        history={[]}
      />
    );

    // Should not show "Suggestions" header when there's no history section
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
    
    // But suggestions should still be visible
    expect(screen.getByText('Taylor Swift')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<SearchSuggestions {...defaultProps} />);

    const container = screen.getByRole('listbox');
    expect(container).toHaveAttribute('aria-label', 'Search suggestions');

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);

    // First option should not be selected initially
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('updates aria-selected when item is selected via keyboard', () => {
    render(<SearchSuggestions {...defaultProps} />);

    fireEvent.keyDown(document, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    
    // Other options should not be selected
    for (let i = 1; i < options.length; i++) {
      expect(options[i]).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('cleans up event listeners when unmounted', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = render(<SearchSuggestions {...defaultProps} />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
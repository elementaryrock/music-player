/**
 * Tests for enhanced SearchBar component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar, { SearchBarProps } from '../SearchBar';

describe('Enhanced SearchBar', () => {
  const defaultProps: SearchBarProps = {
    query: '',
    onQueryChange: jest.fn(),
    onSearch: jest.fn(),
    isSearching: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders with default props', () => {
    render(<SearchBar {...defaultProps} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for songs, artists, albums...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('displays custom placeholder', () => {
    render(<SearchBar {...defaultProps} placeholder="Custom placeholder" />);

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('calls onQueryChange when input changes', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'test query');

    expect(defaultProps.onQueryChange).toHaveBeenCalledTimes(10); // Each character
    expect(defaultProps.onQueryChange).toHaveBeenLastCalledWith('test query');
  });

  it('calls onSearch when form is submitted', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} query="test query" />);

    const form = screen.getByRole('combobox').closest('form');
    fireEvent.submit(form!);

    expect(defaultProps.onSearch).toHaveBeenCalledWith('test query');
  });

  it('calls onSearch when search button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} query="test query" />);

    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(defaultProps.onSearch).toHaveBeenCalledWith('test query');
  });

  it('disables search button when query is empty', () => {
    render(<SearchBar {...defaultProps} query="" />);

    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('disables search button when searching', () => {
    render(<SearchBar {...defaultProps} query="test" isSearching={true} />);

    expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled();
  });

  it('shows loading spinner when searching', () => {
    render(<SearchBar {...defaultProps} isSearching={true} />);

    expect(screen.getByLabelText('Searching')).toBeInTheDocument();
  });

  it('calls onDebounceSearch with debouncing', async () => {
    const onDebounceSearch = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    
    render(
      <SearchBar 
        {...defaultProps} 
        onDebounceSearch={onDebounceSearch}
        debounceMs={300}
      />
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'test');

    // Should not be called immediately
    expect(onDebounceSearch).not.toHaveBeenCalled();

    // Advance timers to trigger debounce
    jest.advanceTimersByTime(300);

    expect(onDebounceSearch).toHaveBeenCalledWith('test');
  });

  it('shows clear button when query is not empty', () => {
    render(<SearchBar {...defaultProps} query="test" showClearButton={true} />);

    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when showClearButton is false', () => {
    render(<SearchBar {...defaultProps} query="test" showClearButton={false} />);

    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('calls onClear and clears query when clear button is clicked', async () => {
    const onClear = jest.fn();
    const user = userEvent.setup();
    
    render(
      <SearchBar 
        {...defaultProps} 
        query="test" 
        showClearButton={true}
        onClear={onClear}
      />
    );

    await user.click(screen.getByLabelText('Clear search'));

    expect(onClear).toHaveBeenCalled();
    expect(defaultProps.onQueryChange).toHaveBeenCalledWith('');
  });

  it('displays error message when error prop is provided', () => {
    render(<SearchBar {...defaultProps} error="Search failed" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  it('does not show error when searching', () => {
    render(<SearchBar {...defaultProps} error="Search failed" isSearching={true} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens dropdown when hasResults is true and query is not empty', () => {
    render(
      <SearchBar {...defaultProps} query="test" hasResults={true}>
        <div data-testid="dropdown-content">Results</div>
      </SearchBar>
    );

    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
    const dropdown = screen.getByRole('listbox');
    expect(dropdown).toHaveClass('active');
  });

  it('closes dropdown when query is empty', () => {
    const { rerender } = render(
      <SearchBar {...defaultProps} query="test" hasResults={true}>
        <div data-testid="dropdown-content">Results</div>
      </SearchBar>
    );

    // Initially open
    expect(screen.getByRole('listbox')).toHaveClass('active');

    // Clear query
    rerender(
      <SearchBar {...defaultProps} query="" hasResults={true}>
        <div data-testid="dropdown-content">Results</div>
      </SearchBar>
    );

    expect(screen.getByRole('listbox')).not.toHaveClass('active');
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <SearchBar {...defaultProps} query="test" hasResults={true}>
          <div data-testid="dropdown-content">Results</div>
        </SearchBar>
        <div data-testid="outside">Outside</div>
      </div>
    );

    // Initially open
    expect(screen.getByRole('listbox')).toHaveClass('active');

    // Click outside
    await user.click(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toHaveClass('active');
    });
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} query="test" hasResults={true} />);

    const input = screen.getByRole('combobox');
    input.focus();

    // Press Escape to close dropdown
    await user.keyboard('{Escape}');

    expect(screen.getByRole('listbox')).not.toHaveClass('active');
    expect(input).not.toHaveFocus();
  });

  it('auto-focuses input when autoFocus is true', () => {
    render(<SearchBar {...defaultProps} autoFocus={true} />);

    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('handles disabled state correctly', () => {
    render(<SearchBar {...defaultProps} disabled={true} />);

    const input = screen.getByRole('combobox');
    const button = screen.getByRole('button');
    const container = input.closest('.search-container');

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
    expect(container).toHaveClass('disabled');
  });

  it('prevents form submission when disabled', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} query="test" disabled={true} />);

    const form = screen.getByRole('combobox').closest('form');
    fireEvent.submit(form!);

    expect(defaultProps.onSearch).not.toHaveBeenCalled();
  });

  it('prevents form submission when query is empty', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} query="" />);

    const form = screen.getByRole('combobox').closest('form');
    fireEvent.submit(form!);

    expect(defaultProps.onSearch).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <SearchBar 
        {...defaultProps} 
        query="test" 
        hasResults={true}
        error="Test error"
      />
    );

    const input = screen.getByRole('combobox');
    
    expect(input).toHaveAttribute('aria-label', 'Search for music');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-describedby', 'search-error');

    const dropdown = screen.getByRole('listbox');
    expect(dropdown).toHaveAttribute('aria-label', 'Search results');
  });

  it('updates aria-expanded based on dropdown state', () => {
    const { rerender } = render(
      <SearchBar {...defaultProps} query="test" hasResults={false} />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <SearchBar {...defaultProps} query="test" hasResults={true} />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('cleans up debounce timer on unmount', () => {
    const onDebounceSearch = jest.fn();
    const { unmount } = render(
      <SearchBar 
        {...defaultProps} 
        onDebounceSearch={onDebounceSearch}
      />
    );

    // Type something to start debounce timer
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'test' } });

    // Unmount before timer fires
    unmount();

    // Advance timers - should not call onDebounceSearch
    jest.advanceTimersByTime(1000);
    expect(onDebounceSearch).not.toHaveBeenCalled();
  });

  it('handles focus and blur events correctly', async () => {
    const user = userEvent.setup();
    render(
      <SearchBar {...defaultProps} query="test" hasResults={true}>
        <div>Results</div>
      </SearchBar>
    );

    const input = screen.getByRole('combobox');
    
    // Focus should open dropdown
    await user.click(input);
    expect(screen.getByRole('listbox')).toHaveClass('active');

    // Blur should close dropdown (with delay)
    await user.tab();
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toHaveClass('active');
    }, { timeout: 200 });
  });

  it('trims whitespace from query before searching', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} query="  test  " />);

    const form = screen.getByRole('combobox').closest('form');
    fireEvent.submit(form!);

    expect(defaultProps.onSearch).toHaveBeenCalledWith('test');
  });
});
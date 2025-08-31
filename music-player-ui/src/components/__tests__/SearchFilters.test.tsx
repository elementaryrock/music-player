/**
 * Tests for SearchFilters component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchFilters, { FilterOptions } from '../SearchFilters';

describe('SearchFilters', () => {
  const defaultFilters: FilterOptions = {
    source: 'all',
    duration: 'any',
    quality: 'any',
    sortBy: 'relevance',
    sortOrder: 'desc',
  };

  const defaultProps = {
    filters: defaultFilters,
    onFiltersChange: jest.fn(),
    resultCount: 42,
    isVisible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders filter toggle button when visible', () => {
    render(<SearchFilters {...defaultProps} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('42 results')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(<SearchFilters {...defaultProps} isVisible={false} />);

    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });

  it('shows active filter count when filters are applied', () => {
    const activeFilters = {
      ...defaultFilters,
      source: 'tidal' as const,
      duration: 'short' as const,
    };

    render(<SearchFilters {...defaultProps} filters={activeFilters} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument(); // 2 active filters
  });

  it('expands filter panel when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Sort By')).toBeInTheDocument();
  });

  it('calls onFiltersChange when source filter is changed', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Click Tidal source filter
    await user.click(screen.getByText('Tidal'));

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      source: 'tidal',
    });
  });

  it('calls onFiltersChange when duration filter is changed', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Click short duration filter
    await user.click(screen.getByText('Short (< 3min)'));

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      duration: 'short',
    });
  });

  it('calls onFiltersChange when quality filter is changed', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Click lossless quality filter
    await user.click(screen.getByText('Lossless Only'));

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      quality: 'lossless',
    });
  });

  it('calls onFiltersChange when sort option is changed', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Change sort by
    const sortSelect = screen.getByDisplayValue('Relevance');
    await user.selectOptions(sortSelect, 'title');

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      sortBy: 'title',
    });
  });

  it('toggles sort order when sort order button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Click sort order button
    const sortOrderButton = screen.getByLabelText('Sort ascending');
    await user.click(sortOrderButton);

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      sortOrder: 'asc',
    });
  });

  it('resets filters when reset button is clicked', async () => {
    const user = userEvent.setup();
    const activeFilters = {
      ...defaultFilters,
      source: 'tidal' as const,
      duration: 'short' as const,
    };

    render(<SearchFilters {...defaultProps} filters={activeFilters} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Click reset button
    await user.click(screen.getByText('Reset Filters'));

    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(defaultFilters);
  });

  it('disables reset button when no filters are active', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    const resetButton = screen.getByText('Reset Filters');
    expect(resetButton).toBeDisabled();
  });

  it('enables reset button when filters are active', async () => {
    const user = userEvent.setup();
    const activeFilters = {
      ...defaultFilters,
      source: 'tidal' as const,
    };

    render(<SearchFilters {...defaultProps} filters={activeFilters} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    const resetButton = screen.getByText('Reset Filters');
    expect(resetButton).not.toBeDisabled();
  });

  it('shows active state for selected filters', async () => {
    const user = userEvent.setup();
    const activeFilters = {
      ...defaultFilters,
      source: 'tidal' as const,
      duration: 'short' as const,
    };

    render(<SearchFilters {...defaultProps} filters={activeFilters} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Check that active filters have active class
    const tidalButton = screen.getByText('Tidal');
    const shortButton = screen.getByText('Short (< 3min)');

    expect(tidalButton).toHaveClass('active');
    expect(shortButton).toHaveClass('active');
  });

  it('closes panel when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <SearchFilters {...defaultProps} />
        <div data-testid="outside">Outside element</div>
      </div>
    );

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    expect(screen.getByText('Source')).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByTestId('outside'));

    // Panel should close (filters should not be visible)
    await waitFor(() => {
      const filtersPanel = screen.getByText('Source').closest('.filters-panel');
      expect(filtersPanel).not.toHaveClass('expanded');
    });
  });

  it('handles disabled state correctly', () => {
    render(<SearchFilters {...defaultProps} disabled={true} />);

    const toggleButton = screen.getByText('Filters').closest('button');
    expect(toggleButton).toBeDisabled();

    const container = screen.getByText('Filters').closest('.search-filters');
    expect(container).toHaveClass('disabled');
  });

  it('displays correct result count with singular/plural', () => {
    // Test singular
    render(<SearchFilters {...defaultProps} resultCount={1} />);
    expect(screen.getByText('1 result')).toBeInTheDocument();

    // Test plural
    render(<SearchFilters {...defaultProps} resultCount={5} />);
    expect(screen.getByText('5 results')).toBeInTheDocument();

    // Test zero
    render(<SearchFilters {...defaultProps} resultCount={0} />);
    expect(screen.getByText('0 results')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} />);

    const toggleButton = screen.getByText('Filters').closest('button');
    
    // Check initial state
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButton).toHaveAttribute('aria-label', 'Show search filters');

    // Expand and check
    await user.click(toggleButton!);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows correct sort order icon', async () => {
    const user = userEvent.setup();
    
    // Test descending order (default)
    render(<SearchFilters {...defaultProps} />);
    
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    const sortOrderButton = screen.getByLabelText('Sort ascending');
    expect(sortOrderButton).toBeInTheDocument();

    // Test ascending order
    const ascFilters = { ...defaultFilters, sortOrder: 'asc' as const };
    render(<SearchFilters {...defaultProps} filters={ascFilters} />);
    
    const toggleButton2 = screen.getByText('Filters').closest('button');
    await user.click(toggleButton2!);

    const sortOrderButton2 = screen.getByLabelText('Sort descending');
    expect(sortOrderButton2).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    render(<SearchFilters {...defaultProps} />);

    const toggleButton = screen.getByText('Filters').closest('button');
    
    // Focus and activate with keyboard
    toggleButton!.focus();
    fireEvent.keyDown(toggleButton!, { key: 'Enter' });

    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('prevents interaction when disabled', async () => {
    const user = userEvent.setup();
    render(<SearchFilters {...defaultProps} disabled={true} />);

    const toggleButton = screen.getByText('Filters').closest('button');
    
    // Should not be able to click
    await user.click(toggleButton!);
    
    // Panel should not expand
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
  });

  it('maintains filter state correctly', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SearchFilters {...defaultProps} />);

    // Expand panel
    const toggleButton = screen.getByText('Filters').closest('button');
    await user.click(toggleButton!);

    // Select a filter
    await user.click(screen.getByText('Tidal'));

    // Rerender with updated filters
    const updatedFilters = { ...defaultFilters, source: 'tidal' as const };
    rerender(<SearchFilters {...defaultProps} filters={updatedFilters} />);

    // Expand panel again
    const toggleButton2 = screen.getByText('Filters').closest('button');
    await user.click(toggleButton2!);

    // Check that Tidal is still selected
    const tidalButton = screen.getByText('Tidal');
    expect(tidalButton).toHaveClass('active');
  });
});
/**
 * Tests for enhanced SearchResults component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchResults, { SearchResultsProps } from '../SearchResults';
import { SearchResult } from '../../services/searchEngine';

describe('Enhanced SearchResults', () => {
  const mockResults: SearchResult[] = [
    {
      id: '1',
      title: 'Test Song 1',
      artist: 'Test Artist 1',
      album: 'Test Album 1',
      source: 'jiosaavn',
      confidence: 0.9,
      duration: 180,
      imageUrl: 'https://example.com/image1.jpg',
      audioUrl: 'https://example.com/audio1.mp3',
    },
    {
      id: '2',
      title: 'Test Song 2',
      artist: 'Test Artist 2',
      source: 'tidal',
      confidence: 0.8,
      duration: 240,
      imageUrl: 'https://example.com/image2.jpg',
      audioUrl: 'https://example.com/audio2.flac',
    },
  ];

  const defaultProps: SearchResultsProps = {
    results: mockResults,
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders results correctly', () => {
    render(<SearchResults {...defaultProps} />);

    expect(screen.getByText('Test Song 1')).toBeInTheDocument();
    expect(screen.getByText('Test Artist 1')).toBeInTheDocument();
    expect(screen.getByText('Test Song 2')).toBeInTheDocument();
    expect(screen.getByText('Test Artist 2')).toBeInTheDocument();
  });

  it('displays result count', () => {
    render(<SearchResults {...defaultProps} />);

    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('displays singular result count', () => {
    render(<SearchResults {...defaultProps} results={[mockResults[0]]} />);

    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('shows query in header when provided', () => {
    render(<SearchResults {...defaultProps} query="test query" />);

    expect(screen.getByText('for "test query"')).toBeInTheDocument();
  });

  it('calls onSelect when result is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchResults {...defaultProps} />);

    await user.click(screen.getByText('Test Song 1'));

    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('calls onSelect when play button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchResults {...defaultProps} />);

    const playButton = screen.getAllByLabelText(/Play .* by .*/)[0];
    await user.click(playButton);

    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SearchResults {...defaultProps} />);

    const firstResult = screen.getByText('Test Song 1').closest('li');
    firstResult!.focus();

    await user.keyboard('{Enter}');

    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('handles space key for selection', async () => {
    const user = userEvent.setup();
    render(<SearchResults {...defaultProps} />);

    const firstResult = screen.getByText('Test Song 1').closest('li');
    firstResult!.focus();

    await user.keyboard(' ');

    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('displays loading state', () => {
    render(<SearchResults {...defaultProps} results={[]} isLoading={true} />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading search results')).toBeInTheDocument();
    expect(screen.getByText('Finding the best music for you...')).toBeInTheDocument();
  });

  it('displays error state', () => {
    render(
      <SearchResults 
        {...defaultProps} 
        results={[]} 
        error="Search failed" 
      />
    );

    expect(screen.getByText('Search Error')).toBeInTheDocument();
    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(screen.getByText(/Try searching with different keywords/)).toBeInTheDocument();
  });

  it('displays empty state with default message', () => {
    render(<SearchResults {...defaultProps} results={[]} />);

    expect(screen.getByText('No Results')).toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('displays empty state with custom message', () => {
    render(
      <SearchResults 
        {...defaultProps} 
        results={[]} 
        emptyMessage="Custom empty message"
      />
    );

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('displays empty state with query suggestion', () => {
    render(
      <SearchResults 
        {...defaultProps} 
        results={[]} 
        query="test query"
      />
    );

    expect(screen.getByText(/No results found for/)).toBeInTheDocument();
    expect(screen.getByText('test query')).toBeInTheDocument();
  });

  it('shows source badges when showSource is true', () => {
    render(<SearchResults {...defaultProps} showSource={true} />);

    expect(screen.getByText('JioSaavn')).toBeInTheDocument();
    expect(screen.getByText('Tidal')).toBeInTheDocument();
  });

  it('hides source badges when showSource is false', () => {
    render(<SearchResults {...defaultProps} showSource={false} />);

    expect(screen.queryByText('JioSaavn')).not.toBeInTheDocument();
    expect(screen.queryByText('Tidal')).not.toBeInTheDocument();
  });

  it('shows duration when showDuration is true', () => {
    render(<SearchResults {...defaultProps} showDuration={true} />);

    expect(screen.getByText('3:00')).toBeInTheDocument(); // 180 seconds
    expect(screen.getByText('4:00')).toBeInTheDocument(); // 240 seconds
  });

  it('hides duration when showDuration is false', () => {
    render(<SearchResults {...defaultProps} showDuration={false} />);

    expect(screen.queryByText('3:00')).not.toBeInTheDocument();
    expect(screen.queryByText('4:00')).not.toBeInTheDocument();
  });

  it('shows quality labels when showQuality is true', () => {
    render(<SearchResults {...defaultProps} showQuality={true} />);

    expect(screen.getByText('High Quality')).toBeInTheDocument();
    expect(screen.getByText('Lossless')).toBeInTheDocument();
  });

  it('hides quality labels when showQuality is false', () => {
    render(<SearchResults {...defaultProps} showQuality={false} />);

    expect(screen.queryByText('High Quality')).not.toBeInTheDocument();
    expect(screen.queryByText('Lossless')).not.toBeInTheDocument();
  });

  it('limits results when maxResults is specified', () => {
    render(<SearchResults {...defaultProps} maxResults={1} />);

    expect(screen.getByText('Test Song 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Song 2')).not.toBeInTheDocument();
    expect(screen.getByText('1 result')).toBeInTheDocument();
    expect(screen.getByText('(showing first 1)')).toBeInTheDocument();
  });

  it('displays confidence bars', () => {
    render(<SearchResults {...defaultProps} />);

    const confidenceBars = screen.getAllByTitle(/Relevance: \d+%/);
    expect(confidenceBars).toHaveLength(2);
    expect(confidenceBars[0]).toHaveAttribute('title', 'Relevance: 90%');
    expect(confidenceBars[1]).toHaveAttribute('title', 'Relevance: 80%');
  });

  it('handles image loading errors', async () => {
    render(<SearchResults {...defaultProps} />);

    const images = screen.getAllByRole('img');
    
    // Simulate image error
    fireEvent.error(images[0]);

    await waitFor(() => {
      expect(images[0]).toHaveAttribute('src', expect.stringContaining('♪'));
    });
  });

  it('uses fallback image when no imageUrl is provided', () => {
    const resultsWithoutImages = mockResults.map(result => ({
      ...result,
      imageUrl: undefined,
    }));

    render(<SearchResults {...defaultProps} results={resultsWithoutImages} />);

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('T')); // First letter of title
  });

  it('displays album information when available', () => {
    render(<SearchResults {...defaultProps} />);

    expect(screen.getByText('Test Album 1')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<SearchResults {...defaultProps} />);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Search results');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-label', 'Test Song 1 by Test Artist 1');
    expect(options[0]).toHaveAttribute('tabIndex', '0');
  });

  it('prevents event bubbling on play button click', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    
    render(<SearchResults {...defaultProps} onSelect={onSelect} />);

    const playButton = screen.getAllByLabelText(/Play .* by .*/)[0];
    await user.click(playButton);

    // Should only be called once (from play button), not twice (from result item)
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('handles results without duration gracefully', () => {
    const resultsWithoutDuration = [
      {
        ...mockResults[0],
        duration: undefined,
      },
    ];

    render(
      <SearchResults 
        {...defaultProps} 
        results={resultsWithoutDuration}
        showDuration={true}
      />
    );

    // Should not crash and should not show duration
    expect(screen.getByText('Test Song 1')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d+/)).not.toBeInTheDocument();
  });

  it('applies correct CSS classes for different sources', () => {
    render(<SearchResults {...defaultProps} showSource={true} />);

    const jiosaavnBadge = screen.getByText('JioSaavn');
    const tidalBadge = screen.getByText('Tidal');

    expect(jiosaavnBadge).toHaveClass('source-jiosaavn');
    expect(tidalBadge).toHaveClass('source-tidal');
  });

  it('applies correct CSS classes for different qualities', () => {
    render(<SearchResults {...defaultProps} showQuality={true} />);

    const highQualityBadge = screen.getByText('High Quality');
    const losslessBadge = screen.getByText('Lossless');

    expect(losslessBadge).toHaveClass('quality-tidal');
  });

  it('handles empty results array', () => {
    render(<SearchResults {...defaultProps} results={[]} />);

    expect(screen.getByText('No Results')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('renders lazy loading images', () => {
    render(<SearchResults {...defaultProps} />);

    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });
});
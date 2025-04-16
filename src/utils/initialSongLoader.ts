/**
 * Utility to load initial songs from JioSaavn API
 */
import { searchSongs } from '../services/api';
import { Track, convertSaavnSongToTrack } from '../types/api.types';

/**
 * Load a specific song by title and artist
 * @param title Song title
 * @param artist Song artist
 * @returns Promise with the track if found, null otherwise
 */
export const loadSpecificSong = async (
  title: string,
  artist: string
): Promise<Track | null> => {
  try {
    // Search for the song with both title and artist for better accuracy
    const searchQuery = `${title} ${artist}`;
    const searchResults = await searchSongs(searchQuery);
    
    if (searchResults && searchResults.results && searchResults.results.length > 0) {
      // Try to find an exact match first
      const exactMatch = searchResults.results.find(
        (song) => 
          song.name.toLowerCase().includes(title.toLowerCase()) && 
          song.primaryArtists.toLowerCase().includes(artist.toLowerCase())
      );
      
      if (exactMatch) {
        return convertSaavnSongToTrack(exactMatch);
      }
      
      // If no exact match, return the first result
      return convertSaavnSongToTrack(searchResults.results[0]);
    }
    
    return null;
  } catch (error) {
    console.error('Error loading specific song:', error);
    return null;
  }
};

/**
 * Load initial songs for the playlist
 * @returns Promise with an array of tracks
 */
export const loadInitialSongs = async (): Promise<Track[]> => {
  const songs = [
    { title: "That's So True", artist: "Gracie Abrams" },
    { title: "Golden Hour", artist: "JVKE" }
  ];
  
  const tracks: Track[] = [];
  
  for (const song of songs) {
    const track = await loadSpecificSong(song.title, song.artist);
    if (track) {
      tracks.push(track);
    }
  }
  
  return tracks;
};

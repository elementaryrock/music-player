/**
 * Utility to load songs from JioSaavn API
 */
import { searchSongs } from '../services/api';

/**
 * Load a specific song by title and artist
 * @param title Song title
 * @param artist Song artist
 * @returns Promise with the song data if found, null otherwise
 */
export const loadSpecificSong = async (
  title: string,
  artist: string
): Promise<any | null> => {
  try {
    // Search for the song with both title and artist for better accuracy
    const searchQuery = `${title} ${artist}`;
    const searchResults = await searchSongs(searchQuery);
    
    if (searchResults && searchResults.results && searchResults.results.length > 0) {
      // Try to find an exact match first
      const exactMatch = searchResults.results.find(
        (song: any) => {
          // Add null checks to prevent errors
          if (!song.name || !song.primaryArtists) return false;
          
          return song.name.toLowerCase().includes(title.toLowerCase()) && 
                 song.primaryArtists.toLowerCase().includes(artist.toLowerCase());
        }
      );
      
      if (exactMatch) {
        return exactMatch;
      }
      
      // If no exact match, return the first result that has required fields
      for (const song of searchResults.results) {
        if (song.name && song.primaryArtists && song.downloadUrl && song.image) {
          return song;
        }
      }
      
      // If no valid songs found, return null
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading specific song:', error);
    return null;
  }
};

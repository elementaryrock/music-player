import React, { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";
import "./loading.css";
import "./background.css";
import NowPlayingDisplay from "./components/NowPlayingDisplay";
import PlaybackControls from "./components/PlaybackControls";
import TrackProgress from "./components/TrackProgress";
import Playlist from "./components/Playlist";
import { LrcPlayer } from "./components/LrcPlayer";
import QualitySelector from "./components/QualitySelector";
import SourceToggle, { AudioSource } from "./components/SourceToggle";
import SearchBar from "./components/SearchBar";
import SearchResults from "./components/SearchResults";
import { searchSongs, getLyrics, searchCombined } from "./services/api";
import {
  loadTidalSong,
  loadTidalTrackById,
  testTidalApiConnection,
} from "./services/tidalApi";
import { Track } from "./types/api.types";
import {
  detectAudioFormatSupport,
  logAudioSupportInfo,
  getBestSupportedTidalQuality,
  isAudioUrlSupported,
  getAudioFormatFromUrl,
} from "./utils/audioSupport";
import {
  needsFallback,
  showFormatCompatibilityMessage,
  getRecommendedQuality,
} from "./services/audioFallback";

function App() {
  // State for playlist
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true); // State to toggle lyrics display
  const [isLiked, setIsLiked] = useState(false); // State for like functionality
  const [currentQuality, setCurrentQuality] = useState("320kbps"); // Default to highest quality

  const [currentSource, setCurrentSource] = useState<AudioSource>("jiosaavn"); // Default to JioSaavn

  // Define available qualities based on current source
  const getAvailableQualities = useCallback((): string[] => {
    switch (currentSource) {
      case "tidal": {
        const allTidalQualities = [
          "HI_RES_LOSSLESS",
          "HI_RES",
          "LOSSLESS",
          "HIGH",
          "LOW",
        ];
        // Return qualities ordered by browser compatibility
        const bestSupported = getBestSupportedTidalQuality(allTidalQualities);
        const reordered = [
          bestSupported,
          ...allTidalQualities.filter((q) => q !== bestSupported),
        ];
        return reordered;
      }
      case "jiosaavn":
        return ["320kbps", "160kbps", "96kbps"];
      case "local":
        return ["320kbps"]; // Local files typically have one quality
      default:
        return ["320kbps", "160kbps", "96kbps"];
    }
  }, [currentSource]);

  const availableQualities = getAvailableQualities();

  // Effect to reset quality when source changes
  useEffect(() => {
    const newQualities = getAvailableQualities();
    if (!newQualities.includes(currentQuality)) {
      // Set to the highest quality available for the new source
      setCurrentQuality(newQualities[0]);
    }
  }, [currentSource, currentQuality, getAvailableQualities]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  // Use a ref to track the current track to avoid dependency issues
  const previousTrackRef = useRef<string>("");

  // Initialize audio support detection on component mount
  useEffect(() => {
    logAudioSupportInfo();

    // Test Tidal API connection
    testTidalApiConnection().then((success) => {
      if (success) {
        console.log("✅ Tidal API connection successful");
      } else {
        console.warn("❌ Tidal API connection failed");
      }
    });

    // For Tidal source, check if we need to adjust the default quality
    if (currentSource === "tidal") {
      const recommended = getRecommendedQuality(availableQualities);
      if (recommended.quality !== currentQuality) {
        console.log(
          `🎵 Recommended quality for your browser: ${recommended.quality} (${recommended.reason})`
        );
        setCurrentQuality(recommended.quality);
      }
    }
  }, []); // Run once on mount

  // Effect to load the song from JioSaavn
  useEffect(() => {
    const loadSongFromJioSaavn = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(
          "Attempting to load 'That's So True' by Gracie Abrams from JioSaavn"
        );

        // Use hardcoded data for "That's So True" by Gracie Abrams
        console.log("Using hardcoded data for That's So True by Gracie Abrams");

        // Create a hardcoded song data object with all necessary properties
        const songData = {
          id: "N1jaLl7l", // Using the correct song ID
          name: "That's So True",
          primaryArtists: "Gracie Abrams",
          album: {
            name: "The Secret of Us(Deluxe)",
            id: "45311516",
          },
          duration: "180", // 3 minutes in seconds
          downloadUrl: [
            {
              quality: "320kbps",
              url: "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_320.mp4",
              link: "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_320.mp4",
            },
            {
              quality: "160kbps",
              url: "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_160.mp4",
              link: "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_160.mp4",
            },
            {
              quality: "96kbps",
              url: "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_96.mp4",
              link: "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_96.mp4",
            },
          ],
          image: [
            {
              quality: "50x50",
              url: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-50x50.jpg",
              link: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-50x50.jpg",
            },
            {
              quality: "150x150",
              url: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-150x150.jpg",
              link: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-150x150.jpg",
            },
            {
              quality: "500x500",
              url: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-500x500.jpg",
              link: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-500x500.jpg",
            },
          ],
          url: "https://www.jiosaavn.com/song/thats-so-true/PlkBUDhcAF8",
          media_url:
            "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_320.mp4",
          imageUrl:
            "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-500x500.jpg",
          artists: [
            {
              name: "Gracie Abrams",
              role: "primary_artists",
              image: [
                {
                  quality: "50x50",
                  url: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-50x50.jpg",
                  link: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-50x50.jpg",
                },
                {
                  quality: "150x150",
                  url: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-150x150.jpg",
                  link: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-150x150.jpg",
                },
                {
                  quality: "500x500",
                  url: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-500x500.jpg",
                  link: "https://c.saavncdn.com/311/The-Secret-of-Us-Deluxe-English-2024-20241018063716-500x500.jpg",
                },
              ],
            },
          ],
        };

        console.log("Created hardcoded song data:", songData);

        if (songData) {
          console.log("Successfully loaded song data:", songData);

          // Log the entire song data to see its structure
          console.log("Full song data:", JSON.stringify(songData, null, 2));

          // We're using hardcoded data, so we know the structure is valid
          console.log("Using hardcoded data with valid structure");

          // Get the download URL based on the selected quality (explicitly use 320kbps)
          let audioSrc = getUrlForQuality("320kbps");

          // Log the downloadUrl structure to debug
          console.log(
            "Download URL structure:",
            JSON.stringify(songData.downloadUrl, null, 2)
          );

          // Check if downloadUrl is an array of objects with link property
          if (
            Array.isArray(songData.downloadUrl) &&
            songData.downloadUrl.length > 0
          ) {
            // Log all available versions to help with debugging
            console.log("All available audio versions:", songData.downloadUrl);

            // Define a type for the downloadUrl item
            type DownloadUrlItem = {
              link?: string;
              url?: string;
              quality?: string;
              label?: string;
              [key: string]: string | number | boolean | undefined; // More specific index signature
            };

            // Check if there are multiple versions (vocal vs instrumental)
            const isInstrumental = (item: DownloadUrlItem) => {
              // Check if the URL or any metadata indicates it's an instrumental version
              const url = item.link || item.url || "";
              const quality = item.quality || "";
              const label = item.label || "";

              return (
                url.toLowerCase().includes("instrumental") ||
                quality.toLowerCase().includes("instrumental") ||
                label.toLowerCase().includes("instrumental")
              );
            };

            // First, try to find non-instrumental versions with 'url' property (new format)
            // Start from the highest quality (usually at the end of the array)
            for (let i = songData.downloadUrl.length - 1; i >= 0; i--) {
              if (
                songData.downloadUrl[i] &&
                songData.downloadUrl[i].url &&
                !isInstrumental(songData.downloadUrl[i])
              ) {
                audioSrc = songData.downloadUrl[i].url;
                console.log(
                  `Found vocal audio URL with quality: ${
                    songData.downloadUrl[i].quality || "unknown"
                  }`
                );
                break;
              }
            }

            // If no non-instrumental URL found, try with 'link' property (old format)
            if (!audioSrc) {
              for (let i = songData.downloadUrl.length - 1; i >= 0; i--) {
                if (
                  songData.downloadUrl[i] &&
                  songData.downloadUrl[i].link &&
                  !isInstrumental(songData.downloadUrl[i])
                ) {
                  audioSrc = songData.downloadUrl[i].link;
                  console.log(
                    `Found vocal audio URL with link property, quality: ${
                      songData.downloadUrl[i].quality || "unknown"
                    }`
                  );
                  break;
                }
              }
            }

            // If still no URL found, just use any available URL (even if instrumental)
            if (!audioSrc) {
              // Try url property first
              for (let i = songData.downloadUrl.length - 1; i >= 0; i--) {
                if (songData.downloadUrl[i] && songData.downloadUrl[i].url) {
                  audioSrc = songData.downloadUrl[i].url;
                  console.log(
                    `Falling back to any audio URL with quality: ${
                      songData.downloadUrl[i].quality || "unknown"
                    }`
                  );
                  break;
                }
              }

              // Then try link property
              if (!audioSrc) {
                for (let i = songData.downloadUrl.length - 1; i >= 0; i--) {
                  if (songData.downloadUrl[i] && songData.downloadUrl[i].link) {
                    audioSrc = songData.downloadUrl[i].link;
                    console.log(
                      `Falling back to any audio URL with link property, quality: ${
                        songData.downloadUrl[i].quality || "unknown"
                      }`
                    );
                    break;
                  }
                }
              }
            }
          }
          // Check if downloadUrl is an object with quality keys
          else if (
            typeof songData.downloadUrl === "object" &&
            songData.downloadUrl !== null
          ) {
            // Try to get the highest quality URL
            const qualities = [
              "320kbps",
              "high",
              "160kbps",
              "medium",
              "96kbps",
              "low",
            ];
            for (const quality of qualities) {
              // Use type assertion to avoid TypeScript error
              // @ts-expect-error - We know this is a valid access pattern
              if (songData.downloadUrl[quality]) {
                // @ts-expect-error - We know this is a valid access pattern
                audioSrc = songData.downloadUrl[quality];
                break;
              }
            }

            // If no quality-based URL found, try to get any URL from the object
            if (!audioSrc) {
              for (const key in songData.downloadUrl) {
                if (typeof songData.downloadUrl[key] === "string") {
                  audioSrc = songData.downloadUrl[key];
                  break;
                }
              }
            }
          }
          // Check if downloadUrl is a direct string URL
          else if (typeof songData.downloadUrl === "string") {
            audioSrc = songData.downloadUrl;
          }

          // If still no audioSrc, check if there's a direct 'url' property
          if (!audioSrc && songData.url) {
            audioSrc = songData.url;
          }

          // If still no audioSrc, fall back to local files
          if (!audioSrc) {
            console.error(
              "Could not find valid audio URL, falling back to local files"
            );
            throw new Error("Could not find valid audio URL");
          }

          console.log("Audio source URL:", audioSrc);

          // Get the highest quality image
          let albumArtUrl = "";

          // Log the image structure to debug
          console.log(
            "Image URL structure:",
            JSON.stringify(songData.image, null, 2)
          );

          // Log the artist information to debug
          console.log(
            "Artist information:",
            JSON.stringify(songData.artists, null, 2)
          );

          // First, try to get album art from the artist information
          if (songData.artists && Array.isArray(songData.artists)) {
            // Define a type for the artist item
            type ArtistItem = {
              name: string;
              role?: string;
              image?: Array<{ quality?: string; url?: string; link?: string }>;
              // Use unknown instead of any for better type safety
              [key: string]:
                | string
                | number
                | boolean
                | undefined
                | Array<unknown>
                | Record<string, unknown>;
            };

            // Find the main artist (usually the first one or the one with role 'primary_artists' or 'lyricist')
            const mainArtist =
              songData.artists.find(
                (artist: ArtistItem) =>
                  artist.role === "primary_artists" ||
                  artist.role === "lyricist" ||
                  artist.name.toLowerCase().includes("gracie abrams")
              ) || songData.artists[0];

            if (
              mainArtist &&
              mainArtist.image &&
              Array.isArray(mainArtist.image)
            ) {
              // Try to find the highest quality image from the artist
              for (let i = mainArtist.image.length - 1; i >= 0; i--) {
                if (mainArtist.image[i] && mainArtist.image[i].url) {
                  const quality = mainArtist.image[i].quality || "";
                  // Prefer 500x500 quality
                  if (quality === "500x500") {
                    albumArtUrl = mainArtist.image[i].url;
                    console.log(
                      `Found artist image URL with quality: ${quality}`
                    );
                    break;
                  } else if (!albumArtUrl) {
                    // Save this URL as a fallback
                    albumArtUrl = mainArtist.image[i].url;
                  }
                }
              }

              if (albumArtUrl) {
                console.log("Using artist image for album art:", albumArtUrl);
              }
            }
          }

          // If no artist image found, try the song's image
          if (!albumArtUrl) {
            // Check if image is an array of objects with url property
            if (Array.isArray(songData.image) && songData.image.length > 0) {
              // First, try to find objects with 'url' property (new format)
              for (let i = songData.image.length - 1; i >= 0; i--) {
                if (songData.image[i] && songData.image[i].url) {
                  albumArtUrl = songData.image[i].url;
                  console.log(
                    `Found song image URL with quality: ${
                      songData.image[i].quality || "unknown"
                    }`
                  );
                  break;
                }
              }

              // If no url found, try to find objects with 'link' property (old format)
              if (!albumArtUrl) {
                for (let i = songData.image.length - 1; i >= 0; i--) {
                  if (songData.image[i] && songData.image[i].link) {
                    albumArtUrl = songData.image[i].link;
                    break;
                  }
                }
              }
            }
            // Check if image is an object with quality keys
            else if (
              typeof songData.image === "object" &&
              songData.image !== null
            ) {
              // Try to get the highest quality URL
              const qualities = [
                "500x500",
                "high",
                "150x150",
                "medium",
                "50x50",
                "low",
              ];
              for (const quality of qualities) {
                // Use type assertion to avoid TypeScript error
                // @ts-expect-error - We know this is a valid access pattern
                if (songData.image[quality]) {
                  // @ts-expect-error - We know this is a valid access pattern
                  albumArtUrl = songData.image[quality];
                  break;
                }
              }

              // If no quality-based URL found, try to get any URL from the object
              if (!albumArtUrl) {
                for (const key in songData.image) {
                  if (typeof songData.image[key] === "string") {
                    albumArtUrl = songData.image[key];
                    break;
                  }
                }
              }
            }
            // Check if image is a direct string URL
            else if (typeof songData.image === "string") {
              albumArtUrl = songData.image;
            }
          }

          // If still no albumArtUrl, check if there's a direct 'imageUrl' property
          if (!albumArtUrl && songData.imageUrl) {
            albumArtUrl = songData.imageUrl;
          }

          // If still no albumArtUrl, try the hardcoded URL for Gracie Abrams
          if (
            !albumArtUrl &&
            songData.name &&
            songData.name.toLowerCase().includes("that's so true")
          ) {
            albumArtUrl =
              "https://c.saavncdn.com/890/21-English-2020-20200219232311-500x500.jpg";
            console.log("Using hardcoded album art URL for Gracie Abrams");
          }

          // If still no albumArtUrl, use a default placeholder
          if (!albumArtUrl) {
            console.warn(
              "Could not find valid album art URL, using placeholder"
            );
            albumArtUrl =
              "https://via.placeholder.com/500/121212/FFFFFF?text=Music";
          }

          console.log("Album art URL:", albumArtUrl);

          // Use local LRC file instead of generating one
          const lrcUrl = "/lrc/lyrics.lrc";

          console.log("Using local LRC file for lyrics");

          // Create track object - explicitly use 320kbps URL
          const track: Track = {
            id: 1,
            title: songData.name || "That's So True",
            artist: songData.primaryArtists || "Gracie Abrams",
            // Force the 320kbps URL here
            audioSrc:
              "https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_320.mp4",
            albumArtUrl,
            lrcUrl,
          };

          console.log("Created track with 320kbps URL:", track);

          console.log("Created track object:", track);

          // Add a second track as a fallback
          const fallbackTrack: Track = {
            id: 2,
            title: "Golden Hour",
            artist: "JVKE",
            audioSrc: "/song/song2.mp3",
            albumArtUrl: "/albumart/albumart2.jpg",
            lrcUrl: "/lrc/lyrics2.lrc",
          };

          setPlaylist([track, fallbackTrack]);
          setCurrentTrack(track);
          setCurrentTrackIndex(0);
          console.log("Successfully set up track from JioSaavn");
        } else {
          console.warn(
            "Could not load song from JioSaavn API, falling back to local files"
          );
          // Fallback to local tracks if API fails
          const fallbackPlaylist = [
            {
              id: 1,
              title: "That's So True",
              artist: "Gracie Abrams",
              audioSrc: "/song/song.mp3",
              albumArtUrl: "/albumart/albumart_600.jpg",
              lrcUrl: "/lrc/lyrics.lrc",
            },
            {
              id: 2,
              title: "Golden Hour",
              artist: "JVKE",
              audioSrc: "/song/song2.mp3",
              albumArtUrl: "/albumart/albumart2.jpg",
              lrcUrl: "/lrc/lyrics2.lrc",
            },
          ];

          setPlaylist(fallbackPlaylist);
          setCurrentTrack(fallbackPlaylist[0]);
          setCurrentTrackIndex(0);
          setError(
            "Could not load song from JioSaavn API. Using local files instead."
          );
        }
      } catch (err) {
        console.error("Error loading song from JioSaavn:", err);
        setError(
          "Failed to load song from JioSaavn API. Using local files instead."
        );

        // Fallback to local tracks if API fails
        const fallbackPlaylist = [
          {
            id: 1,
            title: "That's So True",
            artist: "Gracie Abrams",
            audioSrc: "/song/song.mp3",
            albumArtUrl: "/albumart/albumart_600.jpg",
            lrcUrl: "/lrc/lyrics.lrc",
          },
          {
            id: 2,
            title: "Golden Hour",
            artist: "JVKE",
            audioSrc: "/song/song2.mp3",
            albumArtUrl: "/albumart/albumart2.jpg",
            lrcUrl: "/lrc/lyrics2.lrc",
          },
        ];

        setPlaylist(fallbackPlaylist);
        setCurrentTrack(fallbackPlaylist[0]);
        setCurrentTrackIndex(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadSongFromJioSaavn();
    // We only want to run this effect once on component mount, not when currentQuality changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to update time and duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const updateCurrentTime = () => setCurrentTime(audio.currentTime);
    const setAudioDuration = () => setDuration(audio.duration);
    const handleTrackEnd = () => {
      // Play the next track when current track ends
      if (currentTrackIndex < playlist.length - 1) {
        const nextIndex = currentTrackIndex + 1;
        setCurrentTrackIndex(nextIndex);
        setCurrentTrack(playlist[nextIndex]);
        setIsPlaying(true); // Auto-play the next track
      } else {
        setIsPlaying(false); // Stop playing if it's the last track
      }
    };

    audio.addEventListener("timeupdate", updateCurrentTime);
    audio.addEventListener("loadedmetadata", setAudioDuration);
    audio.addEventListener("ended", handleTrackEnd);

    // Cleanup listeners
    return () => {
      audio.removeEventListener("timeupdate", updateCurrentTime);
      audio.removeEventListener("loadedmetadata", setAudioDuration);
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, [currentTrackIndex, playlist, currentTrack]); // Run when track index or playlist changes

  // Effect to handle play/pause based on state
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (isPlaying) {
        audioRef.current
          .play()
          .catch((error) => console.error("Error playing audio:", error));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]); // Run when isPlaying or currentTrack changes

  // Effect to handle track changes
  useEffect(() => {
    // Only reset and reload when the track itself changes, not when play/pause state changes
    if (audioRef.current && currentTrack) {
      // Check if the track has actually changed by comparing audio sources
      const currentTrackSrc = currentTrack.audioSrc;
      if (previousTrackRef.current !== currentTrackSrc) {
        // Track has changed, reset time and reload
        previousTrackRef.current = currentTrackSrc;
        setCurrentTime(0);
        audioRef.current.load();

        // Auto-play if isPlaying is true
        if (isPlaying) {
          audioRef.current
            .play()
            .catch((error) => console.error("Error playing new track:", error));
        }
      }
    }
  }, [currentTrack, isPlaying]); // Include both dependencies but handle logic inside

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Function to handle quality change
  const handleQualityChange = (quality: string) => {
    console.log(`Changing quality to ${quality}`);
    setCurrentQuality(quality);

    // Save current playback position and playing state
    const currentPosition = audioRef.current?.currentTime || 0;
    const wasPlaying = isPlaying;

    // Update the current track with the new quality URL
    if (currentTrack) {
      const newUrl = getUrlForQuality(quality);
      console.log(`Quality change: Selected URL for ${quality}: ${newUrl}`);
      if (newUrl) {
        // Create a new track object with the updated URL
        const updatedTrack = {
          ...currentTrack,
          audioSrc: newUrl,
        };

        // Update the current track
        setCurrentTrack(updatedTrack);

        // After the audio element is updated, restore playback position and state
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = currentPosition;
            if (wasPlaying) {
              audioRef.current.play().catch((error) => {
                console.error(
                  "Error playing audio after quality change:",
                  error
                );
              });
            }
          }
        }, 100);
      }
    }
  };

  // Function to handle track selection from playlist
  const handleTrackSelect = (trackId: number | string) => {
    const trackIndex = playlist.findIndex((track) => track.id === trackId);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
      setCurrentTrack(playlist[trackIndex]);
      setIsPlaying(true); // Auto-play when selecting a track
    }
  };

  // Function to play next track
  const handleNext = () => {
    if (currentTrackIndex < playlist.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(nextIndex);
      setCurrentTrack(playlist[nextIndex]);
      if (isPlaying) {
        // If already playing, continue playing the next track
        setIsPlaying(true);
      }
    }
  };

  // Function to play previous track
  const handlePrev = () => {
    if (currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      setCurrentTrackIndex(prevIndex);
      setCurrentTrack(playlist[prevIndex]);
      if (isPlaying) {
        // If already playing, continue playing the previous track
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = Number(event.target.value);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleLyrics = () => {
    setShowLyrics(!showLyrics);
  };

  // Function to handle audio source change
  const handleSourceChange = async (newSource: AudioSource) => {
    // Save current playback position and playing state
    const currentPosition = audioRef.current?.currentTime || 0;
    const wasPlaying = isPlaying;

    setCurrentSource(newSource);
    console.log(`Changing audio source to ${newSource}`);

    // If we have a current track, update its URL based on the new source
    if (currentTrack) {
      let newUrl = "";

      if (newSource === "local") {
        newUrl = getUrlForQuality(currentQuality, true);
      } else if (newSource === "jiosaavn") {
        newUrl = getUrlForQuality(currentQuality, false);
      } else if (newSource === "tidal") {
        // For Tidal, we need to load the song from Tidal API
        try {
          const tidalTrack = await loadTidalSong(
            currentTrack.title,
            currentTrack.artist
          );
          if (tidalTrack) {
            newUrl = tidalTrack.audioSrc;
            // Update the track with Tidal-specific data
            const updatedTrack = {
              ...currentTrack,
              audioSrc: newUrl,
              albumArtUrl: tidalTrack.albumArtUrl || currentTrack.albumArtUrl,
              lrcUrl: tidalTrack.lrcUrl || currentTrack.lrcUrl,
              source: "tidal" as const,
            };
            setCurrentTrack(updatedTrack);

            // Restore playback position and state
            setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.currentTime = currentPosition;
                if (wasPlaying) {
                  audioRef.current.play().catch((error) => {
                    console.error(
                      "Error playing audio after source change:",
                      error
                    );
                  });
                }
              }
            }, 100);
            return;
          } else {
            console.warn(
              "Could not load track from Tidal, falling back to current source"
            );
            return;
          }
        } catch (error) {
          console.error("Error loading track from Tidal:", error);
          setError("Failed to load track from Tidal");
          return;
        }
      }

      if (newUrl) {
        console.log(
          `Source change: Selected URL for ${currentQuality}: ${newUrl}`
        );

        // Create a new track object with the updated URL
        const updatedTrack = {
          ...currentTrack,
          audioSrc: newUrl,
          source: newSource,
        };

        // Update the current track
        setCurrentTrack(updatedTrack);

        // After the audio element is updated, restore playback position and state
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = currentPosition;
            if (wasPlaying) {
              audioRef.current.play().catch((error) => {
                console.error(
                  "Error playing audio after source change:",
                  error
                );
              });
            }
          }
        }, 100);
      }
    }
  };

  // --- Search handlers ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);

      // Search based on current source
      if (currentSource === "tidal") {
        const results = await searchCombined(searchQuery.trim(), "tidal");
        setSearchResults(results?.combined || []);
      } else if (currentSource === "jiosaavn") {
        const results = await searchSongs(searchQuery.trim());
        setSearchResults(results?.results || []);
      } else {
        // For local files, we can't really search, so search JioSaavn as fallback
        const results = await searchSongs(searchQuery.trim());
        setSearchResults(results?.results || []);
      }
    } catch (err) {
      console.error("Search error", err);
      setError("Failed to search songs");
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = async (song: Track) => {
    try {
      let newTrack: Track;

      // Handle different sources
      if (song.source === "tidal") {
        // For Tidal songs from our new simplified search, they already have the streaming URL
        if (song.audioSrc) {
          // Song already has streaming URL from the direct search
          newTrack = {
            id: song.id || Date.now(),
            title: song.title,
            artist: song.artist,
            audioSrc: song.audioSrc,
            albumArtUrl: song.albumArtUrl,
            album: song.album,
            duration: song.duration,
            source: "tidal",
            lrcUrl: (song as any).lrcUrl, // Include lyrics if available
          };
        } else {
          // Fallback to the old method if no streaming URL is available
          try {
            const { loadTidalTrackById } = await import("./services/tidalApi");

            // Create a TidalTrack object from the search result for metadata
            const searchTrack = {
              id: Number(song.id),
              title: song.title,
              artist: { id: 0, name: song.artist, type: "MAIN" },
              artists: [{ id: 0, name: song.artist, type: "MAIN" }],
              album: {
                id: 0,
                title: song.album || "Unknown Album",
                cover:
                  (song as any).albumArtUrl
                    ?.split("/")
                    .pop()
                    ?.replace(".jpg", "") || "",
              },
              duration: song.duration || 0,
              replayGain: 0,
              peak: 0,
              allowStreaming: true,
              streamReady: true,
              streamStartDate: "",
              premiumStreamingOnly: false,
              trackNumber: 1,
              volumeNumber: 1,
              popularity: 0,
              copyright: "",
              url: "",
              isrc: "",
              editable: false,
              explicit: false,
              audioQuality: "LOSSLESS",
              audioModes: ["STEREO"],
            };

            const tidalTrack = await loadTidalTrackById(
              Number(song.id),
              currentQuality as
                | "LOW"
                | "HIGH"
                | "LOSSLESS"
                | "HI_RES"
                | "HI_RES_LOSSLESS",
              searchTrack
            );
            if (tidalTrack) {
              newTrack = {
                ...tidalTrack,
                id: song.id || Date.now(),
              };
            } else {
              throw new Error("Could not load Tidal track");
            }
          } catch (error) {
            console.error("Error loading Tidal track:", error);
            setError("Failed to load Tidal track");
            return;
          }
        }
      } else {
        // For JioSaavn songs, extract quality URLs
        const qualityUrls: Record<string, string> = {};
        if (Array.isArray((song as any).downloadUrl)) {
          (song as any).downloadUrl.forEach((item: any) => {
            const link = item.link || item.url;
            if (link && item.quality) {
              qualityUrls[item.quality] = link;
            }
          });
        }

        const audioSrc =
          qualityUrls["320kbps"] ||
          qualityUrls["160kbps"] ||
          qualityUrls["96kbps"] ||
          (song as any).media_url ||
          "";

        const albumArtUrl =
          (Array.isArray((song as any).image) && (song as any).image.length > 0
            ? (song as any).image[(song as any).image.length - 1].link ||
              (song as any).image[(song as any).image.length - 1].url
            : (song as any).imageUrl) || "";

        // Extract artist information from multiple possible fields
        const artistName =
          (song as any).primaryArtists ||
          song.artist ||
          ((song as any).artists &&
          Array.isArray((song as any).artists) &&
          (song as any).artists.length > 0
            ? typeof (song as any).artists[0] === "string"
              ? (song as any).artists[0]
              : (song as any).artists[0].name || ""
            : "") ||
          (song as any).featuredArtists ||
          "Unknown";

        console.log("Artist information from search result:", {
          primaryArtists: (song as any).primaryArtists,
          artist: song.artist,
          artists: (song as any).artists,
          featuredArtists: (song as any).featuredArtists,
          selected: artistName,
        });

        // Create the new track without lyrics first
        newTrack = {
          id: song.id || Date.now(),
          title: (song as any).name || song.title || "Unknown",
          artist: artistName,
          audioSrc,
          albumArtUrl,
          qualityUrls,
          album:
            (song as any).album || (song as any).album_name || song.album || "", // Add album
          duration: (song as any).duration
            ? parseInt((song as any).duration, 10)
            : song.duration, // Add duration
          source: "jiosaavn",
        };
      }

      // Add the new track to the playlist (append if not already present)
      let newIndex = 0;
      setPlaylist((prevPlaylist) => {
        const existingIndex = prevPlaylist.findIndex(
          (trk) => trk.id === newTrack.id
        );
        if (existingIndex !== -1) {
          // Track already exists, keep playlist unchanged and use its index
          newIndex = existingIndex;
          return prevPlaylist;
        }
        // Append the new track to the end of the playlist
        const updated = [...prevPlaylist, newTrack];
        newIndex = updated.length - 1;
        return updated;
      });
      // Update currently playing track and index
      setCurrentTrack(newTrack);
      setCurrentTrackIndex(newIndex);
      setCurrentQuality("320kbps");
      setIsPlaying(true);
      setSearchResults([]);

      // Then fetch lyrics asynchronously
      try {
        const lyrics = await getLyrics(
          newTrack.title,
          newTrack.artist,
          newTrack.album,
          newTrack.duration
        );

        if (lyrics) {
          // Create a Blob URL for the lyrics content
          const blob = new Blob([lyrics], { type: "text/plain" });
          const lrcUrl = URL.createObjectURL(blob);

          // Update the track with lyrics URL
          const updatedTrack = { ...newTrack, lrcUrl };
          setCurrentTrack(updatedTrack);
          setPlaylist((prevPlaylist) => {
            const updated = [...prevPlaylist];
            updated[newIndex] = updatedTrack;
            return updated;
          });
        } else {
          console.log("No lyrics found");
        }
      } catch (lyricsError) {
        console.error("Error fetching lyrics:", lyricsError);
        // We don't set an error state here to avoid disrupting the music playback
      }
    } catch (err) {
      console.error("Error loading selected song", err);
      setError("Failed to load the selected song");
    }
  };

  // Helper function to get URL for a specific quality
  const getUrlForQuality = (
    quality: string = "320kbps", // Default to 320kbps if no quality is specified
    forceLocalFiles?: boolean
  ): string => {
    // Ensure we have a valid quality, defaulting to 320kbps
    const validQuality = quality || "320kbps";

    // If using JioSaavn and currentTrack has URLs, prefer them
    if (!forceLocalFiles && currentTrack?.qualityUrls) {
      const mapped =
        currentTrack.qualityUrls[validQuality] ||
        currentTrack.qualityUrls["320kbps"];
      if (mapped) return mapped;
    }

    // For testing purposes, let's use local files that we know work
    const localFileMap: Record<string, string> = {
      "320kbps": "/song/song.mp3",
      "160kbps": "/song/song.mp3",
      "96kbps": "/song/song.mp3",
    };

    // JioSaavn URLs - these might not work due to CORS or other issues
    const jiosaavnMap: Record<string, string> = {
      "320kbps": `https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_320.mp4`,
      "160kbps": `https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_160.mp4`,
      "96kbps": `https://aac.saavncdn.com/311/fd020307cf90bf63618aac025d9351d8_96.mp4`,
    };

    // Determine whether to use local files based on the current state or the forceLocalFiles parameter
    const shouldUseLocalFiles =
      forceLocalFiles !== undefined
        ? forceLocalFiles
        : currentSource === "local";

    console.log(
      `Getting URL for quality: ${validQuality}, using ${
        shouldUseLocalFiles ? "local files" : "JioSaavn URLs"
      }`
    );

    // Choose between local files and JioSaavn URLs, always defaulting to 320kbps if the requested quality is not available
    const url = shouldUseLocalFiles
      ? localFileMap[validQuality] || localFileMap["320kbps"]
      : jiosaavnMap[validQuality] || jiosaavnMap["320kbps"];

    console.log(`Selected URL: ${url}`);

    return url;
  };

  // Set CSS variable for album art background
  useEffect(() => {
    if (currentTrack?.albumArtUrl) {
      document.documentElement.style.setProperty(
        "--album-art-url",
        `url(${currentTrack.albumArtUrl})`
      );
    }
  }, [currentTrack?.albumArtUrl]);

  return (
    <div className="App">
      {/* Blurred Background */}
      <div
        className={`app-background ${
          currentTrack?.albumArtUrl ? "dynamic-background" : ""
        }`}
      ></div>

      {/* Overlay to darken background slightly for contrast */}
      <div className="background-overlay"></div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Loading song from JioSaavn...</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="error-close-button"
            type="button"
          >
            ×
          </button>
        </div>
      )}

      {/* Search Component with Floating Dropdown - Moved to top */}
      <SearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
        hasResults={searchResults.length > 0}
      >
        <SearchResults results={searchResults} onSelect={handleResultSelect} />
      </SearchBar>

      {/* Hidden Audio Element with Enhanced Error Handling */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.audioSrc}
          preload="metadata"
          onError={(e) => {
            console.error("🚫 Audio error:", e);
            const error = e.currentTarget.error;

            // Check if this is a format compatibility issue
            const format = getAudioFormatFromUrl(currentTrack.audioSrc);
            if (format && needsFallback(currentTrack.audioSrc)) {
              console.warn(`⚠️ Audio format '${format}' may not be supported`);
              showFormatCompatibilityMessage(format, currentQuality);

              // For Tidal FLAC, suggest switching to a lower quality
              if (format === "flac" && currentSource === "tidal") {
                const recommended = getRecommendedQuality(availableQualities);
                setError(
                  `FLAC format not supported in this browser. Try switching to "${recommended.quality}" quality for better compatibility.`
                );
              } else {
                setError(
                  `Audio format '${format}' not supported. Try switching to a different quality or source.`
                );
              }
            } else {
              setError(
                `Error loading audio: ${error?.message || "Unknown error"}`
              );
            }
          }}
          onCanPlay={() => {
            console.log("✅ Audio ready to play");
            // Clear any previous format-related errors
            if (error && error.includes("format")) {
              setError(null);
            }
          }}
          onLoadStart={() => {
            const format = getAudioFormatFromUrl(currentTrack.audioSrc);
            if (format) {
              console.log(
                `🎵 Loading ${format.toUpperCase()} audio:`,
                currentTrack.audioSrc
              );
            }
          }}
          /* Remove controls to hide the default player */
        ></audio>
      )}

      <div className="content-layout">
        {/* Left side: Music Player */}
        <div className="player-container">
          {currentTrack ? (
            <>
              <NowPlayingDisplay
                trackTitle={currentTrack.title}
                artistName={currentTrack.artist}
                albumArtUrl={currentTrack.albumArtUrl}
                initialLiked={isLiked}
                onLikeToggle={setIsLiked}
                currentTrack={{
                  audioSrc: currentTrack.audioSrc,
                  source: currentTrack.source,
                }}
                currentQuality={currentQuality}
              />
              <TrackProgress
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
              />
              <PlaybackControls
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onNext={handleNext}
                onPrev={handlePrev}
              />

              {/* Quality Selector */}
              <QualitySelector
                currentQuality={currentQuality}
                onQualityChange={handleQualityChange}
                availableQualities={availableQualities}
              />

              {/* Source Toggle */}
              <SourceToggle
                currentSource={currentSource}
                onSourceChange={handleSourceChange}
              />

              {/* Lyrics toggle button for mobile */}
              <button
                className="lyrics-toggle-button"
                onClick={toggleLyrics}
                type="button"
                aria-label={showLyrics ? "Hide Lyrics" : "Show Lyrics"}
              >
                {showLyrics ? "Hide Lyrics" : "Show Lyrics"}
              </button>
            </>
          ) : (
            <div className="loading-player">
              <p>Loading player...</p>
            </div>
          )}
        </div>

        {/* Right side: Lyrics Display (conditionally shown) */}
        {showLyrics && currentTrack && (
          <div className="lyrics-panel">
            <LrcPlayer
              lrcUrl={currentTrack.lrcUrl || "/lrc/lyrics.lrc"}
              currentTime={currentTime}
            />
          </div>
        )}
      </div>

      {/* Playlist area - positioned below in mobile view */}
      <div className="playlist-container">
        <Playlist
          tracks={playlist}
          currentTrackId={currentTrack?.id || 0}
          onTrackSelect={handleTrackSelect}
        />
      </div>
    </div>
  );
}

export default App;

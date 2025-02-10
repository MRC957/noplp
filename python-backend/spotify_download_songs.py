
import json
from spotify import SpotifyDriver


if __name__ == "__main__":
    spotify_driver = SpotifyDriver()


    # Read the playlist JSON file
    PLAYLIST_FILE = "client/public/playlist.json"
    with open(PLAYLIST_FILE, 'r', encoding='utf-8') as f:
        playlist = json.load(f)

    # Search each song from the playlist on Spotify
    LYRICS_FOLDER = "client/public/lyrics"
    for song in playlist['songs']:
        try:
            title = song['title']
            artist = song['artist']
            print(f"Searching for: {title} by {artist}")
            
            song_data, df_lyrics = spotify_driver.search(title, artist)
            
            df_lyrics.to_csv(f"{LYRICS_FOLDER}/{song_data["id"]}.csv", index=False)
            print(f"Found: {song_data["name"]}")

            song["id"] = song_data["id"]
            
        except Exception as e:
            print(f"Error searching for '{title}' by '{artist}': {e}")


    # Write updated playlist back to file
    with open(PLAYLIST_FILE, 'w', encoding='utf-8') as f:
        json.dump(playlist, f, ensure_ascii=False, indent=4)



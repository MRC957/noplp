from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import os
import json
import pandas as pd
from spotify import SpotifyDriver, SpotifyLyricsDriver

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

sockets = []

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join('public', path)):
        return send_from_directory('public', path)
    return send_from_directory('public', 'index.html')

# Add new route to serve playlist
@app.route('/api/playlist', methods=['GET'])
def get_playlist():
    try:
        # Read the playlist.json
        with open('client/public/playlist.json', 'r') as f:
            playlist = json.load(f)
            
        # Update the lyrics file path to point to CSV instead of LRC
        # for song in playlist['songs']:
        #     if 'files' in song:
        #         # Change extension from .lrc to .csv
        #         song['files']['lyrics'] = song['files']['lyrics'].replace('.lrc', '.csv')
                
        return jsonify(playlist)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/song/<song_id>', methods=['GET'])
def get_song(song_id):
    try:
        spotify = SpotifyDriver()
        song_data = spotify.get_track(song_id)
        song_data['lyrics'] = song_data['lyrics'].to_dict(orient='records')
        return jsonify(song_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

DEFAULT_WORDS_TO_GUESS = 5

@app.route('/api/getLyrics/<track_id>/<words_to_guess>', methods=['GET'])
def get_lyrics(track_id, words_to_guess=5):
    """Return lyrics for a given track_id as a list of couples (timecodeMs, content)"""
    try:
        if not isinstance(words_to_guess, int): 
            words_to_guess = DEFAULT_WORDS_TO_GUESS
        list_lyrics = {}
        df_lyrics = SpotifyLyricsDriver().get_lyrics(track_id)
        list_lyrics["lyrics"] = df_lyrics.to_dict(orient='records')
        list_lyrics["lyricsToGuess"] = extract_lyric_to_guess(df_lyrics, words_to_guess=int(words_to_guess)).to_dict(orient='records')
        return jsonify(list_lyrics)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def extract_lyric_to_guess(df, words_to_guess=5):
    """Extract the lyrics to guess from the lyrics dataframe"""


    # Count the number of words in each line separated by a space " " or a " ' "
    df['word_count'] = df['words'].apply(lambda x: len(x.replace("'", " ").split()))

    # Choose a random row where word_count is greater than 'nb_missing_lyrics after the 10 first lyrics
    min_song_duration = 20000 # Guess after min 20 seconds
    df_reduced = df[df["startTimeMs"] > min_song_duration]
    guess_candidates = df_reduced[df_reduced['word_count'] == words_to_guess]

    # Add condition to discard when MORE than words_to_guess

    if guess_candidates.empty:
        if words_to_guess == 1 :
            return guess_candidates.iloc[:1]
        return extract_lyric_to_guess(df, words_to_guess-1)
    else:
        return guess_candidates.iloc[:1] # TODO: remove because only to accelerate testing
        return guess_candidates.sample(1)


# @app.route('/api/lyrics/<song_id>', methods=['GET'])
# def get_lyrics(song_id):
#     try:
#         spotify = SpotifyDriver()
#         song_data = spotify.get_track(song_id)
        
#         df = song_data['lyrics']
#         mapping_columns = {
#             "words": "content",
#             "startTimeMs": "timecode"
#         }
#         df.rename(columns=mapping_columns, inplace=True)
#         df = df.astype({'timecode': 'int32'})

#         lyrics = df.to_dict(orient='records')
#         return jsonify(lyrics)
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

@socketio.on('connect')
def handle_connect():
    sockets.append(request.sid)
    join_room('karaoke')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('show-intro')
def handle_show_intro():
    emit('to-intro', room='karaoke', skip_sid=request.sid)

@socketio.on('show-categories')
def handle_show_categories(args):
    emit('to-categories', args, room='karaoke', skip_sid=request.sid)

@socketio.on('show-song-list')
def handle_show_song_list(args):
    emit('to-song-list', args, room='karaoke', skip_sid=request.sid)

@socketio.on('goto-song')
def handle_goto_song(args):
    emit('to-song', args, room='karaoke', skip_sid=request.sid)

@socketio.on('play-song')
def handle_play_song():
    emit('play', room='karaoke', skip_sid=request.sid)

@socketio.on('propose-lyrics')
def handle_propose_lyrics(args):
    emit('show-suggested-lyrics', args, room='karaoke', skip_sid=request.sid)

@socketio.on('validate-lyrics')
def handle_validate_lyrics():
    emit('validate-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('freeze-lyrics')
def handle_freeze_lyrics():
    emit('freeze-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('reveal-lyrics')
def handle_reveal_lyrics():
    emit('reveal-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('continue-lyrics')
def handle_reveal_lyrics():
    emit('continue-lyrics', room='karaoke', skip_sid=request.sid)

@socketio.on('set-perf-mode')
def handle_set_perf_mode(args):
    emit('set-perf-mode', args, room='karaoke', skip_sid=request.sid)

@app.route('/api/spotify/auth', methods=['GET'])
def get_spotify_auth():
    try:
        spotify = SpotifyDriver()
        auth_url = spotify.get_auth_url()
        return jsonify({"url": auth_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/spotify/token', methods=['POST'])
def get_spotify_token():
    try:
        code = request.json.get('code')
        spotify = SpotifyDriver()
        token_info = spotify.get_user_token(code)
        return jsonify(token_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('REACT_APP_WEBSOCKET_SERVER', '4001').split(':')[-1])
    socketio.run(app, host='0.0.0.0', port=port)
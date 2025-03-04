import os
import sys
import requests
import base64
from os import getenv
import urllib.parse

from enum import Enum
from datetime import datetime, timedelta

def refresh_login(f):
    def wrapper(*args):
        args[0].login()
        return f(*args)
    return wrapper

class SpotifySearchType(Enum):
    TRACK="track"
    ALBUM="album"
    ARTIST="artist"
    PLAYLIST="playlist"
    SHOW="show"
    EPISODE="episode"

class SpotifyDriver:
    def __init__(self) -> None:
        client_id, client_secret = getenv('SPOTIFY_CLIENT_ID'), getenv('SPOTIFY_CLIENT_SECRET')
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.datetime_to_ask_new_token = datetime.now()

        self.BASE_AUTH_ADDRESS = "https://accounts.spotify.com"
        self.TOKEN_URI = "/api/token"

        self.BASE_API_ADDRESS = "https://api.spotify.com/v1"
        self.SEARCH_API = "/search"

        self.login()

    def login(self):
        if datetime.now() < self.datetime_to_ask_new_token:
            return

        auth_payload = f"{self.client_id}:{self.client_secret}"

        headers = {
            "Authorization": f"Basic {base64.b64encode(auth_payload.encode('ascii')).decode('ascii')}",
        }
        url = f"{self.BASE_AUTH_ADDRESS}{self.TOKEN_URI}"
        data = {
            "grant_type": "client_credentials"
        }
        rsp = requests.post(url, headers=headers, data=data)

        if rsp.status_code > 299:
            raise RuntimeError(f"Failed to login to spotify: {rsp.json()}")

        token = rsp.json()['access_token']
        self.token = token

        # Store token expiration time
        expires_in = rsp.json()['expires_in']
        self.datetime_to_ask_new_token = datetime.now() + timedelta(minutes=int(expires_in))


    @refresh_login
    def search(self, track_name, artist):
        type = SpotifySearchType.TRACK.value
        query = f"{track_name} artist:{artist}"

        url = f"{self.BASE_API_ADDRESS}{self.SEARCH_API}"
        headers = {
            "Authorization": f"Bearer {self.token}",
        }
        params = {
            "type": type,
            "q": query
        }
        rsp = requests.get(url, headers=headers, params=params)

        if rsp.status_code > 299:
            raise RuntimeError(f"Failed to search in spotify: {rsp.json()}")

        rsp_json = rsp.json()

        items = rsp_json.get('tracks').get('items')
        if len(items) == 0:
            raise RuntimeError(f"No tracks found for {query}")

        track_id = items[0].get('id')
        df_lyrics = SpotifyLyricsDriver().get_lyrics(track_id)

        # Get preview URL from the track data
        preview_url = items[0].get('preview_url')
        if not preview_url:
            raise RuntimeError(f"No preview URL available for track {track_id}")

        return {
            'track': items[0],
            'lyrics': df_lyrics,
            'preview_url': preview_url
        }
    
    @refresh_login
    def get_track(self, track_id):
        # url = f"{self.BASE_API_ADDRESS}/tracks/{track_id}"
        # headers = {
        #     "Authorization": f"Bearer {self.token}",
        # }
        # rsp = requests.get(url, headers=headers)

        # if rsp.status_code > 299:
        #     raise RuntimeError(f"Failed to get track from spotify: {rsp.json()}")

        # track = rsp.json()
        df_lyrics = SpotifyLyricsDriver().get_lyrics(track_id)
        
        return {
            # 'track': track,
            'lyrics': df_lyrics,
            # 'uri': f"spotify:track:{track_id}"  # Replace preview_url with uri
        }

    def get_auth_url(self):
        scope = "streaming user-read-email user-read-private"
        redirect_uri = "http://localhost:3000/callback"
        auth_url = f"{self.BASE_AUTH_ADDRESS}/authorize"
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "scope": scope,
            "redirect_uri": redirect_uri
        }
        return f"{auth_url}?{urllib.parse.urlencode(params)}"

    def get_user_token(self, code):
        redirect_uri = "http://localhost:3000/callback"
        url = f"{self.BASE_AUTH_ADDRESS}{self.TOKEN_URI}"
        auth_payload = f"{self.client_id}:{self.client_secret}"
        
        headers = {
            "Authorization": f"Basic {base64.b64encode(auth_payload.encode('ascii')).decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri
        }
        
        rsp = requests.post(url, headers=headers, data=data)
        if rsp.status_code > 299:
            raise RuntimeError(f"Failed to get user token: {rsp.json()}")
            
        return rsp.json()

class SpotifyLyricsDriver:
    def __init__(self) -> None:
        # Refresh via https://open.spotify.com/get_access_token
        self.token = None
        self.datetime_to_ask_new_token = datetime.now()


        self.BASE_AUTH_ADDRESS = "https://open.spotify.com"
        self.TOKEN_URI = "/get_access_token"

        self.BASE_API_ADDRESS = "https://spclient.wg.spotify.com/color-lyrics/v2"
        self.SEARCH_API = "/track/{track_id}"

    def login(self):
        if datetime.now() < self.datetime_to_ask_new_token:
            return

        url = f"{self.BASE_AUTH_ADDRESS}{self.TOKEN_URI}"


        headers = {
            'content-type': 'text/html; charset=utf-8',
            'app-platform': 'WebPlayer',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
            "cookie" : f"sp_dc={getenv("SPOTIFY_SD_DC")}"
        }

        rsp = requests.get(url, headers=headers)
        # print(f"isAnonymous: {rsp.json().get('isAnonymous')}")

        if rsp.status_code > 299:
            raise RuntimeError(f"Failed to refresh token to get lyrics: {rsp.json()}")

        # print(f"Token found: {rsp.json()['accessToken']}")
        self.token = rsp.json()['accessToken']

        # Store token expiration time
        expires_in = rsp.json()['accessTokenExpirationTimestampMs']
        self.datetime_to_ask_new_token = datetime.fromtimestamp(expires_in / 1000)



    @refresh_login
    def get_lyrics(self, track_id):

        url = f"{self.BASE_API_ADDRESS}{self.SEARCH_API.format(track_id=track_id)}"
        headers = {
            'Cache-Control': 'no-cache',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'app-platform': 'WebPlayer',
            'Authorization': f'Bearer {self.token}',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
        }
        params = {
            "format": "json",
            "vocalRemoval": "false"
        }
        rsp = requests.get(url, headers=headers, params=params)

        if rsp.status_code > 299:
            raise RuntimeError(f"Failed to search in spotify: {rsp.json()}")

        import pandas as pd
        df = pd.DataFrame(rsp.json()["lyrics"]["lines"])
        df = df[["startTimeMs", "words"]].astype({"startTimeMs": int})
        return df
    
        # # Count the number of words in each line separated by a space " " or a " ' "
        # df['word_count'] = df['words'].apply(lambda x: len(x.replace("'", " ").split()))

        # # Choose a random row where word_count is greater than 'nb_missing_lyrics after the 10 first lyrics
        # nb_missing_lyrics = 5
        # df_reduced = df[10:]
        # missing_lyrics = df_reduced[df_reduced['word_count'] > nb_missing_lyrics].sample(1)
        # return df
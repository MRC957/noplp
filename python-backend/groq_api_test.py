

from os import getenv
from groq import Groq
import json
from spotify import SpotifyDriver

# # Write JSON data to file
# with open('data_1.json', 'w', encoding='utf-8') as f:
#     json.dump(json_data, f, ensure_ascii=False, indent=4)

# # Load JSON data from file
# with open('data_1.json', 'r', encoding='utf-8') as f:
#     json_data = json.load(f)


class GroqAPI:
    def __init__(self):
        self.client = Groq(
            api_key=getenv('GROQ_API_KEY'),
        )
        self.all_messages = []
        self.spotify_driver = SpotifyDriver()

    def get_available_models(self):
        # 1) List available models
        import requests

        api_key = getenv('GROQ_API_KEY')
        url = "https://api.groq.com/openai/v1/models"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        response = requests.get(url, headers=headers)

        print(response.json())

    def get_playlist_from_groq(self):

        self.all_messages.extend([
                {
                    "role": "system",
                    "content": """Tu es un expert en chansons françaises et tu connais les paroles et les thèmes de toutes la chansons depuis 1950 jusque 2025. Tu dois proposer des choix populaires pour un karaoké.
                            Tu devras inventer un thème, en maximum 5 mots et choisir des chansons populaires et qui correspondent à ce thème par leurs paroles, leur artiste, leur titre ou les thèmes abordés. Ces chansons doivent avoir fait partie du top 50 français au moins une fois.
                            Le thème peut aussi être une décennie à laquelle appartient les chansons, le nombre de lettres que comportent les artistes ou le titre, quelque-chose de commun entre le nom des artistes ou les titres, etc.
                            
                            Le thème choisi doit apparaître dans toutes les chansons choisies (paroles, décénie, artiste, titre). Le thème est commun à toutes les chansons choisies chansons.
                            S'il y a plusieurs artistes ou titres qui correspondent au thème, tu ne garderas que l'artiste principal.
                            Il est important que la chanson existe et corresponde bien à l'artiste.

                            Ta réponse sera uniquement un JSON sur une seule ligne capable d'être lu par une machine. Veuille à mettre les guillemets au bon endroit.
                            Exemple :
                            {
                                "thème" : <theme>,
                                "songs" : [
                                    {
                                        "title" : "<title1>",
                                        "artist" : "<artist1>"
                                    },
                                    {
                                        "title" : "<title2>",
                                        "artist" : "<artist2>"
                                    },
                                    ...

                                ],
                                "explanation" : <explication du choix des chansons>
                            }"""
                },
                {
                    "role": "user",
                    "content": "Donne moi un thème et 2 chansons qui correspondent",
                }
            ])

        # Attempt 1
        chat_completion = self.client.chat.completions.create(
            messages=self.all_messages,
            # model="llama3-8b-8192",
            model="llama-3.3-70b-versatile",
        )

        rsp = chat_completion.choices[0].message.content
        print(rsp)

        # Extract JSON from the response string
        import re
        import json
        json_match = re.search(r'\{.*\}', rsp, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            try:
                json_data = json.loads(json_str)
                # print(json_data)
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON: {e}")
        else:
            print("No JSON found in the response.")

        return json_data


    def extract_track_name_and_artist(self, track_str):
        track_name = track_str.split(' - ')[0]
        artist = track_str.split(' - ')[1]
        return track_name, artist

    def get_spotify_track(self, track_name, artist):
        return self.spotify_driver.search(track_name, artist)

    def get_next_playlist(self):
        # Attempt 2
        chat_completion = self.client.chat.completions.create(
            messages=self.all_messages,
            model="llama-3.3-70b-versatile",
        )
        rsp = chat_completion.choices[0].message.content
        print(rsp)

        self.all_messages.extend([
                {
                    "role": "assistant",
                    "content": rsp,
                },
                {
                    "role": "user",
                    "content": "Fais le encore, avec un autre thème et 2 autres chansons qui y correspondent",
                }
        ])

        # Attempt 3
        chat_completion = self.client.chat.completions.create(
            messages=self.all_messages,
            model="llama-3.3-70b-versatile",
        )
        rsp = chat_completion.choices[0].message.content
        print(rsp)


if __name__ == "__main__":
    groq_api = GroqAPI()
    json_data = groq_api.get_playlist_from_groq()

    # # Load JSON data from file
    # with open('data_1.json', 'r', encoding='utf-8') as f:
    #     json_data = json.load(f)
    for song in json_data['songs']:

        try:
            track_name = song.get('title')
            artist = song.get('artist')
            # artist = groq_api.extract_track_name_and_artist(track_str)
            res = groq_api.get_spotify_track(track_name, artist)
            print(res)
        except RuntimeError as e:
            print(e)

    print(res)


    groq_api.get_next_playlist()


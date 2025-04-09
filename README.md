# N'oubliez Pas Les Paroles !

Interface du jeu développée en React, inspirée par l'émission TV "N'oubliez pas les paroles". L'application est en deux parties : une première pour les joueur·ses diffusée sur un grand écran et une bonne paire d'enceinte, la seconde est la régie et sert à contrôler le déroulement du jeu.

![Intro](intro.gif)

## Présentation du jeu

Ce jeu de karaoké permet de mettre en compétition deux équipes de joueurs, supervisées par un animateur. 

- Les équipes chantent à tour de rôle sur des chansons sélectionnées par catégorie
- Lors d'un passage, la musique s'interrompt à un moment précis et les paroles disparaissent
- L'équipe doit retrouver les paroles manquantes pour gagner des points
- L'animateur contrôle le déroulement du jeu via l'interface de régie (ControllerComponent)
- Les joueurs chantent devant l'écran principal (TerminalComponent)

### Fonctionnalités principales

- **Sélection par catégories**: Organisez vos chansons par thèmes ou artistes
- **Choix de paroles à deviner**: L'animateur peut sélectionner précisément le passage à faire deviner
- **Validation et correction**: Contrôle des réponses avec visualisation des mots corrects et incorrects
- **Playlists personnalisées**: Créez et sauvegardez différentes listes de chansons
- **Intégration Spotify**: Lecture des chansons via l'API Spotify
- **Gestion de base de données**: Ajoutez, modifiez et catégorisez vos chansons facilement

## Structure du projet

Le projet est divisé en deux parties principales :
- **client**: Application React pour l'interface utilisateur
  - **ControllerComponent**: Interface de régie pour l'animateur
  - **TerminalComponent**: Affichage principal pour les joueurs
  - **DatabaseEditor**: Gestion des chansons et catégories
- **python-backend**: Serveur Python pour la gestion des données et API

## Prérequis

<!-- - Docker pour l'installation via conteneur -->
- Un navigateur web moderne (Firefox recommandé)
- Une connexion Internet pour l'intégration avec Spotify

<!-- ## Build

Depuis la racine du projet :

```shell
docker build . -t noplp
``` -->

## Utilisation
<!-- 
### Démarrer le serveur : 

```shell
docker run --rm -p 8080:8080 noplp
``` -->

### Accéder aux interfaces :

- **Interface de jeu (pour les joueurs)**: [http://localhost:8080](http://localhost:8080)
- **Interface de régie (pour l'animateur)**: [http://localhost:8080/controller](http://localhost:8080/controller)
- **Gestionnaire de base de données**: [http://localhost:8080/database](http://localhost:8080/database)

### Déroulement d'une partie :

1. L'animateur sélectionne une playlist depuis l'interface de régie
2. Les joueurs voient les catégories disponibles sur l'écran principal
3. Une fois une catégorie choisie, l'animateur peut sélectionner une chanson
4. Pendant la lecture, la musique s'arrête à un moment précis pour faire deviner les paroles
5. L'animateur saisit la proposition de l'équipe et contrôle la validation
6. L'animateur peut révéler les bonnes paroles ou continuer la chanson

### Contrôles de l'animateur :

- **Propose Lyrics**: Affiche la proposition de l'équipe
- **Freeze**: Fige la proposition pour validation
- **Validate**: Compare la proposition avec les paroles correctes
- **Reveal**: Révèle les paroles correctes si l'équipe ne trouve pas
- **Continue**: Continue la lecture de la chanson

### Gestion de la base de données :

Utilisez l'interface dédiée pour :
- Ajouter de nouvelles chansons (manuellement ou via Spotify)
- Créer des catégories thématiques
- Associer des chansons à des catégories
- Visualiser les statistiques de votre bibliothèque musicale

## Développement

Pour contribuer au développement:
1. Clonez le dépôt
2. Installez les dépendances du client avec `npm install` dans le dossier client
3. Installez les dépendances Python avec `pip install -r requirements.txt`
4. Lancez le backend avec `python python-backend/app.py`
5. Lancez le frontend avec `npm start` dans le dossier client

## TODO:
- clean database
- export DB content
- package application
- Possibility to display initials
- improve DB manager performances
- Bug in ControllerComponent if 1 song in 2 categories -> 1 cat with 1 song and 1 cat with 3 songs
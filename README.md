# Cintre

Ta garde-robe, pensée pour aujourd'hui. Cintre recense tes vêtements à partir de photos, compose des tenues selon l'occasion et la météo, et garde l'historique de ce que tu portes.

## Ce que fait l'app

- **Aujourd'hui** : la météo de là où tu es, en une phrase, et une tenue proposée selon l'occasion (casual, travail, chic, soirée, sport ou tes propres occasions). Tu peux aussi écrire ou dicter où tu vas (« dîner en terrasse »). Touche une pièce pour l'échanger, « Porter cette tenue » pour la noter.
- **Garde-robe** : les pièces rangées par catégorie, recherche, tri, pièces dormantes. Chaque fiche montre combien de fois la pièce a été portée.
- **Ajouter** : photo portée sur toi, recadrage autour de la pièce, compression automatique (WebP, environ 250 Ko par photo en qualité équilibrée), couleur détectée automatiquement.
- **Cabine d'essayage** : « Essayer sur moi » affiche ta photo en pied avec les pièces posées dessus. Swipe sur une pièce (ou les flèches en bas) pour la changer : l'aperçu est instantané, puis un rendu réaliste vient le remplacer en fondu après une courte pause. Touche la photo pour comparer aperçu et rendu.
- **Tenues** : composer une tenue pièce par pièce (avec « Garder » et « Compléter le reste »), tenues enregistrées, historique.
- **Réglages** : prénom, occasions personnalisées, rotation des pièces, frileux ou pas, qualité des photos, Google Drive, IA optionnelle, export et import.

Tout fonctionne sur le téléphone, même hors connexion. La sauvegarde Google Drive et l'IA sont des options.

## Comment les tenues sont choisies

1. La météo donne une « température utile » : moyenne de la journée, plus froid du soir, vent, et ton réglage frileux ou pas.
2. Elle décide s'il faut une veste et laquelle (légère, moyenne, chaude), ce qui est exclu (short, sandales, doudoune…) et si la pluie compte.
3. Chaque pièce est notée : bonne occasion, bonne chaleur, résistance à la pluie, pas portée récemment.
4. Des centaines de combinaisons sont tirées puis notées sur l'harmonie des couleurs (les neutres vont avec tout, au plus deux couleurs vives, proches ou complémentaires).
5. Une des meilleures est proposée, avec un peu de hasard pour varier.

## Installer sur l'iPhone

Ouvre l'adresse de l'app dans Safari, touche Partager, puis « Sur l'écran d'accueil ». Cintre s'ouvre alors comme une vraie app, en plein écran.

## Activer Google Drive (une seule fois)

1. Va sur https://console.cloud.google.com et crée un projet « Cintre ».
2. « API et services » › « Bibliothèque » : active **Google Drive API** et **Google Picker API**.
3. « Écran de consentement OAuth » : type Externe, nom « Cintre », ton adresse e-mail. Laisse en mode Test et ajoute ton adresse Gmail dans « Utilisateurs test ».
4. « Identifiants » › « Créer des identifiants » › **ID client OAuth**, type « Application Web ». Dans « Origines JavaScript autorisées », ajoute l'adresse de l'app (par exemple `https://mcsens182.github.io`).
5. « Identifiants » › « Créer des identifiants » › **Clé API**. Restreins-la au site de l'app et à l'API Google Picker.
6. Le numéro du projet est sur la page d'accueil de la console.
7. Renseigne les trois valeurs dans `config.js` : `googleClientId`, `googleApiKey`, `googleAppId`.

Cintre utilise l'accès `drive.file` : il ne voit que les fichiers qu'il a créés lui-même (son dossier « Cintre », le fichier `cintre-donnees.json` et le sous-dossier « Photos »).

## IA (optionnelle)

Dans Réglages › Intelligence artificielle, colle une clé API Claude (console.anthropic.com). Elle reste sur l'appareil. Cintre s'en sert pour reconnaître la pièce sur la photo et comprendre des phrases libres.

## Cabine d'essayage (gratuite)

- **Ma photo** (Réglages › Cabine d'essayage) : une photo de face, de la tête aux pieds. La silhouette est repérée sur le téléphone avec MediaPipe Pose (gratuit) pour savoir où poser le haut, la veste, le bas et les chaussures.
- **Aperçu** : les photos des pièces sont posées sur ces zones, avec des bords adoucis. Instantané, fonctionne hors connexion.
- **Rendu réaliste** : modèles d'essayage virtuel publics et gratuits sur Hugging Face, [Leffa](https://huggingface.co/spaces/franciszzj/Leffa) pour le haut et le bas, [IDM-VTON](https://huggingface.co/spaces/yisol/IDM-VTON) en secours pour le haut. Le bas est rendu d'abord, puis la veste (ou le haut) par-dessus. Les chaussures restent en aperçu. Chaque rendu est gardé sur le téléphone (80 au maximum) : une tenue déjà vue réapparaît tout de suite.
- **Quota** : ces modèles tournent sur le GPU partagé gratuit de Hugging Face, avec un quota par jour. Un jeton gratuit (huggingface.co › Settings › Access Tokens, type « Read ») collé dans les Réglages donne un quota plus large. Quand le quota est atteint, la cabine reste sur l'aperçu.
- Ta photo et celles des pièces ne sont envoyées à Hugging Face que si le rendu réaliste est activé.

## Technique

HTML, CSS et JavaScript sans dépendances ni étape de construction. Données dans IndexedDB, service worker pour le hors ligne, météo par Open-Meteo, nom de la ville par BigDataCloud.

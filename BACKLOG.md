# Liste des chantiers Houle
Le rapport du lundi et la tâche planifiée prennent les chantiers non cochés dans l'ordre. Coche (`[x]`) ce qui est fait, ajoute tes idées en bas, change l'ordre pour changer les priorités.

## Fait
- [x] Marée préférée par spot
- [x] Onglet « Week-end » : classement des spots autour de moi
- [x] Lien de partage d'un spot ou d'une session, sans compte
- [x] Appli installable sur l'écran d'accueil et utilisable hors connexion

## À faire, dans cet ordre (décidé avec Enzo le 13/11)
- [x] **Importer mes spots depuis Google Maps** : fichier KML / CSV / GeoJSON (export « Mes cartes » ou Google Takeout), ajoutés en spots PRIVÉS sur l'appareil. Aperçu avant import, doublons repérés.
- [x] **Exposition automatique de chaque spot** (code et tests faits ; il reste à lancer l'action « Exposition des spots » une fois sur GitHub pour remplir les données, voir LISEZ-MOI) : à partir du trait de côte, calculer vers où le spot est ouvert sur le large (fenêtre de houle) et la direction du vent offshore. Remplit les conditions des ~197 spots sans conditions, et sert d'atténuation simple de la houle quand elle vient d'une direction masquée (île, cap), façon Ifremer. Dire clairement que c'est une estimation.
- [x] **Côte beaucoup plus précise** (fait le 14/11 : tuiles OSM ~30 m par case de 1°, chargées au zoom ≥ 8, côte monde en secours ; zones : Europe de l'Ouest 36–55°N / 11°O–10°E, Guadeloupe, Sumatra sud-ouest). Reste : vérifier sur téléphone que la pointe de Crozon n'est plus sous la houle ; ajouter d'autres zones (Maroc, Canaries, Bali/Java, Hossegor déjà couvert, Réunion, Hawaï, Australie…) en éditant REGIONS dans scripts/build_coast.py puis lancer l'action « Côte précise » ; recalculer l'exposition des spots avec la côte précise.
- [x] **Houle animée comme le vent** (fait le 14/11, À VÉRIFIER sur téléphone : non testé avec de vraies données) : filets qui coulent dans le sens de la houle, plus lents pour les longues périodes, colorés par hauteur, arrêtés à la côte ; nouvelle palette façon Ifremer (bleu→vert→jaune→rouge→violet) pour plus de contraste. Reste : ajuster vitesse/longueur des filets selon le retour d'Enzo ; mode « mouvement réduit » garde les flèches.
- [x] **Onglet « Marées »** (fait le 14/11, testé avec données simulées ; demande d'Enzo : pouvoir lire les marées) : choix d'un port (25 ports de France) ou d'un de ses spots, courbe sur 4 jours, pleines/basses mers sur 7 jours avec heures et hauteurs, repère « marée forte/moyenne/faible », lien vers l'annuaire officiel du SHOM. Source Open-Meteo (modèle mondial, ordre de grandeur, dit dans l'écran). Reste, par ordre : (1) comparer avec les horaires officiels sur 3 ports (Brest, Quiberon, Biarritz) et mesurer l'écart ; (2) coefficient de marée estimé (à partir du marnage de Brest, à valider) ; (3) plus de ports (Bretagne détaillée, Atlantique, Méditerranée, monde) ; (4) vraie annuaire : chercher une source libre et réutilisable (le SHOM interdit la réutilisation de ses prédictions sans licence ; XTide / TICON donne des constantes harmoniques libres, à étudier) ; (5) bouton « Marée » depuis la fiche d'un spot.
- [x] **Prévisions de vent plus rapides à arriver sur la carte monde** (fait le 14/11, testé avec de faux fichiers ; À MESURER sur téléphone réel, je n'ai pas pu joindre GitHub Pages depuis ici) : le vent s'affiche dès qu'il est téléchargé, sans attendre la houle ni les isobares ; téléchargement lancé en tâche de fond au démarrage de l'appli (sauf mode économie de données ou connexion 2G) ; nouvel essai automatique à chaque ouverture de Conditions si le premier a échoué. Reste : garder les derniers fichiers en mémoire de l'appareil pour un démarrage instantané et hors connexion ; fichiers plus petits (vent seul à 1° en premier, détail ensuite).
- [x] **Tableau de prévision** (fait le 14/11, testé avec données simulées) : « Hauteur (mètres) », « Période (secondes) », option mètres/pieds (gardée sur l'appareil), définition au toucher de Puissance / Énergie / Mer de vent / 2e houle (avec le calcul et l'explication des mers croisées), direction de la 2e houle, nouvelle ligne Énergie (kJ) additionnée sur toutes les houles : 0,98·H²·T² par train. Surf-Forecast ne publie pas sa formule (seulement les repères : ~100 kJ surfable, 200–1000 plus puissant, >1000 très lourd) : notre estimation tombe dans ces repères mais peut différer ; à comparer avec quelques spots réels quand Enzo aura des valeurs Surf-Forecast à donner. Reste : unités pieds aussi sur la carte.
- [x] **Accessibilité par spot (personnes à mobilité réduite)** (fait le 15/11, testé avec de fausses réponses OpenStreetMap ; À VÉRIFIER avec le vrai service Overpass et sur téléphone) : cases parking < 100 m, sable sans marche, chemin fauteuil, sanitaires, distance à pied ; « non précisé » par défaut, jamais d'invention ; bouton « Chercher dans OpenStreetMap » (tags wheelchair, capacity:disabled, escaliers) qui ne remplit que les cases vides et le dit ; fiche d'un spot et fiche d'un spot connu ; filtre « Accessibles seulement » (parking, sable et chemin tous à « oui »). Reste : filtre aussi sur la carte et pour les spots connus, pictogramme sur les pastilles de la carte, lancer la recherche OSM sur les ~296 spots connus par une action GitHub (fichier de pistes, plutôt que des appels dans l'appli). : cases parking < 100 m, accès au sable sans marche, chemin praticable en fauteuil, sanitaires accessibles, distance à pied jusqu'à l'eau ; filtre ; « non précisé » si inconnu ; pour les spots connus, piste OpenStreetMap (wheelchair=*), jamais d'invention.
- [x] **Atténuation derrière îles et caps** (fait le 16/11, testé sur côtes fictives, À COMPARER sur de vrais spots abrités) : diffraction simplifiée, ombre adoucie et dépendante de la période (houle longue contourne mieux). Reste : vraie physique via Copernicus IBI (voir chantier « Houle plus précise en Europe »).
- [~] **Réglage des spots, 2e série (Enzo a confirmé le 17/11 ; code fait, À VÉRIFIER sur téléphone, surtout l'éditeur de secteurs sur la carte)** :
  1. [x] **Secteurs de houle et de vent vert / orange / rouge, directement sur la carte** : une « part de camembert » autour du spot ; milieu = houle parfaite (vert) ; de chaque côté une bande orange (ça rentre mais spot moyen) ; au-delà rouge (mort). Poignées à déplacer sur la carte pour élargir/rétrécir le vert et pour ouvrir ou fermer séparément le côté gauche et le côté droit de l'orange (un spot peut ne marcher que d'un côté). Même outil pour la houle et pour le vent (vent parfait = offshore). Statuts existants : vert = bon créneau, orange = créneau limite, rouge = rien.
  2. [x] **Marée en hauteur d'eau** : en plus de basse/mi/haute, « mètres d'eau minimum et maximum » (ses notes disent « 4 m d'eau minimum »). Il faut un calage par spot (profondeur à marée basse, ou « tel jour à telle heure il y avait X m ») car le modèle donne le niveau par rapport au niveau moyen, pas la profondeur du spot.
  3. [x] **Période minimum ET maximum** (fait le 17/11, testé ; maximum facultatif, vide = pas de limite ; À VÉRIFIER sur téléphone).
  4. [x] Photos : déjà dans la fiche (max 6, réduites, gardées sur le téléphone, pas de lien). Reste : synchro entre appareils (plus tard).
  4b. [x] (17/11 soir) Le camembert vert/orange/rouge s'affiche directement sur la carte dans la fiche « Classer » (proposé d'après la côte, Houle/Vent, poignées à tirer, côtés orange ouvrables) ; À VÉRIFIER au doigt sur téléphone.
  5. [x] (fait le 18/11, testé en simulation, À VÉRIFIER sur téléphone) Orange : pas d'alerte par défaut ; case « Me prévenir aussi des créneaux limites » dans la fiche du spot ; Week-end : conditions parfaites d'abord + bouton « Afficher aussi les conditions douteuses ». Reste : même bouton pour « Autour de moi » et les classements de Mes spots ; case aussi dans l'écran « Classer ».
  6. [~] (19/11 : carnet « J'ai surfé » fait, voir LISEZ-MOI ; À VÉRIFIER sur téléphone avec le vrai service) Retour de session : retour de session « j'ai surfé, c'était moyen (orange à cause du vent) » pour ajuster les secteurs.
  7. [ ] Fiche « Classer et régler » : ajout période max (fait), secteurs d'après la côte (fait) ; reste mètres d'eau + « Régler sur la carte ».
- [x] **Import Google : lieux sans coordonnées** (fait le 20/11, testé avec un faux service OpenStreetMap, À VÉRIFIER avec le vrai Nominatim et sur téléphone) : dans l'aperçu, bouton « Chercher leur position par le nom » (40 max par lancement, 1 demande/seconde, arrêt net si le service répond 429/403, jamais de nouvel essai forcé) ; positions trouvées décochées et marquées « à vérifier », note ajoutée au spot ; lieux introuvables signalés. Reste : placer à la main sur la carte un lieu introuvable ; relancer pour les 40 suivants (possible : bouton réapparaît).
- [x] **Marée visible dans l'appli** (fait le 14/11, testé avec données simulées, À COMPARER avec les horaires officiels SHOM) : ligne Niveau de la mer dans le tableau (▲ pleine / ▼ basse) + « Marée du jour » avec heures, source Open-Meteo sea_level_height_msl (modèle mondial, ordre de grandeur, dit dans la définition). Reste : coefficient de marée (France), courbe sur la fiche des spots, utiliser la vraie marée pour le critère « marée » des spots, éventuellement données SHOM/officielles si une source libre existe.
- [x] **Vue « Profondeur »** (devenue une OPTION masquée par défaut le 14/11, Enzo : « on s'en fiche, option en plus ») (fait le 14/11, À VÉRIFIER sur téléphone : la couche WMS GEBCO n'a pas pu être testée depuis le serveur de travail) : nouveau bouton Profondeur dans le panneau Conditions, couche GEBCO « gebco_latest_2 » (carte en couleurs), légende foncé = profond, avertissement « pas pour naviguer ». Reste : clic = profondeur au point (demande un service avec accès autorisé, GetFeatureInfo ou tuiles de valeurs), courbes de niveau, EMODnet (plus précis en Europe, ~100 m) en plus de GEBCO sur les zones couvertes, profondeur superposée à la houle pour repérer bancs et fonds.
- [ ] **Spots du monde par pays** : script GitHub Actions qui construit un fichier par pays (spots-FR.json, spots-PT.json…) à partir d'OpenStreetMap (sport=surfing, surf breaks) et d'autres sources libres de droits ; l'appli télécharge les pays choisis et les garde hors connexion. Marquer « à confirmer » les positions peu sûres. Ne copier aucune base commerciale ou protégée.
- [ ] **Alertes quand l'appli est fermée** : notifications Web Push (iPhone : appli installée sur l'écran d'accueil). Demande un petit serveur gratuit (Supabase) + clés VAPID + une action GitHub qui évalue les spots toutes les 6 h. Étapes pour Enzo à lui donner en français simple.
- [ ] **Houle plus précise en Europe** : essayer le modèle côtier IBI du service Copernicus Marine (compte gratuit à créer par Enzo, mailles d'environ 3 km, tient compte des îles et des caps) via l'action GitHub. Garder Open-Meteo en secours.
- [ ] **Tableau de prévision** : puissance par houle (principale, 2e houle, mer de vent), note globale quand plusieurs houles se croisent, façon Surf-Forecast.
- [ ] Compléter les conditions (vent, houle, marée) des spots connus avec des sources lisibles librement (sans contourner aucun blocage)
- [ ] Essai sur téléphone réel : défilement, boutons, lisibilité en plein soleil (à faire par Enzo, corriger ensuite)
- [ ] Synchroniser mes spots entre téléphone et ordinateur (compte, Supabase) — toujours privés
- [ ] Publier l'appli sur les magasins (Android / iPhone)

## Idées ajoutées le 13/11 (exposition)
- [ ] Vérifier l'exposition calculée sur 10 spots que tu connais bien (Hossegor, La Torche, Lacanau, Belharra…) et signaler ceux où la fenêtre de houle est fausse ; régler les seuils (80 km ouvert, 15 km fermé) ensuite
- [ ] Étendre l'exposition à tes spots perso (calcul dans l'appli avec un trait de côte léger, ou action GitHub à la demande)
- [ ] Afficher la fenêtre de houle et le vent offshore sur la carte (petit éventail autour du spot sélectionné)

## Idées ajoutées le 14/11 (carte monde)
- [ ] Garder la dernière carte mondiale (vent, houle) dans la mémoire de l'appareil : démarrage instantané et carte visible hors connexion, avec la mention « données du … » si elles ont plus de 12 h
- [ ] Afficher la fraîcheur des prévisions (« modèle de 06 h, il y a 3 h ») et un bouton « actualiser » sur la carte
- [ ] Mesurer sur téléphone réel le temps d'affichage du vent monde (4G) et réduire la taille des fichiers si besoin

## Idées ajoutées le 15/11 (accessibilité)
- [ ] Action GitHub « Accessibilité des spots connus » : interroger OpenStreetMap une fois pour les ~296 spots connus et enregistrer un fichier de pistes (avec la date), pour afficher le ♿ sur la carte sans appel réseau et filtrer les spots connus
- [ ] Ajouter dans la fiche d'un spot un lien « Corriger dans OpenStreetMap » (ouvre la page OSM du point) pour que les infos vérifiées sur place profitent à tout le monde
- [ ] Réparer le test test/ui_local.py (il attend un bouton « condLayer » qui n'existe plus : échec déjà présent avant ce chantier)

## Demandes d'Enzo le 15/11 (carte sur téléphone) : faites, À VÉRIFIER sur téléphone
- [x] Poignée en haut du panneau (semi-transparente, avec la mention « Glisser vers le bas : carte seule ») : un clic ou un glissement replie la liste, la carte prend tout l'écran ; refaire le geste la remonte. Téléphone en vertical seulement (écran ≤ 820 px).
- [x] Boutons + et − : retirés sur téléphone (pincer), gardés sur ordinateur et déplacés en bas à droite au-dessus de la mention OpenStreetMap ; sur ordinateur, les boutons Ma position / Satellite / Spots connus sont remontés d'un cran pour ne pas les chevaucher ; sur téléphone ils ne bougent pas.
- [ ] Reste : retenir l'état (carte seule ou non) d'une ouverture à l'autre ; rouvrir la liste toute seule quand on touche un spot sur la carte ; version paysage ; réparer test/ui_local.py

## Demandes d'Enzo le 15/11 (spots, rayon, alertes)
- [x] **Spots à classer** (fait, testé avec de faux spots, À VÉRIFIER sur téléphone) : à l'import, nouvelle option par défaut « À classer plus tard » ; bandeau « N spots à classer » en haut de Mes spots ; écran « Classer ce spot » un par un (Surf, Bodyboard, Longboard, Autre, plusieurs possibles, Passer, Arrêter, reprise possible) ; pastille grise en pointillés tant qu'un spot n'est pas classé ; la fiche d'un spot propose maintenant des cases à cocher au lieu d'une seule discipline. ATTENTION : tous les spots déjà importés (qui ont un numéro d'import) comptent « à classer », même si l'ancien import leur avait mis « Surf » par défaut.
- [x] **Rayon « Autour de moi »** (fait, testé avec position simulée, À VÉRIFIER sur téléphone avec la vraie localisation) : sur Mes spots et Alertes, bouton + rayons 20 / 50 / 100 / 200 km (rayon retenu) ; les spots hors rayon disparaissent de la liste et des alertes ; les alertes plus lointaines restent annoncées (« + 3 alertes plus loin ») avec « Tout afficher ». Désactivé au départ : rien ne change tant qu'on ne l'active pas.
- [ ] Reste : appliquer aussi le rayon aux pastilles de la carte ; couleur/forme des pastilles de mes spots selon la discipline (aujourd'hui seulement dans la liste) ; filtrer Mes spots par discipline ; « Tout classer en surf » pour les gros imports (à confirmer avec Enzo) ; retenir le centre du rayon.
- [ ] **À VOIR ENSEMBLE : toucher un spot le met « en alerte » et envoie une notification, sans retour possible** (Enzo, 15/11). Pistes : « Suivre (alertes) » est un bouton séparé, mais ouvrir un spot importé charge sa prévision (et peut déclencher des alertes) ; à reproduire sur téléphone et décider : ouvrir un spot ne doit jamais activer d'alerte ; ajouter « Ne plus suivre » ; distinguer « spot suivi » et « spot juste consulté ». Non traité, il me faut le détail de ce qui se passe.

## Demandes d'Enzo le 15/11 (accessibilité, validation des spots, alertes automatiques)
- [x] **Écran d'accueil « Es-tu en situation de handicap ? »** (fait, testé dans un navigateur de test, À VÉRIFIER sur téléphone, idéalement avec un vrai lecteur d'écran) : avant le tutoriel, cases pour la vue (texte plus gros / très gros, contraste fort, lecture à voix haute), la mobilité (spots accessibles d'abord, grands boutons), l'audition (rappel : aucun son dans l'appli), le mouvement (moins d'animations) ; réglages gardés sur l'appareil ; bouton ♿ en haut pour les changer. Voix : bouton « Écouter » (spot et alertes) + lecture automatique à l'ouverture d'un spot ; utilise la voix du téléphone (fr-FR).
- [x] **Spot validé = surveillé tout seul** (fait, testé) : un spot est validé s'il a un nom, une discipline, la taille de houle (min et max), la puissance de la houle (période min), l'orientation de la houle, l'orientation du vent, la force du vent (max) et la hauteur de marée (min et max) ; la fiche dit « Spot validé » ou liste ce qui manque avec un bouton « Compléter » ; Mes spots affiche « N spots validés · N à compléter ». Un spot validé donne ses alertes sans rien activer. HYPOTHÈSE À CONFIRMER : « puissance » = période minimale pour la houle, vitesse maximale pour le vent ; la vitesse minimale du vent n'existe pas (tu as dit que tu t'en fichais).
- [x] **Hauteur de marée dans les conditions** : fourchette min/max par spot, comparée à la marée prévue (modèle mondial Open-Meteo, ordre de grandeur) ; sans donnée de marée à cet endroit, on ne bloque pas.
- [x] **Bug « toucher un spot le met en alerte »** : cause probable trouvée et corrigée (un spot simplement ouvert chargeait sa prévision et entrait dans les alertes et les notifications ; maintenant seuls les spots validés ou suivis à la main comptent ; le repère vert de la carte suit la même règle). À VÉRIFIER sur téléphone. Pas de bouton « Ne plus suivre » pour l'instant.
- [ ] **Idée : affichage simplifié** (moins de chiffres, une phrase par spot, « ça vaut le coup / pas la peine »), pour ne pas tout avoir à comprendre.
- [ ] **Idée : version entièrement vocalisée / lecteur d'écran** : audit avec VoiceOver (iPhone) et TalkBack (Android) sur chaque écran (carte, onglets, formulaires) ; étiquettes manquantes ; commandes vocales ; savoir si un public aveugle utilise vraiment l'appli (à demander).
- [ ] Idée : choix « handicap » aussi pour les spots connus (accessibilité OSM sur la carte), sous-titrage/animations réduites dans la carte Conditions à tester ; texte agrandi : vérifier la carte Conditions et la poignée.
- [ ] Idée : « Ne plus suivre » / mettre un spot validé en pause (vacances, voyage) ; groupes de spots (Indonésie en pause).

## Idées ajoutées le 16/11 (atténuation)
- [ ] Vérifier l'atténuation sur 5 spots abrités que tu connais (derrière Ouessant, Groix, Noirmoutier, côte sud de la Corse…) et dire si la houle affichée est trop forte ou trop faible ; ajuster le réglage de diffraction (fonction spread dans exposure.js)
- [ ] Afficher « houle réduite par l'abri : -40 % » dans la fiche d'un spot connu pour que l'écart avec le large soit visible
- [ ] Appliquer l'atténuation aussi aux spots perso (position libre) avec un trait de côte léger calculé dans l'appli

## Idées ajoutées le 17/11 (période)
- [ ] Afficher dans la fiche d'un spot « période 10–16 s » à côté de la houle, et colorer en orange quand la période prévue est proche du maximum (créneau limite)
- [ ] Exiger la période max pour « spot validé » seulement si Enzo le souhaite (aujourd'hui facultatif pour ne pas dé-valider les spots existants)
- [ ] Pour la 2e série : commencer par les secteurs vert/orange/rouge sur la carte (point 1) une fois la maquette validée par Enzo ; la marée en mètres d'eau (point 2) demande le calage par spot

## Demande d'Enzo le 17/11 (validation des spots) : faite, À VÉRIFIER sur téléphone
- [x] Spot en cours de validation : sélectionné + repère vert ; carte centrée sur le point GPS (partie visible, fiche déduite) ; zoom 14 au lieu de 16
- [ ] Même centrage quand on touche un spot dans la liste (zoom 15 aujourd'hui) et quand la fiche « Compléter » est ouverte ; recentrer si la fiche change de hauteur (cases cochées) ; régler le zoom (14) selon ton retour

## Idées ajoutées le 18/11 (créneaux limites)
- [x] Dans la liste des alertes, distinguer visuellement un créneau limite (pastille orange) d'un créneau parfait (vert) (fait le 19/11, À VÉRIFIER sur téléphone)
- [ ] Réglage global « alerter les créneaux limites » pour tous les spots d'un coup, en plus de la case par spot
- [ ] Dans le classement Week-end, expliquer en une phrase pourquoi un spot est douteux (ex. « vent un peu de travers »)
- [x] (19/11 : test vocal stabilisé, smoke 0 échec) Stabiliser deux tests de test/smoke.py qui échouent de temps en temps (marée préférée, mémorisation des réglages d'accessibilité) : attentes trop courtes

## Idées ajoutées le 19/11 (alertes)
- [ ] Notification « créneau limite » avec un son/vibration différent d'un créneau parfait (ou sans vibration), pour ne pas déranger pour un spot moyen
- [ ] Trier la liste « À ne pas rater » : parfaits d'abord, puis limites, puis par délai
- [ ] Même pastille Parfait / Limite sur « Autres sessions à venir » et dans la fiche d'un spot (bandeau des 8 jours avec légende)

## Demande d'Enzo le 19/11 (carnet de sessions) : fait, À VÉRIFIER sur téléphone
- [x] Carnet « J'ai surfé » : spot + jour passé + heures, conditions réelles de l'archive Open-Meteo, frise heure par heure vert / orange / rouge, réglages proposés (jamais appliqués tout seuls)
- [ ] Inclure les sessions dans « Exporter une sauvegarde » / « Restaurer » (aujourd'hui elles ne sont que sur l'appareil)
- [ ] Mettre à jour une session déjà enregistrée (aujourd'hui : supprimer puis refaire) et la voir sur la fiche du spot
- [ ] Comparer l'heure de marée du modèle avec une vraie marée (SHOM) pour que « mètres d'eau » colle au ressenti ; proposer aussi le calage waterRef d'après les sessions
- [ ] Importer une session depuis un fichier GPX (montre, appli de suivi) pour remplir jour et heures tout seul
- [ ] Après plusieurs sessions : montrer la dispersion (ex. « tes heures vertes vont de 1,2 à 2,1 m ») et signaler les sessions qui contredisent les autres

## Idées ajoutées le 20/11 (import)
- [ ] Après l'import, proposer « Placer à la main » pour les lieux introuvables : toucher la carte pour poser le spot
- [ ] Afficher sur la carte les spots importés à position « à vérifier » avec une pastille spéciale jusqu'à confirmation
- [ ] Mémoriser les lieux déjà cherchés par nom (appareil) pour ne pas redemander au service quand on réimporte le même fichier

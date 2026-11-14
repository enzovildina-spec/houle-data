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
- [ ] **Prévisions de vent plus rapides à arriver sur la carte monde** (la carte elle-même charge vite).
- [x] **Tableau de prévision** (fait le 14/11, testé avec données simulées) : « Hauteur (mètres) », « Période (secondes) », option mètres/pieds (gardée sur l'appareil), définition au toucher de Puissance / Énergie / Mer de vent / 2e houle (avec le calcul et l'explication des mers croisées), direction de la 2e houle, nouvelle ligne Énergie (kJ) additionnée sur toutes les houles : 0,98·H²·T² par train. Surf-Forecast ne publie pas sa formule (seulement les repères : ~100 kJ surfable, 200–1000 plus puissant, >1000 très lourd) : notre estimation tombe dans ces repères mais peut différer ; à comparer avec quelques spots réels quand Enzo aura des valeurs Surf-Forecast à donner. Reste : unités pieds aussi sur la carte.
- [ ] **Accessibilité par spot (personnes à mobilité réduite)** : cases parking < 100 m, accès au sable sans marche, chemin praticable en fauteuil, sanitaires accessibles, distance à pied jusqu'à l'eau ; filtre ; « non précisé » si inconnu ; pour les spots connus, piste OpenStreetMap (wheelchair=*), jamais d'invention.
- [ ] **Atténuation derrière îles et caps** (façon Ifremer), puis vraie physique via Copernicus IBI.
- [ ] **Import Google : lieux sans coordonnées** (lien « maps/place » seulement) : retrouver la position par le nom (OpenStreetMap) ou la faire placer à la main.
- [x] **Marée visible dans l'appli** (fait le 14/11, testé avec données simulées, À COMPARER avec les horaires officiels SHOM) : ligne Niveau de la mer dans le tableau (▲ pleine / ▼ basse) + « Marée du jour » avec heures, source Open-Meteo sea_level_height_msl (modèle mondial, ordre de grandeur, dit dans la définition). Reste : coefficient de marée (France), courbe sur la fiche des spots, utiliser la vraie marée pour le critère « marée » des spots, éventuellement données SHOM/officielles si une source libre existe.
- [x] **Vue « Profondeur »** (fait le 14/11, À VÉRIFIER sur téléphone : la couche WMS GEBCO n'a pas pu être testée depuis le serveur de travail) : nouveau bouton Profondeur dans le panneau Conditions, couche GEBCO « gebco_latest_2 » (carte en couleurs), légende foncé = profond, avertissement « pas pour naviguer ». Reste : clic = profondeur au point (demande un service avec accès autorisé, GetFeatureInfo ou tuiles de valeurs), courbes de niveau, EMODnet (plus précis en Europe, ~100 m) en plus de GEBCO sur les zones couvertes, profondeur superposée à la houle pour repérer bancs et fonds.
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

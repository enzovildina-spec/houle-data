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
- [ ] **Côte beaucoup plus précise (PRIORITÉ 1, demande d'Enzo)** : ~50 m (la pointe de Crozon est « presque sous l'eau »; ports, rias, embouchures). Plan : trait de côte OpenStreetMap préparé par GitHub Actions par région, simplifié ~30 m, chargé par zone visible avec plus de détail en zoomant ; fichier monde actuel en secours.
- [ ] **Houle animée comme le vent** : filets qui coulent (plus longs et lents pour les longues périodes), colorés par hauteur, arrêt à la côte, palette façon Ifremer ; meilleur contraste/lisibilité de la houle.
- [ ] **Prévisions de vent plus rapides à arriver sur la carte monde** (la carte elle-même charge vite).
- [ ] **Tableau de prévision** : écrire « Hauteur (mètres) » et « Période (secondes) » en toutes lettres ; option mètres/pieds ; toucher « Puissance », « Mer de vent », « 2e houle » = petite définition avec le calcul ; orientation de la 2e houle ; échelle de puissance alignée sur Surf-Forecast (retrouver leur formule exacte, la mienne est 0,49·H²·T kW/m) ; expliquer la 2e houle (s'ajoute si même direction, mers croisées = vagues chaotiques).
- [ ] **Accessibilité par spot (personnes à mobilité réduite)** : cases parking < 100 m, accès au sable sans marche, chemin praticable en fauteuil, sanitaires accessibles, distance à pied jusqu'à l'eau ; filtre ; « non précisé » si inconnu ; pour les spots connus, piste OpenStreetMap (wheelchair=*), jamais d'invention.
- [ ] **Atténuation derrière îles et caps** (façon Ifremer), puis vraie physique via Copernicus IBI.
- [ ] **Import Google : lieux sans coordonnées** (lien « maps/place » seulement) : retrouver la position par le nom (OpenStreetMap) ou la faire placer à la main.
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

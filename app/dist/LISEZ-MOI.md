# Houle : mode d'emploi

Houle est un carnet de spots de surf : une carte, des points GPS précis avec notes et photos, les prévisions de houle et de vent, et des alertes quand les conditions que tu as choisies arrivent. Avec un compte, tu peux aussi avoir des amis, leur partager un spot ou une session, et construire des cartes communes.

Ce dossier contient trois fichiers :

- `houle.html` : toute l'appli, en un seul fichier.
- `schema.sql` : la base de données des comptes (seulement pour l'étape 2).
- `LISEZ-MOI.md` : ce guide.

## Étape 1. Utiliser l'appli tout de suite, sans compte

Sur ordinateur, fais un double-clic sur `houle.html`. Il s'ouvre dans ton navigateur (il faut une connexion internet pour la carte et les prévisions).

Au premier lancement, un tutoriel en 6 étapes s'affiche. Tu peux le relire avec le bouton « ? » en haut à droite.

Ce qui fonctionne déjà :

- La carte (fond Esri en fichier local, OpenStreetMap une fois l'appli en ligne), avec une vue satellite pour repérer les bancs de sable.
- Les spots connus : 296 spots français (Bretagne, Normandie, Pays de la Loire, Charentes, Gironde, Landes, Pays Basque, Méditerranée, Corse, outre-mer) sont déjà sur la carte. Chaque discipline a sa forme et sa couleur : rond bleu pour le surf, losange rose pour le bodyboard, triangle jaune pour le longboard. Les boutons en bas de la carte filtrent par discipline. Les noms s'affichent quand tu zoomes. Touche un spot pour voir ses conditions conseillées (direction de la houle, vent, marée) et la houle prévue sur 8 jours, puis « Ajouter à mes spots » : tes critères sont pré-remplis. La recherche les trouve par leur nom.
- La carte Conditions : le bouton « Conditions » en haut de la carte affiche la météo de toute la zone visible. Le vent est un champ coloré avec des flèches (km/h), la houle un halo coloré en mer avec hauteur, période et direction, et la marée une flèche montante ou descendante avec sa hauteur. Les données se recalculent quand tu déplaces ou zoomes la carte. Le curseur change l'heure (environ 2 jours). Un clic sur un point ouvre un tableau heure par heure. Les trois couches s'activent séparément.
- Carte monde plus rapide (14/11) : quand tu dézoomes, le vent s'affiche dès qu'il est téléchargé ; la houle et la pression arrivent juste après, en arrière-plan. L'appli commence à télécharger ces données dès son ouverture (pas en mode économie de données ni en connexion très lente). Si le téléchargement a échoué, il est retenté quand tu rouvres Conditions.
- Les emojis de houle : sur chaque spot dont la prévision est chargée, un emoji donne la plus grosse houle attendue dans les 3 jours : 💤 plat, 〰️ petite, 🌊 bonne, 🔥 grosse, ⚠️ énorme.
- Limites des spots connus : positions précises à 300-500 m environ (souvent le parking ou la plage, pas le pic), à confirmer en vue satellite. L'exposition estimée d'après la côte (voir plus bas) complète la houle et le vent offshore des spots sans conditions publiées. Les conditions conseillées ont été lues sur des sites de spots pour environ 100 spots sur 296 seulement : pour les autres, la discipline est estimée d'après le type de spot (reef : bodyboard possible, point break : longboard possible) et aucune condition n'est proposée. Les disciplines sont indicatives. Le fichier `spots-connus.json` donne les sources et le détail.
- Accessibilité de l'appli (15/11) : au premier lancement, une page demande « Es-tu en situation de handicap ? » avec des cases : texte plus gros ou très gros, contraste fort, lecture à voix haute, spots accessibles d'abord, grands boutons, moins d'animations. Le bouton ♿ en haut permet de les changer. La lecture à voix haute ajoute un bouton « Écouter » (un spot ou les alertes) et lit un spot quand on l'ouvre. Pour un usage complet sans voir l'écran, active aussi VoiceOver (iPhone) ou TalkBack (Android).
- Spot validé (15/11) : un spot est « validé » quand il a un nom, une discipline, la taille et la puissance de la houle, son orientation, l'orientation et la force du vent, et une fourchette de hauteur de marée. Un spot validé est surveillé tout seul : Houle donne l'alerte sans que tu aies rien à activer. La fiche indique ce qui manque, avec un bouton « Compléter ». Un spot simplement ouvert ne déclenche plus d'alerte.
- Classer ses spots (15/11) : à l'import d'un fichier Google, laisse « À classer plus tard ». Un bandeau « N spots à classer » apparaît dans Mes spots ; « Classer » te montre les spots un par un : touche Surf, Bodyboard, Longboard et/ou Autre (plusieurs possibles), puis « Valider » (ou « Passer »). Tu peux t'arrêter et reprendre. Un spot pas encore classé a une pastille grise en pointillés.
- Autour de moi (15/11) : dans Mes spots et Alertes, touche « Autour de moi » et choisis un rayon (20, 50, 100 ou 200 km) : seuls les spots (et alertes) proches s'affichent. Les alertes plus lointaines sont signalées en bas (« + 3 alertes plus loin ») et « Tout afficher » rétablit tout. Rien n'est filtré tant que tu n'actives pas le bouton.
- Carte seule sur téléphone (15/11) : en vertical, la poignée grise en haut de la liste se touche ou se tire vers le bas pour voir la carte en plein écran, et se tire vers le haut pour revenir à la liste. Les boutons + et − n'existent plus sur téléphone (on pince avec deux doigts) ; sur ordinateur ils sont en bas à droite.
- Accessibilité (15/11) : dans la fiche d'un spot, « Modifier » puis « ♿ Accessibilité » : parking à moins de 100 m, accès au sable sans marche, chemin praticable en fauteuil, sanitaires, distance à pied jusqu'à l'eau. Chaque case reste sur « Non précisé » tant que tu ne la remplis pas : rien n'est inventé. Le bouton « Chercher dans OpenStreetMap » propose des réponses d'après les données de bénévoles (places PMR, escaliers, toilettes accessibles) ; il ne remplit que les cases vides et il faut vérifier sur place. Le même bouton existe dans la fiche d'un spot connu. Dans Mes spots, « ♿ Accessibles seulement » ne garde que les spots où parking, sable et chemin sont tous à « oui ».
- Les spots : touche « Ajouter un spot », puis touche la carte. Tu peux glisser le repère pour être précis, coller des coordonnées GPS (« 43.48123, -1.55678 ») ou utiliser ta position.
- Pour chaque spot : notes, jusqu'à 6 photos, ton lien de prévision (Windguru, Windy, Ifremer ou autre) et un lien Windy automatique sur le point.
- Les prévisions sur 8 jours (houle, période, vent) venues d'Open-Meteo, et un bandeau de 8 cases par spot : vert quand une session est possible, ambre pour un créneau court, gris sinon.
- Tes critères par spot : houle min et max, période minimum et maximum (le maximum est facultatif), vent maximum, direction du vent, direction de la houle, plage horaire, et ta discipline (surf, bodyboard ou longboard).
- Créneaux limites (18/11) : par défaut, seuls les créneaux parfaits (vert) déclenchent une alerte. Dans la fiche d'un spot, la case « Me prévenir aussi des créneaux limites (orange) » ajoute les créneaux orange, signalés « créneau limite » dans le message. Dans l'onglet Week-end, les spots aux conditions parfaites sont classés d'abord et les spots douteux sont masqués ; le bouton « Afficher aussi les conditions douteuses » les ajoute à la suite.
- Les alertes : 7 jours avant, 3 jours avant, la veille, le matin même, au choix pour chaque spot. Les notifications du navigateur partent quand l'appli est ouverte.
- L'export et l'import d'une sauvegarde de tes spots.

Tes spots sont enregistrés dans le navigateur de l'appareil. Si tu vides les données du navigateur, ils disparaissent : exporte une sauvegarde de temps en temps.

Sur téléphone, un fichier ouvert depuis l'appli Fichiers fonctionne mal (pas de position, stockage fragile). Mets plutôt l'appli en ligne (étape 3), ouvre son adresse sur le téléphone, puis « Ajouter à l'écran d'accueil ».

## Étape 2. Activer les comptes, les amis et les cartes communes

Les onglets Amis, Cartes et Reçu n'apparaissent qu'une fois cette étape faite. Il faut un petit serveur. Supabase en offre un gratuit, suffisant pour démarrer.

1. Crée un compte sur supabase.com, puis « New project ». Choisis une région en Europe et note le mot de passe de la base.
2. Dans le projet, ouvre « SQL Editor », « New query », colle tout le contenu de `schema.sql` et clique « Run ». Tu dois voir « Success ». Si un message d'erreur apparaît, copie-le-moi tel quel.
3. Va dans « Project Settings », « API ». Copie l'adresse du projet (Project URL) et la clé publique (appelée « anon » ou « publishable »).
4. Ouvre `houle.html` avec le Bloc-notes (pas Word). Au début du fichier, colle l'adresse et la clé entre les guillemets de `supabaseUrl` et `supabaseAnonKey`. Enregistre.
5. Dans « Authentication », laisse la confirmation par e-mail activée. Dans « URL Configuration », mets comme « Site URL » l'adresse où tu auras mis l'appli en ligne (étape 3), sinon le lien de confirmation renvoie au mauvais endroit.

Ne colle jamais la clé « service_role » ou « secret » dans le fichier. Seule la clé publique y va.

Au premier lancement, chacun crée son compte (e-mail, mot de passe, pseudo). Pour devenir amis, on s'ajoute par pseudo et l'autre doit accepter.

## Étape 3. Mettre l'appli en ligne

Renomme `houle.html` en `index.html`, ouvre app.netlify.com/drop et glisse-dépose le fichier. Tu obtiens une adresse en https à donner à tes amis. Pour mettre à jour l'appli, dépose à nouveau le fichier.

## Ce qui est protégé

- Les mots de passe sont gérés par Supabase. Ils ne sont jamais dans ton fichier.
- Chaque spot n'est lisible que par son propriétaire. Cette règle est appliquée par la base de données elle-même, pas seulement par l'écran : même quelqu'un qui lit le code de la page ne peut pas lire les spots des autres.
- Seuls des amis acceptés peuvent recevoir un spot ou une session. Si tu masques la description, elle n'est pas envoyée du tout.
- Une carte commune n'est lisible que par ses membres. On y entre sur invitation acceptée, ou en demandant avec le code de la carte, le créateur devant valider.
- Si quelqu'un trouve ton mot de passe, il voit tes spots. Utilise un mot de passe long et unique. La double authentification n'est pas encore dans l'appli.
- Le plan gratuit de Supabase ne fait pas de sauvegarde automatique : utilise le bouton « Exporter une sauvegarde ».
- Les pseudos sont visibles par les autres comptes, c'est ce qui permet de s'ajouter entre amis.

## Limites à connaître

- Les prévisions viennent du modèle de houle d'Open-Meteo : c'est la houle au large, sur 8 jours au plus, et celle à 7 jours reste peu fiable. La marée et l'orientation exacte du spot ne sont pas prises en compte dans les alertes ; la marée n'apparaît que sur la carte Conditions. Windguru n'a pas d'accès public pour les programmes : on garde donc un lien cliquable vers sa page.
- Open-Meteo est gratuit pour un usage personnel non commercial. Les fonds de carte (OpenStreetMap, Esri) sont prévus pour un usage léger : si l'appli grossit, il faudra un fournisseur de cartes.
- Les notifications partent seulement quand l'appli est ouverte. Les prévenir même appli fermée demande un petit programme serveur, c'est l'étape suivante.
- Un projet Supabase gratuit inactif plusieurs jours est mis en pause. Il se réveille depuis le tableau de bord.
- Pour l'App Store et Google Play, il faudra emballer l'appli (avec Capacitor, par exemple) et ouvrir un compte développeur chez Apple (99 $ par an) et chez Google (25 $, une fois).

## Limites de la carte Conditions

- Les données viennent d'Open-Meteo, gratuit sans clé, mais limité : environ 10 000 appels par jour, et chaque mise à jour de la carte en consomme une quarantaine pour la houle et autant pour le vent. Si tu déplaces beaucoup la carte, tu peux atteindre la limite : un message te le dit et il suffit d'attendre.
- « En direct » veut dire que la carte se recalcule à chaque déplacement avec les dernières prévisions du modèle, mises à jour environ toutes les heures. Ce ne sont pas des mesures de bouées.
- La marée vient d'un modèle global d'environ 8 km de résolution. Elle est fiable au large et imprécise près des côtes découpées (estuaires, caps, golfes). Pour une marée exacte, utilise les horaires officiels du SHOM.
- La houle est la houle principale du modèle, au large. Elle ne tient pas compte de l'orientation du spot, ni des bancs de sable.
- Le vent est coloré et fléché, pas animé comme sur Windy.
- Cette carte n'a été testée qu'avec des réponses simulées, pas avec le vrai service.

## Ce qui a été vérifié

La logique des alertes et les écrans ont été testés dans un navigateur de test, avec une carte, une météo et un serveur simulés. L'appli n'a pas encore tourné avec le vrai Supabase ni sur un vrai téléphone. Au premier essai réel, si quelque chose coince (surtout à l'étape 2), envoie-moi le message affiché.

## Nouveautés de novembre
- **Affichage simple (22/11)** : dans Mes spots, chaque spot affiche une phrase : « Ça vaut le coup » (jour, heures, houle, vent), « Peut-être, créneau limite » ou « Pas la peine pour le moment ». Le tableau jour par jour est replié (« Voir les chiffres »). Le bouton « Affichage : simple / détaillé » change ça ; le choix est gardé sur l'appareil, simple par défaut. Ce n'est qu'un résumé de la prévision du modèle Open-Meteo avec tes réglages ; la source reste le modèle mondial (ordre de grandeur). À vérifier sur téléphone.
- **Pourquoi « Pas la peine » (24/11)** : la phrase donne maintenant la raison la plus fréquente sur les jours à venir (« surtout houle trop petite (0,6 m) », « vent trop fort… »). Dans l'onglet Alertes, une section « Tes spots en une phrase » reprend le même verdict pour chaque spot suivi (dans ton rayon si activé). Même source : modèle mondial, ordre de grandeur. Testé en simulation, à vérifier sur téléphone.
- **Marée préférée** : dans la fiche d'un spot, « Marée qui marche bien » (basse, mi-marée, haute, toutes). Elle s'affiche sous le nom du spot et est pré-remplie pour les spots connus qui la précisent. Pour mémoire seulement : les alertes ne l'utilisent pas encore.
- **Onglet Week-end** (masqué depuis le 21/11, décision d'Enzo ; code et tests gardés) : classe les spots autour de ta position (ou du centre de la carte), dans un rayon de 50, 100 ou 200 km, pour samedi et dimanche, selon tes critères. Les 24 spots les plus proches sont analysés.
- **Lien de partage** : le bouton « Lien » d'un spot crée une adresse qui s'ouvre sans compte et propose d'ajouter le spot. Tu peux y joindre tes notes et la prochaine bonne session. Les photos ne sont pas envoyées.
- **Installable et hors connexion** : ouverte depuis `https://enzovildina-spec.github.io/houle-data/houle.html`, l'appli peut être ajoutée à l'écran d'accueil (menu du navigateur, « Installer » ou « Sur l'écran d'accueil ») et s'ouvre ensuite sans connexion avec tes spots. Les cartes et les prévisions ont besoin d'Internet.
- **Importer mes lieux (Google Maps)** : bouton en bas de l'onglet Spots. Tu exportes d'abord un fichier chez Google (carte « Mes cartes » en KML/KMZ, ou Takeout en .json/.csv) : l'appli lit ce fichier, montre un aperçu (doublons décochés, tracés ignorés) et ajoute les lieux comme spots **privés**. Elle ne modifie rien chez Google ni dans tes spots existants, et « Annuler cet import » retire seulement les spots ajoutés non modifiés. Les spots importés sont « au repos » (pas de prévision ni d'alertes tant que tu ne touches pas « Suivre »), pour ne pas saturer le quota gratuit. L'ancien bouton « Importer » d'une sauvegarde s'appelle maintenant « Restaurer ».

## Exposition des spots (estimation d'après la côte)

Pour les spots connus sans conditions publiées, l'appli peut proposer une fenêtre de houle (d'où la houle peut arriver) et un vent offshore, calculés d'après le trait de côte (Natural Earth, domaine public). Quand la houle prévue vient d'une direction masquée par la terre (île, cap), la hauteur affichée est réduite. C'est une estimation simple : elle ignore les fonds, les courants et la houle qui contourne les caps. Ces valeurs sont toujours marquées « estimation d'après la côte ».

Pour remplir les données (une seule fois, puis quand tu veux) : sur GitHub, ouvre le dépôt, onglet « Actions », choisis « Exposition des spots (trait de côte) », clique « Run workflow ». Quelques minutes plus tard l'appli publiée est mise à jour. Tant que ce n'est pas fait, rien ne change dans l'appli.

**Mise à jour du 16/11 : atténuation plus douce derrière îles et caps.** Avant, une direction masquée coupait la houle d'un coup. Maintenant la zone d'ombre reçoit encore une partie de la houle des directions ouvertes voisines (diffraction simplifiée), et une houle longue (période élevée) contourne mieux qu'une houle courte : à 16 s l'ombre est plus étroite qu'à 6 s. Le côté terre reste fermé. C'est une estimation simple, pas de la vraie physique : seule la vraie modélisation (Copernicus IBI, voir BACKLOG) tiendra compte de la réfraction et de la bathymétrie. Testé sur des côtes fictives ; à comparer sur de vrais spots abrités (ex. derrière Ouessant ou Groix).

**Mise à jour du 17/11 : période maximum.** Dans la fiche d'un spot, nouveau champ « Période max (s) » (vide = pas de limite, comme avant : tes anciens spots ne changent pas). Si la houle prévue dépasse ce maximum, le créneau est refusé avec la raison « période trop longue ». Le maximum passe aussi dans les liens de partage. Testé par les tests automatiques ; à essayer sur téléphone. Les autres points de la « 2e série » (secteurs vert/orange/rouge sur la carte, marée en mètres d'eau, photos par spot) ne sont pas commencés : ils attendent ta confirmation.

**Mise à jour du 17/11 : validation des spots, carte mieux centrée.** Quand tu classes / valides les spots un par un, le spot affiché est maintenant sélectionné et son repère devient vert (plus gros, avec un halo). La carte se centre exactement sur son point GPS, dans la partie de la carte que la fiche ne cache pas (téléphone : au-dessus de la fiche ; ordinateur : à gauche de la fiche), avec un zoom moins serré qu'avant (14 au lieu de 16) pour voir les alentours. Testé avec une fausse carte ; le centrage réel est À VÉRIFIER sur téléphone.

**Mise à jour du 19/11 : alertes plus lisibles.** Dans la liste « À ne pas rater », chaque alerte porte une pastille verte « Parfait » ou orange « Limite » (texte + couleur, lisible aussi en contraste fort). Le test vocal de réglage a été rendu moins capricieux (attente plus longue). Testé par les tests automatiques ; à vérifier sur téléphone (lisibilité en plein soleil).

**Mise à jour du 19/11 : carnet de sessions « J'ai surfé ».** Dans Mes spots, bouton « 🏄 J'ai surfé » (et « J'ai surfé ici » dans la fiche d'un spot) : tu choisis le spot, le jour (Aujourd'hui, Hier ou n'importe quelle date passée) et les heures (par ex. 13 h à 16 h). Houle va chercher la houle, la période, le vent et la marée de ces heures-là (Open-Meteo : archive pour les jours anciens, service de prévision pour les 7 derniers jours ; modèle mondial, ordre de grandeur, pas une mesure sur le spot). Tu colories ensuite chaque heure : vert = parfait, orange = moyen, rouge = mauvais (touche une couleur puis touche ou glisse sur la colonne des couleurs ; « Pré-remplir d'après les réglages du spot » propose un départ). La session est gardée sur ton appareil dans le « Carnet de sessions », avec les chiffres de chaque heure. Dans le carnet, « Proposer des réglages pour ce spot » calcule d'après tes heures vertes : taille de houle, période minimum, direction de la houle et du vent (avec la bande orange d'après tes heures moyennes), vent maximum, marée. RIEN n'est modifié tant que tu ne touches pas « Appliquer à ce spot ». Testé avec de fausses réponses du service ; pas testé avec le vrai Open-Meteo ni au doigt sur un vrai téléphone. Les sessions ne sont pas encore dans la sauvegarde exportée ni synchronisées entre appareils.

**Mise à jour du 20/11 : import Google, lieux sans coordonnées.** Quand ton fichier contient des lieux sans position (liste Google avec seulement un lien « maps/place » ou juste un nom), l'aperçu de l'import les compte et propose « Chercher leur position par le nom ». L'appli interroge OpenStreetMap (service Nominatim) : seulement le nom du lieu et son adresse, 40 lieux au maximum à la fois, environ un par seconde. Si le service dit « trop de demandes », elle s'arrête et te dit de réessayer plus tard (aucun contournement). Les positions trouvées arrivent **décochées** et marquées « position à vérifier » : regarde-les avant de cocher ; un spot importé ainsi garde une note « position trouvée par le nom, à vérifier ». Les introuvables sont signalés et restent à placer à la main. Testé avec un faux service ; pas testé avec le vrai Nominatim ni sur téléphone.

- Bouton « + J'ai surfé » (21/11) : toujours visible à droite de la barre d'onglets, ouvre directement le carnet de sessions (spot, jour, heures). L'onglet Week-end n'apparaît plus. Non testé sur un vrai téléphone : vérifier que la barre défile bien et que le bouton reste facile à toucher.
- Menu à trois traits ☰ (22/11, demande d'Enzo) : bouton en haut à gauche. Sur téléphone en vertical, l'appli s'ouvre maintenant sur la carte seule ; le menu ouvre une petite page avec Conditions, Mes spots, Alertes, Marées, J'ai surfé, Accessibilité, Aide (et Amis/Cartes/Reçu si les comptes sont activés). Choisir une entrée ouvre la liste sur le bon onglet. Testé en simulation seulement : à essayer sur un vrai téléphone.

**Mise à jour du 23/11 : marée du port le plus proche (chantier B1).** Dans l'onglet Marées, quand tu choisis un de tes spots (ou le centre de la carte), Houle indique « Marée de référence : Port de Brest, à 12 km » avec un bouton « Voir ce port ». La même ligne apparaît dans « J'ai surfé » et change quand tu changes de spot. Attention : les heures et hauteurs affichées viennent toujours du modèle mondial Open-Meteo au point du spot, pas des horaires du port (c'est écrit à l'écran). La liste couvre seulement 25 ports de France ; au-delà de 250 km, Houle dit « aucun port à proximité » au lieu d'en inventer un. Testé par les tests automatiques ; à essayer sur un vrai téléphone.

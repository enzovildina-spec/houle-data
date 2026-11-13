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
- Les emojis de houle : sur chaque spot dont la prévision est chargée, un emoji donne la plus grosse houle attendue dans les 3 jours : 💤 plat, 〰️ petite, 🌊 bonne, 🔥 grosse, ⚠️ énorme.
- Limites des spots connus : positions précises à 300-500 m environ (souvent le parking ou la plage, pas le pic), à confirmer en vue satellite. Les conditions conseillées ont été lues sur des sites de spots pour environ 100 spots sur 296 seulement : pour les autres, la discipline est estimée d'après le type de spot (reef : bodyboard possible, point break : longboard possible) et aucune condition n'est proposée. Les disciplines sont indicatives. Le fichier `spots-connus.json` donne les sources et le détail.
- Les spots : touche « Ajouter un spot », puis touche la carte. Tu peux glisser le repère pour être précis, coller des coordonnées GPS (« 43.48123, -1.55678 ») ou utiliser ta position.
- Pour chaque spot : notes, jusqu'à 6 photos, ton lien de prévision (Windguru, Windy, Ifremer ou autre) et un lien Windy automatique sur le point.
- Les prévisions sur 8 jours (houle, période, vent) venues d'Open-Meteo, et un bandeau de 8 cases par spot : vert quand une session est possible, ambre pour un créneau court, gris sinon.
- Tes critères par spot : houle min et max, période minimum, vent maximum, direction du vent, direction de la houle, plage horaire, et ta discipline (surf, bodyboard ou longboard).
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
- **Marée préférée** : dans la fiche d'un spot, « Marée qui marche bien » (basse, mi-marée, haute, toutes). Elle s'affiche sous le nom du spot et est pré-remplie pour les spots connus qui la précisent. Pour mémoire seulement : les alertes ne l'utilisent pas encore.
- **Onglet Week-end** : classe les spots autour de ta position (ou du centre de la carte), dans un rayon de 50, 100 ou 200 km, pour samedi et dimanche, selon tes critères. Les 24 spots les plus proches sont analysés.
- **Lien de partage** : le bouton « Lien » d'un spot crée une adresse qui s'ouvre sans compte et propose d'ajouter le spot. Tu peux y joindre tes notes et la prochaine bonne session. Les photos ne sont pas envoyées.
- **Installable et hors connexion** : ouverte depuis `https://enzovildina-spec.github.io/houle-data/houle.html`, l'appli peut être ajoutée à l'écran d'accueil (menu du navigateur, « Installer » ou « Sur l'écran d'accueil ») et s'ouvre ensuite sans connexion avec tes spots. Les cartes et les prévisions ont besoin d'Internet.
- **Importer mes lieux (Google Maps)** : bouton en bas de l'onglet Spots. Tu exportes d'abord un fichier chez Google (carte « Mes cartes » en KML/KMZ, ou Takeout en .json/.csv) : l'appli lit ce fichier, montre un aperçu (doublons décochés, tracés ignorés) et ajoute les lieux comme spots **privés**. Elle ne modifie rien chez Google ni dans tes spots existants, et « Annuler cet import » retire seulement les spots ajoutés non modifiés. Les spots importés sont « au repos » (pas de prévision ni d'alertes tant que tu ne touches pas « Suivre »), pour ne pas saturer le quota gratuit. L'ancien bouton « Importer » d'une sauvegarde s'appelle maintenant « Restaurer ».

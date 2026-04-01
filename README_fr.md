<p align="center">
  🌐 &nbsp;
  <a href="README.md">English</a> &nbsp;|&nbsp;
  <a href="README_ch.md">中文</a> &nbsp;|&nbsp;
  <a href="README_es.md">Español</a> &nbsp;|&nbsp;
  <strong>Français</strong> &nbsp;|&nbsp;
  <a href="README_ja.md">日本語</a> &nbsp;|&nbsp;
  <a href="README_ko.md">한국어</a>
</p>

# AssetPilot — Gestion Personnelle des Actifs

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  Une application web de gestion personnelle des actifs — comptabilité, suivi boursier et gestion du budget, tout en un seul endroit.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.4-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## Table des matières

- [Introduction](#introduction)
- [Fonctionnalités clés](#fonctionnalités-clés)
- [Fonctionnalités](#fonctionnalités)
  - [Tableau de bord](#tableau-de-bord)
  - [Gestion des finances](#gestion-des-finances)
  - [Enregistrements boursiers](#enregistrements-boursiers)
  - [Rapports](#rapports)
  - [Gestion du budget](#gestion-du-budget)
  - [Gestion des comptes](#gestion-des-comptes)
  - [Paramètres et administration](#paramètres-et-administration)
- [Stack technologique](#stack-technologique)
- [Installation](#installation)
  - [Option 1 : Déploiement en un clic via Docker Hub (Recommandé)](#option-1--déploiement-en-un-clic-via-docker-hub-recommandé)
  - [Option 2 : Docker Compose](#option-2--docker-compose)
  - [Option 3 : Exécution directe avec Node.js](#option-3--exécution-directe-avec-nodejs)
- [Variables d'environnement](#variables-denvironnement)
- [Guide de déploiement](#guide-de-déploiement)
  - [Synology NAS](#synology-nas)
  - [VPS Cloud](#vps-cloud)
  - [Proxy inverse Nginx](#proxy-inverse-nginx)
  - [Proxy inverse Caddy](#proxy-inverse-caddy)
- [Configuration de Google SSO](#configuration-de-google-sso)
- [Guide d'utilisation](#guide-dutilisation)
  - [Configuration initiale](#configuration-initiale)
  - [Ajouter une transaction](#ajouter-une-transaction)
  - [Guide de paiement par carte de crédit](#guide-de-paiement-par-carte-de-crédit)
  - [Gestion des actions](#gestion-des-actions)
  - [Gestion des taux de change](#gestion-des-taux-de-change)
  - [Export et import CSV](#export-et-import-csv)
  - [Opérations d'administration](#opérations-dadministration)
- [Gestion avancée Docker](#gestion-avancée-docker)
- [Sécurité](#sécurité)
- [Structure des fichiers](#structure-des-fichiers)
- [Sources des API](#sources-des-api)
- [Licence](#licence)

---

## Introduction

**AssetPilot** est une application web de gestion personnelle des actifs axée sur la confidentialité.

Toutes les données sont stockées localement (ou sur votre serveur auto-hébergé) — aucune base de données cloud tierce n'est requise. Déployez en une seule commande Docker, ce qui le rend idéal pour les périphériques NAS domestiques (ex. Synology), les VPS, ou votre machine locale.

**Pour qui est-ce conçu ?**

- Toute personne souhaitant suivre ses flux de trésorerie personnels, ses revenus/dépenses mensuels et son budget
- Les investisseurs sur le marché boursier taïwanais (TWSE) qui ont besoin de gérer leurs positions, leurs profits & pertes et leurs dividendes
- Les utilisateurs soucieux de leur vie privée qui ne souhaitent pas que leurs données financières soient stockées sur des plateformes tierces

---

## Fonctionnalités clés

| Fonctionnalité | Description |
|----------------|-------------|
| 🏠 **Auto-hébergé, propriété des données** | Base de données chiffrée stockée localement ; aucune donnée financière n'est téléchargée vers des serveurs externes |
| 🐳 **Déploiement Docker en un clic** | Aucune configuration requise ; les clés JWT et de chiffrement sont générées automatiquement |
| 📊 **Intégration approfondie TWSE** | Cours boursiers en temps réel, synchronisation automatique des détachements de dividendes, calcul des profits & pertes FIFO via l'OpenAPI TWSE |
| 💱 **Support multi-devises** | Plus de 150 devises prises en charge, avec des taux de change en direct depuis exchangerate-api.com |
| 📱 **Design responsive** | Fonctionne parfaitement sur ordinateur de bureau et sur mobile |
| 🔒 **Sécurité de niveau entreprise** | Chiffrement de base de données ChaCha20-Poly1305, en-têtes de sécurité Helmet, limitation de débit, CSP |
| 👥 **Gestion multi-utilisateurs** | Prend en charge plusieurs utilisateurs ; l'administrateur peut contrôler la politique d'inscription et consulter les journaux de connexion |
| 🔑 **Google SSO** | Connexion Google en un clic optionnelle via le flux d'autorisation OAuth Code |

---

## Fonctionnalités

### Tableau de bord

- Carte de synthèse des actifs totaux (somme de tous les soldes de comptes)
- Résumé mensuel des revenus / dépenses
- Graphique en anneau des catégories de dépenses (prend en charge le graphique à double anneau : anneau intérieur = catégorie parente, anneau extérieur = sous-catégorie)
- Graphique en anneau de répartition des actifs (actifs des comptes + valeur de marché des actions, commutable en double anneau)
- Liste des transactions récentes

### Gestion des finances

**Transactions**
- CRUD de revenus / dépenses / virements avec notes, catégories, comptes et devises
- Les transactions à date future sont automatiquement marquées d'une étiquette « Futur » pour identification et filtrage
- Opérations par lots avec sélection multiple : suppression en lot, changement en lot de catégorie / compte / date
- Virements entre comptes avec appariement automatique bidirectionnel (`linked_id`)

**Gestion du budget**
- Budget mensuel total + budgets par catégorie
- Barres de progression visuelles affichant le budget restant en temps réel

**Gestion des comptes**
- Plusieurs comptes (espèces, banque, carte de crédit, etc.)
- Soldes calculés automatiquement à partir des enregistrements de transactions
- Comptes multi-devises avec conversion des taux de change en direct

**Paramètres des taux de change**
- Connecté à exchangerate-api.com, prenant en charge plus de 150 devises
- Déclenchement manuel ou synchronisation automatique ; affichage de l'horodatage de la dernière mise à jour

**Gestion des catégories**
- Structure de catégories parent-enfant à deux niveaux (ex. Alimentation → Petit-déjeuner / Déjeuner / Dîner)
- Couleurs de catégories personnalisées

**Transactions récurrentes**
- Configurer des revenus/dépenses périodiques (loyer, salaire, etc.) qui génèrent automatiquement des enregistrements de transactions

### Enregistrements boursiers

**Aperçu du portefeuille**
- Calcul en temps réel de la valeur de marché, des profits & pertes latents et du taux de rendement
- Récupération automatique des cours en direct / de clôture depuis TWSE (stratégie en 3 étapes)
- Mise à jour en lot des cours avec source (cours en temps réel / cours de clôture) et horodatage par action

**Enregistrements de transactions**
- Enregistrements d'achat / vente prenant en charge les lots entiers et les fractions d'actions
- Calcul automatique des frais de courtage (`0,1425 %`, minimum NT$20 pour les lots entiers)
- Calcul automatique de la taxe sur les transactions sur valeurs mobilières lors des ventes (actions ordinaires `0,3 %`, ETF/bons de souscription `0,1 %`)
- Saisie d'un code boursier pour interroger automatiquement TWSE et créer l'entrée de l'action (pas besoin d'ajouter manuellement au préalable)
- Recherche/filtre, pagination, suppression en lot avec sélection multiple

**Enregistrements de dividendes**
- Enregistrements de dividendes en espèces / en actions
- Synchronisation automatique des détachements de dividendes depuis TWSE (`TWT49U` + `TWT49UDetail`), sans doublons

**Profits & pertes réalisés**
- Calcul FIFO du coût moyen, des profits & pertes réalisés et du taux de rendement par vente
- Cartes de synthèse : total des profits & pertes réalisés, taux de rendement global, profits & pertes de l'année en cours

**Plan d'investissement régulier (DCA)**
- Définir une période et un budget par cycle ; les transactions d'achat sont générées automatiquement

### Rapports

- **Rapport par catégorie** : Graphique en anneau par catégorie parente, commutable en double anneau (intérieur = parent, extérieur = sous-catégorie) ; la légende et les infobulles affichent le montant et le pourcentage
- **Analyse des tendances** : Graphique en courbes des revenus / dépenses mensuels
- **Dépenses quotidiennes** : Graphique en barres des dépenses journalières
- Filtre de plage de dates personnalisé

### Gestion des comptes

- Ajouter, modifier et supprimer plusieurs comptes
- Affichage du solde en direct pour chaque compte

### Paramètres et administration

**Paramètres du compte**
- Modifier le nom d'affichage et le mot de passe
- Consulter l'historique de connexion personnel (100 dernières entrées) avec horodatage, IP, pays et méthode de connexion

**Export et import de données**
- Export / import CSV des enregistrements de transactions (y compris la structure des catégories)
- Export / import CSV des transactions boursières
- Export / import CSV des enregistrements de dividendes

**Fonctionnalités d'administration**
- Activer/désactiver l'inscription publique ; configurer la liste blanche d'e-mails
- Ajouter / supprimer des comptes utilisateurs
- Consulter les enregistrements de connexion de tous les utilisateurs (y compris les tentatives échouées)
- Synchroniser manuellement les enregistrements de connexion sans actualiser la page

---

## Stack technologique

| Couche | Technologie |
|--------|-------------|
| Frontend | Vanilla HTML / CSS / JavaScript (SPA avec `history.pushState`) |
| Backend | Node.js + Express |
| Base de données | SQLite (sql.js, en mémoire + persistance fichier) |
| Chiffrement | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| Authentification | JWT (Bearer Token) + bcryptjs ; Google OAuth Code Flow (optionnel) |
| Graphiques | Chart.js |
| Icônes | Font Awesome 6 |
| Sécurité | Helmet, express-rate-limit, SRI, liste blanche CORS, CSP |

---

## Installation

### Option 1 : Déploiement en un clic via Docker Hub (Recommandé)

Aucune configuration nécessaire — il suffit d'exécuter :

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

Ouvrez [http://localhost:3000](http://localhost:3000) et vous êtes prêt.

> **C'est tout !** La base de données, la clé JWT, la clé de chiffrement et le volume sont tous créés automatiquement.

---

### Option 2 : Docker Compose

Créez un fichier `docker-compose.yml` :

```yaml
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - GOOGLE_CLIENT_ID=          # Optionnel : entrez votre Google OAuth Client ID pour activer SSO
      # - ALLOWED_ORIGINS=https://votre-domaine.com

volumes:
  assetpilot-data:
```

Démarrez le conteneur :

```bash
docker compose up -d
```

---

### Option 3 : Exécution directe avec Node.js

**Prérequis :** Node.js >= 18

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Modifier .env selon les besoins

# 3. Démarrer le serveur
node server.js
```

Ouvrez [http://localhost:3000](http://localhost:3000) pour commencer à utiliser l'application.

---

## Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `PORT` | Port du serveur | `3000` |
| `JWT_SECRET` | Clé de signature JWT (doit être changée en production) | Générée automatiquement par Docker |
| `JWT_EXPIRES` | Durée de validité du JWT | `7d` |
| `DB_ENCRYPTION_KEY` | Clé de chiffrement de la base de données | Générée automatiquement par Docker |
| `DB_PATH` | Chemin du fichier de base de données | `/app/data/database.db` |
| `ENV_PATH` | Chemin du fichier .env auto-généré | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optionnel) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (optionnel) | — |
| `ALLOWED_ORIGINS` | Liste blanche CORS, séparée par des virgules (illimitée si vide) | — |
| `EXCHANGE_RATE_API_KEY` | Clé API exchangerate-api.com (optionnel) | — |
| `IPINFO_TOKEN` | Jeton ipinfo.io pour un quota de recherche IP plus élevé (optionnel) | — |
| `CHANGELOG_URL` | URL distante du changelog.json | URL du dépôt GitHub par défaut |

---

## Guide de déploiement

### Synology NAS

**Option A : Interface graphique Container Manager (Le plus simple)**

1. DSM → **Container Manager** → **Registre** → Rechercher `es94111/assetpilot` → Télécharger
2. **Conteneur** → **Créer** → Sélectionner `es94111/assetpilot:latest`
3. Définir le port : `3000 → 3000` ; le volume est créé automatiquement
4. Démarrer le conteneur

**Option B : Commande SSH**

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

**Proxy inverse (domaine personnalisé + HTTPS)**

DSM → **Panneau de configuration** → **Portail de connexion** → **Avancé** → **Proxy inverse**, ajouter une règle :

| Champ | Valeur |
|-------|--------|
| Protocole source | HTTPS |
| Nom d'hôte source | `votre-domaine.com` |
| Port source | 443 |
| Protocole de destination | HTTP |
| Nom d'hôte de destination | `localhost` |
| Port de destination | `3000` |

Ajouter un en-tête personnalisé : `X-Forwarded-For` → `$proxy_add_x_forwarded_for`

---

### VPS Cloud

```bash
mkdir assetpilot && cd assetpilot

cat > docker-compose.yml << 'EOF'
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
EOF

docker compose up -d
```

---

### Proxy inverse Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Proxy inverse Caddy

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy provisionne et renouvelle automatiquement les certificats HTTPS.

---

## Configuration de Google SSO

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/) et créez un OAuth 2.0 Client ID (type : Application Web)
2. Définissez les **Origines JavaScript autorisées** :
   - Local : `http://localhost:3000`
   - Production : `https://votre-domaine.com`
3. Définissez les **URI de redirection autorisés** :
   - Local : `http://localhost:3000/`
   - Production : `https://votre-domaine.com/`
4. Définissez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` comme variables d'environnement et redémarrez
5. Si non configuré, le bouton de connexion Google est automatiquement masqué et n'affecte pas la connexion par mot de passe

> ⚠️ Si vous êtes bloqué sur `/?code=...` après la connexion, assurez-vous que l'URI de redirection dans Google Console correspond exactement à votre domaine (y compris `https://` et le `/` final).

---

## Guide d'utilisation

### Configuration initiale

1. Ouvrez votre navigateur et accédez à `http://localhost:3000`
2. Cliquez sur **« S'inscrire maintenant »** pour créer un compte
3. **Le premier utilisateur inscrit devient automatiquement l'administrateur**
4. Les catégories par défaut (alimentation, vêtements, logement, transport, etc.) et les comptes (espèces, compte bancaire) sont créés automatiquement
5. Vous êtes prêt à commencer à utiliser l'application après la connexion

---

### Ajouter une transaction

1. Cliquez sur **« Finances »** dans la barre latérale
2. Cliquez sur **« + Ajouter une transaction »** en haut à droite
3. Remplissez la date, le type (revenu / dépense / virement), le montant, la catégorie et le compte
4. Ajoutez optionnellement des notes et une devise
5. Cliquez sur **« Enregistrer »**

**Opérations par lots :** Sélectionnez plusieurs transactions avec les cases à cocher, puis utilisez la barre d'actions pour supprimer en lot ou modifier en lot la catégorie / le compte / la date.

---

### Guide de paiement par carte de crédit

Lors d'un achat par carte de crédit, enregistrez-le comme une **dépense** avec la carte de crédit comme compte, permettant au solde de devenir négatif (reflétant votre dette réelle).

**Lors du paiement de votre facture de carte de crédit :**

1. **Finances** → **Ajouter une transaction**
2. Définir le type sur **Virement**
3. Compte source : votre **compte bancaire**
4. Compte de destination : votre **compte de carte de crédit**
5. Saisissez le montant du paiement et enregistrez

Cela déduit de votre solde bancaire et compense le solde négatif de la carte de crédit — sans le comptabiliser en double comme dépense.

---

### Gestion des actions

**Ajouter une position boursière**

1. **Enregistrements boursiers** → **Transactions** → **+ Ajouter une transaction boursière**
2. Saisissez le code boursier (ex. `2330`) ; le système interroge automatiquement TWSE et remplit le nom et le cours actuel
3. Remplissez la date d'achat, le nombre d'actions et le prix de transaction
4. Les frais de courtage et la taxe de transaction sont calculés automatiquement (modifiables)
5. La position est ajoutée à votre portefeuille après l'enregistrement

**Mise à jour des cours boursiers**

Cliquez sur **« Mettre à jour les cours »** sur la page du portefeuille. Le système utilise une stratégie en 3 étapes pour récupérer les derniers cours :
- Pendant les heures de négociation → cours en temps réel TWSE
- Après la clôture du marché → cours de clôture STOCK_DAY
- Autres moments → solution de repli STOCK_DAY_ALL

**Synchronisation des détachements de dividendes**

**Enregistrements de dividendes** → **Synchroniser les détachements** — ajoute automatiquement les dividendes en espèces et en actions en fonction de votre période de détention (sans doublons).

---

### Gestion des taux de change

1. **Finances** → **Gestion des comptes** → **Paramètres des taux de change**
2. Cliquez sur **« Récupérer les taux en direct maintenant »** pour synchroniser manuellement
3. Ou activez **« Mise à jour automatique des taux de change »** pour synchroniser automatiquement lors de l'accès à la page
4. Ajoutez n'importe quel code de devise à 3 lettres comme devise personnalisée

---

### Export et import CSV

**Chemin :** **Paramètres** → **Export et import de données**

| Type | Champs exportés |
|------|-----------------|
| Transactions | Date, type, montant, devise, catégorie, compte, notes |
| Transactions boursières | Date, code, nom, type (achat/vente), actions, prix, frais, taxe, compte, notes |
| Enregistrements de dividendes | Date, code, nom, dividende en espèces, dividende en actions, notes |

**Notes sur l'import :** Si un code boursier n'existe pas, il sera créé automatiquement lors de l'import. Si le nom est incorrect, il sera mis à jour avec le nom du CSV.

---

### Opérations d'administration

**Chemin :** **Paramètres** → **Administration**

| Fonctionnalité | Description |
|----------------|-------------|
| Activer/désactiver l'inscription publique | Contrôler si n'importe qui peut s'auto-inscrire |
| Liste blanche d'e-mails | N'autoriser que les e-mails de la liste blanche à s'inscrire (un par ligne) |
| Ajouter un compte | Créer directement un nouvel utilisateur, optionnellement en tant qu'administrateur |
| Supprimer un compte | Supprimer définitivement un utilisateur et toutes ses données associées |
| Audit des connexions | Consulter les horodatages, IPs, pays et statut de succès/échec de connexion de tous les utilisateurs |

---

## Gestion avancée Docker

### Informations sur l'image

| Élément | Valeur |
|---------|--------|
| Docker Hub | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| Architectures prises en charge | `linux/amd64`, `linux/arm64` |
| Image de base | `node:24-alpine` |
| Taille de l'image | ~180 MB |
| Vérification de l'état | Vérification automatique toutes les 30 secondes |

### Volume et persistance des données

Le répertoire `/app/data` à l'intérieur du conteneur contient toutes les données persistantes :

```
/app/data/
├── database.db    # Base de données SQLite chiffrée
└── .env           # Clés auto-générées (JWT_SECRET, DB_ENCRYPTION_KEY)
```

**Trois options de montage :**

```bash
# 1. Volume anonyme (le plus simple)
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. Volume nommé (recommandé, facile à gérer)
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. Montage de liaison (pour accès direct aux fichiers)
docker run -d -p 3000:3000 -v /path/to/data:/app/data es94111/assetpilot:latest
```

### Sauvegarde et restauration

```bash
# Sauvegarde
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# Restauration
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **Important :** La suppression d'un volume détruira définitivement votre base de données et vos clés de chiffrement. Effectuez toujours une sauvegarde avant de procéder.

### Commandes de gestion courantes

```bash
# Afficher l'état du conteneur (y compris la vérification de l'état)
docker ps

# Afficher les journaux en direct
docker logs -f assetpilot

# Arrêter / Redémarrer
docker stop assetpilot
docker restart assetpilot

# Mettre à jour vers la dernière version
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### Construire votre propre image

```bash
docker build -t assetpilot .

docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot
```

---

## Sécurité

| Mécanisme | Description |
|-----------|-------------|
| **Chiffrement de la base de données** | ChaCha20-Poly1305 AEAD + dérivation de clé PBKDF2-SHA256 |
| **Hachage des mots de passe** | Stockage par hachage bcryptjs — les mots de passe ne sont jamais stockés en clair |
| **Protection XSS** | Toutes les entrées utilisateur sont échappées via `escHtml()` avant d'être insérées dans le DOM |
| **En-têtes de sécurité** | Helmet (HSTS, X-Content-Type-Options, Referrer-Policy) |
| **Protection CSP** | Scripts inline bloqués ; sources des scripts et ressources restreintes |
| **Limitation de débit** | API de connexion / inscription limitée à 20 requêtes par IP par 15 minutes |
| **Contrôle CORS** | `ALLOWED_ORIGINS` restreint les domaines d'origine autorisés |
| **Validation de l'état OAuth** | La connexion Google utilise un jeton d'état unique pour prévenir les attaques CSRF / replay |
| **Vérification SRI** | Les scripts CDN externes (Font Awesome, Chart.js) incluent des attributs d'intégrité |
| **Protection contre l'injection d'attributs** | Le champ d'icône de compte est validé par rapport à une liste blanche (seul `fa-*` est autorisé) |
| **Audit des connexions** | Enregistre l'horodatage, l'IP, le pays et la méthode de connexion ; les administrateurs peuvent consulter les tentatives échouées |
| **Vérification de l'état** | Docker HEALTHCHECK détecte automatiquement l'état du service toutes les 30 secondes |

---

## Structure des fichiers

```
├── server.js              # Backend Express (API + base de données)
├── app.js                 # Logique SPA frontend (module IIFE)
├── index.html             # HTML monopage (toutes les pages + modales)
├── style.css              # Styles globaux
├── logo.svg               # Logo du site (page de connexion)
├── favicon.svg            # Favicon + logo de la barre latérale
├── changelog.json         # Enregistrements des mises à jour de version
├── Dockerfile             # Configuration de construction Docker
├── docker-compose.yml     # Configuration Docker Compose
├── .env.example           # Modèle de variables d'environnement
├── .gitignore             # Liste d'exclusions Git
├── SRS.md                 # Spécification des exigences logicielles
├── .github/workflows/
│   └── docker-publish.yml # Construction et déploiement automatisés CI/CD
└── data/                  # Répertoire de données (montage Docker Volume)
    ├── database.db        # Base de données SQLite chiffrée (auto-générée)
    └── .env               # Fichier de clés (auto-généré)
```

---

## Sources des API

| Service | Utilisation | Lien |
|---------|-------------|------|
| **TWSE OpenAPI** | Cours boursiers taïwanais en temps réel et données de détachement de dividendes | [openapi.twse.com.tw](https://openapi.twse.com.tw/) |
| **exchangerate-api.com** | Taux de change mondiaux en direct (devise de base : TWD) | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| **Google Identity Services** | Connexion Google SSO | [developers.google.com/identity](https://developers.google.com/identity) |
| **IPinfo Lite** | Recherche de pays par adresse IP | [ipinfo.io/lite](https://ipinfo.io/lite) |

Les données d'adresses IP sont fournies par IPinfo.

---

## Licence

[GNU AGPL v3](LICENSE)

---

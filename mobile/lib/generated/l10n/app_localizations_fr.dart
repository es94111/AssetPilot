// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get commonSave => 'Enregistrer';

  @override
  String get commonCancel => 'Annuler';

  @override
  String get commonDelete => 'Supprimer';

  @override
  String get commonEdit => 'Modifier';

  @override
  String get commonConfirm => 'Confirmer';

  @override
  String get commonClose => 'Fermer';

  @override
  String get commonLoading => 'Chargement…';

  @override
  String get commonAdd => 'Ajouter';

  @override
  String get commonBack => 'Retour';

  @override
  String get commonSearch => 'Rechercher';

  @override
  String get commonLanguage => 'Langue';

  @override
  String get commonClear => 'Effacer';

  @override
  String get commonSaving => 'Enregistrement...';

  @override
  String get commonConfirmDelete => 'Confirmer la suppression';

  @override
  String get commonPreviousPage => 'Précédent';

  @override
  String get commonNextPage => 'Suivant';

  @override
  String commonTotalRecords(Object count) {
    return '$count enregistrements';
  }

  @override
  String get commonPerPage => 'Par page';

  @override
  String commonRecordsUnit(Object count) {
    return '$count enregistrements';
  }

  @override
  String get commonNoData => 'Aucune donnée pour le moment';

  @override
  String get navSectionsFinance => 'Finances';

  @override
  String get navSectionsStocks => 'Actions';

  @override
  String get navSectionsSystem => 'Système';

  @override
  String get navDashboard => 'Tableau de bord';

  @override
  String get navTransactions => 'Transactions';

  @override
  String get navReports => 'Rapports';

  @override
  String get navBudget => 'Budgets';

  @override
  String get navInfoBoard => 'Tableau d’information';

  @override
  String get navAccounts => 'Comptes';

  @override
  String get navCategories => 'Catégories';

  @override
  String get navRecurring => 'Récurrents';

  @override
  String get navStocksPortfolio => 'Portefeuille';

  @override
  String get navStocksTransactions => 'Transactions actions';

  @override
  String get navStocksDividends => 'Dividendes';

  @override
  String get navStocksRealized => 'P/L réalisé';

  @override
  String get navStocksSettings => 'Paramètres actions';

  @override
  String get navExportImport => 'Export / Import';

  @override
  String get navAccount => 'Compte';

  @override
  String get navApiCredits => 'Accès API';

  @override
  String get navAdmin => 'Admin';

  @override
  String get navTitleStocks => 'Portefeuille';

  @override
  String get navTitleStockTransactions => 'Transactions actions';

  @override
  String get navTitleStockDividends => 'Dividendes actions';

  @override
  String get navTitleStockRealized => 'P/L réalisé';

  @override
  String get navTitleStockSettings => 'Paramètres de trading actions';

  @override
  String get navTitleApiCredits => 'Utilisation et accès API';

  @override
  String get shellFallbackUser => 'Utilisateur';

  @override
  String get shellLogout => 'Déconnexion';

  @override
  String get shellVersionInfo => 'Version';

  @override
  String get shellOpenMenu => 'Ouvrir le menu';

  @override
  String get shellSkipToContent => 'Aller au contenu principal';

  @override
  String get shellThemeLight => 'Clair';

  @override
  String get shellThemeSystem => 'Système';

  @override
  String get shellThemeDark => 'Sombre';

  @override
  String get shellChangelogLoading =>
      'Chargement des informations de version...';

  @override
  String get shellChangelogLoadFailed =>
      'Impossible de charger les informations de version';

  @override
  String get shellChangelogUnknownVersion => 'Inconnue';

  @override
  String get shellChangelogCurrentVersion => 'Version actuelle';

  @override
  String get shellChangelogUpdatableVersion => 'Version disponible';

  @override
  String get shellChangelogUpToDate => 'Déjà à jour';

  @override
  String get shellChangelogUpdatableContent => 'Contenu de la mise à jour';

  @override
  String get shellChangelogRecentContent => 'Dernières mises à jour';

  @override
  String get authLoginTab => 'Connexion';

  @override
  String get authRegisterTab => 'Créer un compte';

  @override
  String get authSubtitleLogin => 'Bon retour, connectez-vous à votre compte';

  @override
  String get authSubtitleRegister => 'Créez votre compte et commencez le suivi';

  @override
  String get authEmailLabel => 'E-mail';

  @override
  String get authPasswordLabel => 'Mot de passe';

  @override
  String get authPasswordPlaceholder => 'Saisissez votre mot de passe';

  @override
  String get authDisplayNameLabel => 'Nom affiché';

  @override
  String get authDisplayNamePlaceholder => 'Votre pseudo';

  @override
  String get authRegisterPasswordPlaceholder =>
      'Au moins 8 caractères, avec majuscules, minuscules et chiffres';

  @override
  String get authTogglePassword => 'Afficher ou masquer le mot de passe';

  @override
  String get authTurnstileAria => 'Vérification humaine Cloudflare Turnstile';

  @override
  String get authLoginButton => 'Se connecter';

  @override
  String get authLoggingIn => 'Connexion…';

  @override
  String get authPasskeyButton => 'Connexion avec Passkey';

  @override
  String get authPasskeyVerifying => 'Vérification du Passkey…';

  @override
  String get authGoogleButton => 'Connexion avec Google';

  @override
  String get authGoogleVerifying => 'Vérification Google…';

  @override
  String get authLineButton => 'Connexion avec LINE';

  @override
  String get authLineVerifying => 'Vérification LINE…';

  @override
  String get authRegisterSubmit => 'Créer le compte';

  @override
  String get authRegistering => 'Création du compte…';

  @override
  String get authLineCallbackCompleting =>
      'Finalisation de la vérification LINE...';

  @override
  String get authLineCallbackMissingCode =>
      'LINE n’a pas renvoyé de code d’autorisation. Veuillez réessayer.';

  @override
  String get authLineCallbackLinkFailed => 'Échec de la liaison du compte LINE';

  @override
  String get authLineCallbackLoginFailed => 'Échec de la connexion LINE';

  @override
  String get authLineCallbackVerifyFailed => 'Échec de la vérification LINE';

  @override
  String get authErrorsTurnstileRequired =>
      'Veuillez d’abord terminer la vérification humaine';

  @override
  String get authErrorsLoginFailed => 'Échec de la connexion';

  @override
  String get authErrorsRegisterFailed => 'Échec de la création du compte';

  @override
  String get authErrorsGoogleNotConfigured =>
      'La connexion Google n’est pas configurée';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'Le composant de connexion Google n’est pas chargé';

  @override
  String get authErrorsGoogleStateFailed =>
      'Impossible de créer l’état de connexion Google';

  @override
  String get authErrorsGoogleNoCode => 'Aucun code d’autorisation Google reçu';

  @override
  String get authErrorsGoogleFailed => 'Échec de la connexion Google';

  @override
  String get authErrorsGoogleCancelled => 'Connexion Google annulée';

  @override
  String get authErrorsPasskeyUnsupported =>
      'Ce navigateur ne prend pas en charge les Passkeys';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Impossible de créer le défi de connexion Passkey';

  @override
  String get authErrorsPasskeyFailed => 'Échec de la connexion Passkey';

  @override
  String get authErrorsLineNotConfigured =>
      'La connexion LINE n’est pas configurée';

  @override
  String get authErrorsLineFailed => 'Échec de la connexion LINE';

  @override
  String get settingsTitle => 'Paramètres';

  @override
  String get settingsLanguageTitle => 'Langue';

  @override
  String get settingsLanguageDescription =>
      'Choisissez la langue de l’interface et des notifications (e-mail / LINE).';

  @override
  String get settingsLanguageSaved => 'Préférence de langue mise à jour';

  @override
  String get settingsAccountTitle => 'Paramètres du compte';

  @override
  String get settingsAccountProfileInfo => 'Informations du compte';

  @override
  String get settingsAccountEmail => 'E-mail';

  @override
  String get settingsAccountDisplayName => 'Nom affiché';

  @override
  String get settingsAccountEditDisplayName => 'Modifier le nom affiché';

  @override
  String get settingsAccountUpdateName => 'Mettre à jour le nom';

  @override
  String get settingsAccountSaving => 'Enregistrement...';

  @override
  String get settingsAccountSetLocalPassword => 'Définir un mot de passe local';

  @override
  String get settingsAccountChangePassword => 'Changer le mot de passe';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'Ce compte utilise actuellement uniquement une connexion tierce. Après avoir défini un mot de passe local, vous pourrez aussi vous connecter avec e-mail et mot de passe.';

  @override
  String get settingsAccountCurrentPassword => 'Mot de passe actuel';

  @override
  String get settingsAccountNewPassword => 'Nouveau mot de passe';

  @override
  String get settingsAccountConfirmNewPassword =>
      'Confirmer le nouveau mot de passe';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'Au moins 8 caractères avec majuscule, minuscule, chiffre et symbole';

  @override
  String get settingsAccountUpdating => 'Mise à jour...';

  @override
  String get settingsAccountSetPassword => 'Définir le mot de passe';

  @override
  String get settingsAccountUpdatePassword => 'Mettre à jour le mot de passe';

  @override
  String get settingsAccountThemeTitle => 'Thème d’affichage';

  @override
  String get settingsAccountThemeSystem => 'Suivre le système';

  @override
  String get settingsAccountThemeLight => 'Mode clair';

  @override
  String get settingsAccountThemeDark => 'Mode sombre';

  @override
  String get settingsAccountDefaultCurrency => 'Devise par défaut';

  @override
  String get settingsAccountCurrencyCode => 'Code devise';

  @override
  String get settingsAccountUpdateDefaultCurrency =>
      'Mettre à jour la devise par défaut';

  @override
  String get settingsAccountPasskeyTitle => 'Gestion des Passkeys';

  @override
  String get settingsAccountNoPasskeys => 'Aucun Passkey enregistré';

  @override
  String get settingsAccountAddPasskey => '+ Ajouter un Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Lien Google';

  @override
  String get settingsAccountLineTitle => 'Lien LINE';

  @override
  String get settingsAccountStatusPrefix => 'État actuel : ';

  @override
  String get settingsAccountLinkedGoogle => 'Compte Google lié';

  @override
  String get settingsAccountNotLinkedGoogle => 'Compte Google non lié';

  @override
  String get settingsAccountLinkGoogle => 'Lier un compte Google';

  @override
  String get settingsAccountUnlink => 'Dissocier';

  @override
  String get settingsAccountLinkedLine => 'Compte LINE lié';

  @override
  String get settingsAccountNotLinkedLine => 'Compte LINE non lié';

  @override
  String get settingsAccountLinkLine => 'Lier un compte LINE';

  @override
  String get settingsAccountLineVerifying => 'Vérification LINE…';

  @override
  String get settingsAccountSessionsTitle => 'Appareils connectés';

  @override
  String get settingsAccountRefresh => 'Actualiser';

  @override
  String get settingsAccountDeviceName => 'Nom de l’appareil';

  @override
  String get settingsAccountLoginTime => 'Heure de connexion';

  @override
  String get settingsAccountLoginIp => 'IP de connexion';

  @override
  String get settingsAccountActions => 'Actions';

  @override
  String get settingsAccountUnknownDevice => 'Appareil inconnu';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (cet appareil)';

  @override
  String get settingsAccountSignOut => 'Déconnecter';

  @override
  String get settingsAccountNoSessions => 'Aucun appareil connecté enregistré';

  @override
  String get settingsAccountAuditTitle => 'Journal de connexion';

  @override
  String get settingsAccountCountry => 'Pays';

  @override
  String get settingsAccountMethod => 'Méthode';

  @override
  String get settingsAccountDevice => 'Appareil';

  @override
  String get settingsAccountAdminLogin => 'Connexion administrateur';

  @override
  String get settingsAccountYes => 'Oui';

  @override
  String get settingsAccountNo => 'Non';

  @override
  String get settingsAccountDeleteTitle => 'Supprimer le compte';

  @override
  String get settingsAccountDeleteDescription =>
      'Après suppression, vos transactions, comptes, actions, Passkeys et paramètres seront définitivement supprimés et ne pourront pas être récupérés.';

  @override
  String get settingsAccountDeleteButton => 'Supprimer mon compte';

  @override
  String get settingsAccountDeleteModalTitle =>
      'Confirmer la suppression du compte';

  @override
  String get settingsAccountDeleteModalWarning =>
      'Cette action supprimera définitivement votre compte et toutes ses données, y compris transactions, comptes, actions, Passkeys et paramètres. Elle est irréversible.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'Saisissez votre mot de passe pour confirmer la suppression';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'Saisissez l’e-mail du compte « $email » pour confirmer la suppression';
  }

  @override
  String get settingsAccountDeleting => 'Suppression...';

  @override
  String get settingsAccountDeletePermanently =>
      'Supprimer définitivement le compte';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'Saisissez votre mot de passe actuel';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'Saisissez un nouveau mot de passe';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'Le nouveau mot de passe doit contenir au moins 8 caractères';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'Le nouveau mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'Les deux nouveaux mots de passe ne correspondent pas';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'Mot de passe défini. Vous pouvez maintenant vous connecter avec ce mot de passe';

  @override
  String get settingsAccountMessagesPasswordUpdated =>
      'Mot de passe mis à jour';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'Échec de la mise à jour du mot de passe';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'Le nom affiché ne peut pas être vide';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'Nom affiché mis à jour';

  @override
  String get settingsAccountMessagesUpdateFailed => 'Échec de la mise à jour';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'Supprimer ce Passkey ?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'La devise doit être un code à 3 lettres';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'Devise par défaut mise à jour';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'Échec de la mise à jour de la devise par défaut';

  @override
  String get settingsAccountMessagesSessionLoggedOut => 'Appareil déconnecté';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'Échec de la déconnexion de l’appareil';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'Ce navigateur ne prend pas en charge Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Appareil Android';

  @override
  String get settingsAccountMessagesComputerDevice => 'Ordinateur';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Échec de l’enregistrement du Passkey';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'Collez un Google ID Token pour simuler la liaison';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Compte Google lié';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'Échec de la liaison du compte Google';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Compte Google dissocié';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Échec de la dissociation du compte Google';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'La connexion LINE n’est pas configurée';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'Échec de la liaison du compte LINE';

  @override
  String get settingsAccountMessagesLineUnlinked => 'Compte LINE dissocié';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'Échec de la dissociation du compte LINE';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'Saisissez votre mot de passe pour confirmer la suppression';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'Saisissez le bon e-mail du compte pour confirmer la suppression';

  @override
  String get settingsAccountMessagesDeleteFailed =>
      'Échec de la suppression du compte';

  @override
  String get dashboardTitle => 'Tableau de bord';

  @override
  String dashboardSubtitle(Object month) {
    return 'Revenus, dépenses, catégories et transactions récentes pour $month.';
  }

  @override
  String get dashboardUncategorized => 'Non catégorisé';

  @override
  String get dashboardKpiTotalIncome => 'Revenus totaux';

  @override
  String get dashboardKpiTotalExpense => 'Dépenses totales';

  @override
  String get dashboardKpiNet => 'Solde net';

  @override
  String get dashboardKpiTodayExpense => 'Dépenses du jour';

  @override
  String get dashboardKpiBankAccounts => 'Comptes bancaires';

  @override
  String get dashboardKpiStockMarketValue => 'Valeur boursière';

  @override
  String get dashboardOverviewTitle => 'Vue mensuelle de trésorerie';

  @override
  String get dashboardOverviewBalance => 'Excédent mensuel';

  @override
  String get dashboardOverviewDeficit => 'Déficit mensuel';

  @override
  String get dashboardOverviewIncome => 'Revenus';

  @override
  String get dashboardOverviewExpense => 'Dépenses';

  @override
  String get dashboardOverviewNet => 'Net';

  @override
  String get dashboardRatioTitle => 'Ratio revenus / dépenses';

  @override
  String get dashboardRatioIncomeShare => 'Part des revenus';

  @override
  String get dashboardRatioExpenseShare => 'Part des dépenses';

  @override
  String get dashboardSectionsExpenseCategories => 'Catégories de dépenses';

  @override
  String get dashboardSectionsIncomeCategories => 'Catégories de revenus';

  @override
  String get dashboardSectionsRecentTransactions => 'Transactions récentes';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return '$count derniers enregistrements';
  }

  @override
  String get dashboardEmptyNoExpense => 'Aucune dépense ce mois-ci';

  @override
  String get dashboardEmptyNoIncome => 'Aucun revenu ce mois-ci';

  @override
  String get dashboardEmptyNoTransactions => 'Aucune transaction ce mois-ci';

  @override
  String get dashboardTableDate => 'Date';

  @override
  String get dashboardTableCategory => 'Catégorie';

  @override
  String get dashboardTableNote => 'Note';

  @override
  String get dashboardTableAmount => 'Montant';

  @override
  String get dashboardFiltersPreviousMonth => 'Mois précédent';

  @override
  String get dashboardFiltersNextMonth => 'Mois suivant';

  @override
  String get dashboardFiltersCurrentMonth => 'Ce mois-ci';

  @override
  String get publicCommonBackHome => 'Retour à l’accueil';

  @override
  String get publicCommonPrivacy => 'Politique de confidentialité';

  @override
  String get publicCommonTerms => 'Conditions d’utilisation';

  @override
  String get publicCommonApiCredits => 'Utilisation des API et crédits';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'Dernière mise à jour : $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - Centre de pilotage des finances personnelles';

  @override
  String get publicCommonMetadataDescription =>
      'Gestionnaire de finances personnelles chiffré et autohébergeable pour dépenses, budgets, actions taïwanaises et analyses.';

  @override
  String get publicCommonDatesApiCredits => '11 juin 2026';

  @override
  String get publicCommonDatesPrivacy => '17 juin 2026';

  @override
  String get publicCommonDatesTerms => '11 juin 2026';

  @override
  String get publicHomeTagline =>
      'Centre de pilotage des finances personnelles';

  @override
  String get publicHomeLogin => 'Se connecter';

  @override
  String get publicHomeRegister => 'Créer un compte';

  @override
  String get publicHomeBadge => 'Autohébergé, données chiffrées, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'Votre centre de pilotage financier';

  @override
  String get publicHomeHeadline2 => 'clair dès la page d’accueil';

  @override
  String get publicHomeLeadBefore =>
      'Regroupez actions taïwanaises, revenus, dépenses, budgets, rapports et audit au même endroit. Les données financières sont chiffrées au repos avec';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'sans dépendance à un cloud particulier ni à un abonnement. Vous comprenez le produit avant de vous connecter.';

  @override
  String get publicHomeStartUsing => 'Commencer';

  @override
  String get publicHomeCreateFirst => 'Créer d’abord un compte';

  @override
  String get publicHomeChipsOpenSource => 'Open source AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'Stockage local chiffré';

  @override
  String get publicHomeChipsNoCloudLock => 'Pas de verrouillage cloud externe';

  @override
  String get publicHomeChipsDocker => 'Déploiement Docker en une commande';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'Modules clés';

  @override
  String get publicHomeStatsModulesSublabel =>
      'Comptes, actions, rapports, gouvernance';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'Chiffrement des données';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'Source boursière';

  @override
  String get publicHomeStatsStockSourceSublabel => 'Intraday, clôture et repli';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'Calcul précis';

  @override
  String get publicHomeStatsPrecisionSublabel => 'P/L par lot avec decimal.js';

  @override
  String get publicHomePreLoginNote =>
      'Même sans connexion, vous pouvez découvrir les fonctions d’AssetPilot, son traitement des données et ses modes de déploiement avant de décider de vous connecter ou de créer un compte.';

  @override
  String get publicHomeWhyLabel => 'Pourquoi AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'Comptabilité quotidienne, suivi d’investissement et maîtrise des données au même endroit';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot s’adresse à celles et ceux qui gèrent eux-mêmes leurs finances. Il centralise trésorerie, budgets et actions taïwanaises tout en gardant l’export, l’audit et l’autohébergement à portée de main.';

  @override
  String get publicHomePillarsFinanceTitle =>
      'Gestion de trésorerie et des budgets';

  @override
  String get publicHomePillarsFinanceTag => 'Cœur comptable';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'Suivi des soldes multi-comptes et virements internes';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'Pilotage des budgets mensuels et par catégorie';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'Création automatique des revenus et dépenses récurrents';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'Modifications par lot de catégorie, date et suppression';

  @override
  String get publicHomePillarsStocksTitle => 'Suivi des actions taïwanaises';

  @override
  String get publicHomePillarsStocksTag => 'Module actions';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'Cours TWSE et synchronisation des détachements';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'Calcul FIFO complet du P/L réalisé';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'Registre des dividendes et suivi des dépôts';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'Investissements récurrents et marquage des radiations';

  @override
  String get publicHomePillarsSecurityTitle =>
      'Sécurité et gouvernance des données';

  @override
  String get publicHomePillarsSecurityTag => 'Gouvernance';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'Chiffrement au repos ChaCha20-Poly1305';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'Connexion par mot de passe, Google ou Passkey';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'Export/import, sauvegarde, restauration et journaux d’audit';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Protection par rate limit, CSP et prévention d’injection CSV';

  @override
  String get publicHomePillarsSelfHostedTitle => 'Autohébergement et contrats';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne =>
      'Démarrage Docker en une commande';

  @override
  String get publicHomePillarsSelfHostedItemsTwo =>
      'Compatibilité amd64 et arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'Documentation de contrat OpenAPI 3.2';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'Routage URL-first pour favoris et rechargements directs';

  @override
  String get publicHomeQuickStartLabel => 'Démarrage rapide';

  @override
  String get publicHomeQuickStartTitle =>
      'Lancez-le sur votre serveur en 60 secondes';

  @override
  String get publicHomeQuickStartDescription =>
      'Démarrez rapidement avec Docker. Au premier lancement, les clés JWT et de chiffrement de base de données sont générées automatiquement. amd64 et arm64 sont pris en charge, pour NAS, VPS ou votre propre hôte Docker.';

  @override
  String get publicHomeQuickStartChipsImage => 'Image d’environ 180 MB';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'Health check intégré';

  @override
  String get publicHomeQuickStartChipsKeys =>
      'Clés générées au premier démarrage';

  @override
  String get publicHomeTechLabel => 'Stack technique';

  @override
  String get publicHomeTechTitle => 'Technologies et informations publiques';

  @override
  String get publicHomeTechDescription =>
      'Les principales technologies, sources de données externes et informations de licence sont présentées clairement pour comprendre le fonctionnement du service avant de l’utiliser.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. Gestion de patrimoine personnel que vous autohébergez, contrôlez et sauvegardez.';

  @override
  String get publicApiCreditsPageTitle => 'Utilisation des API et crédits';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'Utilisation des API et crédits — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'Transparence des API externes';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot ne se connecte à des sources externes que lorsqu’une fonction en a besoin. Cette page détaille les usages, les licences et les données transmises pour faciliter la revue de conformité en autohébergement.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'Services externes';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'Gratuit pris en charge';

  @override
  String get publicApiCreditsPageStatsAttributionRequired =>
      'Attribution requise';

  @override
  String get publicApiCreditsPageServiceKindsData => 'Requêtes de données';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'Authentification';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Canaux e-mail';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'Sauvegarde cloud';

  @override
  String get publicApiCreditsPageTransparencyTitle =>
      'Transparence des données';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'Les situations ci-dessous n’envoient que le minimum nécessaire à la fonction et ne transmettent pas vos détails financiers à des tiers.';

  @override
  String get publicApiCreditsPageMinNecessary =>
      'Principe du minimum nécessaire';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle =>
      'Synchronisation des taux de change';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'Seules des données publiques de taux de change sont consultées ; aucun détail financier personnel n’est envoyé.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle =>
      'Données actions taïwanaises';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'Seuls les codes actions et données de marché sont envoyés, pas les comptes, coûts de position ni transactions.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'Audit de connexion';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo sert uniquement à afficher le pays dans les journaux de connexion.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => 'Connexion tierce';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google et LINE ne sont utilisés que lorsque vous vous connectez ou liez un compte volontairement.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => 'Sauvegarde cloud';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4 reçoit le fichier complet de base de données uniquement lorsqu’un administrateur téléverse explicitement une sauvegarde.';

  @override
  String get publicApiCreditsPageServiceListTitle =>
      'Liste des services externes';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return '$total services au total. $free prennent en charge une offre gratuite et $paid proposent des offres payantes.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'Site officiel';

  @override
  String get publicApiCreditsPageFreePlan => 'Offre gratuite';

  @override
  String get publicApiCreditsPagePaidPlan => 'Offre payante';

  @override
  String get publicApiCreditsPageSupported => 'Pris en charge';

  @override
  String get publicApiCreditsPageUnavailable => 'Indisponible';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'Taux de change mondiaux en temps réel avec TWD comme devise de base';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'Géolocalisation IP pour le champ pays des audits de connexion';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'Cours en temps réel, données ex-dividende et recherche de noms d’actions';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Connexion Google SSO';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'Connexion LINE et liaison de compte';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Canal d’envoi e-mail pour rapports d’actifs administrateur via Gmail, Outlook ou autre serveur SMTP';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Canal d’envoi e-mail pour rapports d’actifs administrateur via HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'Canal d’envoi e-mail pour rapports d’actifs administrateur';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'Destination de stockage objet compatible S3 pour sauvegardes SQL PostgreSQL complètes administrateur';

  @override
  String get publicAppCallbackReturningTitle =>
      'Retour vers l’app AssetPilot...';

  @override
  String get publicAppCallbackReturningBody =>
      'Si le retour n’est pas automatique, vérifiez que la dernière version de l’app Android AssetPilot est installée.';

  @override
  String get publicAppCallbackPasskeyTitle =>
      'Connexion AssetPilot avec Passkey';

  @override
  String get publicAppCallbackPasskeyStarting =>
      'Démarrage de la connexion avec Passkey...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'Ce navigateur ne prend pas en charge Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Impossible de créer le défi de connexion Passkey';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'Terminez la vérification Passkey sur votre appareil...';

  @override
  String get publicAppCallbackPasskeyLoginFailed =>
      'Échec de la connexion avec Passkey';

  @override
  String get publicAppCallbackReturningApp => 'Retour vers l’app...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'Impossible de créer le justificatif de connexion de l’app';

  @override
  String get featuresCommonActions => 'Actions';

  @override
  String get featuresCommonAccount => 'Compte';

  @override
  String get featuresCommonAmount => 'Montant';

  @override
  String get featuresCommonDate => 'Date';

  @override
  String get featuresCommonEndDate => 'Fin';

  @override
  String get featuresCommonNote => 'Note';

  @override
  String get featuresCommonStartDate => 'Début';

  @override
  String get featuresCommonStatus => 'État';

  @override
  String get featuresCommonStock => 'Action';

  @override
  String get featuresCommonType => 'Type';

  @override
  String get featuresCommonName => 'Nom';

  @override
  String get featuresCommonCurrency => 'Devise';

  @override
  String get featuresCommonExchangeRate => 'Taux de change';

  @override
  String get featuresCommonIncome => 'Revenu';

  @override
  String get featuresCommonExpense => 'Dépense';

  @override
  String get featuresCommonUncategorized => 'Non catégorisé';

  @override
  String get featuresCommonUnspecified => 'Non renseigné';

  @override
  String get featuresCommonAutoCalculate => 'Calcul automatique';

  @override
  String get featuresCommonExcludeFromStats => 'Exclure des statistiques';

  @override
  String get featuresCommonTopLevelCategory => '- Catégorie racine -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'Gestion des catégories';

  @override
  String get featuresCategoriesExpenseTab => 'Catégories de dépenses';

  @override
  String get featuresCategoriesIncomeTab => 'Catégories de revenus';

  @override
  String get featuresCategoriesAddCategory => 'Ajouter une catégorie';

  @override
  String get featuresCategoriesEditCategory => 'Modifier la catégorie';

  @override
  String get featuresCategoriesNewCategory => 'Ajouter une catégorie';

  @override
  String get featuresCategoriesNameLabel => 'Nom *';

  @override
  String get featuresCategoriesTypeLabel => 'Type';

  @override
  String get featuresCategoriesParentLabel => 'Catégorie parente';

  @override
  String get featuresCategoriesColorLabel => 'Couleur';

  @override
  String get featuresCategoriesExpense => 'Dépense';

  @override
  String get featuresCategoriesIncome => 'Revenu';

  @override
  String get featuresCategoriesDeleteMessage =>
      'Supprimer cette catégorie ? Ses sous-catégories seront également supprimées.';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'Saisissez le nom de la catégorie';

  @override
  String get featuresCategoriesMessagesDeleteFailed =>
      'Échec de la suppression';

  @override
  String get featuresBudgetTitle => 'Budgets';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'Budget total du mois';

  @override
  String get featuresBudgetSpent => 'Dépensé';

  @override
  String get featuresBudgetAddBudget => 'Ajouter un budget';

  @override
  String get featuresBudgetEditBudget => 'Modifier le budget';

  @override
  String get featuresBudgetNewBudget => 'Ajouter un budget';

  @override
  String get featuresBudgetCategoryLabel =>
      'Catégorie (vide pour le budget total)';

  @override
  String get featuresBudgetTotalBudgetOption => '- Budget total -';

  @override
  String get featuresBudgetAmountLabel => 'Montant du budget *';

  @override
  String get featuresBudgetTotalBudgetName => '(Budget total)';

  @override
  String get featuresBudgetOverBudget => 'Budget dépassé';

  @override
  String get featuresBudgetDeleteMessage => 'Supprimer ce budget ?';

  @override
  String get featuresBudgetMessagesAmountRequired =>
      'Saisissez un montant de budget valide';

  @override
  String get featuresReportsTitle => 'Rapports';

  @override
  String get featuresReportsTabsCategory => 'Répartition par catégorie';

  @override
  String get featuresReportsTabsTrend => 'Analyse des tendances';

  @override
  String get featuresReportsTabsDaily => 'Dépenses quotidiennes';

  @override
  String get featuresReportsPeriodsThisMonth => 'Ce mois-ci';

  @override
  String get featuresReportsPeriodsLastMonth => 'Mois dernier';

  @override
  String get featuresReportsPeriodsLast3 => '3 derniers mois';

  @override
  String get featuresReportsPeriodsLast6 => '6 derniers mois';

  @override
  String get featuresReportsPeriodsThisYear => 'Cette année';

  @override
  String get featuresReportsPeriodsCustom => 'Personnalisé';

  @override
  String get featuresReportsPeriodLabel => 'Période';

  @override
  String get featuresReportsStart => 'Début';

  @override
  String get featuresReportsEnd => 'Fin';

  @override
  String get featuresReportsCurrentTotal => 'Total actuel';

  @override
  String get featuresReportsComparedPrevious =>
      'Comparé à la période précédente';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta, aucune donnée sur la période précédente';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate %)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'Détail $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'Total : $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'Catégorie sélectionnée : ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', montant $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'Voir les transactions liées';

  @override
  String get featuresRecurringTitle => 'Revenus et dépenses récurrents';

  @override
  String get featuresRecurringAdd => 'Ajouter un récurrent';

  @override
  String get featuresRecurringEdit => 'Modifier le récurrent';

  @override
  String get featuresRecurringCreate => 'Ajouter un récurrent';

  @override
  String get featuresRecurringAmountLabel => 'Montant *';

  @override
  String get featuresRecurringFxFeeLabel => 'Frais étrangers (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'Vide : calcul automatique selon les frais de carte';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'Frais étrangers de la carte $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', valeur suggérée NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'Consultation du dernier taux de change...';

  @override
  String get featuresRecurringCategory => 'Catégorie';

  @override
  String get featuresRecurringFrequency => 'Fréquence';

  @override
  String get featuresRecurringStartDate => 'Date de début';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'Prochaine exécution : $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'Catégorie : $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'Compte : $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'Frais étrangers : NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => 'Supprimer ce récurrent ?';

  @override
  String get featuresRecurringCreatingTransfer => 'Création...';

  @override
  String get featuresRecurringConfirmTransfer => 'Confirmer le virement';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'Quotidien';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'Hebdomadaire';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'Mensuel';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'Annuel';

  @override
  String get featuresRecurringMessagesAmountRequired =>
      'Saisissez un montant valide';

  @override
  String get featuresDataTransferTitle => 'Export et import de données';

  @override
  String get featuresDataTransferExportStartDate => 'Date de début d’export';

  @override
  String get featuresDataTransferExportEndDate => 'Date de fin d’export';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'Export et import CSV pris en charge. Colonnes : $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'Exporter en CSV';

  @override
  String get featuresDataTransferExporting => 'Export...';

  @override
  String get featuresDataTransferChooseCsv => 'Choisir un CSV à importer';

  @override
  String get featuresDataTransferImporting => 'Import...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'Import réussi : $count lignes';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'Ignorées : $count lignes';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'Catégories créées automatiquement : $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'Comptes créés automatiquement : $items';
  }

  @override
  String get featuresDataTransferWarning => 'Avertissement';

  @override
  String get featuresDataTransferError => 'Erreur';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'Ligne $row : $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'Comptes';

  @override
  String get featuresDataTransferModulesTransactions => 'Transactions';

  @override
  String get featuresDataTransferModulesCategories => 'Catégories';

  @override
  String get featuresDataTransferModulesStockTransactions =>
      'Transactions actions';

  @override
  String get featuresDataTransferModulesStockDividends => 'Dividendes';

  @override
  String get featuresDataTransferMessagesExportSuccess => 'Export réussi';

  @override
  String get featuresDataTransferMessagesExportFailed => 'Échec de l’export';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'Le CSV ne contient aucune donnée importable';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return 'Import $name terminé';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => 'Échec de l’import';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'Sauvegarde complète téléchargée';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'Échec du téléchargement de la sauvegarde complète';

  @override
  String get featuresDataTransferMessagesRestoreDone => 'Restauration terminée';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'Échec de la restauration de la sauvegarde';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'Sauvegarde de base de données téléchargée';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'Échec de la sauvegarde de base de données';

  @override
  String get featuresDataTransferMessagesDbRestoreDone =>
      'Base de données restaurée';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'Échec de la restauration de base de données';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'Téléversé vers $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'Échec de la sauvegarde MEGA S4';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'Renseignez au moins un champ';

  @override
  String get featuresDataTransferMessagesSaved => 'Paramètres enregistrés';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'Échec de l’enregistrement des paramètres';

  @override
  String get featuresDataTransferBundleTitle =>
      'Sauvegarde complète des données (images incluses)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'Téléchargez en un ZIP toutes vos données personnelles : transactions, comptes, catégories, budgets, cycles, taux de change, actions et images de justificatifs.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'Téléversez ce même ZIP pour restaurer.';

  @override
  String get featuresDataTransferBundleRestorePrefix =>
      'La restauration utilise le';

  @override
  String get featuresDataTransferBundleMergeMode => 'mode fusion';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ' : les données déjà présentes sont ignorées et seules les données manquantes sont ajoutées ;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'vos données existantes ne sont ni supprimées ni écrasées';

  @override
  String get featuresDataTransferBundleDownload =>
      'Télécharger la sauvegarde complète';

  @override
  String get featuresDataTransferBundleDownloading =>
      'Préparation du téléchargement...';

  @override
  String get featuresDataTransferBundleRestore =>
      'Téléverser une sauvegarde à restaurer';

  @override
  String get featuresDataTransferBundleRestoring => 'Restauration...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'Sauvegarde / restauration complète de base';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'Réservé aux administrateurs. En mode SQLite, télécharge une sauvegarde `.db` ; en mode PostgreSQL, une sauvegarde `.sql`. Téléversez le format correspondant pour restaurer.';

  @override
  String get featuresDataTransferDatabaseDownload =>
      'Télécharger la sauvegarde de base';

  @override
  String get featuresDataTransferDatabaseDownloading => 'Téléchargement...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'Choisir une sauvegarde à restaurer';

  @override
  String get featuresDataTransferDatabaseRestoring => 'Restauration...';

  @override
  String get featuresDataTransferMegaTitle => 'Sauvegarde cloud MEGA S4';

  @override
  String get featuresDataTransferMegaDescription =>
      'Téléverse la sauvegarde SQLite complète actuelle comme objet dans un bucket MEGA S4. Les informations de connexion viennent des variables d’environnement du serveur ; les clés ne sont pas saisies ni affichées dans le navigateur.';

  @override
  String get featuresDataTransferMegaState => 'État : ';

  @override
  String get featuresDataTransferMegaConfigured => 'Configuré';

  @override
  String get featuresDataTransferMegaNotConfigured =>
      'Configuration incomplète';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket : ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'Variables d’environnement manquantes : $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'Téléverser vers MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'Téléversement...';

  @override
  String get featuresDataTransferMegaConfigure => 'Configurer';

  @override
  String get featuresDataTransferMegaCancelConfigure =>
      'Annuler la configuration';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'La configuration est écrite dans un fichier persistant du serveur et prend effet immédiatement. Les champs de clés doivent être ressaisis ; ils ne sont pas préremplis.';

  @override
  String get featuresDataTransferMegaBucketName => 'Nom du bucket';

  @override
  String get featuresDataTransferMegaPrefix => 'Préfixe (facultatif)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (facultatif, vide pour calcul automatique)';

  @override
  String get featuresDataTransferMegaSaveSettings =>
      'Enregistrer les paramètres';

  @override
  String get featuresAccountsTitle => 'Comptes';

  @override
  String get featuresAccountsTypeLabelsBank => 'Compte bancaire';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'Carte de crédit';

  @override
  String get featuresAccountsTypeLabelsCash => 'Espèces';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet =>
      'Portefeuille numérique';

  @override
  String get featuresAccountsTypeLabelsOther => 'Autre';

  @override
  String get featuresAccountsTotalAssets => 'Actifs totaux';

  @override
  String get featuresAccountsCreditOutstanding => 'Solde carte à payer';

  @override
  String get featuresAccountsAddAccount => 'Ajouter un compte';

  @override
  String get featuresAccountsEditAccount => 'Modifier le compte';

  @override
  String get featuresAccountsNewAccount => 'Ajouter un compte';

  @override
  String get featuresAccountsAccountName => 'Nom du compte *';

  @override
  String get featuresAccountsInitialBalance => 'Solde initial';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'Solde initial / réglage actuel';

  @override
  String get featuresAccountsLinkedBank => 'Banque';

  @override
  String get featuresAccountsUngrouped => 'Sans groupe';

  @override
  String get featuresAccountsOverseasFeeRate => 'Frais étrangers (%)';

  @override
  String get featuresAccountsStatementClosingDay => 'Jour de clôture (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'Exemple : 15. Laisser vide pour ne pas calculer le cycle courant.';

  @override
  String get featuresAccountsExcludeFromTotal => 'Exclure des actifs totaux';

  @override
  String get featuresAccountsOtherAccounts => 'Autres comptes';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'Total converti : $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'Banque liée : $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'Frais étrangers : $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'Jour de clôture mensuel : $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'Dépenses du cycle courant : $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'Relevé précédent : ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'Dépenses $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'Payé $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'Voir le détail des cycles ›';

  @override
  String get featuresAccountsRepaymentTitle =>
      'Remboursement de carte de crédit';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'Compte de paiement';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'Date de remboursement';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'Cette banque n’a aucune carte liée';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'Solde actuel : $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount =>
      'Montant du remboursement';

  @override
  String get featuresAccountsRepaymentConfirm => 'Confirmer le remboursement';

  @override
  String get featuresAccountsDeleteMessage => 'Supprimer ce compte ?';

  @override
  String get featuresAccountsCyclesTitle => 'Détail des cycles de relevé';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name jour de clôture mensuel $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'Les paiements sont rattachés au relevé qu’ils soldent. Les montants payés après une clôture comptent pour ce cycle.';

  @override
  String get featuresAccountsCyclesPeriod => 'Période';

  @override
  String get featuresAccountsCyclesSpending => 'Dépenses';

  @override
  String get featuresAccountsCyclesPayment => 'Paiement réel';

  @override
  String get featuresAccountsCyclesCurrent => 'Courant';

  @override
  String get featuresAccountsFxTitle => 'Gestion des taux de change';

  @override
  String get featuresAccountsFxAutoUpdate => 'Mise à jour automatique des taux';

  @override
  String get featuresAccountsFxSyncNow => 'Synchroniser maintenant';

  @override
  String get featuresAccountsFxSyncing => 'Synchronisation...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'Dernière synchronisation : $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'Devise';

  @override
  String get featuresAccountsFxUnitToTwd => '1 unité = TWD';

  @override
  String get featuresAccountsFxEmpty => 'Aucun taux de change configuré';

  @override
  String get featuresAccountsFxCurrencyLabel => 'Devise (ex. USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'Taux vers TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'Ajouter / Mettre à jour';

  @override
  String get featuresAccountsMessagesNameRequired =>
      'Saisissez le nom du compte';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'Sélectionnez le compte de paiement';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'Saisissez un remboursement pour au moins une carte';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'La devise doit être un code à 3 lettres';

  @override
  String get featuresAccountsMessagesRateInvalid =>
      'Saisissez un taux de change valide';

  @override
  String get featuresAccountsMessagesSaved => 'Enregistré';

  @override
  String get featuresAccountsMessagesSaveFailed => 'Échec de l’enregistrement';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'Échec de la suppression';

  @override
  String get featuresAccountsMessagesRatesUpdated =>
      'Taux de change mis à jour';

  @override
  String get featuresAccountsMessagesSyncFailed =>
      'Échec de la synchronisation';

  @override
  String get featuresAccountsMessagesLoadFailed => 'Échec du chargement';

  @override
  String get featuresTransactionsTitle => 'Transactions';

  @override
  String get featuresTransactionsSearchPlaceholder =>
      'Rechercher dans les notes...';

  @override
  String get featuresTransactionsAllTypes => 'Tous les types';

  @override
  String get featuresTransactionsAllAccounts => 'Tous les comptes';

  @override
  String get featuresTransactionsAllCategories => 'Toutes les catégories';

  @override
  String get featuresTransactionsTransfer => 'Virement';

  @override
  String get featuresTransactionsFuture => 'Transactions futures';

  @override
  String get featuresTransactionsExcludeTransfer => 'Exclure les virements';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (tout)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'Date de début';

  @override
  String get featuresTransactionsEndDateTitle => 'Date de fin';

  @override
  String get featuresTransactionsAdd => 'Ajouter une transaction';

  @override
  String get featuresTransactionsEdit => 'Modifier la transaction';

  @override
  String get featuresTransactionsCreate => 'Ajouter une transaction';

  @override
  String get featuresTransactionsAccountTransfer => 'Virement entre comptes';

  @override
  String get featuresTransactionsBatchCategory =>
      'Changer la catégorie par lot';

  @override
  String get featuresTransactionsBatchDate => 'Changer la date par lot';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'Supprimer la sélection ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'Revenus de la page';

  @override
  String get featuresTransactionsPageExpense => 'Dépenses de la page';

  @override
  String get featuresTransactionsPageTotal => 'Total de la page';

  @override
  String get featuresTransactionsPageSummaryAria =>
      'Résumé des transactions de la page';

  @override
  String get featuresTransactionsEmpty => 'Aucune transaction correspondante';

  @override
  String featuresTransactionsSource(Object name) {
    return 'Source : $name';
  }

  @override
  String get featuresTransactionsFxFee => 'Frais de carte étrangère';

  @override
  String get featuresTransactionsPhotoOne => 'Photo 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count photos';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'Date *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'Montant *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'Taux de change (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'Vide : utiliser le taux du système';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'Consultation du dernier taux de change...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'Vide : calcul automatique selon les frais de carte';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'Frais étrangers de la carte $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', suggéré NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'Photos';

  @override
  String get featuresTransactionsLoadingPhotos => 'Chargement des photos...';

  @override
  String get featuresTransactionsTakePhoto => 'Prendre une photo';

  @override
  String get featuresTransactionsChooseImage => 'Choisir une image';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'Sur mobile, prenez une photo ou choisissez-en une dans la galerie. Jusqu’à 5 images, $maxMb MB chacune.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'Nouvelles photos $count';
  }

  @override
  String get featuresTransactionsRemove => 'Retirer';

  @override
  String get featuresTransactionsChoosePhoto => 'Choisir une photo';

  @override
  String get featuresTransactionsTransferOut => 'Compte source *';

  @override
  String get featuresTransactionsTransferIn => 'Compte destination *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'Sélectionner';

  @override
  String get featuresTransactionsCreating => 'Création...';

  @override
  String get featuresTransactionsConfirmTransfer => 'Confirmer le virement';

  @override
  String get featuresTransactionsBatchCategoryTitle =>
      'Changer la catégorie par lot';

  @override
  String get featuresTransactionsBatchDateTitle => 'Changer la date par lot';

  @override
  String get featuresTransactionsNewCategory => 'Nouvelle catégorie';

  @override
  String get featuresTransactionsNewDate => 'Nouvelle date';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'Appliquer à $count enregistrements';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'Supprimer cette transaction ? Cette action est irréversible.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'Supprimer les $count transactions sélectionnées ?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'Transaction mise à jour, mais $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'Transaction créée, mais $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'Les virements doivent être supprimés puis recréés';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'Les frais de carte étrangère sont générés automatiquement. Modifiez la transaction en devise liée ; les frais seront resynchronisés ensuite.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'Échec de l’envoi de la photo';

  @override
  String get featuresTransactionsMessagesDateRequired =>
      'Sélectionnez une date';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'Saisissez un montant valide';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'Sélectionnez le compte source et le compte destination';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'Le compte source et destination ne peuvent pas être identiques';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'Revenu';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'Dépense';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => 'Virement entrant';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => 'Virement sortant';

  @override
  String get featuresStocksTabsPortfolio => 'Portefeuille';

  @override
  String get featuresStocksTabsTransactions => 'Transactions';

  @override
  String get featuresStocksTabsDividends => 'Dividendes';

  @override
  String get featuresStocksTabsRealized => 'P/L réalisé';

  @override
  String get featuresStocksTabsSettings => 'Paramètres de trading';

  @override
  String get featuresStocksCommonStockLabel => 'Action';

  @override
  String get featuresStocksCommonStockRequired => 'Action *';

  @override
  String get featuresStocksCommonStockTypeStock => 'Action';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'Warrant';

  @override
  String get featuresStocksCommonDate => 'Date';

  @override
  String get featuresStocksCommonShares => 'Titres';

  @override
  String get featuresStocksCommonPrice => 'Prix';

  @override
  String get featuresStocksCommonTotal => 'Total';

  @override
  String get featuresStocksCommonReturnRate => 'Rendement';

  @override
  String get featuresStocksCommonOverallReturnRate => 'Rendement global';

  @override
  String get featuresStocksCommonEstimatedPL => 'P/L estimé';

  @override
  String get featuresStocksCommonRealizedPL => 'P/L réalisé';

  @override
  String get featuresStocksCommonTotalRealizedPL => 'P/L réalisé total';

  @override
  String get featuresStocksCommonYearRealizedPL => 'P/L réalisé cette année';

  @override
  String get featuresStocksCommonRealizedCount => 'Lignes réalisées';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count enregistrements';
  }

  @override
  String get featuresStocksCommonSellAverage => 'Prix moyen de vente';

  @override
  String get featuresStocksCommonCostAverage => 'Coût moyen';

  @override
  String get featuresStocksCommonFeeAndTax => 'Frais + taxe';

  @override
  String get featuresStocksCommonCashDividend => 'Dividende en espèces';

  @override
  String get featuresStocksCommonStockDividend => 'Dividende en actions';

  @override
  String get featuresStocksCommonStockSymbol => 'Code action *';

  @override
  String get featuresStocksCommonStockName => 'Nom de l’action';

  @override
  String get featuresStocksCommonSearching => 'Recherche...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- Ne pas comptabiliser (dividende en actions uniquement) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'Calcul automatique';

  @override
  String get featuresStocksCommonBuy => 'Acheter';

  @override
  String get featuresStocksCommonSell => 'Vendre';

  @override
  String get featuresStocksPortfolioTitle => 'Portefeuille';

  @override
  String get featuresStocksPortfolioTotalMarketValue =>
      'Valeur totale de marché';

  @override
  String get featuresStocksPortfolioTotalCost => 'Coût investi total';

  @override
  String get featuresStocksPortfolioTotalDividend => 'Dividendes totaux';

  @override
  String get featuresStocksPortfolioAddStock => 'Ajouter une action';

  @override
  String get featuresStocksPortfolioEditStock => 'Modifier l’action';

  @override
  String get featuresStocksPortfolioNewStock => 'Ajouter une action';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'Mettre à jour les cours';

  @override
  String get featuresStocksPortfolioBatchUpdate =>
      'Mise à jour automatique par lot';

  @override
  String get featuresStocksPortfolioUpdating => 'Mise à jour...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'AssetPilot interroge d’abord l’API publique TWSE depuis votre navigateur. Si la requête est bloquée, il utilise le proxy API utilisateur authentifié et met à jour vos positions.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'Mise à jour terminée : $updated réussies.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'Mise à jour terminée : $updated réussies, $failed échouées.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'Impossible de récupérer les données TWSE depuis le navigateur';

  @override
  String get featuresStocksPortfolioHeldShares => 'Titres détenus';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count titres';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'Prix actuel';

  @override
  String get featuresStocksPortfolioMarketValue => 'Valeur de marché';

  @override
  String featuresStocksPortfolioDividendMonths(Object months) {
    return 'Mois de dividende : $months';
  }

  @override
  String get featuresStocksPortfolioDividendMonthsEmpty =>
      'Aucun historique de dividende';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired =>
      'Saisissez le code action';

  @override
  String get featuresStocksTransactionsTitle => 'Transactions actions';

  @override
  String get featuresStocksTransactionsAddTransaction =>
      'Ajouter une transaction';

  @override
  String get featuresStocksTransactionsEditTransaction =>
      'Modifier la transaction';

  @override
  String get featuresStocksTransactionsNewTransaction =>
      'Ajouter une transaction';

  @override
  String get featuresStocksTransactionsTypeLabel => 'Type';

  @override
  String get featuresStocksTransactionsDateLabel => 'Date *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'Titres *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'Prix unitaire *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'Frais';

  @override
  String get featuresStocksTransactionsTaxLabel => 'Taxe de transaction';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      'Supprimer cette transaction ?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired =>
      'Sélectionnez une action';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'Saisissez un nombre de titres valide';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'Saisissez un prix valide';

  @override
  String get featuresStocksDividendsTitle => 'Dividendes';

  @override
  String get featuresStocksDividendsAddDividend => 'Ajouter un dividende';

  @override
  String get featuresStocksDividendsEditDividend => 'Modifier le dividende';

  @override
  String get featuresStocksDividendsNewDividend => 'Ajouter un dividende';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'Synchroniser les ex-dividendes';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'Synchronise automatiquement les historiques d’ex-dividendes depuis TWSE selon vos positions.';

  @override
  String get featuresStocksDividendsSyncStart => 'Lancer la synchronisation';

  @override
  String get featuresStocksDividendsSyncing => 'Synchronisation...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '$synced ajoutés, $skipped ignorés.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '$synced ajoutés, $skipped ignorés, $failed échoués.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel =>
      'Dividende en espèces (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel =>
      'Dividende en actions';

  @override
  String get featuresStocksDividendsDepositAccount => 'Compte de dépôt';

  @override
  String get featuresStocksDividendsDeleteMessage => 'Supprimer ce dividende ?';

  @override
  String get featuresStocksDividendsMessagesStockRequired =>
      'Sélectionnez une action';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'Saisissez un dividende en espèces ou en actions';

  @override
  String get featuresStocksRealizedTitle => 'P/L réalisé';

  @override
  String get featuresStocksSettingsTitle => 'Paramètres de trading';

  @override
  String get featuresStocksSettingsFeeTitle => 'Frais / taxe de transaction';

  @override
  String get featuresStocksSettingsFeeRate => 'Taux de frais';

  @override
  String get featuresStocksSettingsFeeDiscount => 'Remise (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot => 'Frais minimum (lot standard)';

  @override
  String get featuresStocksSettingsFeeMinOdd =>
      'Frais minimum (lot fractionné)';

  @override
  String get featuresStocksSettingsSellTaxRateStock => 'Taxe de vente (action)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'Taxe de vente (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'Taxe de vente (warrant)';

  @override
  String get featuresStocksSettingsSellTaxMin => 'Taxe de transaction minimale';

  @override
  String get featuresStocksSettingsSaveSettings => 'Enregistrer les paramètres';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'État des actions';

  @override
  String get featuresStocksSettingsCurrentPrice => 'Prix actuel';

  @override
  String get featuresStocksSettingsNormalTracking => 'Suivi normal';

  @override
  String get featuresStocksSettingsDelisted => 'Radiée';

  @override
  String get featuresStocksSettingsRestoreTracking => 'Restaurer le suivi';

  @override
  String get featuresStocksSettingsMarkDelisted => 'Marquer comme radiée';

  @override
  String get featuresStocksSettingsRecurringTitle =>
      'Investissement récurrent en actions';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'Ajouter';

  @override
  String get featuresStocksSettingsEditRecurring =>
      'Modifier l’investissement récurrent';

  @override
  String get featuresStocksSettingsNewRecurring =>
      'Ajouter un investissement récurrent';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'Montant (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'Fréquence';

  @override
  String get featuresStocksSettingsStartDate => 'Date de début';

  @override
  String get featuresStocksSettingsLastGenerated => 'Dernière génération';

  @override
  String get featuresStocksSettingsActive => 'Actif';

  @override
  String get featuresStocksSettingsInactive => 'Inactif';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'Supprimer cet investissement récurrent ?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'Quotidien';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'Hebdomadaire';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'Mensuel';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'Annuel';

  @override
  String get featuresStocksSettingsMessagesSaved => 'Paramètres enregistrés';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'Échec de l’enregistrement : $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired =>
      'Sélectionnez une action';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'Saisissez un montant valide';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol a été $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'restaurée en suivi normal';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'marquée comme radiée';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'Échec de la mise à jour de l’état de radiation';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => 'Rapport quotidien de trésorerie';

  @override
  String get notificationsReportTypeWeekly =>
      'Rapport hebdomadaire de trésorerie';

  @override
  String get notificationsReportTypeMonthly => 'Rapport mensuel de trésorerie';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'Rapport quotidien de trésorerie｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'Rapport hebdomadaire de trésorerie｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'Rapport mensuel de trésorerie｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, trésorerie du $date ($weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, trésorerie du $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, trésorerie de $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 Date du rapport $date　·　Envoyé le $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 Période du rapport $start ~ $end　·　Envoyé le $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 Mois du rapport $month　·　Envoyé le $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'Résumé de toute la journée d’hier ($date, $weekday) ; envoyé aujourd’hui ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'Résumé des 7 derniers jours ($start ~ $end) ; envoyé aujourd’hui ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'Résumé du mois dernier ($month, $start ~ $end) ; envoyé ce mois-ci ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'Hier';

  @override
  String get notificationsLeadWeekly => 'Cette semaine';

  @override
  String get notificationsLeadMonthly => 'Le mois dernier';

  @override
  String notificationsKpiIncome(Object lead) {
    return 'Revenus - $lead';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return 'Dépenses - $lead';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return 'Net - $lead';
  }

  @override
  String get notificationsCompareLabelDaily => 'vs. veille';

  @override
  String get notificationsCompareLabelWeekly => 'vs. semaine précédente';

  @override
  String get notificationsCompareLabelMonthly => 'vs. mois précédent';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'hier ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return '7 derniers jours ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'mois dernier ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'Soldes des comptes';

  @override
  String get notificationsSectionsTopCategories =>
      'Top 5 des dépenses ce mois-ci';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'Top 5 des dépenses en $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'Détail quotidien';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'Cumul du mois ($month)';
  }

  @override
  String get notificationsSectionsStock => 'Investissements en actions';

  @override
  String get notificationsSectionsRecentDaily => 'Transactions d’hier';

  @override
  String get notificationsSectionsRecentWeekly => 'Transactions de la semaine';

  @override
  String get notificationsSectionsRecentMonthly =>
      'Transactions du mois dernier';

  @override
  String get notificationsLabelsIncome => 'Revenus';

  @override
  String get notificationsLabelsExpense => 'Dépenses';

  @override
  String get notificationsLabelsNet => 'Net';

  @override
  String get notificationsLabelsCost => 'Coût total';

  @override
  String get notificationsLabelsMarketValue => 'Valeur de marché';

  @override
  String get notificationsLabelsUnrealizedPL => 'P/L non réalisé';

  @override
  String get notificationsLabelsReturnRate => 'Rendement';

  @override
  String get notificationsLabelsUncategorized => 'Non catégorisé';

  @override
  String get notificationsTableDate => 'Date';

  @override
  String get notificationsEmptyNoAccount => 'Aucun compte pour le moment';

  @override
  String get notificationsEmptyNoExpense => 'Aucune dépense pour le moment';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'Aucune transaction pour $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'Actions : valeur de marché $marketValue, P/L non réalisé $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'Voir le rapport complet';

  @override
  String get notificationsCtaViewLineRecord => 'Voir les enregistrements LINE';

  @override
  String get notificationsReminderAltText => 'Rappel de dépense';

  @override
  String get notificationsReminderTitle =>
      'Pensez à enregistrer les dépenses du jour';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, prenez 10 secondes pour ajouter les dépenses d’aujourd’hui afin de ne rien oublier en fin de mois.';
  }

  @override
  String get notificationsReminderHint =>
      'Touchez Ajouter une dépense, puis saisissez : montant note date (date facultative)';

  @override
  String get notificationsReminderFallbackName => 'bonjour';

  @override
  String get notificationsReminderAddExpense => 'Ajouter une dépense';

  @override
  String get notificationsReminderViewToday => 'Voir les écritures du jour';

  @override
  String get notificationsFallbackUser => 'Utilisateur';

  @override
  String get mobileLegacyMessagebde18a20 => '・Exclu des actifs totaux';

  @override
  String get mobileLegacyNoneCreateAsParent =>
      '(Aucune, créer comme catégorie parente)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'L’accueil affiche par mois les revenus, dépenses, solde net et catégories de dépenses. Changez de mois pour voir où va votre argent.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'Les paiements sont rattachés au relevé qu’ils soldent, même s’ils sont payés au cycle suivant après clôture.';

  @override
  String get mobileLegacy0NoPayment => '0 = ne pas rembourser';

  @override
  String get mobileLegacyMon => 'Lun';

  @override
  String get mobileLegacyStock => 'Action ordinaire';

  @override
  String get mobileLegacyStocks => 'Actions ordinaires (%)';

  @override
  String get mobileLegacyTue => 'Mar';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Compte de dépôt (requis pour les dividendes en espèces)';

  @override
  String get mobileLegacyWed => 'Mer';

  @override
  String get mobileLegacyPreviousStatement => 'Relevé précédent ';

  @override
  String get mobileLegacyNext => 'Suivant';

  @override
  String get mobileLegacyDelisted => 'Retiré de la cote';

  @override
  String get mobileLegacySubcategory => 'Sous-catégorie';

  @override
  String get mobileLegacyDeleted => 'Supprimé';

  @override
  String get mobileLegacyUpdated => 'Mis à jour';

  @override
  String get mobileLegacyLinked => 'Lié';

  @override
  String get mobileLegacyUnlinked => 'Dissocié';

  @override
  String get mobileLegacyTotalRealizedPL => 'P/L réalisé total';

  @override
  String get mobileLegacyFri => 'Ven';

  @override
  String get mobileLegacyStandardRate01 => 'Taux standard : 0,1 %';

  @override
  String get mobileLegacyStandardRate03 => 'Taux standard : 0,3 %';

  @override
  String get mobileLegacySat => 'Sam';

  @override
  String get mobileLegacyCategoryName => 'Nom de catégorie';

  @override
  String get mobileLegacyFeeOptional => 'Commission (facultatif)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Laissez commission et taxe vides pour les calculer automatiquement';

  @override
  String get mobileLegacyCommissionRate => 'Taux de commission (%)';

  @override
  String get mobileLegacyDay => 'Dim';

  @override
  String get mobileLegacyMonthlyBudget => 'Budget mensuel';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'Catégorie parente (vide = créer une catégorie parente)';

  @override
  String get mobileLegacyTheme => 'Thème';

  @override
  String get mobileLegacyThu => 'Jeu';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'Catégorie inconnue';

  @override
  String get mobileLegacyNotLinked => 'Non lié';

  @override
  String get mobileLegacyNoTransactionsThisMonth =>
      'Aucune transaction ce mois-ci';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'Aucun budget ce mois-ci';

  @override
  String get mobileLegacyNetThisMonth => 'Solde net du mois';

  @override
  String get mobileLegacyPositiveWholeNumber => 'Entier positif';

  @override
  String get mobileLegacyDeletePermanently => 'Supprimer définitivement';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'Supprimer définitivement le compte et toutes les données';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'Aucune note de version disponible';

  @override
  String get mobileLegacyCurrentDevice => 'Appareil actuel';

  @override
  String get mobileLegacyTransactions => 'Transactions';

  @override
  String get mobileLegacyAll => 'Tout';

  @override
  String get mobileLegacyAllCategories => 'Toutes les catégories';

  @override
  String get mobileLegacyAllAccounts => 'Tous les comptes';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'Remboursement de chaque carte (dans sa devise)';

  @override
  String get mobileLegacySyncDividends => 'Synchroniser les dividendes';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'Nom (facultatif, rempli automatiquement si vide)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'Dans Actions, saisissez un code comme 2330 pour suivre les prix, les gains réalisés et latents, et synchroniser automatiquement les dividendes.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'Dans l’onglet Transactions, touchez + pour ajouter un revenu ou une dépense. Plusieurs devises et les virements entre comptes sont pris en charge. Balayez vers la gauche pour supprimer ou touchez pour modifier.';

  @override
  String get mobileLegacyNoDataForThisPeriod =>
      'Aucune donnée sur cette période';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'Cette action supprimera définitivement votre compte et toutes vos données, y compris transactions, comptes, actions et paramètres. Elle est irréversible.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Personnaliser l’envoi programmé des rapports';

  @override
  String get mobileLegacyAutomatic => 'Automatique';

  @override
  String get mobileLegacyAtLeast8Characters => 'Au moins 8 caractères';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'Au moins 8 caractères avec majuscules, minuscules, chiffres et symboles';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'Votre assistant de finances personnelles pour les transactions, budgets, actions taïwanaises et rapports. Prenez une minute pour découvrir l’essentiel.';

  @override
  String get mobileLegacyDeletePasskey => 'Supprimer la Passkey';

  @override
  String get mobileLegacyDeleteCategory => 'Supprimer la catégorie';

  @override
  String get mobileLegacyDeleteTransaction => 'Supprimer la transaction';

  @override
  String get mobileLegacyDeleteDividend => 'Supprimer le dividende';

  @override
  String get mobileLegacyDeleteStock => 'Supprimer l’action';

  @override
  String get mobileLegacyDeleteAccount => 'Supprimer le compte';

  @override
  String get mobileLegacyDeleteSchedule => 'Supprimer la planification';

  @override
  String get mobileLegacyDeletePhoto => 'Supprimer la photo';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'Un compte de dépôt est requis pour les dividendes en espèces';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'Aucune transaction ne correspond aux filtres';

  @override
  String get mobileLegacyDiscount01 => 'Remise (0-1)';

  @override
  String get mobileLegacyImproved => 'Amélioré';

  @override
  String get mobileLegacyMore => 'Plus';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'Mis à jour';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'Dernier jour de chaque mois';

  @override
  String get mobileLegacyNoPricesToUpdate => 'Aucun prix à mettre à jour';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'Aucun nouveau dividende à synchroniser';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'Utilisateur déconnecté, connexion locale effacée';

  @override
  String get mobileLegacyGettingStarted => 'Premiers pas';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'Exemple : 0,6 signifie 40 % de remise';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'Exemple : 1.5 signifie 1,5 % ; les frais sont calculés automatiquement pour les paiements en devise';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'Dans Plus, définissez les budgets mensuels, consultez les rapports, gérez comptes et catégories, programmez les transactions récurrentes et les notifications. Prêt ? Commencez à saisir vos données.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Taux standard du courtier : 0,1425 %';

  @override
  String get mobileLegacyNotSentYet => 'Pas encore envoyé';

  @override
  String get mobileLegacyNoRealizedReturns => 'Aucun P/L réalisé';

  @override
  String get mobileLegacyNoCategoriesYet => 'Aucune catégorie pour le moment';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'Aucune transaction. Touchez le bouton en bas à droite pour en ajouter une.';

  @override
  String get mobileLegacyNoRecurringTransactions =>
      'Aucune transaction récurrente';

  @override
  String get mobileLegacyNoDividendRecords => 'Aucun dividende enregistré';

  @override
  String get mobileLegacyNoStockTransactions => 'Aucune transaction d’action';

  @override
  String get mobileLegacyNoHoldingsYet => 'Aucune position pour le moment';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'Aucun historique de connexion';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'Terminez l’enregistrement dans le navigateur (biométrie de l’appareil requise)';

  @override
  String get mobileLegacyNotice => 'Avis';

  @override
  String get mobileLegacyDividends => 'Dividendes';

  @override
  String get mobileLegacyDividendSyncCompleted => 'Dividendes synchronisés';

  @override
  String get mobileLegacyTickerEG2330 => 'Ticker (ex. 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'Valeur de marché des actions';

  @override
  String get mobileLegacyHoldings => 'Portefeuille';

  @override
  String get mobileLegacyDayOfWeek => 'Jour de la semaine';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'Voir la version actuelle et les notes de version';

  @override
  String get mobileLegacyRename => 'Renommer';

  @override
  String get mobileLegacyCheckAgain => 'Revérifier';

  @override
  String get mobileLegacyRetry => 'Réessayer';

  @override
  String get mobileLegacyHome => 'Accueil';

  @override
  String get mobileLegacyFixed => 'Corrigé';

  @override
  String get mobileLegacyApply => 'Appliquer';

  @override
  String get mobileLegacyTime => 'Heure';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'Frais à l’étranger en TWD (facultatif)';

  @override
  String get mobileLegacyAddTransaction => 'Ajouter une transaction';

  @override
  String get mobileLegacyTransactions8084a8ea => 'Transactions';

  @override
  String get mobileLegacyStartDate => 'Date de début';

  @override
  String get mobileLegacyTrackTaiwanStocks => 'Suivez vos actions taïwanaises';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Actions reçues en dividende (facultatif)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Les frais de carte à l’étranger sont générés automatiquement. Modifiez la transaction étrangère associée.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'Le mot de passe doit contenir au moins 8 caractères';

  @override
  String get mobileLegacyAccountName => 'Nom du compte';

  @override
  String get mobileLegacyAccountDeleted => 'Compte supprimé';

  @override
  String get mobileLegacyAccountSecurity => 'Sécurité du compte';

  @override
  String get mobileLegacyLinkedAccounts => 'Comptes liés';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => 'Devises fréquentes';

  @override
  String get mobileLegacyChooseFromGallery => 'Choisir dans la galerie';

  @override
  String get mobileLegacyEnabled => 'Activé';

  @override
  String get mobileLegacyDark => 'Sombre';

  @override
  String get mobileLegacyLight => 'Clair';

  @override
  String get mobileLegacyClearDates => 'Effacer les dates';

  @override
  String get mobileLegacyClearFilters => 'Effacer les filtres';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Dividende en espèces (total, facultatif)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Saisissez un dividende en espèces ou en actions';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'Une fois défini, la carte du compte affiche les dépenses du cycle courant ; vide, rien n’est calculé';

  @override
  String get mobileLegacyNoteOptional => 'Note (facultatif)';

  @override
  String get mobileLegacyNoteKeyword => 'Mot-clé de note';

  @override
  String get mobileLegacyMinimumTransactionTax =>
      'Taxe de transaction minimale';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'Jusqu’à 5 photos par transaction';

  @override
  String get mobileLegacyReportNotifications => 'Notifications de rapport';

  @override
  String get mobileLegacySeeYourCompleteCashFlow =>
      'Gardez une vue complète de vos flux';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser =>
      'Impossible d’ouvrir le navigateur';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForGoogleSign =>
      'Unable to open the browser for Google sign-in';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForLineSign =>
      'Unable to open the browser for LINE sign-in';

  @override
  String get mobileLegacyUnableToOpenTheBrowserForPasskeySign =>
      'Unable to open the browser for passkey sign-in';

  @override
  String get mobileLegacyYourSessionExpiredSignInAgain =>
      'La session a expiré. Veuillez vous reconnecter';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'La réponse de connexion ne contient pas le cookie d’authentification. Vérifiez la configuration du serveur';

  @override
  String get mobileLegacySignedIn => 'Connexion réussie';

  @override
  String get mobileLegacySignInHistory => 'Historique de connexion';

  @override
  String get mobileLegacySignedInDevices => 'Appareils connectés';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'Connexion impossible pour la demande de connexion';

  @override
  String get mobileLegacyEndDate => 'Date de fin';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'La réponse d’inscription ne contient pas le cookie d’authentification. Vérifiez la configuration du serveur';

  @override
  String get mobileLegacySignUpAndSignIn => 'Créer un compte et se connecter';

  @override
  String get mobileLegacyBuy => 'Acheter';

  @override
  String get mobileLegacyFrequency => 'Fréquence';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'Le taux de change doit être supérieur à 0';

  @override
  String get mobileLegacyReturns => 'Résultat';

  @override
  String get mobileLegacyAddPasskey => 'Ajouter une Passkey';

  @override
  String get mobileLegacyAddStockTransaction =>
      'Ajouter une transaction d’action';

  @override
  String get mobileLegacyAddSchedule => 'Ajouter une planification';

  @override
  String get mobileLegacyAddReportSchedule =>
      'Ajouter une planification de rapport';

  @override
  String get mobileLegacyAddPhotosOptional => 'Ajouter des photos (facultatif)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'Échec du chargement de la photo';

  @override
  String get mobileLegacyLink => 'Lier';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'L’association se fait dans le navigateur. Avant de dissocier, vérifiez qu’un autre mode de connexion reste disponible.';

  @override
  String get mobileLegacyUnlink => 'Dissocier';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'Finances personnelles · App Android';

  @override
  String get mobileLegacySkip => 'Ignorer';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'Commission minimale lot fractionné';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'E-mail ou mot de passe incorrect';

  @override
  String get mobileLegacyDefaultCurrency => 'Devise par défaut';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Devise par défaut et devises fréquentes';

  @override
  String get mobileLegacyBudgets => 'Budgets';

  @override
  String get mobileLegacyBudgetsReportsAndMore => 'Budgets, rapports et plus';

  @override
  String get mobileLegacyBudgetAmount => 'Montant du budget';

  @override
  String get mobileLegacyCurrencySettings => 'Paramètres de devise';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'Langue de l’app, des notifications et du web';

  @override
  String get mobileLegacyBank => 'Banque';

  @override
  String get mobileLegacyBankBalance => 'Solde bancaire';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'Nécessite un compte LINE lié';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'Il faut au moins une carte de crédit et un compte hors carte pour enregistrer un remboursement';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'Incluez majuscules, minuscules, chiffres et symboles';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'Incluez majuscules, minuscules, chiffres et symboles';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'Supprimer cette planification de rapport ?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'Supprimer cette photo envoyée ? Cette action est irréversible.';

  @override
  String get mobileLegacyEditStockTransaction =>
      'Modifier la transaction d’action';

  @override
  String get mobileLegacyEditReportSchedule =>
      'Modifier la planification du rapport';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'Terminez d’abord la vérification ci-dessous';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'Ajoutez d’abord une action dans l’onglet Positions';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'Sélectionnez d’abord une catégorie parente';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'Saisissez un remboursement pour au moins une carte';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'Choisissez au moins un mode de notification';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'Saisissez un nombre supérieur ou égal à 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 =>
      'Saisissez une valeur de 1 à 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 =>
      'Saisissez un montant supérieur à 0';

  @override
  String get mobileLegacyEnterATicker => 'Saisissez un ticker';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'Saisissez un entier positif';

  @override
  String get mobileLegacyEnterAName => 'Saisissez un nom';

  @override
  String get mobileLegacyEnterAValidEmailAddress =>
      'Saisissez une adresse e-mail valide';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'Saisissez votre mot de passe pour confirmer';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'Saisissez l’e-mail du compte pour confirmer';

  @override
  String get mobileLegacyEnterADisplayName => 'Saisissez un nom d’affichage';

  @override
  String get mobileLegacySelectASubcategory =>
      'Sélectionnez une sous-catégorie';

  @override
  String get mobileLegacySelectACategory => 'Sélectionnez une catégorie';

  @override
  String get mobileLegacySelectAParentCategory =>
      'Sélectionnez une catégorie parente';

  @override
  String get mobileLegacySelectAnAccount => 'Sélectionnez un compte';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Sélectionnez le compte destinataire';

  @override
  String get mobileLegacySell => 'Vendre';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'Commission minimale lot complet';

  @override
  String get mobileLegacyFilter => 'Filtrer';

  @override
  String get mobileLegacyFilterTransactions => 'Filtrer les transactions';

  @override
  String get mobileLegacyChooseTheme => 'Choisir le thème';

  @override
  String get mobileLegacyLogTransactionsInSeconds =>
      'Enregistrez une transaction en quelques secondes';

  @override
  String get mobileLegacyMarketValue => 'Valeur de marché totale';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'Actifs totaux (convertis en TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Chinois traditionnel / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'Pas encore de compte ? Inscrivez-vous';

  @override
  String get mobileLegacyPaymentRecorded => 'Remboursement enregistré';

  @override
  String get mobileLegacyToAccount => 'Compte destinataire';

  @override
  String get mobileLegacyFromAccount => 'Compte source';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'Les comptes source et destinataire doivent être différents';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Modifiez les virements dans la version web';

  @override
  String get mobileLegacyTransactionTaxSell => 'Taxe de transaction (vente)';

  @override
  String get mobileLegacyTransactionTaxOptional =>
      'Taxe de transaction (facultatif)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'Type (influe sur la taxe de transaction)';

  @override
  String get mobileLegacyWarrants => 'Warrants (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'Bienvenue dans AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'Les autres appareils seront déconnectés après ce changement.';

  @override
  String get mobileLegacyTestSentryConfiguration =>
      'Tester la configuration Sentry';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'L’API a répondu 401 ; la session a expiré et la connexion locale a été effacée';

  @override
  String get mobileLegacyApiRequestFailed => 'Échec de la requête API';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'Connexion à l’API impossible';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'La réponse de l’app ne contient pas le cookie d’authentification';

  @override
  String get mobileLegacyEmailNotifications => 'Notifications par e-mail';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'La réponse Google ne contient pas le cookie d’authentification';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'Notifications LINE';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'La réponse LINE ne contient pas le cookie d’authentification';

  @override
  String get mobileLegacyLineSignInStateMismatchTryAgain =>
      'LINE sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyLineSignInTimedOutOrWasCancelled =>
      'LINE sign-in timed out or was cancelled';

  @override
  String get mobileLegacyPasskeySignInTimedOutOrWasCancelled =>
      'Passkey sign-in timed out or was cancelled';

  @override
  String get mobileLegacyTwdIsAlwaysIncludedSelectedCurrenciesAppearFirst =>
      'TWD est toujours inclus. Les devises cochées apparaissent en tête des listes de transactions et de récurrences.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'Jour $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'Dernier envoi : $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'Version actuelle v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'La version v$version est disponible';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'Chaque mois le $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'Chaque $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'Créé le $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'Langue mise à jour : $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'Échec du chargement : $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'Erreur inattendue : $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return 'Échec de la connexion $provider : $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'Échec de la mise à jour des cours : $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'Échec de la synchronisation des dividendes : $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'Échec de l’envoi de la photo : $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'Échec de la requête (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'Échec de la connexion (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'Impossible de joindre le serveur ($target) : $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return 'Supprimer « $name » ?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'Dissocier $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'Dissocier $provider ?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return 'Association $provider';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (tout)';
  }

  @override
  String mobileDynamicUnknownHttpMethod(Object method) {
    return 'Unknown HTTP method: $method';
  }

  @override
  String mobileDynamicDeleteAccountName(Object name) {
    return 'Delete “$name”? Related transactions may also be affected.';
  }

  @override
  String mobileDynamicCurrentSpending(Object amount, Object range) {
    return 'Current spending $amount$range';
  }

  @override
  String mobileDynamicSpentAmount(Object amount) {
    return 'Spent $amount';
  }

  @override
  String mobileDynamicPaidAmount(Object amount) {
    return 'Paid $amount';
  }

  @override
  String mobileDynamicStatementCloses(Object name, Object day) {
    return '$name · Statement closes on day $day';
  }

  @override
  String mobileDynamicAddBudgetForMonth(Object month) {
    return 'Add budget ($month)';
  }

  @override
  String mobileDynamicRecurringSubtitle(
    Object frequency,
    Object account,
    Object startDate,
  ) {
    return '$frequency · $account · From $startDate';
  }

  @override
  String mobileDynamicReportTotalExpense(Object total) {
    return 'Total expenses: $total';
  }

  @override
  String mobileDynamicReportTotalIncome(Object total) {
    return 'Total income: $total';
  }

  @override
  String mobileDynamicDeleteTransactionDate(Object date) {
    return 'Delete the transaction from $date? This cannot be undone.';
  }

  @override
  String mobileDynamicDeleteTransactionCompact(Object date) {
    return 'Delete the transaction from $date?';
  }

  @override
  String mobileDynamicExchangeRateForCurrency(Object currency) {
    return 'Exchange rate (1 $currency = ? TWD)';
  }

  @override
  String mobileDynamicCardRateAutoFee(Object rate) {
    return 'Card rate: $rate%. Leave blank to calculate automatically.';
  }

  @override
  String mobileDynamicUploadedPhotosCount(Object count) {
    return 'Uploaded photos ($count)';
  }

  @override
  String mobileDynamicAddPhotosCount(Object count) {
    return 'Add photos ($count/5)';
  }

  @override
  String mobileDynamicStockPricesUpdated(Object count) {
    return 'Updated $count stocks';
  }

  @override
  String mobileDynamicStockPricesUpdatedWithFailed(
    Object count,
    Object failed,
  ) {
    return 'Updated $count stocks; $failed lookups failed';
  }

  @override
  String mobileDynamicDeleteStock(Object symbol, Object name) {
    return 'Delete “$symbol $name”? All of its transactions and dividends will also be deleted.';
  }

  @override
  String mobileDynamicStockHoldingSubtitle(
    Object shares,
    Object avgCost,
    Object currentPrice,
  ) {
    return '$shares shares · Avg. $avgCost · Current $currentPrice';
  }

  @override
  String mobileDynamicStockTransactionSubtitle(
    Object date,
    Object shares,
    Object price,
  ) {
    return '$date · $shares shares @ $price';
  }

  @override
  String mobileDynamicDeleteDividend(Object symbol, Object date) {
    return 'Delete the $symbol dividend from $date?';
  }

  @override
  String mobileDynamicDividendsSynced(Object count) {
    return 'Synced $count dividends';
  }

  @override
  String mobileDynamicDividendsSyncedWithSkipped(Object count, Object skipped) {
    return 'Synced $count dividends; skipped $skipped';
  }

  @override
  String mobileDynamicCashDividend(Object amount) {
    return 'Cash $amount';
  }

  @override
  String mobileDynamicStockDividendShares(Object shares) {
    return '$shares stock-dividend shares';
  }

  @override
  String mobileDynamicRealizedTransactionSubtitle(Object date, Object shares) {
    return '$date · Sold $shares shares';
  }

  @override
  String dashboardDataStatusQueriedAt(Object time) {
    return 'Données consultées à $time';
  }

  @override
  String get dashboardAttentionTitle => 'À vérifier';

  @override
  String get dashboardAttentionAllClear =>
      'Rien ne nécessite votre attention pour le moment';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count transactions récurrentes sont à vérifier';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count transactions non catégorisées · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count positions détenues n’ont pas de prix';
  }

  @override
  String get dashboardDriversTitle => '3 principaux facteurs du mois';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'Les principaux montants en $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share % de ce type';
  }

  @override
  String get dashboardPersonalizeTrigger => 'Personnaliser l’accueil';

  @override
  String get dashboardPersonalizeTitle => 'Personnaliser l’accueil';

  @override
  String get dashboardPersonalizeDescription =>
      'Choisissez les modules affichés et classez-les selon votre usage.';

  @override
  String get dashboardPersonalizeModulesAssets => 'Aperçu des actifs';

  @override
  String get dashboardPersonalizeModulesAttention => 'À vérifier';

  @override
  String get dashboardPersonalizeModulesWhyChanged =>
      'Pourquoi le flux de trésorerie a changé';

  @override
  String get dashboardPersonalizeModulesSpending => 'Catégories de dépenses';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth =>
      'Santé du portefeuille';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'Revenus et opérations récentes';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'Monter $module';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'Descendre $module';
  }

  @override
  String get dashboardPersonalizeSaved =>
      'Disposition du tableau de bord enregistrée';

  @override
  String get dashboardPersonalizeSaveError =>
      'Impossible d’enregistrer la disposition du tableau de bord';

  @override
  String get dashboardPersonalizeReset => 'Réinitialiser';

  @override
  String get dashboardPersonalizeApply => 'Appliquer';

  @override
  String get dashboardComparisonTitle =>
      'Pourquoi le flux de trésorerie a changé';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd comparé à $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'Mois complet comparé à $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'Aucune période précédente comparable pour ce mois.';

  @override
  String get dashboardComparisonNoChanges =>
      'Le flux de trésorerie enregistré est inchangé par rapport à la période comparable.';

  @override
  String get dashboardComparisonPreviousNet =>
      'Flux de trésorerie net précédent';

  @override
  String get dashboardComparisonNetChange =>
      'Variation du flux de trésorerie net';

  @override
  String get dashboardComparisonNewThisPeriod => 'Nouveau sur cette période';

  @override
  String get dashboardComparisonIncreased => 'Montant en hausse';

  @override
  String get dashboardComparisonDecreased => 'Montant en baisse';

  @override
  String get dashboardPortfolioHealthTitle =>
      'Santé du coût de revient du portefeuille';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'Valeur actuelle comparée au coût FIFO restant';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'Ajoutez une position pour afficher l’analyse du coût.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'Les prix actuels sont nécessaires pour cette comparaison.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'Aucun pourcentage combiné n’est disponible pour plusieurs devises.';

  @override
  String get dashboardPortfolioHealthMarketValue => 'Valeur de marché cotée';

  @override
  String get dashboardPortfolioHealthCost => 'Coût des positions cotées';

  @override
  String get dashboardPortfolioHealthUnrealizedGross =>
      'Plus/moins-value brute latente';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'Principale position : $name · $share% de la valeur cotée';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'Cette vue compare les prix actuels au coût FIFO enregistré. Ce n’est ni un indice de marché ni une performance pondérée dans le temps.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'Couverture des prix : $priced positions sur $total';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook =>
      'Prévision de trésorerie planifiée';

  @override
  String get dashboardPersonalizeModulesSavingsScenario => 'Scénario d’épargne';

  @override
  String get dashboardCashOutlookTitle =>
      '30 prochains jours · trésorerie planifiée';

  @override
  String get dashboardCashOutlookSubtitle =>
      'Basé sur les opérations récurrentes confirmées';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · Estimation planifiée';
  }

  @override
  String get dashboardCashOutlookInvalidDate =>
      'Impossible de calculer la période estimée.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'Ajoutez un compte bancaire inclus avant d’estimer la trésorerie planifiée.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'Créez un revenu ou une dépense récurrente pour voir la trésorerie à venir.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'Vérifiez les opérations récurrentes et liez-les à des comptes bancaires inclus.';

  @override
  String get dashboardCashOutlookStartingBalance => 'Solde bancaire à ce jour';

  @override
  String get dashboardCashOutlookScheduledNet => 'Variation nette planifiée';

  @override
  String get dashboardCashOutlookClosingBalance =>
      'Trésorerie estimée après 30 jours';

  @override
  String get dashboardCashOutlookLowestBalance => 'Trésorerie minimale estimée';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count opérations planifiées · Revenus $income · Dépenses $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'La trésorerie combinée estimée pourrait devenir négative';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'Vers le $date, l’estimation atteint $amount sous zéro. Vérifiez les dates et montants avant d’agir.';
  }

  @override
  String get dashboardCashOutlookUpcoming => 'Opérations planifiées à venir';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'Affichage de $shown sur $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'Aucune opération planifiée dans cette période de 30 jours.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '$included opérations récurrentes sur $total sont couvertes ; vérifiez-en $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'L’estimation combine tous les comptes bancaires inclus avec le solde du jour et les opérations récurrentes liées confirmées. Elle ne montre pas les découverts possibles d’un compte et ne modifie pas les soldes réels ; les opérations échues sont créées au prochain traitement. Les estimations TWD utilisent systématiquement les taux actuels.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'La trésorerie planifiée pourrait manquer de $amount vers le $date';
  }

  @override
  String get dashboardScenarioTitle => 'Scénario d’épargne';

  @override
  String get dashboardScenarioSubtitle =>
      'Estimez l’effet cumulé d’un ajustement mensuel';

  @override
  String get dashboardScenarioMonthlyAdjustment =>
      'Ajustement mensuel de l’épargne (TWD)';

  @override
  String get dashboardScenarioDecrease => 'Réduire l’ajustement mensuel de 500';

  @override
  String get dashboardScenarioIncrease =>
      'Augmenter l’ajustement mensuel de 500';

  @override
  String get dashboardScenarioHorizon => 'Horizon';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count mois';
  }

  @override
  String get dashboardScenarioDifference => 'Écart cumulé';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'Un ajustement mensuel de $monthly pendant $months mois produit un écart cumulé de $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'Scénario simple : ajustement mensuel × nombre de mois. Il exclut intérêts, rendements, inflation et fiscalité, sans garantir de résultat futur.';

  @override
  String get navMcp => 'Connexion MCP';

  @override
  String get settingsMcpTitle => 'Paramètres de connexion MCP';

  @override
  String get settingsMcpDescription =>
      'Connectez les outils d\'IA compatibles MCP via OAuth, ou créez un jeton personnel pour les clients qui exigent des identifiants manuels.';

  @override
  String get settingsMcpOauthTitle => 'Se connecter avec OAuth';

  @override
  String get settingsMcpOauthDescription =>
      'Saisissez l\'URL de connexion dans un outil compatible MCP OAuth. AssetPilot ouvrira une page sécurisée de connexion et de consentement, sans jeton manuel.';

  @override
  String get settingsMcpCreateNew => 'Créer un nouveau jeton';

  @override
  String get settingsMcpNameLabel => 'Nom';

  @override
  String get settingsMcpNamePlaceholder => 'ex. Mon ChatGPT';

  @override
  String get settingsMcpExpiresAtLabel => 'Date d\'expiration (facultatif)';

  @override
  String get settingsMcpCreateButton => 'Créer le jeton';

  @override
  String get settingsMcpCreating => 'Création…';

  @override
  String get settingsMcpCreateFailed => 'Échec de la création du jeton';

  @override
  String get settingsMcpNameRequired => 'Le nom est requis';

  @override
  String get settingsMcpNameTooLong =>
      'Le nom ne peut pas dépasser 100 caractères';

  @override
  String get settingsMcpListTitle => 'Mes jetons MCP';

  @override
  String get settingsMcpRefresh => 'Actualiser';

  @override
  String get settingsMcpNoCredentials => 'Aucun jeton pour le moment';

  @override
  String get settingsMcpLoadFailed => 'Échec du chargement des jetons';

  @override
  String get settingsMcpColName => 'Nom';

  @override
  String get settingsMcpColCreatedAt => 'Créé le';

  @override
  String get settingsMcpColLastUsedAt => 'Dernière utilisation';

  @override
  String get settingsMcpColStatus => 'Statut';

  @override
  String get settingsMcpColActions => 'Actions';

  @override
  String get settingsMcpNeverUsed => 'Jamais utilisé';

  @override
  String get settingsMcpStatusActive => 'Actif';

  @override
  String get settingsMcpStatusExpired => 'Expiré';

  @override
  String get settingsMcpStatusRevoked => 'Révoqué';

  @override
  String get settingsMcpRevokeButton => 'Révoquer';

  @override
  String get settingsMcpRevokeConfirm =>
      'Révoquer ce jeton ? Toutes les requêtes qui l\'utilisent seront immédiatement rejetées.';

  @override
  String get settingsMcpRevokeFailed => 'Échec de la révocation du jeton';

  @override
  String get settingsMcpTokenModalTitle => 'Jeton d\'accès MCP';

  @override
  String get settingsMcpTokenWarning =>
      'Ce jeton ne s\'affiche qu\'une seule fois. Copiez-le et conservez-le en sécurité maintenant ; il ne pourra plus être consulté après fermeture.';

  @override
  String get settingsMcpTokenLabel => 'Jeton d\'accès';

  @override
  String get settingsMcpConnectionUrlLabel => 'URL de connexion MCP';

  @override
  String get settingsMcpCopyButton => 'Copier';

  @override
  String get settingsMcpCopied => 'Copié !';

  @override
  String get settingsMcpCloseConfirm => 'Je l\'ai copié, fermer';
}

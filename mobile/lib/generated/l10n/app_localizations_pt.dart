// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get commonSave => 'Salvar';

  @override
  String get commonCancel => 'Cancelar';

  @override
  String get commonDelete => 'Excluir';

  @override
  String get commonEdit => 'Editar';

  @override
  String get commonConfirm => 'Confirmar';

  @override
  String get commonClose => 'Fechar';

  @override
  String get commonLoading => 'Carregando…';

  @override
  String get commonAdd => 'Adicionar';

  @override
  String get commonBack => 'Voltar';

  @override
  String get commonSearch => 'Buscar';

  @override
  String get commonLanguage => 'Idioma';

  @override
  String get commonClear => 'Limpar';

  @override
  String get commonSaving => 'Salvando...';

  @override
  String get commonConfirmDelete => 'Confirmar exclusão';

  @override
  String get commonPreviousPage => 'Anterior';

  @override
  String get commonNextPage => 'Próxima';

  @override
  String commonTotalRecords(Object count) {
    return '$count registros';
  }

  @override
  String get commonPerPage => 'Por página';

  @override
  String commonRecordsUnit(Object count) {
    return '$count registros';
  }

  @override
  String get commonNoData => 'Ainda não há dados';

  @override
  String get navSectionsFinance => 'Finanças';

  @override
  String get navSectionsStocks => 'Ações';

  @override
  String get navSectionsSystem => 'Sistema';

  @override
  String get navDashboard => 'Painel';

  @override
  String get navTransactions => 'Transações';

  @override
  String get navReports => 'Relatórios';

  @override
  String get navBudget => 'Orçamentos';

  @override
  String get navInfoBoard => 'Painel de informações';

  @override
  String get navAccounts => 'Contas';

  @override
  String get navCategories => 'Categorias';

  @override
  String get navRecurring => 'Recorrentes';

  @override
  String get navStocksPortfolio => 'Carteira';

  @override
  String get navStocksTransactions => 'Transações de ações';

  @override
  String get navStocksDividends => 'Dividendos';

  @override
  String get navStocksRealized => 'P/L realizado';

  @override
  String get navStocksSettings => 'Configurações de ações';

  @override
  String get navExportImport => 'Exportar / importar';

  @override
  String get navAccount => 'Conta';

  @override
  String get navApiCredits => 'Acesso API';

  @override
  String get navAdmin => 'Admin';

  @override
  String get navTitleStocks => 'Carteira';

  @override
  String get navTitleStockTransactions => 'Transações de ações';

  @override
  String get navTitleStockDividends => 'Dividendos de ações';

  @override
  String get navTitleStockRealized => 'P/L realizado';

  @override
  String get navTitleStockSettings => 'Configurações de negociação de ações';

  @override
  String get navTitleApiCredits => 'Uso e acesso API';

  @override
  String get shellFallbackUser => 'Usuário';

  @override
  String get shellLogout => 'Sair';

  @override
  String get shellVersionInfo => 'Informações da versão';

  @override
  String get shellOpenMenu => 'Abrir menu';

  @override
  String get shellSkipToContent => 'Ir para o conteúdo principal';

  @override
  String get shellThemeLight => 'Claro';

  @override
  String get shellThemeSystem => 'Sistema';

  @override
  String get shellThemeDark => 'Escuro';

  @override
  String get shellChangelogLoading => 'Carregando informações da versão...';

  @override
  String get shellChangelogLoadFailed =>
      'Não foi possível carregar as informações da versão';

  @override
  String get shellChangelogUnknownVersion => 'Desconhecida';

  @override
  String get shellChangelogCurrentVersion => 'Versão atual';

  @override
  String get shellChangelogUpdatableVersion => 'Versão disponível';

  @override
  String get shellChangelogUpToDate => 'Já está atualizado';

  @override
  String get shellChangelogUpdatableContent => 'Conteúdo da atualização';

  @override
  String get shellChangelogRecentContent => 'Atualizações recentes';

  @override
  String get authLoginTab => 'Entrar';

  @override
  String get authRegisterTab => 'Criar conta';

  @override
  String get authSubtitleLogin => 'Que bom te ver de volta. Entre na sua conta';

  @override
  String get authSubtitleRegister => 'Crie sua conta e comece a acompanhar';

  @override
  String get authEmailLabel => 'E-mail';

  @override
  String get authPasswordLabel => 'Senha';

  @override
  String get authPasswordPlaceholder => 'Digite sua senha';

  @override
  String get authDisplayNameLabel => 'Nome de exibição';

  @override
  String get authDisplayNamePlaceholder => 'Seu nome ou apelido';

  @override
  String get authRegisterPasswordPlaceholder =>
      'Pelo menos 8 caracteres, com maiúsculas, minúsculas e números';

  @override
  String get authTogglePassword => 'Mostrar ou ocultar senha';

  @override
  String get authTurnstileAria => 'Verificação humana do Cloudflare Turnstile';

  @override
  String get authLoginButton => 'Entrar';

  @override
  String get authLoggingIn => 'Entrando…';

  @override
  String get authPasskeyButton => 'Entrar com Passkey';

  @override
  String get authPasskeyVerifying => 'Verificando Passkey…';

  @override
  String get authGoogleButton => 'Entrar com Google';

  @override
  String get authGoogleVerifying => 'Verificando Google…';

  @override
  String get authLineButton => 'Entrar com LINE';

  @override
  String get authLineVerifying => 'Verificando LINE…';

  @override
  String get authRegisterSubmit => 'Criar conta';

  @override
  String get authRegistering => 'Criando conta…';

  @override
  String get authLineCallbackCompleting =>
      'Concluindo a verificação do LINE...';

  @override
  String get authLineCallbackMissingCode =>
      'O LINE não retornou um código de autorização. Tente novamente.';

  @override
  String get authLineCallbackLinkFailed =>
      'Não foi possível vincular a conta LINE';

  @override
  String get authLineCallbackLoginFailed => 'Falha ao entrar com LINE';

  @override
  String get authLineCallbackVerifyFailed => 'Falha na verificação do LINE';

  @override
  String get authErrorsTurnstileRequired =>
      'Conclua a verificação humana primeiro';

  @override
  String get authErrorsLoginFailed => 'Não foi possível entrar';

  @override
  String get authErrorsRegisterFailed => 'Não foi possível criar a conta';

  @override
  String get authErrorsGoogleNotConfigured =>
      'O login com Google não está configurado';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'O componente de login com Google não foi carregado';

  @override
  String get authErrorsGoogleStateFailed =>
      'Não foi possível criar o estado de login do Google';

  @override
  String get authErrorsGoogleNoCode =>
      'Nenhum código de autorização do Google foi recebido';

  @override
  String get authErrorsGoogleFailed => 'Falha ao entrar com Google';

  @override
  String get authErrorsGoogleCancelled => 'Login com Google cancelado';

  @override
  String get authErrorsPasskeyUnsupported =>
      'Este navegador não oferece suporte a Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Não foi possível criar o desafio de login com Passkey';

  @override
  String get authErrorsPasskeyFailed => 'Falha ao entrar com Passkey';

  @override
  String get authErrorsLineNotConfigured =>
      'O login com LINE não está configurado';

  @override
  String get authErrorsLineFailed => 'Falha ao entrar com LINE';

  @override
  String get settingsTitle => 'Configurações';

  @override
  String get settingsLanguageTitle => 'Idioma';

  @override
  String get settingsLanguageDescription =>
      'Escolha o idioma da interface e das notificações (Email / LINE).';

  @override
  String get settingsLanguageSaved => 'Preferência de idioma atualizada';

  @override
  String get settingsAccountTitle => 'Configurações da conta';

  @override
  String get settingsAccountProfileInfo => 'Informações da conta';

  @override
  String get settingsAccountEmail => 'E-mail';

  @override
  String get settingsAccountDisplayName => 'Nome de exibição';

  @override
  String get settingsAccountEditDisplayName => 'Editar nome de exibição';

  @override
  String get settingsAccountUpdateName => 'Atualizar nome';

  @override
  String get settingsAccountSaving => 'Salvando...';

  @override
  String get settingsAccountSetLocalPassword => 'Definir senha local';

  @override
  String get settingsAccountChangePassword => 'Alterar senha';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'Esta conta usa apenas login de terceiros no momento. Depois de definir uma senha local, você também poderá entrar com e-mail e senha.';

  @override
  String get settingsAccountCurrentPassword => 'Senha atual';

  @override
  String get settingsAccountNewPassword => 'Nova senha';

  @override
  String get settingsAccountConfirmNewPassword => 'Confirmar nova senha';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'Pelo menos 8 caracteres com maiúscula, minúscula, número e símbolo';

  @override
  String get settingsAccountUpdating => 'Atualizando...';

  @override
  String get settingsAccountSetPassword => 'Definir senha';

  @override
  String get settingsAccountUpdatePassword => 'Atualizar senha';

  @override
  String get settingsAccountThemeTitle => 'Tema';

  @override
  String get settingsAccountThemeSystem => 'Seguir o sistema';

  @override
  String get settingsAccountThemeLight => 'Modo claro';

  @override
  String get settingsAccountThemeDark => 'Modo escuro';

  @override
  String get settingsAccountDefaultCurrency => 'Moeda padrão';

  @override
  String get settingsAccountCurrencyCode => 'Código da moeda';

  @override
  String get settingsAccountUpdateDefaultCurrency => 'Atualizar moeda padrão';

  @override
  String get settingsAccountPasskeyTitle => 'Gerenciar Passkeys';

  @override
  String get settingsAccountNoPasskeys => 'Nenhum Passkey registrado';

  @override
  String get settingsAccountAddPasskey => '+ Adicionar Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Vínculo com Google';

  @override
  String get settingsAccountLineTitle => 'Vínculo com LINE';

  @override
  String get settingsAccountStatusPrefix => 'Status atual: ';

  @override
  String get settingsAccountLinkedGoogle => 'Conta Google vinculada';

  @override
  String get settingsAccountNotLinkedGoogle => 'Conta Google não vinculada';

  @override
  String get settingsAccountLinkGoogle => 'Vincular conta Google';

  @override
  String get settingsAccountUnlink => 'Desvincular';

  @override
  String get settingsAccountLinkedLine => 'Conta LINE vinculada';

  @override
  String get settingsAccountNotLinkedLine => 'Conta LINE não vinculada';

  @override
  String get settingsAccountLinkLine => 'Vincular conta LINE';

  @override
  String get settingsAccountLineVerifying => 'Verificando LINE…';

  @override
  String get settingsAccountSessionsTitle => 'Dispositivos conectados';

  @override
  String get settingsAccountRefresh => 'Atualizar';

  @override
  String get settingsAccountDeviceName => 'Nome do dispositivo';

  @override
  String get settingsAccountLoginTime => 'Hora de login';

  @override
  String get settingsAccountLoginIp => 'IP de login';

  @override
  String get settingsAccountActions => 'Ações';

  @override
  String get settingsAccountUnknownDevice => 'Dispositivo desconhecido';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (este dispositivo)';

  @override
  String get settingsAccountSignOut => 'Sair';

  @override
  String get settingsAccountNoSessions =>
      'Nenhum registro de dispositivo conectado';

  @override
  String get settingsAccountAuditTitle => 'Histórico de login';

  @override
  String get settingsAccountCountry => 'País';

  @override
  String get settingsAccountMethod => 'Método';

  @override
  String get settingsAccountDevice => 'Dispositivo';

  @override
  String get settingsAccountAdminLogin => 'Login de administrador';

  @override
  String get settingsAccountYes => 'Sim';

  @override
  String get settingsAccountNo => 'Não';

  @override
  String get settingsAccountDeleteTitle => 'Excluir conta';

  @override
  String get settingsAccountDeleteDescription =>
      'Depois de excluir sua conta, transações, contas, ações, Passkeys e configurações serão removidos permanentemente e não poderão ser recuperados.';

  @override
  String get settingsAccountDeleteButton => 'Excluir minha conta';

  @override
  String get settingsAccountDeleteModalTitle => 'Confirmar exclusão da conta';

  @override
  String get settingsAccountDeleteModalWarning =>
      'Esta ação excluirá permanentemente sua conta e todos os dados, incluindo transações, contas, ações, Passkeys e configurações. Não é possível recuperar.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'Digite sua senha para confirmar a exclusão';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'Digite o e-mail da conta \"$email\" para confirmar a exclusão';
  }

  @override
  String get settingsAccountDeleting => 'Excluindo...';

  @override
  String get settingsAccountDeletePermanently =>
      'Excluir conta permanentemente';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'Digite sua senha atual';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'Digite uma nova senha';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'A nova senha deve ter pelo menos 8 caracteres';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'A nova senha deve incluir maiúscula, minúscula, número e caractere especial';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'As duas novas senhas não coincidem';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'Senha definida. Agora você pode entrar com sua senha';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'Senha atualizada';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'Não foi possível atualizar a senha';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'O nome de exibição não pode ficar vazio';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'Nome de exibição atualizado';

  @override
  String get settingsAccountMessagesUpdateFailed =>
      'Não foi possível atualizar';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'Excluir este Passkey?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'A moeda deve ser um código de 3 letras';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'Moeda padrão atualizada';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'Não foi possível atualizar a moeda padrão';

  @override
  String get settingsAccountMessagesSessionLoggedOut =>
      'Dispositivo desconectado';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'Não foi possível sair do dispositivo';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'Este navegador não oferece suporte a Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Dispositivo Android';

  @override
  String get settingsAccountMessagesComputerDevice => 'Computador';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Falha ao registrar Passkey';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'Cole um Google ID Token para simular a vinculação';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Conta Google vinculada';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'Não foi possível vincular a conta Google';

  @override
  String get settingsAccountMessagesGoogleUnlinked =>
      'Conta Google desvinculada';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Não foi possível desvincular a conta Google';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'O login com LINE não está configurado';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'Não foi possível vincular a conta LINE';

  @override
  String get settingsAccountMessagesLineUnlinked => 'Conta LINE desvinculada';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'Não foi possível desvincular a conta LINE';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'Digite sua senha para confirmar a exclusão';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'Digite o e-mail correto da conta para confirmar a exclusão';

  @override
  String get settingsAccountMessagesDeleteFailed =>
      'Não foi possível excluir a conta';

  @override
  String get dashboardTitle => 'Painel';

  @override
  String dashboardSubtitle(Object month) {
    return 'Receitas, despesas, categorias e transações recentes de $month.';
  }

  @override
  String get dashboardUncategorized => 'Sem categoria';

  @override
  String get dashboardKpiTotalIncome => 'Receita total';

  @override
  String get dashboardKpiTotalExpense => 'Despesa total';

  @override
  String get dashboardKpiNet => 'Saldo líquido';

  @override
  String get dashboardKpiTodayExpense => 'Despesa de hoje';

  @override
  String get dashboardKpiBankAccounts => 'Contas bancárias';

  @override
  String get dashboardKpiStockMarketValue => 'Valor de mercado das ações';

  @override
  String get dashboardOverviewTitle => 'Resumo mensal do fluxo de caixa';

  @override
  String get dashboardOverviewBalance => 'Superávit do mês';

  @override
  String get dashboardOverviewDeficit => 'Déficit do mês';

  @override
  String get dashboardOverviewIncome => 'Receitas';

  @override
  String get dashboardOverviewExpense => 'Despesas';

  @override
  String get dashboardOverviewNet => 'Líquido';

  @override
  String get dashboardRatioTitle => 'Relação receitas / despesas';

  @override
  String get dashboardRatioIncomeShare => 'Participação das receitas';

  @override
  String get dashboardRatioExpenseShare => 'Participação das despesas';

  @override
  String get dashboardSectionsExpenseCategories => 'Categorias de despesa';

  @override
  String get dashboardSectionsIncomeCategories => 'Categorias de receita';

  @override
  String get dashboardSectionsRecentTransactions => 'Transações recentes';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'Últimos $count registros';
  }

  @override
  String get dashboardEmptyNoExpense => 'Sem despesas neste mês';

  @override
  String get dashboardEmptyNoIncome => 'Sem receitas neste mês';

  @override
  String get dashboardEmptyNoTransactions => 'Sem transações neste mês';

  @override
  String get dashboardTableDate => 'Data';

  @override
  String get dashboardTableCategory => 'Categoria';

  @override
  String get dashboardTableNote => 'Observação';

  @override
  String get dashboardTableAmount => 'Valor';

  @override
  String get dashboardFiltersPreviousMonth => 'Mês anterior';

  @override
  String get dashboardFiltersNextMonth => 'Próximo mês';

  @override
  String get dashboardFiltersCurrentMonth => 'Este mês';

  @override
  String get publicCommonBackHome => 'Voltar ao início';

  @override
  String get publicCommonPrivacy => 'Política de privacidade';

  @override
  String get publicCommonTerms => 'Termos de serviço';

  @override
  String get publicCommonApiCredits => 'Uso de API e créditos';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'Última atualização: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - Central de finanças pessoais';

  @override
  String get publicCommonMetadataDescription =>
      'Gerenciador financeiro pessoal criptografado e auto-hospedável para despesas, orçamentos, ações de Taiwan e análises.';

  @override
  String get publicCommonDatesApiCredits => '11 de junho de 2026';

  @override
  String get publicCommonDatesPrivacy => '17 de junho de 2026';

  @override
  String get publicCommonDatesTerms => '11 de junho de 2026';

  @override
  String get publicHomeTagline => 'Central de finanças pessoais';

  @override
  String get publicHomeLogin => 'Entrar';

  @override
  String get publicHomeRegister => 'Criar conta';

  @override
  String get publicHomeBadge => 'Auto-hospedado, dados criptografados, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'Sua central de controle financeiro';

  @override
  String get publicHomeHeadline2 => 'clara já na primeira tela';

  @override
  String get publicHomeLeadBefore =>
      'Reúna investimentos em ações de Taiwan, receitas, despesas, orçamentos, relatórios e auditoria em um só lugar. Os dados financeiros são criptografados em repouso com';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'sem prender você a uma nuvem específica nem a uma assinatura. Entenda o produto antes de entrar.';

  @override
  String get publicHomeStartUsing => 'Começar';

  @override
  String get publicHomeCreateFirst => 'Criar uma conta primeiro';

  @override
  String get publicHomeChipsOpenSource => 'Código aberto AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'Armazenamento local criptografado';

  @override
  String get publicHomeChipsNoCloudLock => 'Sem dependência de nuvem externa';

  @override
  String get publicHomeChipsDocker => 'Deploy Docker com um comando';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'Módulos principais';

  @override
  String get publicHomeStatsModulesSublabel =>
      'Lançamentos, ações, relatórios, governança';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'Criptografia de dados';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'Fonte de cotações';

  @override
  String get publicHomeStatsStockSourceSublabel =>
      'Intradiário, fechamento e contingência';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'Cálculo preciso';

  @override
  String get publicHomeStatsPrecisionSublabel => 'P/L por lote com decimal.js';

  @override
  String get publicHomePreLoginNote =>
      'Mesmo sem entrar, você pode conhecer os recursos do AssetPilot, como os dados são tratados e as opções de implantação antes de decidir entrar ou criar uma conta.';

  @override
  String get publicHomeWhyLabel => 'Por que AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'Controle diário, acompanhamento de investimentos e domínio dos dados no mesmo lugar';

  @override
  String get publicHomeWhyDescription =>
      'O AssetPilot foi feito para quem administra as próprias finanças. Ele centraliza fluxo de caixa, orçamentos e ações de Taiwan, mantendo exportação, auditoria e auto-hospedagem sob seu controle.';

  @override
  String get publicHomePillarsFinanceTitle =>
      'Gestão de fluxo de caixa e orçamento';

  @override
  String get publicHomePillarsFinanceTag => 'Núcleo financeiro';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'Acompanhamento de saldos em várias contas e transferências internas';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'Controle de progresso mensal e por categoria';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'Geração automática de receitas e despesas recorrentes';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'Alteração em lote de categoria, data e exclusão';

  @override
  String get publicHomePillarsStocksTitle =>
      'Acompanhamento de ações de Taiwan';

  @override
  String get publicHomePillarsStocksTag => 'Módulo de ações';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'Consulta de cotações TWSE e sincronização de ex-dividendos';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'Cálculo FIFO de P/L realizado com precisão total';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'Registro de dividendos e depósitos em conta';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'Investimentos recorrentes e marcação de deslistagem';

  @override
  String get publicHomePillarsSecurityTitle =>
      'Segurança e governança de dados';

  @override
  String get publicHomePillarsSecurityTag => 'Governança';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'Criptografia em repouso com ChaCha20-Poly1305';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'Login por senha, Google e Passkey';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'Exportação/importação, backup, restauração e logs de auditoria';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Proteção com rate limit, CSP e prevenção de injeção CSV';

  @override
  String get publicHomePillarsSelfHostedTitle => 'Auto-hospedagem e contratos';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne =>
      'Inicialização Docker com um comando';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'Suporte a amd64 e arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'Contrato documentado em OpenAPI 3.2';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'Rotas URL-first para favoritos e recarregamento direto';

  @override
  String get publicHomeQuickStartLabel => 'Início rápido';

  @override
  String get publicHomeQuickStartTitle =>
      'Rode no seu próprio servidor em 60 segundos';

  @override
  String get publicHomeQuickStartDescription =>
      'Comece rápido com Docker. Na primeira execução, as chaves JWT e de criptografia do banco são geradas automaticamente. Há suporte a amd64 e arm64, ideal para NAS, VPS ou seu próprio host Docker.';

  @override
  String get publicHomeQuickStartChipsImage => 'Imagem de aprox. 180 MB';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'Health check integrado';

  @override
  String get publicHomeQuickStartChipsKeys =>
      'Chaves geradas na primeira inicialização';

  @override
  String get publicHomeTechLabel => 'Stack técnico';

  @override
  String get publicHomeTechTitle => 'Tecnologia e informações públicas';

  @override
  String get publicHomeTechDescription =>
      'As principais tecnologias, fontes externas de dados e informações de licença ficam claras para que você entenda como o serviço funciona antes de usar.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. Gestão de patrimônio pessoal que você auto-hospeda, controla e faz backup.';

  @override
  String get publicApiCreditsPageTitle => 'Uso de API e créditos';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'Uso de API e créditos — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'Transparência de APIs externas';

  @override
  String get publicApiCreditsPageDescription =>
      'O AssetPilot só se conecta a fontes externas quando uma função precisa disso. Esta página mostra a finalidade de cada API, observações de licença e escopo dos dados enviados para revisão de conformidade em auto-hospedagem.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'Serviços externos';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'Com plano gratuito';

  @override
  String get publicApiCreditsPageStatsAttributionRequired => 'Exige atribuição';

  @override
  String get publicApiCreditsPageServiceKindsData => 'Consultas de dados';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'Autenticação';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Canais de e-mail';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'Backup em nuvem';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'Transparência de dados';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'Os cenários abaixo enviam apenas o mínimo necessário para a função e não entregam seus detalhes financeiros a serviços de terceiros.';

  @override
  String get publicApiCreditsPageMinNecessary =>
      'Princípio do mínimo necessário';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => 'Sincronização de câmbio';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'Somente dados públicos de câmbio são consultados; detalhes financeiros pessoais não são enviados.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle =>
      'Dados de ações de Taiwan';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'Apenas códigos de ações e dados de mercado são enviados, sem contas, custo de posição ou transações.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'Auditoria de login';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'O IPinfo é usado apenas para exibir o país nos registros de login.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => 'Login de terceiros';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google e LINE só são usados quando você entra ou vincula uma conta de forma ativa.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => 'Backup em nuvem';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'O MEGA S4 recebe o arquivo completo do banco apenas quando um administrador envia o backup explicitamente.';

  @override
  String get publicApiCreditsPageServiceListTitle =>
      'Lista de serviços externos';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return 'São $total serviços no total. $free oferecem plano gratuito e $paid têm planos pagos.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'Site oficial';

  @override
  String get publicApiCreditsPageFreePlan => 'Plano gratuito';

  @override
  String get publicApiCreditsPagePaidPlan => 'Plano pago';

  @override
  String get publicApiCreditsPageSupported => 'Compatível';

  @override
  String get publicApiCreditsPageUnavailable => 'Indisponível';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'Cotações globais em tempo real com TWD como moeda-base';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'Geolocalização de IP para o campo de país nos registros de auditoria de login';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'Cotações em tempo real, dados de ex-dividendos e busca de nomes de ações';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Login Google SSO';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'Login LINE e vinculação de conta';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Canal de envio de e-mail para relatórios de ativos do administrador via Gmail, Outlook ou outro servidor SMTP';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Canal de envio de e-mail para relatórios de ativos do administrador via HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'Canal de envio de e-mail para relatórios de ativos do administrador';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'Destino de object storage compatível com S3 para backups SQL completos de PostgreSQL do administrador';

  @override
  String get publicAppCallbackReturningTitle =>
      'Voltando para o app AssetPilot...';

  @override
  String get publicAppCallbackReturningBody =>
      'Se você não voltar automaticamente, confirme que a versão mais recente do AssetPilot para Android está instalada.';

  @override
  String get publicAppCallbackPasskeyTitle => 'Login no AssetPilot com Passkey';

  @override
  String get publicAppCallbackPasskeyStarting =>
      'Iniciando login com Passkey...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'Este navegador não oferece suporte a Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Não foi possível criar o desafio de login com Passkey';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'Conclua a verificação de Passkey no seu dispositivo...';

  @override
  String get publicAppCallbackPasskeyLoginFailed =>
      'Falha ao entrar com Passkey';

  @override
  String get publicAppCallbackReturningApp => 'Voltando para o app...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'Não foi possível criar a credencial de login do app';

  @override
  String get featuresCommonActions => 'Ações';

  @override
  String get featuresCommonAccount => 'Conta';

  @override
  String get featuresCommonAmount => 'Valor';

  @override
  String get featuresCommonDate => 'Data';

  @override
  String get featuresCommonEndDate => 'Fim';

  @override
  String get featuresCommonNote => 'Observação';

  @override
  String get featuresCommonStartDate => 'Início';

  @override
  String get featuresCommonStatus => 'Status';

  @override
  String get featuresCommonStock => 'Ação';

  @override
  String get featuresCommonType => 'Tipo';

  @override
  String get featuresCommonName => 'Nome';

  @override
  String get featuresCommonCurrency => 'Moeda';

  @override
  String get featuresCommonExchangeRate => 'Câmbio';

  @override
  String get featuresCommonIncome => 'Receita';

  @override
  String get featuresCommonExpense => 'Despesa';

  @override
  String get featuresCommonUncategorized => 'Sem categoria';

  @override
  String get featuresCommonUnspecified => 'Não especificado';

  @override
  String get featuresCommonAutoCalculate => 'Calcular automaticamente';

  @override
  String get featuresCommonExcludeFromStats => 'Excluir das estatísticas';

  @override
  String get featuresCommonTopLevelCategory => '- Categoria principal -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'Categorias';

  @override
  String get featuresCategoriesExpenseTab => 'Categorias de despesa';

  @override
  String get featuresCategoriesIncomeTab => 'Categorias de receita';

  @override
  String get featuresCategoriesAddCategory => 'Adicionar categoria';

  @override
  String get featuresCategoriesEditCategory => 'Editar categoria';

  @override
  String get featuresCategoriesNewCategory => 'Adicionar categoria';

  @override
  String get featuresCategoriesNameLabel => 'Nome *';

  @override
  String get featuresCategoriesTypeLabel => 'Tipo';

  @override
  String get featuresCategoriesParentLabel => 'Categoria principal';

  @override
  String get featuresCategoriesColorLabel => 'Cor';

  @override
  String get featuresCategoriesExpense => 'Despesa';

  @override
  String get featuresCategoriesIncome => 'Receita';

  @override
  String get featuresCategoriesDeleteMessage =>
      'Excluir esta categoria? As subcategorias também serão removidas.';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'Digite o nome da categoria';

  @override
  String get featuresCategoriesMessagesDeleteFailed =>
      'Não foi possível excluir';

  @override
  String get featuresBudgetTitle => 'Orçamentos';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'Orçamento total do mês';

  @override
  String get featuresBudgetSpent => 'Gasto';

  @override
  String get featuresBudgetAddBudget => 'Adicionar orçamento';

  @override
  String get featuresBudgetEditBudget => 'Editar orçamento';

  @override
  String get featuresBudgetNewBudget => 'Adicionar orçamento';

  @override
  String get featuresBudgetCategoryLabel =>
      'Categoria (em branco para orçamento total)';

  @override
  String get featuresBudgetTotalBudgetOption => '- Orçamento total -';

  @override
  String get featuresBudgetAmountLabel => 'Valor do orçamento *';

  @override
  String get featuresBudgetTotalBudgetName => '(Orçamento total)';

  @override
  String get featuresBudgetOverBudget => 'Acima do orçamento';

  @override
  String get featuresBudgetDeleteMessage => 'Excluir este orçamento?';

  @override
  String get featuresBudgetMessagesAmountRequired =>
      'Digite um valor de orçamento válido';

  @override
  String get featuresReportsTitle => 'Relatórios';

  @override
  String get featuresReportsTabsCategory => 'Distribuição por categoria';

  @override
  String get featuresReportsTabsTrend => 'Análise de tendência';

  @override
  String get featuresReportsTabsDaily => 'Gasto diário';

  @override
  String get featuresReportsPeriodsThisMonth => 'Este mês';

  @override
  String get featuresReportsPeriodsLastMonth => 'Mês passado';

  @override
  String get featuresReportsPeriodsLast3 => 'Últimos 3 meses';

  @override
  String get featuresReportsPeriodsLast6 => 'Últimos 6 meses';

  @override
  String get featuresReportsPeriodsThisYear => 'Este ano';

  @override
  String get featuresReportsPeriodsCustom => 'Personalizado';

  @override
  String get featuresReportsPeriodLabel => 'Período';

  @override
  String get featuresReportsStart => 'Início';

  @override
  String get featuresReportsEnd => 'Fim';

  @override
  String get featuresReportsCurrentTotal => 'Total atual';

  @override
  String get featuresReportsComparedPrevious => 'Comparado ao período anterior';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta; período anterior sem dados';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'Detalhe de $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'Total: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'Categoria selecionada: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', valor $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'Ver transações relacionadas';

  @override
  String get featuresRecurringTitle => 'Receitas e despesas recorrentes';

  @override
  String get featuresRecurringAdd => 'Adicionar recorrente';

  @override
  String get featuresRecurringEdit => 'Editar recorrente';

  @override
  String get featuresRecurringCreate => 'Adicionar recorrente';

  @override
  String get featuresRecurringAmountLabel => 'Valor *';

  @override
  String get featuresRecurringFxFeeLabel => 'Taxa internacional (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'Em branco: o sistema calcula pela taxa do cartão';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'Taxa internacional do cartão $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', valor sugerido NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'Consultando câmbio mais recente...';

  @override
  String get featuresRecurringCategory => 'Categoria';

  @override
  String get featuresRecurringFrequency => 'Frequência';

  @override
  String get featuresRecurringStartDate => 'Data inicial';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'Próxima execução: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'Categoria: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'Conta: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'Taxa internacional: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => 'Excluir este recorrente?';

  @override
  String get featuresRecurringCreatingTransfer => 'Criando...';

  @override
  String get featuresRecurringConfirmTransfer => 'Confirmar transferência';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'Diário';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'Semanal';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'Mensal';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'Anual';

  @override
  String get featuresRecurringMessagesAmountRequired =>
      'Digite um valor válido';

  @override
  String get featuresDataTransferTitle => 'Exportação e importação de dados';

  @override
  String get featuresDataTransferExportStartDate =>
      'Data inicial da exportação';

  @override
  String get featuresDataTransferExportEndDate => 'Data final da exportação';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'Exportação e importação CSV compatíveis. Colunas: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'Exportar CSV';

  @override
  String get featuresDataTransferExporting => 'Exportando...';

  @override
  String get featuresDataTransferChooseCsv => 'Escolher CSV para importar';

  @override
  String get featuresDataTransferImporting => 'Importando...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'Importação concluída: $count registros';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'Ignorados: $count registros';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'Categorias criadas automaticamente: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'Contas criadas automaticamente: $items';
  }

  @override
  String get featuresDataTransferWarning => 'Aviso';

  @override
  String get featuresDataTransferError => 'Erro';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'Linha $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'Contas';

  @override
  String get featuresDataTransferModulesTransactions => 'Transações';

  @override
  String get featuresDataTransferModulesCategories => 'Categorias';

  @override
  String get featuresDataTransferModulesStockTransactions =>
      'Transações de ações';

  @override
  String get featuresDataTransferModulesStockDividends => 'Dividendos';

  @override
  String get featuresDataTransferMessagesExportSuccess =>
      'Exportação concluída';

  @override
  String get featuresDataTransferMessagesExportFailed =>
      'Não foi possível exportar';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'O CSV não tem dados para importar';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return 'Importação de $name concluída';
  }

  @override
  String get featuresDataTransferMessagesImportFailed =>
      'Não foi possível importar';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'Backup completo baixado';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'Não foi possível baixar o backup completo';

  @override
  String get featuresDataTransferMessagesRestoreDone => 'Restauração concluída';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'Não foi possível restaurar o backup';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'Backup do banco baixado';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'Falha no backup do banco';

  @override
  String get featuresDataTransferMessagesDbRestoreDone => 'Banco restaurado';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'Não foi possível restaurar o banco';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'Enviado para $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'Falha no backup MEGA S4';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'Preencha pelo menos um campo';

  @override
  String get featuresDataTransferMessagesSaved => 'Configurações salvas';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'Não foi possível salvar as configurações';

  @override
  String get featuresDataTransferBundleTitle =>
      'Backup completo de dados (inclui imagens)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'Baixe em um único ZIP todos os seus dados pessoais: transações, contas, categorias, orçamentos, ciclos, câmbio, ações e imagens de comprovantes.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'Envie o mesmo ZIP para restaurar.';

  @override
  String get featuresDataTransferBundleRestorePrefix => 'A restauração usa';

  @override
  String get featuresDataTransferBundleMergeMode => 'modo de mesclagem';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ': dados existentes são ignorados automaticamente e apenas o que falta é reposto;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'seus dados atuais não são excluídos nem sobrescritos';

  @override
  String get featuresDataTransferBundleDownload => 'Baixar backup completo';

  @override
  String get featuresDataTransferBundleDownloading => 'Preparando download...';

  @override
  String get featuresDataTransferBundleRestore =>
      'Enviar backup para restaurar';

  @override
  String get featuresDataTransferBundleRestoring => 'Restaurando...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'Backup / restauração completa do banco';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'Somente administradores. No modo SQLite baixa um backup `.db`; no PostgreSQL, um backup `.sql`. Para restaurar, envie o formato correspondente.';

  @override
  String get featuresDataTransferDatabaseDownload => 'Baixar backup do banco';

  @override
  String get featuresDataTransferDatabaseDownloading => 'Baixando...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'Escolher backup para restaurar';

  @override
  String get featuresDataTransferDatabaseRestoring => 'Restaurando...';

  @override
  String get featuresDataTransferMegaTitle => 'Backup em nuvem MEGA S4';

  @override
  String get featuresDataTransferMegaDescription =>
      'Envia o backup SQLite completo atual como objeto para um bucket MEGA S4. A conexão vem das variáveis de ambiente do servidor; chaves não são digitadas nem exibidas no navegador.';

  @override
  String get featuresDataTransferMegaState => 'Status: ';

  @override
  String get featuresDataTransferMegaConfigured => 'Configurado';

  @override
  String get featuresDataTransferMegaNotConfigured => 'Configuração incompleta';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'Variáveis de ambiente ausentes: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'Enviar backup para MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'Enviando...';

  @override
  String get featuresDataTransferMegaConfigure => 'Configurar';

  @override
  String get featuresDataTransferMegaCancelConfigure => 'Cancelar configuração';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'As configurações são gravadas em um arquivo persistente do servidor e entram em vigor imediatamente. Digite as chaves novamente; elas não são preenchidas automaticamente.';

  @override
  String get featuresDataTransferMegaBucketName => 'Nome do bucket';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefixo (opcional)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (opcional; vazio para calcular automaticamente)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'Salvar configurações';

  @override
  String get featuresAccountsTitle => 'Contas';

  @override
  String get featuresAccountsTypeLabelsBank => 'Conta bancária';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'Cartão de crédito';

  @override
  String get featuresAccountsTypeLabelsCash => 'Dinheiro';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'Carteira digital';

  @override
  String get featuresAccountsTypeLabelsOther => 'Outra';

  @override
  String get featuresAccountsTotalAssets => 'Ativos totais';

  @override
  String get featuresAccountsCreditOutstanding => 'Fatura em aberto';

  @override
  String get featuresAccountsAddAccount => 'Adicionar conta';

  @override
  String get featuresAccountsEditAccount => 'Editar conta';

  @override
  String get featuresAccountsNewAccount => 'Adicionar conta';

  @override
  String get featuresAccountsAccountName => 'Nome da conta *';

  @override
  String get featuresAccountsInitialBalance => 'Saldo inicial';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'Saldo inicial / configuração atual';

  @override
  String get featuresAccountsLinkedBank => 'Banco';

  @override
  String get featuresAccountsUngrouped => 'Sem grupo';

  @override
  String get featuresAccountsOverseasFeeRate => 'Taxa internacional (%)';

  @override
  String get featuresAccountsStatementClosingDay => 'Dia de fechamento (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'Exemplo: 15. Em branco não calcula o gasto do ciclo atual.';

  @override
  String get featuresAccountsExcludeFromTotal => 'Excluir dos ativos totais';

  @override
  String get featuresAccountsOtherAccounts => 'Outras contas';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'Total convertido: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'Banco vinculado: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'Taxa internacional: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'Dia de fechamento mensal: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'Gasto do ciclo atual: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'Fatura anterior: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'Gasto $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'Pago $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'Ver detalhe dos ciclos ›';

  @override
  String get featuresAccountsRepaymentTitle => 'Pagamento de cartão de crédito';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'Conta de pagamento';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'Data de pagamento';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'Este banco não tem cartões vinculados';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'Saldo atual: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'Valor do pagamento';

  @override
  String get featuresAccountsRepaymentConfirm => 'Confirmar pagamento';

  @override
  String get featuresAccountsDeleteMessage => 'Excluir esta conta?';

  @override
  String get featuresAccountsCyclesTitle => 'Detalhes dos ciclos de fatura';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name dia de fechamento mensal $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'Pagamentos são vinculados à fatura que quitam. Valores pagos após o fechamento contam para esse ciclo.';

  @override
  String get featuresAccountsCyclesPeriod => 'Período';

  @override
  String get featuresAccountsCyclesSpending => 'Gasto';

  @override
  String get featuresAccountsCyclesPayment => 'Pagamento real';

  @override
  String get featuresAccountsCyclesCurrent => 'Atual';

  @override
  String get featuresAccountsFxTitle => 'Gestão de câmbio';

  @override
  String get featuresAccountsFxAutoUpdate => 'Atualizar câmbio automaticamente';

  @override
  String get featuresAccountsFxSyncNow => 'Sincronizar agora';

  @override
  String get featuresAccountsFxSyncing => 'Sincronizando...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'Última sincronização: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'Moeda';

  @override
  String get featuresAccountsFxUnitToTwd => '1 unidade = TWD';

  @override
  String get featuresAccountsFxEmpty => 'Nenhum câmbio estrangeiro configurado';

  @override
  String get featuresAccountsFxCurrencyLabel => 'Moeda (ex.: USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'Câmbio para TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'Adicionar / atualizar';

  @override
  String get featuresAccountsMessagesNameRequired => 'Digite o nome da conta';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'Selecione a conta de pagamento';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'Informe o pagamento de pelo menos um cartão';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'A moeda deve ser um código de 3 letras';

  @override
  String get featuresAccountsMessagesRateInvalid =>
      'Digite uma taxa de câmbio válida';

  @override
  String get featuresAccountsMessagesSaved => 'Salvo';

  @override
  String get featuresAccountsMessagesSaveFailed => 'Não foi possível salvar';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'Não foi possível excluir';

  @override
  String get featuresAccountsMessagesRatesUpdated => 'Câmbio atualizado';

  @override
  String get featuresAccountsMessagesSyncFailed =>
      'Não foi possível sincronizar';

  @override
  String get featuresAccountsMessagesLoadFailed => 'Não foi possível carregar';

  @override
  String get featuresTransactionsTitle => 'Transações';

  @override
  String get featuresTransactionsSearchPlaceholder => 'Buscar observações...';

  @override
  String get featuresTransactionsAllTypes => 'Todos os tipos';

  @override
  String get featuresTransactionsAllAccounts => 'Todas as contas';

  @override
  String get featuresTransactionsAllCategories => 'Todas as categorias';

  @override
  String get featuresTransactionsTransfer => 'Transferência';

  @override
  String get featuresTransactionsFuture => 'Transações futuras';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (tudo)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'Data inicial';

  @override
  String get featuresTransactionsEndDateTitle => 'Data final';

  @override
  String get featuresTransactionsAdd => 'Adicionar transação';

  @override
  String get featuresTransactionsEdit => 'Editar transação';

  @override
  String get featuresTransactionsCreate => 'Adicionar transação';

  @override
  String get featuresTransactionsAccountTransfer =>
      'Transferência entre contas';

  @override
  String get featuresTransactionsBatchCategory => 'Alterar categoria em lote';

  @override
  String get featuresTransactionsBatchDate => 'Alterar data em lote';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'Excluir selecionadas ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'Receitas da página';

  @override
  String get featuresTransactionsPageExpense => 'Despesas da página';

  @override
  String get featuresTransactionsPageTotal => 'Total da página';

  @override
  String get featuresTransactionsPageSummaryAria =>
      'Resumo de transações da página';

  @override
  String get featuresTransactionsEmpty => 'Nenhuma transação encontrada';

  @override
  String featuresTransactionsSource(Object name) {
    return 'Origem: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'Taxa de cartão internacional';

  @override
  String get featuresTransactionsPhotoOne => 'Foto 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count fotos';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'Data *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'Valor *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'Câmbio (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'Em branco usa o câmbio do sistema';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'Consultando câmbio mais recente...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'Em branco o sistema calcula pela taxa do cartão';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'Taxa internacional do cartão $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', sugerido NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'Fotos';

  @override
  String get featuresTransactionsLoadingPhotos => 'Carregando fotos...';

  @override
  String get featuresTransactionsTakePhoto => 'Tirar foto';

  @override
  String get featuresTransactionsChooseImage => 'Escolher imagem';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'No celular, tire uma foto ou escolha da galeria. Até 5 imagens, $maxMb MB cada.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'Novas fotos $count';
  }

  @override
  String get featuresTransactionsRemove => 'Remover';

  @override
  String get featuresTransactionsChoosePhoto => 'Escolher foto';

  @override
  String get featuresTransactionsTransferOut => 'Conta origem *';

  @override
  String get featuresTransactionsTransferIn => 'Conta destino *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'Selecionar';

  @override
  String get featuresTransactionsCreating => 'Criando...';

  @override
  String get featuresTransactionsConfirmTransfer => 'Confirmar transferência';

  @override
  String get featuresTransactionsBatchCategoryTitle =>
      'Alterar categoria em lote';

  @override
  String get featuresTransactionsBatchDateTitle => 'Alterar data em lote';

  @override
  String get featuresTransactionsNewCategory => 'Nova categoria';

  @override
  String get featuresTransactionsNewDate => 'Nova data';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'Aplicar a $count registros';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'Excluir esta transação? Esta ação não pode ser desfeita.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'Excluir as $count transações selecionadas?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'Transação atualizada, mas $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'Transação criada, mas $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'Transferências devem ser excluídas e recriadas';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'Taxas de cartão internacional são geradas automaticamente. Edite a transação em moeda estrangeira relacionada; a taxa será sincronizada depois.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'Falha ao enviar foto';

  @override
  String get featuresTransactionsMessagesDateRequired => 'Selecione uma data';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'Digite um valor válido';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'Selecione a conta origem e a conta destino';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'Conta origem e destino não podem ser iguais';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'Receita';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'Despesa';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in =>
      'Transferência recebida';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out =>
      'Transferência enviada';

  @override
  String get featuresStocksTabsPortfolio => 'Carteira';

  @override
  String get featuresStocksTabsTransactions => 'Transações';

  @override
  String get featuresStocksTabsDividends => 'Dividendos';

  @override
  String get featuresStocksTabsRealized => 'P/L realizado';

  @override
  String get featuresStocksTabsSettings => 'Configurações de negociação';

  @override
  String get featuresStocksCommonStockLabel => 'Ação';

  @override
  String get featuresStocksCommonStockRequired => 'Ação *';

  @override
  String get featuresStocksCommonStockTypeStock => 'Ação';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'Warrant';

  @override
  String get featuresStocksCommonDate => 'Data';

  @override
  String get featuresStocksCommonShares => 'Ações';

  @override
  String get featuresStocksCommonPrice => 'Preço';

  @override
  String get featuresStocksCommonTotal => 'Total';

  @override
  String get featuresStocksCommonReturnRate => 'Retorno';

  @override
  String get featuresStocksCommonOverallReturnRate => 'Retorno total';

  @override
  String get featuresStocksCommonEstimatedPL => 'P/L estimado';

  @override
  String get featuresStocksCommonRealizedPL => 'P/L realizado';

  @override
  String get featuresStocksCommonTotalRealizedPL => 'P/L realizado total';

  @override
  String get featuresStocksCommonYearRealizedPL => 'P/L realizado no ano';

  @override
  String get featuresStocksCommonRealizedCount => 'Registros realizados';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count registros';
  }

  @override
  String get featuresStocksCommonSellAverage => 'Preço médio de venda';

  @override
  String get featuresStocksCommonCostAverage => 'Custo médio';

  @override
  String get featuresStocksCommonFeeAndTax => 'Taxas + imposto';

  @override
  String get featuresStocksCommonCashDividend => 'Dividendo em dinheiro';

  @override
  String get featuresStocksCommonStockDividend => 'Dividendo em ações';

  @override
  String get featuresStocksCommonStockSymbol => 'Código da ação *';

  @override
  String get featuresStocksCommonStockName => 'Nome da ação';

  @override
  String get featuresStocksCommonSearching => 'Buscando...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- Não depositar (somente dividendo em ações) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'Calcular automaticamente';

  @override
  String get featuresStocksCommonBuy => 'Comprar';

  @override
  String get featuresStocksCommonSell => 'Vender';

  @override
  String get featuresStocksPortfolioTitle => 'Carteira';

  @override
  String get featuresStocksPortfolioTotalMarketValue =>
      'Valor total de mercado';

  @override
  String get featuresStocksPortfolioTotalCost => 'Custo total investido';

  @override
  String get featuresStocksPortfolioTotalDividend => 'Dividendos totais';

  @override
  String get featuresStocksPortfolioAddStock => 'Adicionar ação';

  @override
  String get featuresStocksPortfolioEditStock => 'Editar ação';

  @override
  String get featuresStocksPortfolioNewStock => 'Adicionar ação';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'Atualizar preços';

  @override
  String get featuresStocksPortfolioBatchUpdate =>
      'Atualização automática em lote';

  @override
  String get featuresStocksPortfolioUpdating => 'Atualizando...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'O AssetPilot consulta primeiro a API pública da TWSE pelo navegador. Se a solicitação for bloqueada, usa o proxy da API do usuário autenticado e atualiza suas posições.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'Atualização concluída: $updated com sucesso.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'Atualização concluída: $updated com sucesso, $failed falharam.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'Não foi possível obter dados da TWSE pelo navegador';

  @override
  String get featuresStocksPortfolioHeldShares => 'Ações mantidas';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count ações';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'Preço atual';

  @override
  String get featuresStocksPortfolioMarketValue => 'Valor de mercado';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired =>
      'Digite o código da ação';

  @override
  String get featuresStocksTransactionsTitle => 'Transações de ações';

  @override
  String get featuresStocksTransactionsAddTransaction => 'Adicionar transação';

  @override
  String get featuresStocksTransactionsEditTransaction => 'Editar transação';

  @override
  String get featuresStocksTransactionsNewTransaction => 'Adicionar transação';

  @override
  String get featuresStocksTransactionsTypeLabel => 'Tipo';

  @override
  String get featuresStocksTransactionsDateLabel => 'Data *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'Ações *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'Preço unitário *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'Taxa';

  @override
  String get featuresStocksTransactionsTaxLabel => 'Imposto da transação';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      'Excluir esta transação?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired =>
      'Selecione uma ação';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'Digite uma quantidade válida de ações';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'Digite um preço válido';

  @override
  String get featuresStocksDividendsTitle => 'Dividendos';

  @override
  String get featuresStocksDividendsAddDividend => 'Adicionar dividendo';

  @override
  String get featuresStocksDividendsEditDividend => 'Editar dividendo';

  @override
  String get featuresStocksDividendsNewDividend => 'Adicionar dividendo';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'Sincronizar ex-dividendos';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'Sincroniza automaticamente dados históricos de ex-dividendos da TWSE com base nas suas posições.';

  @override
  String get featuresStocksDividendsSyncStart => 'Iniciar sincronização';

  @override
  String get featuresStocksDividendsSyncing => 'Sincronizando...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '$synced adicionados, $skipped ignorados.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '$synced adicionados, $skipped ignorados, $failed falharam.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel =>
      'Dividendo em dinheiro (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => 'Dividendo em ações';

  @override
  String get featuresStocksDividendsDepositAccount => 'Conta de depósito';

  @override
  String get featuresStocksDividendsDeleteMessage => 'Excluir este dividendo?';

  @override
  String get featuresStocksDividendsMessagesStockRequired =>
      'Selecione uma ação';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'Digite dividendo em dinheiro ou em ações';

  @override
  String get featuresStocksRealizedTitle => 'P/L realizado';

  @override
  String get featuresStocksSettingsTitle => 'Configurações de negociação';

  @override
  String get featuresStocksSettingsFeeTitle => 'Taxas / imposto de transação';

  @override
  String get featuresStocksSettingsFeeRate => 'Taxa de corretagem';

  @override
  String get featuresStocksSettingsFeeDiscount => 'Desconto (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot => 'Taxa mínima (lote padrão)';

  @override
  String get featuresStocksSettingsFeeMinOdd =>
      'Taxa mínima (lote fracionário)';

  @override
  String get featuresStocksSettingsSellTaxRateStock =>
      'Imposto de venda (ação)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'Imposto de venda (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'Imposto de venda (warrant)';

  @override
  String get featuresStocksSettingsSellTaxMin => 'Imposto mínimo de transação';

  @override
  String get featuresStocksSettingsSaveSettings => 'Salvar configurações';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'Status das ações';

  @override
  String get featuresStocksSettingsCurrentPrice => 'Preço atual';

  @override
  String get featuresStocksSettingsNormalTracking => 'Acompanhamento normal';

  @override
  String get featuresStocksSettingsDelisted => 'Deslistada';

  @override
  String get featuresStocksSettingsRestoreTracking =>
      'Restaurar acompanhamento';

  @override
  String get featuresStocksSettingsMarkDelisted => 'Marcar como deslistada';

  @override
  String get featuresStocksSettingsRecurringTitle =>
      'Investimento recorrente em ações';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'Adicionar';

  @override
  String get featuresStocksSettingsEditRecurring =>
      'Editar investimento recorrente';

  @override
  String get featuresStocksSettingsNewRecurring =>
      'Adicionar investimento recorrente';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'Valor (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'Frequência';

  @override
  String get featuresStocksSettingsStartDate => 'Data inicial';

  @override
  String get featuresStocksSettingsLastGenerated => 'Última geração';

  @override
  String get featuresStocksSettingsActive => 'Ativo';

  @override
  String get featuresStocksSettingsInactive => 'Inativo';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'Excluir este investimento recorrente?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'Diário';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'Semanal';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'Mensal';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'Anual';

  @override
  String get featuresStocksSettingsMessagesSaved => 'Configurações salvas';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'Não foi possível salvar: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired =>
      'Selecione uma ação';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'Digite um valor válido';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol foi $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'restaurada para acompanhamento normal';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'marcada como deslistada';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'Não foi possível atualizar o status de deslistagem';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily =>
      'Relatório diário de fluxo de caixa';

  @override
  String get notificationsReportTypeWeekly =>
      'Relatório semanal de fluxo de caixa';

  @override
  String get notificationsReportTypeMonthly =>
      'Relatório mensal de fluxo de caixa';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'Relatório diário de fluxo de caixa｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'Relatório semanal de fluxo de caixa｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'Relatório mensal de fluxo de caixa｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, fluxo de caixa de $date ($weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, fluxo de caixa de $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, fluxo de caixa de $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 Data do relatório $date　·　Enviado em $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 Período do relatório $start ~ $end　·　Enviado em $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 Mês do relatório $month　·　Enviado em $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'Resumo de ontem inteiro ($date, $weekday); enviado hoje ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'Resumo dos últimos 7 dias ($start ~ $end); enviado hoje ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'Resumo do mês passado ($month, $start ~ $end); enviado neste mês ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'Ontem';

  @override
  String get notificationsLeadWeekly => 'Esta semana';

  @override
  String get notificationsLeadMonthly => 'Mês passado';

  @override
  String notificationsKpiIncome(Object lead) {
    return 'Receitas de $lead';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return 'Despesas de $lead';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return 'Líquido de $lead';
  }

  @override
  String get notificationsCompareLabelDaily => 'vs. dia anterior';

  @override
  String get notificationsCompareLabelWeekly => 'vs. semana anterior';

  @override
  String get notificationsCompareLabelMonthly => 'vs. mês anterior';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'ontem ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'últimos 7 dias ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'mês passado ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'Saldos das contas';

  @override
  String get notificationsSectionsTopCategories => 'Top 5 despesas deste mês';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'Top 5 despesas em $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'Detalhe diário';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'Acumulado do mês ($month)';
  }

  @override
  String get notificationsSectionsStock => 'Investimentos em ações';

  @override
  String get notificationsSectionsRecentDaily => 'Transações de ontem';

  @override
  String get notificationsSectionsRecentWeekly => 'Transações desta semana';

  @override
  String get notificationsSectionsRecentMonthly => 'Transações do mês passado';

  @override
  String get notificationsLabelsIncome => 'Receitas';

  @override
  String get notificationsLabelsExpense => 'Despesas';

  @override
  String get notificationsLabelsNet => 'Líquido';

  @override
  String get notificationsLabelsCost => 'Custo total';

  @override
  String get notificationsLabelsMarketValue => 'Valor de mercado';

  @override
  String get notificationsLabelsUnrealizedPL => 'P/L não realizado';

  @override
  String get notificationsLabelsReturnRate => 'Retorno';

  @override
  String get notificationsLabelsUncategorized => 'Sem categoria';

  @override
  String get notificationsTableDate => 'Data';

  @override
  String get notificationsEmptyNoAccount => 'Ainda não há contas';

  @override
  String get notificationsEmptyNoExpense => 'Ainda não há despesas';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'Nenhuma transação para $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'Ações: valor de mercado $marketValue, P/L não realizado $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'Ver relatório completo';

  @override
  String get notificationsCtaViewLineRecord => 'Ver registros do LINE';

  @override
  String get notificationsReminderAltText => 'Lembrete de despesa';

  @override
  String get notificationsReminderTitle =>
      'Não esqueça de registrar as despesas de hoje';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, leve 10 segundos para registrar os gastos de hoje e não deixar nada passar no fechamento do mês.';
  }

  @override
  String get notificationsReminderHint =>
      'Toque em Adicionar despesa e digite: valor observação data (a data é opcional)';

  @override
  String get notificationsReminderFallbackName => 'olá';

  @override
  String get notificationsReminderAddExpense => 'Adicionar despesa';

  @override
  String get notificationsReminderViewToday => 'Ver registros de hoje';

  @override
  String get notificationsFallbackUser => 'Usuário';

  @override
  String get mobileLegacyMessagebde18a20 => '・Excluído dos ativos totais';

  @override
  String get mobileLegacyNoneCreateAsParent =>
      '(Nenhuma, criar como categoria pai)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'A tela inicial mostra receitas, despesas, saldo líquido e categorias por mês. Alterne entre meses para entender para onde o dinheiro foi.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'Os pagamentos são vinculados à fatura que quitam, mesmo quando pagos no ciclo seguinte após o fechamento.';

  @override
  String get mobileLegacy0NoPayment => '0 = não pagar';

  @override
  String get mobileLegacyMon => 'Seg';

  @override
  String get mobileLegacyStock => 'Ação comum';

  @override
  String get mobileLegacyStocks => 'Ações comuns (%)';

  @override
  String get mobileLegacyTue => 'Ter';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Conta de depósito (obrigatória para dividendos em dinheiro)';

  @override
  String get mobileLegacyWed => 'Qua';

  @override
  String get mobileLegacyPreviousStatement => 'Fatura anterior ';

  @override
  String get mobileLegacyNext => 'Próximo';

  @override
  String get mobileLegacyDelisted => 'Deslistada';

  @override
  String get mobileLegacySubcategory => 'Subcategoria';

  @override
  String get mobileLegacyDeleted => 'Excluído';

  @override
  String get mobileLegacyUpdated => 'Atualizado';

  @override
  String get mobileLegacyLinked => 'Vinculado';

  @override
  String get mobileLegacyUnlinked => 'Desvinculado';

  @override
  String get mobileLegacyTotalRealizedPL => 'P/L realizado total';

  @override
  String get mobileLegacyFri => 'Sex';

  @override
  String get mobileLegacyStandardRate01 => 'Taxa padrão: 0,1%';

  @override
  String get mobileLegacyStandardRate03 => 'Taxa padrão: 0,3%';

  @override
  String get mobileLegacySat => 'Sáb';

  @override
  String get mobileLegacyCategoryName => 'Nome da categoria';

  @override
  String get mobileLegacyFeeOptional => 'Comissão (opcional)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Deixe comissão e imposto em branco para calcular automaticamente';

  @override
  String get mobileLegacyCommissionRate => 'Taxa de comissão (%)';

  @override
  String get mobileLegacyDay => 'Dom';

  @override
  String get mobileLegacyMonthlyBudget => 'Orçamento mensal';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'Categoria pai (não selecione para criar uma categoria pai)';

  @override
  String get mobileLegacyTheme => 'Tema';

  @override
  String get mobileLegacyThu => 'Qui';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'Categoria desconhecida';

  @override
  String get mobileLegacyNotLinked => 'Não vinculado';

  @override
  String get mobileLegacyNoTransactionsThisMonth =>
      'Nenhuma transação neste mês';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'Nenhum orçamento neste mês';

  @override
  String get mobileLegacyNetThisMonth => 'Saldo líquido do mês';

  @override
  String get mobileLegacyPositiveWholeNumber => 'Número inteiro positivo';

  @override
  String get mobileLegacyDeletePermanently => 'Excluir permanentemente';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'Excluir a conta e todos os dados permanentemente';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'Nenhuma nota de atualização disponível';

  @override
  String get mobileLegacyCurrentDevice => 'Dispositivo atual';

  @override
  String get mobileLegacyTransactions => 'Transações';

  @override
  String get mobileLegacyAll => 'Tudo';

  @override
  String get mobileLegacyAllCategories => 'Todas as categorias';

  @override
  String get mobileLegacyAllAccounts => 'Todas as contas';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'Pagamento de cada cartão (na moeda do cartão)';

  @override
  String get mobileLegacySyncDividends => 'Sincronizar dividendos';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'Nome (opcional; preenchido automaticamente se vazio)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'Na aba Ações, informe um código como 2330 para acompanhar preços, P/L realizado e não realizado, e sincronizar dividendos automaticamente.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'Na aba Transações, toque em + para adicionar receitas ou despesas. Há suporte a várias moedas e transferências entre contas. Deslize para a esquerda para excluir ou toque para editar.';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'Sem dados neste período';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'Esta ação excluirá permanentemente sua conta e todos os dados, incluindo transações, contas, ações e configurações. Não é possível desfazer.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Personalizar envio programado de relatórios';

  @override
  String get mobileLegacyAutomatic => 'Automático';

  @override
  String get mobileLegacyAtLeast8Characters => 'Pelo menos 8 caracteres';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'Pelo menos 8 caracteres com maiúsculas, minúsculas, números e símbolos';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'Seu companheiro de finanças pessoais para transações, orçamentos, ações de Taiwan e relatórios. Leva só um minuto para conhecer o essencial.';

  @override
  String get mobileLegacyDeletePasskey => 'Excluir Passkey';

  @override
  String get mobileLegacyDeleteCategory => 'Excluir categoria';

  @override
  String get mobileLegacyDeleteTransaction => 'Excluir transação';

  @override
  String get mobileLegacyDeleteDividend => 'Excluir dividendo';

  @override
  String get mobileLegacyDeleteStock => 'Excluir ação';

  @override
  String get mobileLegacyDeleteAccount => 'Excluir conta';

  @override
  String get mobileLegacyDeleteSchedule => 'Excluir agendamento';

  @override
  String get mobileLegacyDeletePhoto => 'Excluir foto';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'A conta de depósito é obrigatória para dividendos em dinheiro';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'Nenhuma transação corresponde aos filtros';

  @override
  String get mobileLegacyDiscount01 => 'Desconto (0-1)';

  @override
  String get mobileLegacyImproved => 'Melhorado';

  @override
  String get mobileLegacyMore => 'Mais';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'Atualizado';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'Último dia de cada mês';

  @override
  String get mobileLegacyNoPricesToUpdate => 'Nenhum preço para atualizar';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'Nenhum dividendo novo para sincronizar';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'Usuário saiu; login local limpo';

  @override
  String get mobileLegacyGettingStarted => 'Primeiros passos';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'Exemplo: 0,6 significa 40% de desconto';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'Ex.: 1,5 significa 1,5%; a taxa é calculada automaticamente em compras em moeda estrangeira';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'Em Mais, defina orçamentos mensais, veja relatórios, gerencie contas e categorias, programe transações recorrentes e notificações. Quando estiver pronto, comece a registrar.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Taxa padrão da corretora: 0,1425%';

  @override
  String get mobileLegacyNotSentYet => 'Ainda não enviado';

  @override
  String get mobileLegacyNoRealizedReturns => 'Nenhum P/L realizado';

  @override
  String get mobileLegacyNoCategoriesYet => 'Ainda não há categorias';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'Nenhuma transação ainda. Toque no botão inferior direito para começar.';

  @override
  String get mobileLegacyNoRecurringTransactions =>
      'Nenhuma transação recorrente';

  @override
  String get mobileLegacyNoDividendRecords => 'Nenhum registro de dividendos';

  @override
  String get mobileLegacyNoStockTransactions => 'Nenhuma transação de ações';

  @override
  String get mobileLegacyNoHoldingsYet => 'Nenhuma posição ainda';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'Nenhum histórico de acesso';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'Conclua o registro no navegador (requer biometria do dispositivo)';

  @override
  String get mobileLegacyNotice => 'Aviso';

  @override
  String get mobileLegacyDividends => 'Dividendos';

  @override
  String get mobileLegacyDividendSyncCompleted => 'Dividendos sincronizados';

  @override
  String get mobileLegacyTickerEG2330 => 'Ticker (ex.: 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'Valor de mercado das ações';

  @override
  String get mobileLegacyHoldings => 'Carteira';

  @override
  String get mobileLegacyDayOfWeek => 'Dia da semana';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'Ver versão atual e notas de atualização';

  @override
  String get mobileLegacyRename => 'Renomear';

  @override
  String get mobileLegacyCheckAgain => 'Verificar novamente';

  @override
  String get mobileLegacyRetry => 'Tentar novamente';

  @override
  String get mobileLegacyHome => 'Início';

  @override
  String get mobileLegacyFixed => 'Corrigido';

  @override
  String get mobileLegacyApply => 'Aplicar';

  @override
  String get mobileLegacyTime => 'Horário';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'Tarifa internacional em TWD (opcional)';

  @override
  String get mobileLegacyAddTransaction => 'Adicionar transação';

  @override
  String get mobileLegacyTransactions8084a8ea => 'Transações';

  @override
  String get mobileLegacyStartDate => 'Data inicial';

  @override
  String get mobileLegacyTrackTaiwanStocks => 'Acompanhe ações de Taiwan';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Ações recebidas como dividendo (opcional)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Tarifas de cartão no exterior são geradas automaticamente. Edite a transação estrangeira correspondente.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'A senha deve ter pelo menos 8 caracteres';

  @override
  String get mobileLegacyAccountName => 'Nome da conta';

  @override
  String get mobileLegacyAccountDeleted => 'Conta excluída';

  @override
  String get mobileLegacyAccountSecurity => 'Segurança da conta';

  @override
  String get mobileLegacyLinkedAccounts => 'Contas vinculadas';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => 'Moedas frequentes';

  @override
  String get mobileLegacyChooseFromGallery => 'Escolher da galeria';

  @override
  String get mobileLegacyEnabled => 'Ativado';

  @override
  String get mobileLegacyDark => 'Escuro';

  @override
  String get mobileLegacyLight => 'Claro';

  @override
  String get mobileLegacyClearDates => 'Limpar datas';

  @override
  String get mobileLegacyClearFilters => 'Limpar filtros';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Dividendo em dinheiro (total, opcional)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Informe dividendo em dinheiro ou em ações';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'Ao definir, o cartão da conta mostra os gastos do ciclo atual; vazio não calcula';

  @override
  String get mobileLegacyNoteOptional => 'Nota (opcional)';

  @override
  String get mobileLegacyNoteKeyword => 'Palavra-chave da nota';

  @override
  String get mobileLegacyMinimumTransactionTax => 'Imposto mínimo de transação';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'Até 5 fotos por transação';

  @override
  String get mobileLegacyReportNotifications => 'Notificações de relatório';

  @override
  String get mobileLegacySeeYourCompleteCashFlow =>
      'Veja todo o seu fluxo de caixa';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser =>
      'Não foi possível abrir o navegador';

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
      'A sessão expirou. Entre novamente';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'A resposta de login não trouxe o cookie de autenticação. Verifique a configuração do backend';

  @override
  String get mobileLegacySignedIn => 'Login realizado';

  @override
  String get mobileLegacySignInHistory => 'Histórico de acesso';

  @override
  String get mobileLegacySignedInDevices => 'Dispositivos conectados';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'Não foi possível conectar para entrar';

  @override
  String get mobileLegacyEndDate => 'Data final';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'A resposta de cadastro não trouxe o cookie de autenticação. Verifique a configuração do backend';

  @override
  String get mobileLegacySignUpAndSignIn => 'Criar conta e entrar';

  @override
  String get mobileLegacyBuy => 'Comprar';

  @override
  String get mobileLegacyFrequency => 'Frequência';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'A taxa de câmbio deve ser maior que 0';

  @override
  String get mobileLegacyReturns => 'P/L';

  @override
  String get mobileLegacyAddPasskey => 'Adicionar Passkey';

  @override
  String get mobileLegacyAddStockTransaction => 'Adicionar transação de ações';

  @override
  String get mobileLegacyAddSchedule => 'Adicionar agendamento';

  @override
  String get mobileLegacyAddReportSchedule =>
      'Adicionar agendamento de relatório';

  @override
  String get mobileLegacyAddPhotosOptional => 'Adicionar fotos (opcional)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'Falha ao carregar foto';

  @override
  String get mobileLegacyLink => 'Vincular';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'A vinculação é autorizada no navegador. Antes de desvincular, confirme que ainda há outra forma de entrar.';

  @override
  String get mobileLegacyUnlink => 'Desvincular';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'Finanças pessoais · App Android';

  @override
  String get mobileLegacySkip => 'Pular';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'Comissão mínima para lote fracionário';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'E-mail ou senha incorretos';

  @override
  String get mobileLegacyDefaultCurrency => 'Moeda padrão';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Moeda padrão e moedas frequentes';

  @override
  String get mobileLegacyBudgets => 'Orçamentos';

  @override
  String get mobileLegacyBudgetsReportsAndMore =>
      'Orçamentos, relatórios e mais';

  @override
  String get mobileLegacyBudgetAmount => 'Valor do orçamento';

  @override
  String get mobileLegacyCurrencySettings => 'Configurações de moeda';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'Idioma do app, notificações e web';

  @override
  String get mobileLegacyBank => 'Banco';

  @override
  String get mobileLegacyBankBalance => 'Saldo bancário';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'Requer uma conta LINE vinculada';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'É preciso ter ao menos um cartão de crédito e uma conta que não seja cartão para registrar o pagamento';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'Inclua maiúsculas, minúsculas, números e símbolos';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'Inclua maiúsculas, minúsculas, números e símbolos';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'Excluir este agendamento de relatório?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'Excluir esta foto enviada? Esta ação não pode ser desfeita.';

  @override
  String get mobileLegacyEditStockTransaction => 'Editar transação de ações';

  @override
  String get mobileLegacyEditReportSchedule =>
      'Editar agendamento de relatório';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'Conclua primeiro a verificação abaixo';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'Adicione uma ação na aba Carteira primeiro';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'Selecione primeiro uma categoria pai';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'Informe o pagamento de pelo menos um cartão';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'Selecione pelo menos um método de notificação';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'Informe um número maior ou igual a 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => 'Digite um valor de 1 a 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 =>
      'Informe um valor maior que 0';

  @override
  String get mobileLegacyEnterATicker => 'Informe um ticker';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'Informe um número inteiro positivo';

  @override
  String get mobileLegacyEnterAName => 'Digite um nome';

  @override
  String get mobileLegacyEnterAValidEmailAddress => 'Informe um email válido';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'Informe sua senha para confirmar';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'Informe o email da conta para confirmar';

  @override
  String get mobileLegacyEnterADisplayName => 'Informe um nome de exibição';

  @override
  String get mobileLegacySelectASubcategory => 'Selecione uma subcategoria';

  @override
  String get mobileLegacySelectACategory => 'Selecione uma categoria';

  @override
  String get mobileLegacySelectAParentCategory => 'Selecione uma categoria pai';

  @override
  String get mobileLegacySelectAnAccount => 'Selecione uma conta';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Selecione a conta de destino';

  @override
  String get mobileLegacySell => 'Vender';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'Comissão mínima para lote inteiro';

  @override
  String get mobileLegacyFilter => 'Filtrar';

  @override
  String get mobileLegacyFilterTransactions => 'Filtrar transações';

  @override
  String get mobileLegacyChooseTheme => 'Escolher tema';

  @override
  String get mobileLegacyLogTransactionsInSeconds =>
      'Registre transações em segundos';

  @override
  String get mobileLegacyMarketValue => 'Valor de mercado total';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'Ativos totais (em TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Chinês tradicional / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'Ainda não tem conta? Cadastre-se';

  @override
  String get mobileLegacyPaymentRecorded => 'Pagamento registrado';

  @override
  String get mobileLegacyToAccount => 'Conta de destino';

  @override
  String get mobileLegacyFromAccount => 'Conta de origem';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'As contas de origem e destino devem ser diferentes';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Edite transferências na versão web';

  @override
  String get mobileLegacyTransactionTaxSell => 'Imposto de transação (venda)';

  @override
  String get mobileLegacyTransactionTaxOptional =>
      'Imposto de transação (opcional)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'Tipo (afeta o imposto de transação)';

  @override
  String get mobileLegacyWarrants => 'Warrants (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'Boas-vindas ao AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'Os outros dispositivos serão desconectados após a alteração.';

  @override
  String get mobileLegacyTestSentryConfiguration =>
      'Testar configuração do Sentry';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'A API respondeu 401; a sessão expirou e o login local foi limpo';

  @override
  String get mobileLegacyApiRequestFailed => 'Falha na requisição da API';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'Não foi possível conectar à API';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'A resposta do app não trouxe o cookie de autenticação';

  @override
  String get mobileLegacyEmailNotifications => 'Notificações por email';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'A resposta do Google não trouxe o cookie de autenticação';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'Notificações por LINE';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'A resposta do LINE não trouxe o cookie de autenticação';

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
      'TWD sempre fica incluído. As moedas marcadas aparecem primeiro nas listas de transações e recorrências.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'Dia $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'Último envio: $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'Versão atual v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'A versão v$version está disponível';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'Mensalmente no dia $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'Toda semana: $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'Criado em $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'Idioma atualizado: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'Falha ao carregar: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'Erro inesperado: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return 'Falha ao entrar com $provider: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'Falha ao atualizar preços: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'Falha ao sincronizar dividendos: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'Falha ao enviar foto: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'Falha na requisição (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'Falha ao entrar (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'Não foi possível conectar ao servidor ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return 'Excluir “$name”?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'Desvincular $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'Desvincular $provider?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return 'Vínculo com $provider';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (todos)';
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
    return 'Dados consultados às $time';
  }

  @override
  String get dashboardAttentionTitle => 'Requer atenção';

  @override
  String get dashboardAttentionAllClear => 'Nada precisa da sua atenção agora';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count transações recorrentes precisam de revisão';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count transações sem categoria · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count posições em carteira estão sem preço';
  }

  @override
  String get dashboardDriversTitle => '3 principais fatores do mês';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'O que mais contribui em $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share% deste tipo';
  }

  @override
  String get dashboardPersonalizeTrigger => 'Personalizar início';

  @override
  String get dashboardPersonalizeTitle => 'Personalizar início';

  @override
  String get dashboardPersonalizeDescription =>
      'Escolha os módulos exibidos e organize-os conforme seu uso.';

  @override
  String get dashboardPersonalizeModulesAssets => 'Visão geral dos ativos';

  @override
  String get dashboardPersonalizeModulesAttention => 'Requer atenção';

  @override
  String get dashboardPersonalizeModulesWhyChanged =>
      'Por que o fluxo de caixa mudou';

  @override
  String get dashboardPersonalizeModulesSpending => 'Categorias de despesas';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => 'Saúde da carteira';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'Receitas e transações recentes';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'Mover $module para cima';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'Mover $module para baixo';
  }

  @override
  String get dashboardPersonalizeSaved => 'Layout do painel salvo';

  @override
  String get dashboardPersonalizeSaveError =>
      'Não foi possível salvar o layout do painel';

  @override
  String get dashboardPersonalizeReset => 'Redefinir';

  @override
  String get dashboardPersonalizeApply => 'Aplicar';

  @override
  String get dashboardComparisonTitle => 'Por que o fluxo de caixa mudou';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd comparado a $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'Mês completo comparado a $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'Não há período anterior comparável para este mês.';

  @override
  String get dashboardComparisonNoChanges =>
      'O fluxo de caixa registrado não mudou em relação ao período comparável.';

  @override
  String get dashboardComparisonPreviousNet =>
      'Fluxo de caixa líquido anterior';

  @override
  String get dashboardComparisonNetChange =>
      'Variação do fluxo de caixa líquido';

  @override
  String get dashboardComparisonNewThisPeriod => 'Novo neste período';

  @override
  String get dashboardComparisonIncreased => 'Valor aumentou';

  @override
  String get dashboardComparisonDecreased => 'Valor diminuiu';

  @override
  String get dashboardPortfolioHealthTitle => 'Saúde do custo da carteira';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'Valor atual comparado ao custo FIFO restante';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'Adicione uma posição para ver análises de custo.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'Preços atuais são necessários para esta comparação.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'Não há percentual combinado para posições em várias moedas.';

  @override
  String get dashboardPortfolioHealthMarketValue =>
      'Valor de mercado precificado';

  @override
  String get dashboardPortfolioHealthCost => 'Custo das posições precificadas';

  @override
  String get dashboardPortfolioHealthUnrealizedGross =>
      'Ganho/perda bruto não realizado';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'Maior posição: $name · $share% do valor precificado';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'Compara preços atuais ao custo FIFO registrado. Não é um índice de mercado nem desempenho ponderado pelo tempo.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'Cobertura de preços: $priced de $total posições';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook =>
      'Previsão de caixa programado';

  @override
  String get dashboardPersonalizeModulesSavingsScenario =>
      'Cenário de economia';

  @override
  String get dashboardCashOutlookTitle => 'Próximos 30 dias · caixa programado';

  @override
  String get dashboardCashOutlookSubtitle =>
      'Baseado em lançamentos recorrentes confirmados';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · Estimativa programada';
  }

  @override
  String get dashboardCashOutlookInvalidDate =>
      'Não foi possível calcular o período estimado.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'Adicione uma conta bancária incluída antes de estimar o caixa programado.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'Crie uma receita ou despesa recorrente para ver o caixa programado.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'Revise os lançamentos recorrentes e vincule-os a contas bancárias incluídas.';

  @override
  String get dashboardCashOutlookStartingBalance => 'Saldo bancário até hoje';

  @override
  String get dashboardCashOutlookScheduledNet => 'Variação líquida programada';

  @override
  String get dashboardCashOutlookClosingBalance =>
      'Caixa estimado após 30 dias';

  @override
  String get dashboardCashOutlookLowestBalance => 'Menor caixa estimado';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count ocorrências programadas · Receitas $income · Despesas $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'O caixa combinado estimado pode ficar abaixo de zero';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'Por volta de $date, a estimativa fica $amount abaixo de zero. Revise datas e valores antes de agir.';
  }

  @override
  String get dashboardCashOutlookUpcoming => 'Próximos lançamentos programados';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'Mostrando $shown de $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'Nenhuma ocorrência programada neste período de 30 dias.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '$included de $total lançamentos recorrentes estão cobertos; revise $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'A estimativa combina todas as contas bancárias incluídas com o saldo de hoje e lançamentos recorrentes vinculados confirmados. Ela não mostra possíveis saldos negativos de uma conta nem altera saldos reais; lançamentos vencidos são criados no próximo processamento. As estimativas em TWD usam de forma consistente as taxas atuais.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'O caixa programado pode faltar em $amount por volta de $date';
  }

  @override
  String get dashboardScenarioTitle => 'Cenário de economia';

  @override
  String get dashboardScenarioSubtitle =>
      'Estime o efeito acumulado de um ajuste mensal';

  @override
  String get dashboardScenarioMonthlyAdjustment =>
      'Ajuste mensal de economia (TWD)';

  @override
  String get dashboardScenarioDecrease => 'Diminuir o ajuste mensal em 500';

  @override
  String get dashboardScenarioIncrease => 'Aumentar o ajuste mensal em 500';

  @override
  String get dashboardScenarioHorizon => 'Horizonte de tempo';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count meses';
  }

  @override
  String get dashboardScenarioDifference => 'Diferença acumulada';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'Um ajuste mensal de $monthly por $months meses produz uma diferença acumulada de $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'Cenário simples: ajuste mensal × meses. Exclui juros, retornos de mercado, inflação e impostos e não garante resultado futuro.';
}

/// The translations for Portuguese, as used in Brazil (`pt_BR`).
class AppLocalizationsPtBr extends AppLocalizationsPt {
  AppLocalizationsPtBr() : super('pt_BR');

  @override
  String get commonSave => 'Salvar';

  @override
  String get commonCancel => 'Cancelar';

  @override
  String get commonDelete => 'Excluir';

  @override
  String get commonEdit => 'Editar';

  @override
  String get commonConfirm => 'Confirmar';

  @override
  String get commonClose => 'Fechar';

  @override
  String get commonLoading => 'Carregando…';

  @override
  String get commonAdd => 'Adicionar';

  @override
  String get commonBack => 'Voltar';

  @override
  String get commonSearch => 'Buscar';

  @override
  String get commonLanguage => 'Idioma';

  @override
  String get commonClear => 'Limpar';

  @override
  String get commonSaving => 'Salvando...';

  @override
  String get commonConfirmDelete => 'Confirmar exclusão';

  @override
  String get commonPreviousPage => 'Anterior';

  @override
  String get commonNextPage => 'Próxima';

  @override
  String commonTotalRecords(Object count) {
    return '$count registros';
  }

  @override
  String get commonPerPage => 'Por página';

  @override
  String commonRecordsUnit(Object count) {
    return '$count registros';
  }

  @override
  String get commonNoData => 'Ainda não há dados';

  @override
  String get navSectionsFinance => 'Finanças';

  @override
  String get navSectionsStocks => 'Ações';

  @override
  String get navSectionsSystem => 'Sistema';

  @override
  String get navDashboard => 'Painel';

  @override
  String get navTransactions => 'Transações';

  @override
  String get navReports => 'Relatórios';

  @override
  String get navBudget => 'Orçamentos';

  @override
  String get navInfoBoard => 'Painel de informações';

  @override
  String get navAccounts => 'Contas';

  @override
  String get navCategories => 'Categorias';

  @override
  String get navRecurring => 'Recorrentes';

  @override
  String get navStocksPortfolio => 'Carteira';

  @override
  String get navStocksTransactions => 'Transações de ações';

  @override
  String get navStocksDividends => 'Dividendos';

  @override
  String get navStocksRealized => 'P/L realizado';

  @override
  String get navStocksSettings => 'Configurações de ações';

  @override
  String get navExportImport => 'Exportar / importar';

  @override
  String get navAccount => 'Conta';

  @override
  String get navApiCredits => 'Acesso API';

  @override
  String get navAdmin => 'Admin';

  @override
  String get navTitleStocks => 'Carteira';

  @override
  String get navTitleStockTransactions => 'Transações de ações';

  @override
  String get navTitleStockDividends => 'Dividendos de ações';

  @override
  String get navTitleStockRealized => 'P/L realizado';

  @override
  String get navTitleStockSettings => 'Configurações de negociação de ações';

  @override
  String get navTitleApiCredits => 'Uso e acesso API';

  @override
  String get shellFallbackUser => 'Usuário';

  @override
  String get shellLogout => 'Sair';

  @override
  String get shellVersionInfo => 'Informações da versão';

  @override
  String get shellOpenMenu => 'Abrir menu';

  @override
  String get shellSkipToContent => 'Ir para o conteúdo principal';

  @override
  String get shellThemeLight => 'Claro';

  @override
  String get shellThemeSystem => 'Sistema';

  @override
  String get shellThemeDark => 'Escuro';

  @override
  String get shellChangelogLoading => 'Carregando informações da versão...';

  @override
  String get shellChangelogLoadFailed =>
      'Não foi possível carregar as informações da versão';

  @override
  String get shellChangelogUnknownVersion => 'Desconhecida';

  @override
  String get shellChangelogCurrentVersion => 'Versão atual';

  @override
  String get shellChangelogUpdatableVersion => 'Versão disponível';

  @override
  String get shellChangelogUpToDate => 'Já está atualizado';

  @override
  String get shellChangelogUpdatableContent => 'Conteúdo da atualização';

  @override
  String get shellChangelogRecentContent => 'Atualizações recentes';

  @override
  String get authLoginTab => 'Entrar';

  @override
  String get authRegisterTab => 'Criar conta';

  @override
  String get authSubtitleLogin => 'Que bom te ver de volta. Entre na sua conta';

  @override
  String get authSubtitleRegister => 'Crie sua conta e comece a acompanhar';

  @override
  String get authEmailLabel => 'E-mail';

  @override
  String get authPasswordLabel => 'Senha';

  @override
  String get authPasswordPlaceholder => 'Digite sua senha';

  @override
  String get authDisplayNameLabel => 'Nome de exibição';

  @override
  String get authDisplayNamePlaceholder => 'Seu nome ou apelido';

  @override
  String get authRegisterPasswordPlaceholder =>
      'Pelo menos 8 caracteres, com maiúsculas, minúsculas e números';

  @override
  String get authTogglePassword => 'Mostrar ou ocultar senha';

  @override
  String get authTurnstileAria => 'Verificação humana do Cloudflare Turnstile';

  @override
  String get authLoginButton => 'Entrar';

  @override
  String get authLoggingIn => 'Entrando…';

  @override
  String get authPasskeyButton => 'Entrar com Passkey';

  @override
  String get authPasskeyVerifying => 'Verificando Passkey…';

  @override
  String get authGoogleButton => 'Entrar com Google';

  @override
  String get authGoogleVerifying => 'Verificando Google…';

  @override
  String get authLineButton => 'Entrar com LINE';

  @override
  String get authLineVerifying => 'Verificando LINE…';

  @override
  String get authRegisterSubmit => 'Criar conta';

  @override
  String get authRegistering => 'Criando conta…';

  @override
  String get authLineCallbackCompleting =>
      'Concluindo a verificação do LINE...';

  @override
  String get authLineCallbackMissingCode =>
      'O LINE não retornou um código de autorização. Tente novamente.';

  @override
  String get authLineCallbackLinkFailed =>
      'Não foi possível vincular a conta LINE';

  @override
  String get authLineCallbackLoginFailed => 'Falha ao entrar com LINE';

  @override
  String get authLineCallbackVerifyFailed => 'Falha na verificação do LINE';

  @override
  String get authErrorsTurnstileRequired =>
      'Conclua a verificação humana primeiro';

  @override
  String get authErrorsLoginFailed => 'Não foi possível entrar';

  @override
  String get authErrorsRegisterFailed => 'Não foi possível criar a conta';

  @override
  String get authErrorsGoogleNotConfigured =>
      'O login com Google não está configurado';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'O componente de login com Google não foi carregado';

  @override
  String get authErrorsGoogleStateFailed =>
      'Não foi possível criar o estado de login do Google';

  @override
  String get authErrorsGoogleNoCode =>
      'Nenhum código de autorização do Google foi recebido';

  @override
  String get authErrorsGoogleFailed => 'Falha ao entrar com Google';

  @override
  String get authErrorsGoogleCancelled => 'Login com Google cancelado';

  @override
  String get authErrorsPasskeyUnsupported =>
      'Este navegador não oferece suporte a Passkey';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Não foi possível criar o desafio de login com Passkey';

  @override
  String get authErrorsPasskeyFailed => 'Falha ao entrar com Passkey';

  @override
  String get authErrorsLineNotConfigured =>
      'O login com LINE não está configurado';

  @override
  String get authErrorsLineFailed => 'Falha ao entrar com LINE';

  @override
  String get settingsTitle => 'Configurações';

  @override
  String get settingsLanguageTitle => 'Idioma';

  @override
  String get settingsLanguageDescription =>
      'Escolha o idioma da interface e das notificações (Email / LINE).';

  @override
  String get settingsLanguageSaved => 'Preferência de idioma atualizada';

  @override
  String get settingsAccountTitle => 'Configurações da conta';

  @override
  String get settingsAccountProfileInfo => 'Informações da conta';

  @override
  String get settingsAccountEmail => 'E-mail';

  @override
  String get settingsAccountDisplayName => 'Nome de exibição';

  @override
  String get settingsAccountEditDisplayName => 'Editar nome de exibição';

  @override
  String get settingsAccountUpdateName => 'Atualizar nome';

  @override
  String get settingsAccountSaving => 'Salvando...';

  @override
  String get settingsAccountSetLocalPassword => 'Definir senha local';

  @override
  String get settingsAccountChangePassword => 'Alterar senha';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      'Esta conta usa apenas login de terceiros no momento. Depois de definir uma senha local, você também poderá entrar com e-mail e senha.';

  @override
  String get settingsAccountCurrentPassword => 'Senha atual';

  @override
  String get settingsAccountNewPassword => 'Nova senha';

  @override
  String get settingsAccountConfirmNewPassword => 'Confirmar nova senha';

  @override
  String get settingsAccountPasswordPlaceholder =>
      'Pelo menos 8 caracteres com maiúscula, minúscula, número e símbolo';

  @override
  String get settingsAccountUpdating => 'Atualizando...';

  @override
  String get settingsAccountSetPassword => 'Definir senha';

  @override
  String get settingsAccountUpdatePassword => 'Atualizar senha';

  @override
  String get settingsAccountThemeTitle => 'Tema';

  @override
  String get settingsAccountThemeSystem => 'Seguir o sistema';

  @override
  String get settingsAccountThemeLight => 'Modo claro';

  @override
  String get settingsAccountThemeDark => 'Modo escuro';

  @override
  String get settingsAccountDefaultCurrency => 'Moeda padrão';

  @override
  String get settingsAccountCurrencyCode => 'Código da moeda';

  @override
  String get settingsAccountUpdateDefaultCurrency => 'Atualizar moeda padrão';

  @override
  String get settingsAccountPasskeyTitle => 'Gerenciar Passkeys';

  @override
  String get settingsAccountNoPasskeys => 'Nenhum Passkey registrado';

  @override
  String get settingsAccountAddPasskey => '+ Adicionar Passkey';

  @override
  String get settingsAccountGoogleTitle => 'Vínculo com Google';

  @override
  String get settingsAccountLineTitle => 'Vínculo com LINE';

  @override
  String get settingsAccountStatusPrefix => 'Status atual: ';

  @override
  String get settingsAccountLinkedGoogle => 'Conta Google vinculada';

  @override
  String get settingsAccountNotLinkedGoogle => 'Conta Google não vinculada';

  @override
  String get settingsAccountLinkGoogle => 'Vincular conta Google';

  @override
  String get settingsAccountUnlink => 'Desvincular';

  @override
  String get settingsAccountLinkedLine => 'Conta LINE vinculada';

  @override
  String get settingsAccountNotLinkedLine => 'Conta LINE não vinculada';

  @override
  String get settingsAccountLinkLine => 'Vincular conta LINE';

  @override
  String get settingsAccountLineVerifying => 'Verificando LINE…';

  @override
  String get settingsAccountSessionsTitle => 'Dispositivos conectados';

  @override
  String get settingsAccountRefresh => 'Atualizar';

  @override
  String get settingsAccountDeviceName => 'Nome do dispositivo';

  @override
  String get settingsAccountLoginTime => 'Hora de login';

  @override
  String get settingsAccountLoginIp => 'IP de login';

  @override
  String get settingsAccountActions => 'Ações';

  @override
  String get settingsAccountUnknownDevice => 'Dispositivo desconhecido';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (este dispositivo)';

  @override
  String get settingsAccountSignOut => 'Sair';

  @override
  String get settingsAccountNoSessions =>
      'Nenhum registro de dispositivo conectado';

  @override
  String get settingsAccountAuditTitle => 'Histórico de login';

  @override
  String get settingsAccountCountry => 'País';

  @override
  String get settingsAccountMethod => 'Método';

  @override
  String get settingsAccountDevice => 'Dispositivo';

  @override
  String get settingsAccountAdminLogin => 'Login de administrador';

  @override
  String get settingsAccountYes => 'Sim';

  @override
  String get settingsAccountNo => 'Não';

  @override
  String get settingsAccountDeleteTitle => 'Excluir conta';

  @override
  String get settingsAccountDeleteDescription =>
      'Depois de excluir sua conta, transações, contas, ações, Passkeys e configurações serão removidos permanentemente e não poderão ser recuperados.';

  @override
  String get settingsAccountDeleteButton => 'Excluir minha conta';

  @override
  String get settingsAccountDeleteModalTitle => 'Confirmar exclusão da conta';

  @override
  String get settingsAccountDeleteModalWarning =>
      'Esta ação excluirá permanentemente sua conta e todos os dados, incluindo transações, contas, ações, Passkeys e configurações. Não é possível recuperar.';

  @override
  String get settingsAccountDeletePasswordLabel =>
      'Digite sua senha para confirmar a exclusão';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return 'Digite o e-mail da conta \"$email\" para confirmar a exclusão';
  }

  @override
  String get settingsAccountDeleting => 'Excluindo...';

  @override
  String get settingsAccountDeletePermanently =>
      'Excluir conta permanentemente';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired =>
      'Digite sua senha atual';

  @override
  String get settingsAccountMessagesNewPasswordRequired =>
      'Digite uma nova senha';

  @override
  String get settingsAccountMessagesPasswordTooShort =>
      'A nova senha deve ter pelo menos 8 caracteres';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      'A nova senha deve incluir maiúscula, minúscula, número e caractere especial';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      'As duas novas senhas não coincidem';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      'Senha definida. Agora você pode entrar com sua senha';

  @override
  String get settingsAccountMessagesPasswordUpdated => 'Senha atualizada';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      'Não foi possível atualizar a senha';

  @override
  String get settingsAccountMessagesDisplayNameRequired =>
      'O nome de exibição não pode ficar vazio';

  @override
  String get settingsAccountMessagesDisplayNameUpdated =>
      'Nome de exibição atualizado';

  @override
  String get settingsAccountMessagesUpdateFailed =>
      'Não foi possível atualizar';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm =>
      'Excluir este Passkey?';

  @override
  String get settingsAccountMessagesCurrencyInvalid =>
      'A moeda deve ser um código de 3 letras';

  @override
  String get settingsAccountMessagesCurrencyUpdated =>
      'Moeda padrão atualizada';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      'Não foi possível atualizar a moeda padrão';

  @override
  String get settingsAccountMessagesSessionLoggedOut =>
      'Dispositivo desconectado';

  @override
  String get settingsAccountMessagesSessionLogoutFailed =>
      'Não foi possível sair do dispositivo';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      'Este navegador não oferece suporte a Passkey';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Dispositivo Android';

  @override
  String get settingsAccountMessagesComputerDevice => 'Computador';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Falha ao registrar Passkey';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      'Cole um Google ID Token para simular a vinculação';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Conta Google vinculada';

  @override
  String get settingsAccountMessagesGoogleLinkFailed =>
      'Não foi possível vincular a conta Google';

  @override
  String get settingsAccountMessagesGoogleUnlinked =>
      'Conta Google desvinculada';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Não foi possível desvincular a conta Google';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'O login com LINE não está configurado';

  @override
  String get settingsAccountMessagesLineLinkFailed =>
      'Não foi possível vincular a conta LINE';

  @override
  String get settingsAccountMessagesLineUnlinked => 'Conta LINE desvinculada';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'Não foi possível desvincular a conta LINE';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      'Digite sua senha para confirmar a exclusão';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      'Digite o e-mail correto da conta para confirmar a exclusão';

  @override
  String get settingsAccountMessagesDeleteFailed =>
      'Não foi possível excluir a conta';

  @override
  String get dashboardTitle => 'Painel';

  @override
  String dashboardSubtitle(Object month) {
    return 'Receitas, despesas, categorias e transações recentes de $month.';
  }

  @override
  String get dashboardUncategorized => 'Sem categoria';

  @override
  String get dashboardKpiTotalIncome => 'Receita total';

  @override
  String get dashboardKpiTotalExpense => 'Despesa total';

  @override
  String get dashboardKpiNet => 'Saldo líquido';

  @override
  String get dashboardKpiTodayExpense => 'Despesa de hoje';

  @override
  String get dashboardKpiBankAccounts => 'Contas bancárias';

  @override
  String get dashboardKpiStockMarketValue => 'Valor de mercado das ações';

  @override
  String get dashboardOverviewTitle => 'Resumo mensal do fluxo de caixa';

  @override
  String get dashboardOverviewBalance => 'Superávit do mês';

  @override
  String get dashboardOverviewDeficit => 'Déficit do mês';

  @override
  String get dashboardOverviewIncome => 'Receitas';

  @override
  String get dashboardOverviewExpense => 'Despesas';

  @override
  String get dashboardOverviewNet => 'Líquido';

  @override
  String get dashboardRatioTitle => 'Relação receitas / despesas';

  @override
  String get dashboardRatioIncomeShare => 'Participação das receitas';

  @override
  String get dashboardRatioExpenseShare => 'Participação das despesas';

  @override
  String get dashboardSectionsExpenseCategories => 'Categorias de despesa';

  @override
  String get dashboardSectionsIncomeCategories => 'Categorias de receita';

  @override
  String get dashboardSectionsRecentTransactions => 'Transações recentes';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return 'Últimos $count registros';
  }

  @override
  String get dashboardEmptyNoExpense => 'Sem despesas neste mês';

  @override
  String get dashboardEmptyNoIncome => 'Sem receitas neste mês';

  @override
  String get dashboardEmptyNoTransactions => 'Sem transações neste mês';

  @override
  String get dashboardTableDate => 'Data';

  @override
  String get dashboardTableCategory => 'Categoria';

  @override
  String get dashboardTableNote => 'Observação';

  @override
  String get dashboardTableAmount => 'Valor';

  @override
  String get dashboardFiltersPreviousMonth => 'Mês anterior';

  @override
  String get dashboardFiltersNextMonth => 'Próximo mês';

  @override
  String get dashboardFiltersCurrentMonth => 'Este mês';

  @override
  String get publicCommonBackHome => 'Voltar ao início';

  @override
  String get publicCommonPrivacy => 'Política de privacidade';

  @override
  String get publicCommonTerms => 'Termos de serviço';

  @override
  String get publicCommonApiCredits => 'Uso de API e créditos';

  @override
  String publicCommonLastUpdated(Object date) {
    return 'Última atualização: $date';
  }

  @override
  String get publicCommonMetadataTitle =>
      'AssetPilot - Central de finanças pessoais';

  @override
  String get publicCommonMetadataDescription =>
      'Gerenciador financeiro pessoal criptografado e auto-hospedável para despesas, orçamentos, ações de Taiwan e análises.';

  @override
  String get publicCommonDatesApiCredits => '11 de junho de 2026';

  @override
  String get publicCommonDatesPrivacy => '17 de junho de 2026';

  @override
  String get publicCommonDatesTerms => '11 de junho de 2026';

  @override
  String get publicHomeTagline => 'Central de finanças pessoais';

  @override
  String get publicHomeLogin => 'Entrar';

  @override
  String get publicHomeRegister => 'Criar conta';

  @override
  String get publicHomeBadge => 'Auto-hospedado, dados criptografados, AGPL v3';

  @override
  String get publicHomeHeadline1 => 'Sua central de controle financeiro';

  @override
  String get publicHomeHeadline2 => 'clara já na primeira tela';

  @override
  String get publicHomeLeadBefore =>
      'Reúna investimentos em ações de Taiwan, receitas, despesas, orçamentos, relatórios e auditoria em um só lugar. Os dados financeiros são criptografados em repouso com';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      'sem prender você a uma nuvem específica nem a uma assinatura. Entenda o produto antes de entrar.';

  @override
  String get publicHomeStartUsing => 'Começar';

  @override
  String get publicHomeCreateFirst => 'Criar uma conta primeiro';

  @override
  String get publicHomeChipsOpenSource => 'Código aberto AGPL v3';

  @override
  String get publicHomeChipsEncrypted => 'Armazenamento local criptografado';

  @override
  String get publicHomeChipsNoCloudLock => 'Sem dependência de nuvem externa';

  @override
  String get publicHomeChipsDocker => 'Deploy Docker com um comando';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => 'Módulos principais';

  @override
  String get publicHomeStatsModulesSublabel =>
      'Lançamentos, ações, relatórios, governança';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => 'Criptografia de dados';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => 'Fonte de cotações';

  @override
  String get publicHomeStatsStockSourceSublabel =>
      'Intradiário, fechamento e contingência';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => 'Cálculo preciso';

  @override
  String get publicHomeStatsPrecisionSublabel => 'P/L por lote com decimal.js';

  @override
  String get publicHomePreLoginNote =>
      'Mesmo sem entrar, você pode conhecer os recursos do AssetPilot, como os dados são tratados e as opções de implantação antes de decidir entrar ou criar uma conta.';

  @override
  String get publicHomeWhyLabel => 'Por que AssetPilot';

  @override
  String get publicHomeWhyTitle =>
      'Controle diário, acompanhamento de investimentos e domínio dos dados no mesmo lugar';

  @override
  String get publicHomeWhyDescription =>
      'O AssetPilot foi feito para quem administra as próprias finanças. Ele centraliza fluxo de caixa, orçamentos e ações de Taiwan, mantendo exportação, auditoria e auto-hospedagem sob seu controle.';

  @override
  String get publicHomePillarsFinanceTitle =>
      'Gestão de fluxo de caixa e orçamento';

  @override
  String get publicHomePillarsFinanceTag => 'Núcleo financeiro';

  @override
  String get publicHomePillarsFinanceItemsOne =>
      'Acompanhamento de saldos em várias contas e transferências internas';

  @override
  String get publicHomePillarsFinanceItemsTwo =>
      'Controle de progresso mensal e por categoria';

  @override
  String get publicHomePillarsFinanceItemsThree =>
      'Geração automática de receitas e despesas recorrentes';

  @override
  String get publicHomePillarsFinanceItemsFour =>
      'Alteração em lote de categoria, data e exclusão';

  @override
  String get publicHomePillarsStocksTitle =>
      'Acompanhamento de ações de Taiwan';

  @override
  String get publicHomePillarsStocksTag => 'Módulo de ações';

  @override
  String get publicHomePillarsStocksItemsOne =>
      'Consulta de cotações TWSE e sincronização de ex-dividendos';

  @override
  String get publicHomePillarsStocksItemsTwo =>
      'Cálculo FIFO de P/L realizado com precisão total';

  @override
  String get publicHomePillarsStocksItemsThree =>
      'Registro de dividendos e depósitos em conta';

  @override
  String get publicHomePillarsStocksItemsFour =>
      'Investimentos recorrentes e marcação de deslistagem';

  @override
  String get publicHomePillarsSecurityTitle =>
      'Segurança e governança de dados';

  @override
  String get publicHomePillarsSecurityTag => 'Governança';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'Criptografia em repouso com ChaCha20-Poly1305';

  @override
  String get publicHomePillarsSecurityItemsTwo =>
      'Login por senha, Google e Passkey';

  @override
  String get publicHomePillarsSecurityItemsThree =>
      'Exportação/importação, backup, restauração e logs de auditoria';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Proteção com rate limit, CSP e prevenção de injeção CSV';

  @override
  String get publicHomePillarsSelfHostedTitle => 'Auto-hospedagem e contratos';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne =>
      'Inicialização Docker com um comando';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'Suporte a amd64 e arm64';

  @override
  String get publicHomePillarsSelfHostedItemsThree =>
      'Contrato documentado em OpenAPI 3.2';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      'Rotas URL-first para favoritos e recarregamento direto';

  @override
  String get publicHomeQuickStartLabel => 'Início rápido';

  @override
  String get publicHomeQuickStartTitle =>
      'Rode no seu próprio servidor em 60 segundos';

  @override
  String get publicHomeQuickStartDescription =>
      'Comece rápido com Docker. Na primeira execução, as chaves JWT e de criptografia do banco são geradas automaticamente. Há suporte a amd64 e arm64, ideal para NAS, VPS ou seu próprio host Docker.';

  @override
  String get publicHomeQuickStartChipsImage => 'Imagem de aprox. 180 MB';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => 'Health check integrado';

  @override
  String get publicHomeQuickStartChipsKeys =>
      'Chaves geradas na primeira inicialização';

  @override
  String get publicHomeTechLabel => 'Stack técnico';

  @override
  String get publicHomeTechTitle => 'Tecnologia e informações públicas';

  @override
  String get publicHomeTechDescription =>
      'As principais tecnologias, fontes externas de dados e informações de licença ficam claras para que você entenda como o serviço funciona antes de usar.';

  @override
  String get publicHomeFooter =>
      'GNU AGPL v3. Gestão de patrimônio pessoal que você auto-hospeda, controla e faz backup.';

  @override
  String get publicApiCreditsPageTitle => 'Uso de API e créditos';

  @override
  String get publicApiCreditsPageMetadataTitle =>
      'Uso de API e créditos — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => 'Transparência de APIs externas';

  @override
  String get publicApiCreditsPageDescription =>
      'O AssetPilot só se conecta a fontes externas quando uma função precisa disso. Esta página mostra a finalidade de cada API, observações de licença e escopo dos dados enviados para revisão de conformidade em auto-hospedagem.';

  @override
  String get publicApiCreditsPageStatsExternalServices => 'Serviços externos';

  @override
  String get publicApiCreditsPageStatsFreeSupported => 'Com plano gratuito';

  @override
  String get publicApiCreditsPageStatsAttributionRequired => 'Exige atribuição';

  @override
  String get publicApiCreditsPageServiceKindsData => 'Consultas de dados';

  @override
  String get publicApiCreditsPageServiceKindsAuth => 'Autenticação';

  @override
  String get publicApiCreditsPageServiceKindsEmail => 'Canais de e-mail';

  @override
  String get publicApiCreditsPageServiceKindsBackup => 'Backup em nuvem';

  @override
  String get publicApiCreditsPageTransparencyTitle => 'Transparência de dados';

  @override
  String get publicApiCreditsPageTransparencyText =>
      'Os cenários abaixo enviam apenas o mínimo necessário para a função e não entregam seus detalhes financeiros a serviços de terceiros.';

  @override
  String get publicApiCreditsPageMinNecessary =>
      'Princípio do mínimo necessário';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => 'Sincronização de câmbio';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      'Somente dados públicos de câmbio são consultados; detalhes financeiros pessoais não são enviados.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle =>
      'Dados de ações de Taiwan';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      'Apenas códigos de ações e dados de mercado são enviados, sem contas, custo de posição ou transações.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => 'Auditoria de login';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'O IPinfo é usado apenas para exibir o país nos registros de login.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => 'Login de terceiros';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google e LINE só são usados quando você entra ou vincula uma conta de forma ativa.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => 'Backup em nuvem';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'O MEGA S4 recebe o arquivo completo do banco apenas quando um administrador envia o backup explicitamente.';

  @override
  String get publicApiCreditsPageServiceListTitle =>
      'Lista de serviços externos';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return 'São $total serviços no total. $free oferecem plano gratuito e $paid têm planos pagos.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => 'Site oficial';

  @override
  String get publicApiCreditsPageFreePlan => 'Plano gratuito';

  @override
  String get publicApiCreditsPagePaidPlan => 'Plano pago';

  @override
  String get publicApiCreditsPageSupported => 'Compatível';

  @override
  String get publicApiCreditsPageUnavailable => 'Indisponível';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'Cotações globais em tempo real com TWD como moeda-base';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      'Geolocalização de IP para o campo de país nos registros de auditoria de login';

  @override
  String get publicApiCreditsPageDescriptionsTwse =>
      'Cotações em tempo real, dados de ex-dividendos e busca de nomes de ações';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Login Google SSO';

  @override
  String get publicApiCreditsPageDescriptionsLine =>
      'Login LINE e vinculação de conta';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Canal de envio de e-mail para relatórios de ativos do administrador via Gmail, Outlook ou outro servidor SMTP';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'Canal de envio de e-mail para relatórios de ativos do administrador via HTTP REST API';

  @override
  String get publicApiCreditsPageDescriptionsResend =>
      'Canal de envio de e-mail para relatórios de ativos do administrador';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      'Destino de object storage compatível com S3 para backups SQL completos de PostgreSQL do administrador';

  @override
  String get publicAppCallbackReturningTitle =>
      'Voltando para o app AssetPilot...';

  @override
  String get publicAppCallbackReturningBody =>
      'Se você não voltar automaticamente, confirme que a versão mais recente do AssetPilot para Android está instalada.';

  @override
  String get publicAppCallbackPasskeyTitle => 'Login no AssetPilot com Passkey';

  @override
  String get publicAppCallbackPasskeyStarting =>
      'Iniciando login com Passkey...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      'Este navegador não oferece suporte a Passkey';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Não foi possível criar o desafio de login com Passkey';

  @override
  String get publicAppCallbackPasskeyVerify =>
      'Conclua a verificação de Passkey no seu dispositivo...';

  @override
  String get publicAppCallbackPasskeyLoginFailed =>
      'Falha ao entrar com Passkey';

  @override
  String get publicAppCallbackReturningApp => 'Voltando para o app...';

  @override
  String get publicAppCallbackAppTicketFailed =>
      'Não foi possível criar a credencial de login do app';

  @override
  String get featuresCommonActions => 'Ações';

  @override
  String get featuresCommonAccount => 'Conta';

  @override
  String get featuresCommonAmount => 'Valor';

  @override
  String get featuresCommonDate => 'Data';

  @override
  String get featuresCommonEndDate => 'Fim';

  @override
  String get featuresCommonNote => 'Observação';

  @override
  String get featuresCommonStartDate => 'Início';

  @override
  String get featuresCommonStatus => 'Status';

  @override
  String get featuresCommonStock => 'Ação';

  @override
  String get featuresCommonType => 'Tipo';

  @override
  String get featuresCommonName => 'Nome';

  @override
  String get featuresCommonCurrency => 'Moeda';

  @override
  String get featuresCommonExchangeRate => 'Câmbio';

  @override
  String get featuresCommonIncome => 'Receita';

  @override
  String get featuresCommonExpense => 'Despesa';

  @override
  String get featuresCommonUncategorized => 'Sem categoria';

  @override
  String get featuresCommonUnspecified => 'Não especificado';

  @override
  String get featuresCommonAutoCalculate => 'Calcular automaticamente';

  @override
  String get featuresCommonExcludeFromStats => 'Excluir das estatísticas';

  @override
  String get featuresCommonTopLevelCategory => '- Categoria principal -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => 'Categorias';

  @override
  String get featuresCategoriesExpenseTab => 'Categorias de despesa';

  @override
  String get featuresCategoriesIncomeTab => 'Categorias de receita';

  @override
  String get featuresCategoriesAddCategory => 'Adicionar categoria';

  @override
  String get featuresCategoriesEditCategory => 'Editar categoria';

  @override
  String get featuresCategoriesNewCategory => 'Adicionar categoria';

  @override
  String get featuresCategoriesNameLabel => 'Nome *';

  @override
  String get featuresCategoriesTypeLabel => 'Tipo';

  @override
  String get featuresCategoriesParentLabel => 'Categoria principal';

  @override
  String get featuresCategoriesColorLabel => 'Cor';

  @override
  String get featuresCategoriesExpense => 'Despesa';

  @override
  String get featuresCategoriesIncome => 'Receita';

  @override
  String get featuresCategoriesDeleteMessage =>
      'Excluir esta categoria? As subcategorias também serão removidas.';

  @override
  String get featuresCategoriesMessagesNameRequired =>
      'Digite o nome da categoria';

  @override
  String get featuresCategoriesMessagesDeleteFailed =>
      'Não foi possível excluir';

  @override
  String get featuresBudgetTitle => 'Orçamentos';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$month/$year';
  }

  @override
  String get featuresBudgetTotalBudget => 'Orçamento total do mês';

  @override
  String get featuresBudgetSpent => 'Gasto';

  @override
  String get featuresBudgetAddBudget => 'Adicionar orçamento';

  @override
  String get featuresBudgetEditBudget => 'Editar orçamento';

  @override
  String get featuresBudgetNewBudget => 'Adicionar orçamento';

  @override
  String get featuresBudgetCategoryLabel =>
      'Categoria (em branco para orçamento total)';

  @override
  String get featuresBudgetTotalBudgetOption => '- Orçamento total -';

  @override
  String get featuresBudgetAmountLabel => 'Valor do orçamento *';

  @override
  String get featuresBudgetTotalBudgetName => '(Orçamento total)';

  @override
  String get featuresBudgetOverBudget => 'Acima do orçamento';

  @override
  String get featuresBudgetDeleteMessage => 'Excluir este orçamento?';

  @override
  String get featuresBudgetMessagesAmountRequired =>
      'Digite um valor de orçamento válido';

  @override
  String get featuresReportsTitle => 'Relatórios';

  @override
  String get featuresReportsTabsCategory => 'Distribuição por categoria';

  @override
  String get featuresReportsTabsTrend => 'Análise de tendência';

  @override
  String get featuresReportsTabsDaily => 'Gasto diário';

  @override
  String get featuresReportsPeriodsThisMonth => 'Este mês';

  @override
  String get featuresReportsPeriodsLastMonth => 'Mês passado';

  @override
  String get featuresReportsPeriodsLast3 => 'Últimos 3 meses';

  @override
  String get featuresReportsPeriodsLast6 => 'Últimos 6 meses';

  @override
  String get featuresReportsPeriodsThisYear => 'Este ano';

  @override
  String get featuresReportsPeriodsCustom => 'Personalizado';

  @override
  String get featuresReportsPeriodLabel => 'Período';

  @override
  String get featuresReportsStart => 'Início';

  @override
  String get featuresReportsEnd => 'Fim';

  @override
  String get featuresReportsCurrentTotal => 'Total atual';

  @override
  String get featuresReportsComparedPrevious => 'Comparado ao período anterior';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta; período anterior sem dados';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return 'Detalhe de $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return 'Total: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => 'Categoria selecionada: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', valor $amount';
  }

  @override
  String get featuresReportsViewTransactions => 'Ver transações relacionadas';

  @override
  String get featuresRecurringTitle => 'Receitas e despesas recorrentes';

  @override
  String get featuresRecurringAdd => 'Adicionar recorrente';

  @override
  String get featuresRecurringEdit => 'Editar recorrente';

  @override
  String get featuresRecurringCreate => 'Adicionar recorrente';

  @override
  String get featuresRecurringAmountLabel => 'Valor *';

  @override
  String get featuresRecurringFxFeeLabel => 'Taxa internacional (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder =>
      'Em branco: o sistema calcula pela taxa do cartão';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return 'Taxa internacional do cartão $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', valor sugerido NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading =>
      'Consultando câmbio mais recente...';

  @override
  String get featuresRecurringCategory => 'Categoria';

  @override
  String get featuresRecurringFrequency => 'Frequência';

  @override
  String get featuresRecurringStartDate => 'Data inicial';

  @override
  String featuresRecurringNextRun(Object date) {
    return 'Próxima execução: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return 'Categoria: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return 'Conta: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return 'Taxa internacional: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => 'Excluir este recorrente?';

  @override
  String get featuresRecurringCreatingTransfer => 'Criando...';

  @override
  String get featuresRecurringConfirmTransfer => 'Confirmar transferência';

  @override
  String get featuresRecurringFrequencyLabelsDaily => 'Diário';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => 'Semanal';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => 'Mensal';

  @override
  String get featuresRecurringFrequencyLabelsYearly => 'Anual';

  @override
  String get featuresRecurringMessagesAmountRequired =>
      'Digite um valor válido';

  @override
  String get featuresDataTransferTitle => 'Exportação e importação de dados';

  @override
  String get featuresDataTransferExportStartDate =>
      'Data inicial da exportação';

  @override
  String get featuresDataTransferExportEndDate => 'Data final da exportação';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'Exportação e importação CSV compatíveis. Colunas: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'Exportar CSV';

  @override
  String get featuresDataTransferExporting => 'Exportando...';

  @override
  String get featuresDataTransferChooseCsv => 'Escolher CSV para importar';

  @override
  String get featuresDataTransferImporting => 'Importando...';

  @override
  String featuresDataTransferImported(Object count) {
    return 'Importação concluída: $count registros';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return 'Ignorados: $count registros';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return 'Categorias criadas automaticamente: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return 'Contas criadas automaticamente: $items';
  }

  @override
  String get featuresDataTransferWarning => 'Aviso';

  @override
  String get featuresDataTransferError => 'Erro';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return 'Linha $row: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => 'Contas';

  @override
  String get featuresDataTransferModulesTransactions => 'Transações';

  @override
  String get featuresDataTransferModulesCategories => 'Categorias';

  @override
  String get featuresDataTransferModulesStockTransactions =>
      'Transações de ações';

  @override
  String get featuresDataTransferModulesStockDividends => 'Dividendos';

  @override
  String get featuresDataTransferMessagesExportSuccess =>
      'Exportação concluída';

  @override
  String get featuresDataTransferMessagesExportFailed =>
      'Não foi possível exportar';

  @override
  String get featuresDataTransferMessagesEmptyCsv =>
      'O CSV não tem dados para importar';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return 'Importação de $name concluída';
  }

  @override
  String get featuresDataTransferMessagesImportFailed =>
      'Não foi possível importar';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      'Backup completo baixado';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      'Não foi possível baixar o backup completo';

  @override
  String get featuresDataTransferMessagesRestoreDone => 'Restauração concluída';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      'Não foi possível restaurar o backup';

  @override
  String get featuresDataTransferMessagesDbExportDone =>
      'Backup do banco baixado';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      'Falha no backup do banco';

  @override
  String get featuresDataTransferMessagesDbRestoreDone => 'Banco restaurado';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      'Não foi possível restaurar o banco';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return 'Enviado para $bucket/$key';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed =>
      'Falha no backup MEGA S4';

  @override
  String get featuresDataTransferMessagesRequireOneField =>
      'Preencha pelo menos um campo';

  @override
  String get featuresDataTransferMessagesSaved => 'Configurações salvas';

  @override
  String get featuresDataTransferMessagesSaveFailed =>
      'Não foi possível salvar as configurações';

  @override
  String get featuresDataTransferBundleTitle =>
      'Backup completo de dados (inclui imagens)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      'Baixe em um único ZIP todos os seus dados pessoais: transações, contas, categorias, orçamentos, ciclos, câmbio, ações e imagens de comprovantes.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      'Envie o mesmo ZIP para restaurar.';

  @override
  String get featuresDataTransferBundleRestorePrefix => 'A restauração usa';

  @override
  String get featuresDataTransferBundleMergeMode => 'modo de mesclagem';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      ': dados existentes são ignorados automaticamente e apenas o que falta é reposto;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      'seus dados atuais não são excluídos nem sobrescritos';

  @override
  String get featuresDataTransferBundleDownload => 'Baixar backup completo';

  @override
  String get featuresDataTransferBundleDownloading => 'Preparando download...';

  @override
  String get featuresDataTransferBundleRestore =>
      'Enviar backup para restaurar';

  @override
  String get featuresDataTransferBundleRestoring => 'Restaurando...';

  @override
  String get featuresDataTransferDatabaseTitle =>
      'Backup / restauração completa do banco';

  @override
  String get featuresDataTransferDatabaseDescription =>
      'Somente administradores. No modo SQLite baixa um backup `.db`; no PostgreSQL, um backup `.sql`. Para restaurar, envie o formato correspondente.';

  @override
  String get featuresDataTransferDatabaseDownload => 'Baixar backup do banco';

  @override
  String get featuresDataTransferDatabaseDownloading => 'Baixando...';

  @override
  String get featuresDataTransferDatabaseRestore =>
      'Escolher backup para restaurar';

  @override
  String get featuresDataTransferDatabaseRestoring => 'Restaurando...';

  @override
  String get featuresDataTransferMegaTitle => 'Backup em nuvem MEGA S4';

  @override
  String get featuresDataTransferMegaDescription =>
      'Envia o backup SQLite completo atual como objeto para um bucket MEGA S4. A conexão vem das variáveis de ambiente do servidor; chaves não são digitadas nem exibidas no navegador.';

  @override
  String get featuresDataTransferMegaState => 'Status: ';

  @override
  String get featuresDataTransferMegaConfigured => 'Configurado';

  @override
  String get featuresDataTransferMegaNotConfigured => 'Configuração incompleta';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return 'Variáveis de ambiente ausentes: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'Enviar backup para MEGA S4';

  @override
  String get featuresDataTransferMegaUploading => 'Enviando...';

  @override
  String get featuresDataTransferMegaConfigure => 'Configurar';

  @override
  String get featuresDataTransferMegaCancelConfigure => 'Cancelar configuração';

  @override
  String get featuresDataTransferMegaFormHelp =>
      'As configurações são gravadas em um arquivo persistente do servidor e entram em vigor imediatamente. Digite as chaves novamente; elas não são preenchidas automaticamente.';

  @override
  String get featuresDataTransferMegaBucketName => 'Nome do bucket';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefixo (opcional)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (opcional; vazio para calcular automaticamente)';

  @override
  String get featuresDataTransferMegaSaveSettings => 'Salvar configurações';

  @override
  String get featuresAccountsTitle => 'Contas';

  @override
  String get featuresAccountsTypeLabelsBank => 'Conta bancária';

  @override
  String get featuresAccountsTypeLabelsCredit_card => 'Cartão de crédito';

  @override
  String get featuresAccountsTypeLabelsCash => 'Dinheiro';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => 'Carteira digital';

  @override
  String get featuresAccountsTypeLabelsOther => 'Outra';

  @override
  String get featuresAccountsTotalAssets => 'Ativos totais';

  @override
  String get featuresAccountsCreditOutstanding => 'Fatura em aberto';

  @override
  String get featuresAccountsAddAccount => 'Adicionar conta';

  @override
  String get featuresAccountsEditAccount => 'Editar conta';

  @override
  String get featuresAccountsNewAccount => 'Adicionar conta';

  @override
  String get featuresAccountsAccountName => 'Nome da conta *';

  @override
  String get featuresAccountsInitialBalance => 'Saldo inicial';

  @override
  String get featuresAccountsInitialBalanceEdit =>
      'Saldo inicial / configuração atual';

  @override
  String get featuresAccountsLinkedBank => 'Banco';

  @override
  String get featuresAccountsUngrouped => 'Sem grupo';

  @override
  String get featuresAccountsOverseasFeeRate => 'Taxa internacional (%)';

  @override
  String get featuresAccountsStatementClosingDay => 'Dia de fechamento (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      'Exemplo: 15. Em branco não calcula o gasto do ciclo atual.';

  @override
  String get featuresAccountsExcludeFromTotal => 'Excluir dos ativos totais';

  @override
  String get featuresAccountsOtherAccounts => 'Outras contas';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return 'Total convertido: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return 'Banco vinculado: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return 'Taxa internacional: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return 'Dia de fechamento mensal: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return 'Gasto do ciclo atual: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => 'Fatura anterior: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return 'Gasto $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return 'Pago $amount';
  }

  @override
  String get featuresAccountsViewCycles => 'Ver detalhe dos ciclos ›';

  @override
  String get featuresAccountsRepaymentTitle => 'Pagamento de cartão de crédito';

  @override
  String get featuresAccountsRepaymentPaymentAccount => 'Conta de pagamento';

  @override
  String get featuresAccountsRepaymentPaymentDate => 'Data de pagamento';

  @override
  String get featuresAccountsRepaymentNoLinkedCards =>
      'Este banco não tem cartões vinculados';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return 'Saldo atual: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => 'Valor do pagamento';

  @override
  String get featuresAccountsRepaymentConfirm => 'Confirmar pagamento';

  @override
  String get featuresAccountsDeleteMessage => 'Excluir esta conta?';

  @override
  String get featuresAccountsCyclesTitle => 'Detalhes dos ciclos de fatura';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name dia de fechamento mensal $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      'Pagamentos são vinculados à fatura que quitam. Valores pagos após o fechamento contam para esse ciclo.';

  @override
  String get featuresAccountsCyclesPeriod => 'Período';

  @override
  String get featuresAccountsCyclesSpending => 'Gasto';

  @override
  String get featuresAccountsCyclesPayment => 'Pagamento real';

  @override
  String get featuresAccountsCyclesCurrent => 'Atual';

  @override
  String get featuresAccountsFxTitle => 'Gestão de câmbio';

  @override
  String get featuresAccountsFxAutoUpdate => 'Atualizar câmbio automaticamente';

  @override
  String get featuresAccountsFxSyncNow => 'Sincronizar agora';

  @override
  String get featuresAccountsFxSyncing => 'Sincronizando...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return 'Última sincronização: $date';
  }

  @override
  String get featuresAccountsFxCurrency => 'Moeda';

  @override
  String get featuresAccountsFxUnitToTwd => '1 unidade = TWD';

  @override
  String get featuresAccountsFxEmpty => 'Nenhum câmbio estrangeiro configurado';

  @override
  String get featuresAccountsFxCurrencyLabel => 'Moeda (ex.: USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'Câmbio para TWD';

  @override
  String get featuresAccountsFxAddOrUpdate => 'Adicionar / atualizar';

  @override
  String get featuresAccountsMessagesNameRequired => 'Digite o nome da conta';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired =>
      'Selecione a conta de pagamento';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      'Informe o pagamento de pelo menos um cartão';

  @override
  String get featuresAccountsMessagesCurrencyInvalid =>
      'A moeda deve ser um código de 3 letras';

  @override
  String get featuresAccountsMessagesRateInvalid =>
      'Digite uma taxa de câmbio válida';

  @override
  String get featuresAccountsMessagesSaved => 'Salvo';

  @override
  String get featuresAccountsMessagesSaveFailed => 'Não foi possível salvar';

  @override
  String get featuresAccountsMessagesDeleteFailed => 'Não foi possível excluir';

  @override
  String get featuresAccountsMessagesRatesUpdated => 'Câmbio atualizado';

  @override
  String get featuresAccountsMessagesSyncFailed =>
      'Não foi possível sincronizar';

  @override
  String get featuresAccountsMessagesLoadFailed => 'Não foi possível carregar';

  @override
  String get featuresTransactionsTitle => 'Transações';

  @override
  String get featuresTransactionsSearchPlaceholder => 'Buscar observações...';

  @override
  String get featuresTransactionsAllTypes => 'Todos os tipos';

  @override
  String get featuresTransactionsAllAccounts => 'Todas as contas';

  @override
  String get featuresTransactionsAllCategories => 'Todas as categorias';

  @override
  String get featuresTransactionsTransfer => 'Transferência';

  @override
  String get featuresTransactionsFuture => 'Transações futuras';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (tudo)';
  }

  @override
  String get featuresTransactionsStartDateTitle => 'Data inicial';

  @override
  String get featuresTransactionsEndDateTitle => 'Data final';

  @override
  String get featuresTransactionsAdd => 'Adicionar transação';

  @override
  String get featuresTransactionsEdit => 'Editar transação';

  @override
  String get featuresTransactionsCreate => 'Adicionar transação';

  @override
  String get featuresTransactionsAccountTransfer =>
      'Transferência entre contas';

  @override
  String get featuresTransactionsBatchCategory => 'Alterar categoria em lote';

  @override
  String get featuresTransactionsBatchDate => 'Alterar data em lote';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return 'Excluir selecionadas ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => 'Receitas da página';

  @override
  String get featuresTransactionsPageExpense => 'Despesas da página';

  @override
  String get featuresTransactionsPageTotal => 'Total da página';

  @override
  String get featuresTransactionsPageSummaryAria =>
      'Resumo de transações da página';

  @override
  String get featuresTransactionsEmpty => 'Nenhuma transação encontrada';

  @override
  String featuresTransactionsSource(Object name) {
    return 'Origem: $name';
  }

  @override
  String get featuresTransactionsFxFee => 'Taxa de cartão internacional';

  @override
  String get featuresTransactionsPhotoOne => 'Foto 1';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '$count fotos';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => 'Data *';

  @override
  String get featuresTransactionsAmountRequiredLabel => 'Valor *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return 'Câmbio (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder =>
      'Em branco usa o câmbio do sistema';

  @override
  String get featuresTransactionsLatestRateLoading =>
      'Consultando câmbio mais recente...';

  @override
  String get featuresTransactionsFxFeePlaceholder =>
      'Em branco o sistema calcula pela taxa do cartão';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return 'Taxa internacional do cartão $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', sugerido NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => 'Fotos';

  @override
  String get featuresTransactionsLoadingPhotos => 'Carregando fotos...';

  @override
  String get featuresTransactionsTakePhoto => 'Tirar foto';

  @override
  String get featuresTransactionsChooseImage => 'Escolher imagem';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return 'No celular, tire uma foto ou escolha da galeria. Até 5 imagens, $maxMb MB cada.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return 'Novas fotos $count';
  }

  @override
  String get featuresTransactionsRemove => 'Remover';

  @override
  String get featuresTransactionsChoosePhoto => 'Escolher foto';

  @override
  String get featuresTransactionsTransferOut => 'Conta origem *';

  @override
  String get featuresTransactionsTransferIn => 'Conta destino *';

  @override
  String get featuresTransactionsSelectPlaceholder => 'Selecionar';

  @override
  String get featuresTransactionsCreating => 'Criando...';

  @override
  String get featuresTransactionsConfirmTransfer => 'Confirmar transferência';

  @override
  String get featuresTransactionsBatchCategoryTitle =>
      'Alterar categoria em lote';

  @override
  String get featuresTransactionsBatchDateTitle => 'Alterar data em lote';

  @override
  String get featuresTransactionsNewCategory => 'Nova categoria';

  @override
  String get featuresTransactionsNewDate => 'Nova data';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return 'Aplicar a $count registros';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      'Excluir esta transação? Esta ação não pode ser desfeita.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return 'Excluir as $count transações selecionadas?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return 'Transação atualizada, mas $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return 'Transação criada, mas $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      'Transferências devem ser excluídas e recriadas';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      'Taxas de cartão internacional são geradas automaticamente. Edite a transação em moeda estrangeira relacionada; a taxa será sincronizada depois.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed =>
      'Falha ao enviar foto';

  @override
  String get featuresTransactionsMessagesDateRequired => 'Selecione uma data';

  @override
  String get featuresTransactionsMessagesAmountRequired =>
      'Digite um valor válido';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      'Selecione a conta origem e a conta destino';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      'Conta origem e destino não podem ser iguais';

  @override
  String get featuresTransactionsTypeLabelsIncome => 'Receita';

  @override
  String get featuresTransactionsTypeLabelsExpense => 'Despesa';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in =>
      'Transferência recebida';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out =>
      'Transferência enviada';

  @override
  String get featuresStocksTabsPortfolio => 'Carteira';

  @override
  String get featuresStocksTabsTransactions => 'Transações';

  @override
  String get featuresStocksTabsDividends => 'Dividendos';

  @override
  String get featuresStocksTabsRealized => 'P/L realizado';

  @override
  String get featuresStocksTabsSettings => 'Configurações de negociação';

  @override
  String get featuresStocksCommonStockLabel => 'Ação';

  @override
  String get featuresStocksCommonStockRequired => 'Ação *';

  @override
  String get featuresStocksCommonStockTypeStock => 'Ação';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => 'Warrant';

  @override
  String get featuresStocksCommonDate => 'Data';

  @override
  String get featuresStocksCommonShares => 'Ações';

  @override
  String get featuresStocksCommonPrice => 'Preço';

  @override
  String get featuresStocksCommonTotal => 'Total';

  @override
  String get featuresStocksCommonReturnRate => 'Retorno';

  @override
  String get featuresStocksCommonOverallReturnRate => 'Retorno total';

  @override
  String get featuresStocksCommonEstimatedPL => 'P/L estimado';

  @override
  String get featuresStocksCommonRealizedPL => 'P/L realizado';

  @override
  String get featuresStocksCommonTotalRealizedPL => 'P/L realizado total';

  @override
  String get featuresStocksCommonYearRealizedPL => 'P/L realizado no ano';

  @override
  String get featuresStocksCommonRealizedCount => 'Registros realizados';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count registros';
  }

  @override
  String get featuresStocksCommonSellAverage => 'Preço médio de venda';

  @override
  String get featuresStocksCommonCostAverage => 'Custo médio';

  @override
  String get featuresStocksCommonFeeAndTax => 'Taxas + imposto';

  @override
  String get featuresStocksCommonCashDividend => 'Dividendo em dinheiro';

  @override
  String get featuresStocksCommonStockDividend => 'Dividendo em ações';

  @override
  String get featuresStocksCommonStockSymbol => 'Código da ação *';

  @override
  String get featuresStocksCommonStockName => 'Nome da ação';

  @override
  String get featuresStocksCommonSearching => 'Buscando...';

  @override
  String get featuresStocksCommonCancelAccounting =>
      '- Não depositar (somente dividendo em ações) -';

  @override
  String get featuresStocksCommonAutoCalculate => 'Calcular automaticamente';

  @override
  String get featuresStocksCommonBuy => 'Comprar';

  @override
  String get featuresStocksCommonSell => 'Vender';

  @override
  String get featuresStocksPortfolioTitle => 'Carteira';

  @override
  String get featuresStocksPortfolioTotalMarketValue =>
      'Valor total de mercado';

  @override
  String get featuresStocksPortfolioTotalCost => 'Custo total investido';

  @override
  String get featuresStocksPortfolioTotalDividend => 'Dividendos totais';

  @override
  String get featuresStocksPortfolioAddStock => 'Adicionar ação';

  @override
  String get featuresStocksPortfolioEditStock => 'Editar ação';

  @override
  String get featuresStocksPortfolioNewStock => 'Adicionar ação';

  @override
  String get featuresStocksPortfolioUpdatePrices => 'Atualizar preços';

  @override
  String get featuresStocksPortfolioBatchUpdate =>
      'Atualização automática em lote';

  @override
  String get featuresStocksPortfolioUpdating => 'Atualizando...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'O AssetPilot consulta primeiro a API pública da TWSE pelo navegador. Se a solicitação for bloqueada, usa o proxy da API do usuário autenticado e atualiza suas posições.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return 'Atualização concluída: $updated com sucesso.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return 'Atualização concluída: $updated com sucesso, $failed falharam.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      'Não foi possível obter dados da TWSE pelo navegador';

  @override
  String get featuresStocksPortfolioHeldShares => 'Ações mantidas';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count ações';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => 'Preço atual';

  @override
  String get featuresStocksPortfolioMarketValue => 'Valor de mercado';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired =>
      'Digite o código da ação';

  @override
  String get featuresStocksTransactionsTitle => 'Transações de ações';

  @override
  String get featuresStocksTransactionsAddTransaction => 'Adicionar transação';

  @override
  String get featuresStocksTransactionsEditTransaction => 'Editar transação';

  @override
  String get featuresStocksTransactionsNewTransaction => 'Adicionar transação';

  @override
  String get featuresStocksTransactionsTypeLabel => 'Tipo';

  @override
  String get featuresStocksTransactionsDateLabel => 'Data *';

  @override
  String get featuresStocksTransactionsSharesLabel => 'Ações *';

  @override
  String get featuresStocksTransactionsPriceLabel => 'Preço unitário *';

  @override
  String get featuresStocksTransactionsFeeLabel => 'Taxa';

  @override
  String get featuresStocksTransactionsTaxLabel => 'Imposto da transação';

  @override
  String get featuresStocksTransactionsDeleteMessage =>
      'Excluir esta transação?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired =>
      'Selecione uma ação';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      'Digite uma quantidade válida de ações';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired =>
      'Digite um preço válido';

  @override
  String get featuresStocksDividendsTitle => 'Dividendos';

  @override
  String get featuresStocksDividendsAddDividend => 'Adicionar dividendo';

  @override
  String get featuresStocksDividendsEditDividend => 'Editar dividendo';

  @override
  String get featuresStocksDividendsNewDividend => 'Adicionar dividendo';

  @override
  String get featuresStocksDividendsSyncExDividends =>
      'Sincronizar ex-dividendos';

  @override
  String get featuresStocksDividendsSyncDescription =>
      'Sincroniza automaticamente dados históricos de ex-dividendos da TWSE com base nas suas posições.';

  @override
  String get featuresStocksDividendsSyncStart => 'Iniciar sincronização';

  @override
  String get featuresStocksDividendsSyncing => 'Sincronizando...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '$synced adicionados, $skipped ignorados.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '$synced adicionados, $skipped ignorados, $failed falharam.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel =>
      'Dividendo em dinheiro (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => 'Dividendo em ações';

  @override
  String get featuresStocksDividendsDepositAccount => 'Conta de depósito';

  @override
  String get featuresStocksDividendsDeleteMessage => 'Excluir este dividendo?';

  @override
  String get featuresStocksDividendsMessagesStockRequired =>
      'Selecione uma ação';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      'Digite dividendo em dinheiro ou em ações';

  @override
  String get featuresStocksRealizedTitle => 'P/L realizado';

  @override
  String get featuresStocksSettingsTitle => 'Configurações de negociação';

  @override
  String get featuresStocksSettingsFeeTitle => 'Taxas / imposto de transação';

  @override
  String get featuresStocksSettingsFeeRate => 'Taxa de corretagem';

  @override
  String get featuresStocksSettingsFeeDiscount => 'Desconto (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot => 'Taxa mínima (lote padrão)';

  @override
  String get featuresStocksSettingsFeeMinOdd =>
      'Taxa mínima (lote fracionário)';

  @override
  String get featuresStocksSettingsSellTaxRateStock =>
      'Imposto de venda (ação)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => 'Imposto de venda (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant =>
      'Imposto de venda (warrant)';

  @override
  String get featuresStocksSettingsSellTaxMin => 'Imposto mínimo de transação';

  @override
  String get featuresStocksSettingsSaveSettings => 'Salvar configurações';

  @override
  String get featuresStocksSettingsStockStatusTitle => 'Status das ações';

  @override
  String get featuresStocksSettingsCurrentPrice => 'Preço atual';

  @override
  String get featuresStocksSettingsNormalTracking => 'Acompanhamento normal';

  @override
  String get featuresStocksSettingsDelisted => 'Deslistada';

  @override
  String get featuresStocksSettingsRestoreTracking =>
      'Restaurar acompanhamento';

  @override
  String get featuresStocksSettingsMarkDelisted => 'Marcar como deslistada';

  @override
  String get featuresStocksSettingsRecurringTitle =>
      'Investimento recorrente em ações';

  @override
  String get featuresStocksSettingsAddRecurringShort => 'Adicionar';

  @override
  String get featuresStocksSettingsEditRecurring =>
      'Editar investimento recorrente';

  @override
  String get featuresStocksSettingsNewRecurring =>
      'Adicionar investimento recorrente';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => 'Valor (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => 'Frequência';

  @override
  String get featuresStocksSettingsStartDate => 'Data inicial';

  @override
  String get featuresStocksSettingsLastGenerated => 'Última geração';

  @override
  String get featuresStocksSettingsActive => 'Ativo';

  @override
  String get featuresStocksSettingsInactive => 'Inativo';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm =>
      'Excluir este investimento recorrente?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => 'Diário';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => 'Semanal';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => 'Mensal';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => 'Anual';

  @override
  String get featuresStocksSettingsMessagesSaved => 'Configurações salvas';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return 'Não foi possível salvar: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired =>
      'Selecione uma ação';

  @override
  String get featuresStocksSettingsMessagesAmountRequired =>
      'Digite um valor válido';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol foi $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus =>
      'restaurada para acompanhamento normal';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus =>
      'marcada como deslistada';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      'Não foi possível atualizar o status de deslistagem';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily =>
      'Relatório diário de fluxo de caixa';

  @override
  String get notificationsReportTypeWeekly =>
      'Relatório semanal de fluxo de caixa';

  @override
  String get notificationsReportTypeMonthly =>
      'Relatório mensal de fluxo de caixa';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return 'Relatório diário de fluxo de caixa｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return 'Relatório semanal de fluxo de caixa｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return 'Relatório mensal de fluxo de caixa｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name, fluxo de caixa de $date ($weekday)';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name, fluxo de caixa de $start ~ $end';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name, fluxo de caixa de $month';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 Data do relatório $date　·　Enviado em $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 Período do relatório $start ~ $end　·　Enviado em $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 Mês do relatório $month　·　Enviado em $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return 'Resumo de ontem inteiro ($date, $weekday); enviado hoje ($sendDate)';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return 'Resumo dos últimos 7 dias ($start ~ $end); enviado hoje ($sendDate)';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return 'Resumo do mês passado ($month, $start ~ $end); enviado neste mês ($sendDate)';
  }

  @override
  String get notificationsLeadDaily => 'Ontem';

  @override
  String get notificationsLeadWeekly => 'Esta semana';

  @override
  String get notificationsLeadMonthly => 'Mês passado';

  @override
  String notificationsKpiIncome(Object lead) {
    return 'Receitas de $lead';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return 'Despesas de $lead';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return 'Líquido de $lead';
  }

  @override
  String get notificationsCompareLabelDaily => 'vs. dia anterior';

  @override
  String get notificationsCompareLabelWeekly => 'vs. semana anterior';

  @override
  String get notificationsCompareLabelMonthly => 'vs. mês anterior';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return 'ontem ($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return 'últimos 7 dias ($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return 'mês passado ($month)';
  }

  @override
  String get notificationsSectionsBalance => 'Saldos das contas';

  @override
  String get notificationsSectionsTopCategories => 'Top 5 despesas deste mês';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return 'Top 5 despesas em $month';
  }

  @override
  String get notificationsSectionsDailyDetail => 'Detalhe diário';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return 'Acumulado do mês ($month)';
  }

  @override
  String get notificationsSectionsStock => 'Investimentos em ações';

  @override
  String get notificationsSectionsRecentDaily => 'Transações de ontem';

  @override
  String get notificationsSectionsRecentWeekly => 'Transações desta semana';

  @override
  String get notificationsSectionsRecentMonthly => 'Transações do mês passado';

  @override
  String get notificationsLabelsIncome => 'Receitas';

  @override
  String get notificationsLabelsExpense => 'Despesas';

  @override
  String get notificationsLabelsNet => 'Líquido';

  @override
  String get notificationsLabelsCost => 'Custo total';

  @override
  String get notificationsLabelsMarketValue => 'Valor de mercado';

  @override
  String get notificationsLabelsUnrealizedPL => 'P/L não realizado';

  @override
  String get notificationsLabelsReturnRate => 'Retorno';

  @override
  String get notificationsLabelsUncategorized => 'Sem categoria';

  @override
  String get notificationsTableDate => 'Data';

  @override
  String get notificationsEmptyNoAccount => 'Ainda não há contas';

  @override
  String get notificationsEmptyNoExpense => 'Ainda não há despesas';

  @override
  String notificationsEmptyNoTx(Object label) {
    return 'Nenhuma transação para $label';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return 'Ações: valor de mercado $marketValue, P/L não realizado $pl';
  }

  @override
  String get notificationsCtaViewFullReport => 'Ver relatório completo';

  @override
  String get notificationsCtaViewLineRecord => 'Ver registros do LINE';

  @override
  String get notificationsReminderAltText => 'Lembrete de despesa';

  @override
  String get notificationsReminderTitle =>
      'Não esqueça de registrar as despesas de hoje';

  @override
  String notificationsReminderBody(Object name) {
    return '$name, leve 10 segundos para registrar os gastos de hoje e não deixar nada passar no fechamento do mês.';
  }

  @override
  String get notificationsReminderHint =>
      'Toque em Adicionar despesa e digite: valor observação data (a data é opcional)';

  @override
  String get notificationsReminderFallbackName => 'olá';

  @override
  String get notificationsReminderAddExpense => 'Adicionar despesa';

  @override
  String get notificationsReminderViewToday => 'Ver registros de hoje';

  @override
  String get notificationsFallbackUser => 'Usuário';

  @override
  String get mobileLegacyMessagebde18a20 => '・Excluído dos ativos totais';

  @override
  String get mobileLegacyNoneCreateAsParent =>
      '(Nenhuma, criar como categoria pai)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      'A tela inicial mostra receitas, despesas, saldo líquido e categorias por mês. Alterne entre meses para entender para onde o dinheiro foi.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      'Os pagamentos são vinculados à fatura que quitam, mesmo quando pagos no ciclo seguinte após o fechamento.';

  @override
  String get mobileLegacy0NoPayment => '0 = não pagar';

  @override
  String get mobileLegacyMon => 'Seg';

  @override
  String get mobileLegacyStock => 'Ação comum';

  @override
  String get mobileLegacyStocks => 'Ações comuns (%)';

  @override
  String get mobileLegacyTue => 'Ter';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      'Conta de depósito (obrigatória para dividendos em dinheiro)';

  @override
  String get mobileLegacyWed => 'Qua';

  @override
  String get mobileLegacyPreviousStatement => 'Fatura anterior ';

  @override
  String get mobileLegacyNext => 'Próximo';

  @override
  String get mobileLegacyDelisted => 'Deslistada';

  @override
  String get mobileLegacySubcategory => 'Subcategoria';

  @override
  String get mobileLegacyDeleted => 'Excluído';

  @override
  String get mobileLegacyUpdated => 'Atualizado';

  @override
  String get mobileLegacyLinked => 'Vinculado';

  @override
  String get mobileLegacyUnlinked => 'Desvinculado';

  @override
  String get mobileLegacyTotalRealizedPL => 'P/L realizado total';

  @override
  String get mobileLegacyFri => 'Sex';

  @override
  String get mobileLegacyStandardRate01 => 'Taxa padrão: 0,1%';

  @override
  String get mobileLegacyStandardRate03 => 'Taxa padrão: 0,3%';

  @override
  String get mobileLegacySat => 'Sáb';

  @override
  String get mobileLegacyCategoryName => 'Nome da categoria';

  @override
  String get mobileLegacyFeeOptional => 'Comissão (opcional)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      'Deixe comissão e imposto em branco para calcular automaticamente';

  @override
  String get mobileLegacyCommissionRate => 'Taxa de comissão (%)';

  @override
  String get mobileLegacyDay => 'Dom';

  @override
  String get mobileLegacyMonthlyBudget => 'Orçamento mensal';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      'Categoria pai (não selecione para criar uma categoria pai)';

  @override
  String get mobileLegacyTheme => 'Tema';

  @override
  String get mobileLegacyThu => 'Qui';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => 'Categoria desconhecida';

  @override
  String get mobileLegacyNotLinked => 'Não vinculado';

  @override
  String get mobileLegacyNoTransactionsThisMonth =>
      'Nenhuma transação neste mês';

  @override
  String get mobileLegacyNoBudgetThisMonth => 'Nenhum orçamento neste mês';

  @override
  String get mobileLegacyNetThisMonth => 'Saldo líquido do mês';

  @override
  String get mobileLegacyPositiveWholeNumber => 'Número inteiro positivo';

  @override
  String get mobileLegacyDeletePermanently => 'Excluir permanentemente';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      'Excluir a conta e todos os dados permanentemente';

  @override
  String get mobileLegacyNoReleaseNotesAvailable =>
      'Nenhuma nota de atualização disponível';

  @override
  String get mobileLegacyCurrentDevice => 'Dispositivo atual';

  @override
  String get mobileLegacyTransactions => 'Transações';

  @override
  String get mobileLegacyAll => 'Tudo';

  @override
  String get mobileLegacyAllCategories => 'Todas as categorias';

  @override
  String get mobileLegacyAllAccounts => 'Todas as contas';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      'Pagamento de cada cartão (na moeda do cartão)';

  @override
  String get mobileLegacySyncDividends => 'Sincronizar dividendos';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      'Nome (opcional; preenchido automaticamente se vazio)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      'Na aba Ações, informe um código como 2330 para acompanhar preços, P/L realizado e não realizado, e sincronizar dividendos automaticamente.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      'Na aba Transações, toque em + para adicionar receitas ou despesas. Há suporte a várias moedas e transferências entre contas. Deslize para a esquerda para excluir ou toque para editar.';

  @override
  String get mobileLegacyNoDataForThisPeriod => 'Sem dados neste período';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      'Esta ação excluirá permanentemente sua conta e todos os dados, incluindo transações, contas, ações e configurações. Não é possível desfazer.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      'Personalizar envio programado de relatórios';

  @override
  String get mobileLegacyAutomatic => 'Automático';

  @override
  String get mobileLegacyAtLeast8Characters => 'Pelo menos 8 caracteres';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      'Pelo menos 8 caracteres com maiúsculas, minúsculas, números e símbolos';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      'Seu companheiro de finanças pessoais para transações, orçamentos, ações de Taiwan e relatórios. Leva só um minuto para conhecer o essencial.';

  @override
  String get mobileLegacyDeletePasskey => 'Excluir Passkey';

  @override
  String get mobileLegacyDeleteCategory => 'Excluir categoria';

  @override
  String get mobileLegacyDeleteTransaction => 'Excluir transação';

  @override
  String get mobileLegacyDeleteDividend => 'Excluir dividendo';

  @override
  String get mobileLegacyDeleteStock => 'Excluir ação';

  @override
  String get mobileLegacyDeleteAccount => 'Excluir conta';

  @override
  String get mobileLegacyDeleteSchedule => 'Excluir agendamento';

  @override
  String get mobileLegacyDeletePhoto => 'Excluir foto';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      'A conta de depósito é obrigatória para dividendos em dinheiro';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters =>
      'Nenhuma transação corresponde aos filtros';

  @override
  String get mobileLegacyDiscount01 => 'Desconto (0-1)';

  @override
  String get mobileLegacyImproved => 'Melhorado';

  @override
  String get mobileLegacyMore => 'Mais';

  @override
  String get mobileLegacyUpdatedd9db02d0 => 'Atualizado';

  @override
  String get mobileLegacyLastDayOfEachMonth => 'Último dia de cada mês';

  @override
  String get mobileLegacyNoPricesToUpdate => 'Nenhum preço para atualizar';

  @override
  String get mobileLegacyNoNewDividendsToSync =>
      'Nenhum dividendo novo para sincronizar';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      'Usuário saiu; login local limpo';

  @override
  String get mobileLegacyGettingStarted => 'Primeiros passos';

  @override
  String get mobileLegacyExample06MeansA40Discount =>
      'Exemplo: 0,6 significa 40% de desconto';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      'Ex.: 1,5 significa 1,5%; a taxa é calculada automaticamente em compras em moeda estrangeira';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      'Em Mais, defina orçamentos mensais, veja relatórios, gerencie contas e categorias, programe transações recorrentes e notificações. Quando estiver pronto, comece a registrar.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 =>
      'Taxa padrão da corretora: 0,1425%';

  @override
  String get mobileLegacyNotSentYet => 'Ainda não enviado';

  @override
  String get mobileLegacyNoRealizedReturns => 'Nenhum P/L realizado';

  @override
  String get mobileLegacyNoCategoriesYet => 'Ainda não há categorias';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      'Nenhuma transação ainda. Toque no botão inferior direito para começar.';

  @override
  String get mobileLegacyNoRecurringTransactions =>
      'Nenhuma transação recorrente';

  @override
  String get mobileLegacyNoDividendRecords => 'Nenhum registro de dividendos';

  @override
  String get mobileLegacyNoStockTransactions => 'Nenhuma transação de ações';

  @override
  String get mobileLegacyNoHoldingsYet => 'Nenhuma posição ainda';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => 'Nenhum histórico de acesso';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      'Conclua o registro no navegador (requer biometria do dispositivo)';

  @override
  String get mobileLegacyNotice => 'Aviso';

  @override
  String get mobileLegacyDividends => 'Dividendos';

  @override
  String get mobileLegacyDividendSyncCompleted => 'Dividendos sincronizados';

  @override
  String get mobileLegacyTickerEG2330 => 'Ticker (ex.: 2330)';

  @override
  String get mobileLegacyStockMarketValue => 'Valor de mercado das ações';

  @override
  String get mobileLegacyHoldings => 'Carteira';

  @override
  String get mobileLegacyDayOfWeek => 'Dia da semana';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      'Ver versão atual e notas de atualização';

  @override
  String get mobileLegacyRename => 'Renomear';

  @override
  String get mobileLegacyCheckAgain => 'Verificar novamente';

  @override
  String get mobileLegacyRetry => 'Tentar novamente';

  @override
  String get mobileLegacyHome => 'Início';

  @override
  String get mobileLegacyFixed => 'Corrigido';

  @override
  String get mobileLegacyApply => 'Aplicar';

  @override
  String get mobileLegacyTime => 'Horário';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      'Tarifa internacional em TWD (opcional)';

  @override
  String get mobileLegacyAddTransaction => 'Adicionar transação';

  @override
  String get mobileLegacyTransactions8084a8ea => 'Transações';

  @override
  String get mobileLegacyStartDate => 'Data inicial';

  @override
  String get mobileLegacyTrackTaiwanStocks => 'Acompanhe ações de Taiwan';

  @override
  String get mobileLegacyStockDividendSharesOptional =>
      'Ações recebidas como dividendo (opcional)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      'Tarifas de cartão no exterior são geradas automaticamente. Edite a transação estrangeira correspondente.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      'A senha deve ter pelo menos 8 caracteres';

  @override
  String get mobileLegacyAccountName => 'Nome da conta';

  @override
  String get mobileLegacyAccountDeleted => 'Conta excluída';

  @override
  String get mobileLegacyAccountSecurity => 'Segurança da conta';

  @override
  String get mobileLegacyLinkedAccounts => 'Contas vinculadas';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => 'Moedas frequentes';

  @override
  String get mobileLegacyChooseFromGallery => 'Escolher da galeria';

  @override
  String get mobileLegacyEnabled => 'Ativado';

  @override
  String get mobileLegacyDark => 'Escuro';

  @override
  String get mobileLegacyLight => 'Claro';

  @override
  String get mobileLegacyClearDates => 'Limpar datas';

  @override
  String get mobileLegacyClearFilters => 'Limpar filtros';

  @override
  String get mobileLegacyCashDividendTotalOptional =>
      'Dividendo em dinheiro (total, opcional)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      'Informe dividendo em dinheiro ou em ações';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      'Ao definir, o cartão da conta mostra os gastos do ciclo atual; vazio não calcula';

  @override
  String get mobileLegacyNoteOptional => 'Nota (opcional)';

  @override
  String get mobileLegacyNoteKeyword => 'Palavra-chave da nota';

  @override
  String get mobileLegacyMinimumTransactionTax => 'Imposto mínimo de transação';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction =>
      'Até 5 fotos por transação';

  @override
  String get mobileLegacyReportNotifications => 'Notificações de relatório';

  @override
  String get mobileLegacySeeYourCompleteCashFlow =>
      'Veja todo o seu fluxo de caixa';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser =>
      'Não foi possível abrir o navegador';

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
      'A sessão expirou. Entre novamente';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      'A resposta de login não trouxe o cookie de autenticação. Verifique a configuração do backend';

  @override
  String get mobileLegacySignedIn => 'Login realizado';

  @override
  String get mobileLegacySignInHistory => 'Histórico de acesso';

  @override
  String get mobileLegacySignedInDevices => 'Dispositivos conectados';

  @override
  String get mobileLegacySignInRequestConnectionFailed =>
      'Não foi possível conectar para entrar';

  @override
  String get mobileLegacyEndDate => 'Data final';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      'A resposta de cadastro não trouxe o cookie de autenticação. Verifique a configuração do backend';

  @override
  String get mobileLegacySignUpAndSignIn => 'Criar conta e entrar';

  @override
  String get mobileLegacyBuy => 'Comprar';

  @override
  String get mobileLegacyFrequency => 'Frequência';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 =>
      'A taxa de câmbio deve ser maior que 0';

  @override
  String get mobileLegacyReturns => 'P/L';

  @override
  String get mobileLegacyAddPasskey => 'Adicionar Passkey';

  @override
  String get mobileLegacyAddStockTransaction => 'Adicionar transação de ações';

  @override
  String get mobileLegacyAddSchedule => 'Adicionar agendamento';

  @override
  String get mobileLegacyAddReportSchedule =>
      'Adicionar agendamento de relatório';

  @override
  String get mobileLegacyAddPhotosOptional => 'Adicionar fotos (opcional)';

  @override
  String get mobileLegacyFailedToLoadPhoto => 'Falha ao carregar foto';

  @override
  String get mobileLegacyLink => 'Vincular';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      'A vinculação é autorizada no navegador. Antes de desvincular, confirme que ainda há outra forma de entrar.';

  @override
  String get mobileLegacyUnlink => 'Desvincular';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp =>
      'Finanças pessoais · App Android';

  @override
  String get mobileLegacySkip => 'Pular';

  @override
  String get mobileLegacyMinimumOddLotCommission =>
      'Comissão mínima para lote fracionário';

  @override
  String get mobileLegacyIncorrectEmailOrPassword =>
      'E-mail ou senha incorretos';

  @override
  String get mobileLegacyDefaultCurrency => 'Moeda padrão';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      'Moeda padrão e moedas frequentes';

  @override
  String get mobileLegacyBudgets => 'Orçamentos';

  @override
  String get mobileLegacyBudgetsReportsAndMore =>
      'Orçamentos, relatórios e mais';

  @override
  String get mobileLegacyBudgetAmount => 'Valor do orçamento';

  @override
  String get mobileLegacyCurrencySettings => 'Configurações de moeda';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage =>
      'Idioma do app, notificações e web';

  @override
  String get mobileLegacyBank => 'Banco';

  @override
  String get mobileLegacyBankBalance => 'Saldo bancário';

  @override
  String get mobileLegacyRequiresALinkedLineAccount =>
      'Requer uma conta LINE vinculada';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      'É preciso ter ao menos um cartão de crédito e uma conta que não seja cartão para registrar o pagamento';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      'Inclua maiúsculas, minúsculas, números e símbolos';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      'Inclua maiúsculas, minúsculas, números e símbolos';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      'Excluir este agendamento de relatório?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      'Excluir esta foto enviada? Esta ação não pode ser desfeita.';

  @override
  String get mobileLegacyEditStockTransaction => 'Editar transação de ações';

  @override
  String get mobileLegacyEditReportSchedule =>
      'Editar agendamento de relatório';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst =>
      'Conclua primeiro a verificação abaixo';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      'Adicione uma ação na aba Carteira primeiro';

  @override
  String get mobileLegacySelectAParentCategoryFirst =>
      'Selecione primeiro uma categoria pai';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      'Informe o pagamento de pelo menos um cartão';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      'Selecione pelo menos um método de notificação';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo =>
      'Informe um número maior ou igual a 0';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => 'Digite um valor de 1 a 31';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 =>
      'Informe um valor maior que 0';

  @override
  String get mobileLegacyEnterATicker => 'Informe um ticker';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber =>
      'Informe um número inteiro positivo';

  @override
  String get mobileLegacyEnterAName => 'Digite um nome';

  @override
  String get mobileLegacyEnterAValidEmailAddress => 'Informe um email válido';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm =>
      'Informe sua senha para confirmar';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      'Informe o email da conta para confirmar';

  @override
  String get mobileLegacyEnterADisplayName => 'Informe um nome de exibição';

  @override
  String get mobileLegacySelectASubcategory => 'Selecione uma subcategoria';

  @override
  String get mobileLegacySelectACategory => 'Selecione uma categoria';

  @override
  String get mobileLegacySelectAParentCategory => 'Selecione uma categoria pai';

  @override
  String get mobileLegacySelectAnAccount => 'Selecione uma conta';

  @override
  String get mobileLegacySelectADestinationAccount =>
      'Selecione a conta de destino';

  @override
  String get mobileLegacySell => 'Vender';

  @override
  String get mobileLegacyMinimumBoardLotCommission =>
      'Comissão mínima para lote inteiro';

  @override
  String get mobileLegacyFilter => 'Filtrar';

  @override
  String get mobileLegacyFilterTransactions => 'Filtrar transações';

  @override
  String get mobileLegacyChooseTheme => 'Escolher tema';

  @override
  String get mobileLegacyLogTransactionsInSeconds =>
      'Registre transações em segundos';

  @override
  String get mobileLegacyMarketValue => 'Valor de mercado total';

  @override
  String get mobileLegacyTotalAssetsInTwd => 'Ativos totais (em TWD)';

  @override
  String get mobileLegacyTraditionalChineseEnglish =>
      'Chinês tradicional / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp =>
      'Ainda não tem conta? Cadastre-se';

  @override
  String get mobileLegacyPaymentRecorded => 'Pagamento registrado';

  @override
  String get mobileLegacyToAccount => 'Conta de destino';

  @override
  String get mobileLegacyFromAccount => 'Conta de origem';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      'As contas de origem e destino devem ser diferentes';

  @override
  String get mobileLegacyEditTransfersInTheWebApp =>
      'Edite transferências na versão web';

  @override
  String get mobileLegacyTransactionTaxSell => 'Imposto de transação (venda)';

  @override
  String get mobileLegacyTransactionTaxOptional =>
      'Imposto de transação (opcional)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax =>
      'Tipo (afeta o imposto de transação)';

  @override
  String get mobileLegacyWarrants => 'Warrants (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'Boas-vindas ao AssetPilot';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      'Os outros dispositivos serão desconectados após a alteração.';

  @override
  String get mobileLegacyTestSentryConfiguration =>
      'Testar configuração do Sentry';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'A API respondeu 401; a sessão expirou e o login local foi limpo';

  @override
  String get mobileLegacyApiRequestFailed => 'Falha na requisição da API';

  @override
  String get mobileLegacyApiRequestConnectionFailed =>
      'Não foi possível conectar à API';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      'A resposta do app não trouxe o cookie de autenticação';

  @override
  String get mobileLegacyEmailNotifications => 'Notificações por email';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'A resposta do Google não trouxe o cookie de autenticação';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'Notificações por LINE';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'A resposta do LINE não trouxe o cookie de autenticação';

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
      'TWD sempre fica incluído. As moedas marcadas aparecem primeiro nas listas de transações e recorrências.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return 'Dia $day';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return 'Último envio: $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return 'Versão atual v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'A versão v$version está disponível';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return 'Mensalmente no dia $day';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return 'Toda semana: $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return 'Criado em $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return 'Idioma atualizado: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return 'Falha ao carregar: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return 'Erro inesperado: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return 'Falha ao entrar com $provider: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return 'Falha ao atualizar preços: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return 'Falha ao sincronizar dividendos: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return 'Falha ao enviar foto: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return 'Falha na requisição (HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return 'Falha ao entrar (HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return 'Não foi possível conectar ao servidor ($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return 'Excluir “$name”?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return 'Desvincular $provider';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return 'Desvincular $provider?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return 'Vínculo com $provider';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (todos)';
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
    return 'Dados consultados às $time';
  }

  @override
  String get dashboardAttentionTitle => 'Requer atenção';

  @override
  String get dashboardAttentionAllClear => 'Nada precisa da sua atenção agora';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '$count transações recorrentes precisam de revisão';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '$count transações sem categoria · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '$count posições em carteira estão sem preço';
  }

  @override
  String get dashboardDriversTitle => '3 principais fatores do mês';

  @override
  String dashboardDriversSubtitle(Object month) {
    return 'O que mais contribui em $month';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '$share% deste tipo';
  }

  @override
  String get dashboardPersonalizeTrigger => 'Personalizar início';

  @override
  String get dashboardPersonalizeTitle => 'Personalizar início';

  @override
  String get dashboardPersonalizeDescription =>
      'Escolha os módulos exibidos e organize-os conforme seu uso.';

  @override
  String get dashboardPersonalizeModulesAssets => 'Visão geral dos ativos';

  @override
  String get dashboardPersonalizeModulesAttention => 'Requer atenção';

  @override
  String get dashboardPersonalizeModulesWhyChanged =>
      'Por que o fluxo de caixa mudou';

  @override
  String get dashboardPersonalizeModulesSpending => 'Categorias de despesas';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => 'Saúde da carteira';

  @override
  String get dashboardPersonalizeModulesIncomeRecent =>
      'Receitas e transações recentes';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return 'Mover $module para cima';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return 'Mover $module para baixo';
  }

  @override
  String get dashboardPersonalizeSaved => 'Layout do painel salvo';

  @override
  String get dashboardPersonalizeSaveError =>
      'Não foi possível salvar o layout do painel';

  @override
  String get dashboardPersonalizeReset => 'Redefinir';

  @override
  String get dashboardPersonalizeApply => 'Aplicar';

  @override
  String get dashboardComparisonTitle => 'Por que o fluxo de caixa mudou';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd comparado a $previousStart–$previousEnd';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return 'Mês completo comparado a $previousStart–$previousEnd';
  }

  @override
  String get dashboardComparisonUnavailable =>
      'Não há período anterior comparável para este mês.';

  @override
  String get dashboardComparisonNoChanges =>
      'O fluxo de caixa registrado não mudou em relação ao período comparável.';

  @override
  String get dashboardComparisonPreviousNet =>
      'Fluxo de caixa líquido anterior';

  @override
  String get dashboardComparisonNetChange =>
      'Variação do fluxo de caixa líquido';

  @override
  String get dashboardComparisonNewThisPeriod => 'Novo neste período';

  @override
  String get dashboardComparisonIncreased => 'Valor aumentou';

  @override
  String get dashboardComparisonDecreased => 'Valor diminuiu';

  @override
  String get dashboardPortfolioHealthTitle => 'Saúde do custo da carteira';

  @override
  String get dashboardPortfolioHealthSubtitle =>
      'Valor atual comparado ao custo FIFO restante';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      'Adicione uma posição para ver análises de custo.';

  @override
  String get dashboardPortfolioHealthMissingPrices =>
      'Preços atuais são necessários para esta comparação.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      'Não há percentual combinado para posições em várias moedas.';

  @override
  String get dashboardPortfolioHealthMarketValue =>
      'Valor de mercado precificado';

  @override
  String get dashboardPortfolioHealthCost => 'Custo das posições precificadas';

  @override
  String get dashboardPortfolioHealthUnrealizedGross =>
      'Ganho/perda bruto não realizado';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return 'Maior posição: $name · $share% do valor precificado';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      'Compara preços atuais ao custo FIFO registrado. Não é um índice de mercado nem desempenho ponderado pelo tempo.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return 'Cobertura de preços: $priced de $total posições';
  }

  @override
  String get dashboardPersonalizeModulesCashOutlook =>
      'Previsão de caixa programado';

  @override
  String get dashboardPersonalizeModulesSavingsScenario =>
      'Cenário de economia';

  @override
  String get dashboardCashOutlookTitle => 'Próximos 30 dias · caixa programado';

  @override
  String get dashboardCashOutlookSubtitle =>
      'Baseado em lançamentos recorrentes confirmados';

  @override
  String dashboardCashOutlookWindow(Object start, Object end) {
    return '$start–$end · Estimativa programada';
  }

  @override
  String get dashboardCashOutlookInvalidDate =>
      'Não foi possível calcular o período estimado.';

  @override
  String get dashboardCashOutlookNoBankAccounts =>
      'Adicione uma conta bancária incluída antes de estimar o caixa programado.';

  @override
  String get dashboardCashOutlookNoSchedules =>
      'Crie uma receita ou despesa recorrente para ver o caixa programado.';

  @override
  String get dashboardCashOutlookNoCoveredSchedules =>
      'Revise os lançamentos recorrentes e vincule-os a contas bancárias incluídas.';

  @override
  String get dashboardCashOutlookStartingBalance => 'Saldo bancário até hoje';

  @override
  String get dashboardCashOutlookScheduledNet => 'Variação líquida programada';

  @override
  String get dashboardCashOutlookClosingBalance =>
      'Caixa estimado após 30 dias';

  @override
  String get dashboardCashOutlookLowestBalance => 'Menor caixa estimado';

  @override
  String dashboardCashOutlookFlowSummary(
    Object count,
    Object income,
    Object expense,
  ) {
    return '$count ocorrências programadas · Receitas $income · Despesas $expense';
  }

  @override
  String get dashboardCashOutlookShortfallTitle =>
      'O caixa combinado estimado pode ficar abaixo de zero';

  @override
  String dashboardCashOutlookShortfallBody(Object date, Object amount) {
    return 'Por volta de $date, a estimativa fica $amount abaixo de zero. Revise datas e valores antes de agir.';
  }

  @override
  String get dashboardCashOutlookUpcoming => 'Próximos lançamentos programados';

  @override
  String dashboardCashOutlookShowing(Object shown, Object total) {
    return 'Mostrando $shown de $total';
  }

  @override
  String get dashboardCashOutlookNoUpcoming =>
      'Nenhuma ocorrência programada neste período de 30 dias.';

  @override
  String dashboardCashOutlookCoverage(
    Object included,
    Object total,
    Object uncovered,
  ) {
    return '$included de $total lançamentos recorrentes estão cobertos; revise $uncovered.';
  }

  @override
  String get dashboardCashOutlookDisclaimer =>
      'A estimativa combina todas as contas bancárias incluídas com o saldo de hoje e lançamentos recorrentes vinculados confirmados. Ela não mostra possíveis saldos negativos de uma conta nem altera saldos reais; lançamentos vencidos são criados no próximo processamento. As estimativas em TWD usam de forma consistente as taxas atuais.';

  @override
  String dashboardCashOutlookAttentionShortfall(Object amount, Object date) {
    return 'O caixa programado pode faltar em $amount por volta de $date';
  }

  @override
  String get dashboardScenarioTitle => 'Cenário de economia';

  @override
  String get dashboardScenarioSubtitle =>
      'Estime o efeito acumulado de um ajuste mensal';

  @override
  String get dashboardScenarioMonthlyAdjustment =>
      'Ajuste mensal de economia (TWD)';

  @override
  String get dashboardScenarioDecrease => 'Diminuir o ajuste mensal em 500';

  @override
  String get dashboardScenarioIncrease => 'Aumentar o ajuste mensal em 500';

  @override
  String get dashboardScenarioHorizon => 'Horizonte de tempo';

  @override
  String dashboardScenarioMonths(Object count) {
    return '$count meses';
  }

  @override
  String get dashboardScenarioDifference => 'Diferença acumulada';

  @override
  String dashboardScenarioSummary(
    Object monthly,
    Object months,
    Object difference,
  ) {
    return 'Um ajuste mensal de $monthly por $months meses produz uma diferença acumulada de $difference.';
  }

  @override
  String get dashboardScenarioDisclaimer =>
      'Cenário simples: ajuste mensal × meses. Exclui juros, retornos de mercado, inflação e impostos e não garante resultado futuro.';
}

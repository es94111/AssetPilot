// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Korean (`ko`).
class AppLocalizationsKo extends AppLocalizations {
  AppLocalizationsKo([String locale = 'ko']) : super(locale);

  @override
  String get commonSave => '저장';

  @override
  String get commonCancel => '취소';

  @override
  String get commonDelete => '삭제';

  @override
  String get commonEdit => '수정';

  @override
  String get commonConfirm => '확인';

  @override
  String get commonClose => '닫기';

  @override
  String get commonLoading => '불러오는 중…';

  @override
  String get commonAdd => '추가';

  @override
  String get commonBack => '뒤로';

  @override
  String get commonSearch => '검색';

  @override
  String get commonLanguage => '언어';

  @override
  String get commonClear => '초기화';

  @override
  String get commonSaving => '저장 중...';

  @override
  String get commonConfirmDelete => '삭제 확인';

  @override
  String get commonPreviousPage => '이전';

  @override
  String get commonNextPage => '다음';

  @override
  String commonTotalRecords(Object count) {
    return '총 $count건';
  }

  @override
  String get commonPerPage => '페이지당';

  @override
  String commonRecordsUnit(Object count) {
    return '$count건';
  }

  @override
  String get commonNoData => '아직 데이터가 없습니다';

  @override
  String get navSectionsFinance => '재무';

  @override
  String get navSectionsStocks => '주식';

  @override
  String get navSectionsSystem => '시스템';

  @override
  String get navDashboard => '대시보드';

  @override
  String get navTransactions => '거래';

  @override
  String get navReports => '보고서';

  @override
  String get navBudget => '예산';

  @override
  String get navInfoBoard => '정보 보드';

  @override
  String get navAccounts => '계좌';

  @override
  String get navCategories => '카테고리';

  @override
  String get navRecurring => '반복 거래';

  @override
  String get navStocksPortfolio => '포트폴리오';

  @override
  String get navStocksTransactions => '주식 거래';

  @override
  String get navStocksDividends => '배당';

  @override
  String get navStocksRealized => '실현 손익';

  @override
  String get navStocksSettings => '주식 설정';

  @override
  String get navExportImport => '내보내기 / 가져오기';

  @override
  String get navAccount => '계정';

  @override
  String get navApiCredits => 'API 접근';

  @override
  String get navAdmin => '관리자';

  @override
  String get navTitleStocks => '포트폴리오';

  @override
  String get navTitleStockTransactions => '주식 거래';

  @override
  String get navTitleStockDividends => '주식 배당';

  @override
  String get navTitleStockRealized => '실현 손익';

  @override
  String get navTitleStockSettings => '주식 거래 설정';

  @override
  String get navTitleApiCredits => 'API 사용 및 접근';

  @override
  String get shellFallbackUser => '사용자';

  @override
  String get shellLogout => '로그아웃';

  @override
  String get shellVersionInfo => '버전 정보';

  @override
  String get shellOpenMenu => '메뉴 열기';

  @override
  String get shellSkipToContent => '주요 콘텐츠로 건너뛰기';

  @override
  String get shellThemeLight => '라이트';

  @override
  String get shellThemeSystem => '시스템';

  @override
  String get shellThemeDark => '다크';

  @override
  String get shellChangelogLoading => '버전 정보를 불러오는 중...';

  @override
  String get shellChangelogLoadFailed => '버전 정보를 불러오지 못했습니다';

  @override
  String get shellChangelogUnknownVersion => '알 수 없음';

  @override
  String get shellChangelogCurrentVersion => '현재 버전';

  @override
  String get shellChangelogUpdatableVersion => '업데이트 가능 버전';

  @override
  String get shellChangelogUpToDate => '최신 버전입니다';

  @override
  String get shellChangelogUpdatableContent => '업데이트 내용';

  @override
  String get shellChangelogRecentContent => '최근 업데이트';

  @override
  String get authLoginTab => '로그인';

  @override
  String get authRegisterTab => '계정 만들기';

  @override
  String get authSubtitleLogin => '다시 오신 것을 환영합니다. 계정에 로그인하세요';

  @override
  String get authSubtitleRegister => '계정을 만들고 자산 관리를 시작하세요';

  @override
  String get authEmailLabel => '이메일';

  @override
  String get authPasswordLabel => '비밀번호';

  @override
  String get authPasswordPlaceholder => '비밀번호를 입력하세요';

  @override
  String get authDisplayNameLabel => '표시 이름';

  @override
  String get authDisplayNamePlaceholder => '이름 또는 별명';

  @override
  String get authRegisterPasswordPlaceholder => '8자 이상, 대문자/소문자와 숫자 포함';

  @override
  String get authTogglePassword => '비밀번호 표시 전환';

  @override
  String get authTurnstileAria => 'Cloudflare Turnstile 사람 인증';

  @override
  String get authLoginButton => '로그인';

  @override
  String get authLoggingIn => '로그인 중…';

  @override
  String get authPasskeyButton => 'Passkey로 로그인';

  @override
  String get authPasskeyVerifying => 'Passkey 확인 중…';

  @override
  String get authGoogleButton => 'Google로 로그인';

  @override
  String get authGoogleVerifying => 'Google 확인 중…';

  @override
  String get authLineButton => 'LINE으로 로그인';

  @override
  String get authLineVerifying => 'LINE 확인 중…';

  @override
  String get authRegisterSubmit => '계정 만들기';

  @override
  String get authRegistering => '계정 생성 중…';

  @override
  String get authLineCallbackCompleting => 'LINE 인증을 완료하는 중...';

  @override
  String get authLineCallbackMissingCode => 'LINE에서 인증 코드를 받지 못했습니다. 다시 시도하세요.';

  @override
  String get authLineCallbackLinkFailed => 'LINE 계정 연결 실패';

  @override
  String get authLineCallbackLoginFailed => 'LINE 로그인 실패';

  @override
  String get authLineCallbackVerifyFailed => 'LINE 인증 실패';

  @override
  String get authErrorsTurnstileRequired => '먼저 사람 인증을 완료하세요';

  @override
  String get authErrorsLoginFailed => '로그인에 실패했습니다';

  @override
  String get authErrorsRegisterFailed => '계정을 만들지 못했습니다';

  @override
  String get authErrorsGoogleNotConfigured => 'Google 로그인이 설정되어 있지 않습니다';

  @override
  String get authErrorsGoogleComponentNotLoaded =>
      'Google 로그인 컴포넌트가 아직 로드되지 않았습니다';

  @override
  String get authErrorsGoogleStateFailed => 'Google 로그인 상태를 만들지 못했습니다';

  @override
  String get authErrorsGoogleNoCode => 'Google 인증 코드를 받지 못했습니다';

  @override
  String get authErrorsGoogleFailed => 'Google 로그인 실패';

  @override
  String get authErrorsGoogleCancelled => 'Google 로그인이 취소되었습니다';

  @override
  String get authErrorsPasskeyUnsupported => '이 브라우저는 Passkey를 지원하지 않습니다';

  @override
  String get authErrorsPasskeyChallengeFailed =>
      'Passkey 로그인 challenge를 만들지 못했습니다';

  @override
  String get authErrorsPasskeyFailed => 'Passkey 로그인 실패';

  @override
  String get authErrorsLineNotConfigured => 'LINE 로그인이 설정되어 있지 않습니다';

  @override
  String get authErrorsLineFailed => 'LINE 로그인 실패';

  @override
  String get settingsTitle => '설정';

  @override
  String get settingsLanguageTitle => '언어';

  @override
  String get settingsLanguageDescription =>
      '인터페이스와 알림(Email / LINE)에 사용할 언어를 선택하세요.';

  @override
  String get settingsLanguageSaved => '언어 설정이 업데이트되었습니다';

  @override
  String get settingsAccountTitle => '계정 설정';

  @override
  String get settingsAccountProfileInfo => '계정 정보';

  @override
  String get settingsAccountEmail => '이메일';

  @override
  String get settingsAccountDisplayName => '표시 이름';

  @override
  String get settingsAccountEditDisplayName => '표시 이름 수정';

  @override
  String get settingsAccountUpdateName => '이름 업데이트';

  @override
  String get settingsAccountSaving => '저장 중...';

  @override
  String get settingsAccountSetLocalPassword => '로컬 비밀번호 설정';

  @override
  String get settingsAccountChangePassword => '비밀번호 변경';

  @override
  String get settingsAccountOauthOnlyPasswordHelp =>
      '이 계정은 현재 외부 로그인만 사용하고 있습니다. 로컬 비밀번호를 설정하면 이메일과 비밀번호로도 로그인할 수 있습니다.';

  @override
  String get settingsAccountCurrentPassword => '현재 비밀번호';

  @override
  String get settingsAccountNewPassword => '새 비밀번호';

  @override
  String get settingsAccountConfirmNewPassword => '새 비밀번호 확인';

  @override
  String get settingsAccountPasswordPlaceholder => '8자 이상, 대문자/소문자/숫자/기호 포함';

  @override
  String get settingsAccountUpdating => '업데이트 중...';

  @override
  String get settingsAccountSetPassword => '비밀번호 설정';

  @override
  String get settingsAccountUpdatePassword => '비밀번호 업데이트';

  @override
  String get settingsAccountThemeTitle => '화면 테마';

  @override
  String get settingsAccountThemeSystem => '시스템 설정 따르기';

  @override
  String get settingsAccountThemeLight => '라이트 모드';

  @override
  String get settingsAccountThemeDark => '다크 모드';

  @override
  String get settingsAccountDefaultCurrency => '기본 통화';

  @override
  String get settingsAccountCurrencyCode => '통화 코드';

  @override
  String get settingsAccountUpdateDefaultCurrency => '기본 통화 업데이트';

  @override
  String get settingsAccountPasskeyTitle => 'Passkey 관리';

  @override
  String get settingsAccountNoPasskeys => '등록된 Passkey가 없습니다';

  @override
  String get settingsAccountAddPasskey => '+ Passkey 추가';

  @override
  String get settingsAccountGoogleTitle => 'Google 연결';

  @override
  String get settingsAccountLineTitle => 'LINE 연결';

  @override
  String get settingsAccountStatusPrefix => '현재 상태: ';

  @override
  String get settingsAccountLinkedGoogle => 'Google 계정이 연결되었습니다';

  @override
  String get settingsAccountNotLinkedGoogle => 'Google 계정이 연결되지 않았습니다';

  @override
  String get settingsAccountLinkGoogle => 'Google 계정 연결';

  @override
  String get settingsAccountUnlink => '연결 해제';

  @override
  String get settingsAccountLinkedLine => 'LINE 계정이 연결되었습니다';

  @override
  String get settingsAccountNotLinkedLine => 'LINE 계정이 연결되지 않았습니다';

  @override
  String get settingsAccountLinkLine => 'LINE 계정 연결';

  @override
  String get settingsAccountLineVerifying => 'LINE 확인 중…';

  @override
  String get settingsAccountSessionsTitle => '로그인된 기기';

  @override
  String get settingsAccountRefresh => '새로고침';

  @override
  String get settingsAccountDeviceName => '기기 이름';

  @override
  String get settingsAccountLoginTime => '로그인 시간';

  @override
  String get settingsAccountLoginIp => '로그인 IP';

  @override
  String get settingsAccountActions => '작업';

  @override
  String get settingsAccountUnknownDevice => '알 수 없는 기기';

  @override
  String get settingsAccountCurrentDeviceSuffix => ' (현재 기기)';

  @override
  String get settingsAccountSignOut => '로그아웃';

  @override
  String get settingsAccountNoSessions => '아직 로그인된 기기 기록이 없습니다';

  @override
  String get settingsAccountAuditTitle => '로그인 기록';

  @override
  String get settingsAccountCountry => '국가';

  @override
  String get settingsAccountMethod => '방법';

  @override
  String get settingsAccountDevice => '기기';

  @override
  String get settingsAccountAdminLogin => '관리자 로그인';

  @override
  String get settingsAccountYes => '예';

  @override
  String get settingsAccountNo => '아니요';

  @override
  String get settingsAccountDeleteTitle => '계정 삭제';

  @override
  String get settingsAccountDeleteDescription =>
      '계정을 삭제하면 거래, 계좌, 주식, Passkey, 설정이 영구 삭제되며 복구할 수 없습니다.';

  @override
  String get settingsAccountDeleteButton => '내 계정 삭제';

  @override
  String get settingsAccountDeleteModalTitle => '계정 삭제 확인';

  @override
  String get settingsAccountDeleteModalWarning =>
      '이 작업은 계정과 모든 데이터를 영구 삭제합니다. 거래, 계좌, 주식, Passkey, 설정이 모두 포함되며 되돌릴 수 없습니다.';

  @override
  String get settingsAccountDeletePasswordLabel => '삭제를 확인하려면 비밀번호를 입력하세요';

  @override
  String settingsAccountDeleteEmailLabel(Object email) {
    return '삭제를 확인하려면 계정 이메일 \"$email\"을 입력하세요';
  }

  @override
  String get settingsAccountDeleting => '삭제 중...';

  @override
  String get settingsAccountDeletePermanently => '계정 영구 삭제';

  @override
  String get settingsAccountMessagesCurrentPasswordRequired => '현재 비밀번호를 입력하세요';

  @override
  String get settingsAccountMessagesNewPasswordRequired => '새 비밀번호를 입력하세요';

  @override
  String get settingsAccountMessagesPasswordTooShort => '새 비밀번호는 8자 이상이어야 합니다';

  @override
  String get settingsAccountMessagesPasswordComplexity =>
      '새 비밀번호에는 대문자, 소문자, 숫자, 특수문자가 포함되어야 합니다';

  @override
  String get settingsAccountMessagesConfirmPasswordMismatch =>
      '새 비밀번호가 서로 일치하지 않습니다';

  @override
  String get settingsAccountMessagesLocalPasswordSet =>
      '비밀번호가 설정되었습니다. 이제 비밀번호로 로그인할 수 있습니다';

  @override
  String get settingsAccountMessagesPasswordUpdated => '비밀번호가 업데이트되었습니다';

  @override
  String get settingsAccountMessagesPasswordUpdateFailed =>
      '비밀번호를 업데이트하지 못했습니다';

  @override
  String get settingsAccountMessagesDisplayNameRequired => '표시 이름은 비워 둘 수 없습니다';

  @override
  String get settingsAccountMessagesDisplayNameUpdated => '표시 이름이 업데이트되었습니다';

  @override
  String get settingsAccountMessagesUpdateFailed => '업데이트하지 못했습니다';

  @override
  String get settingsAccountMessagesDeletePasskeyConfirm => '이 Passkey를 삭제할까요?';

  @override
  String get settingsAccountMessagesCurrencyInvalid => '통화는 3글자 코드여야 합니다';

  @override
  String get settingsAccountMessagesCurrencyUpdated => '기본 통화가 업데이트되었습니다';

  @override
  String get settingsAccountMessagesCurrencyUpdateFailed =>
      '기본 통화를 업데이트하지 못했습니다';

  @override
  String get settingsAccountMessagesSessionLoggedOut => '기기에서 로그아웃했습니다';

  @override
  String get settingsAccountMessagesSessionLogoutFailed => '기기 로그아웃에 실패했습니다';

  @override
  String get settingsAccountMessagesPasskeyUnsupported =>
      '이 브라우저는 Passkey를 지원하지 않습니다';

  @override
  String get settingsAccountMessagesAndroidDevice => 'Android 기기';

  @override
  String get settingsAccountMessagesComputerDevice => '컴퓨터';

  @override
  String get settingsAccountMessagesPasskeyRegisterFailed =>
      'Passkey를 등록하지 못했습니다';

  @override
  String get settingsAccountMessagesGoogleTokenPrompt =>
      '연결을 시뮬레이션하려면 Google ID Token을 붙여넣으세요';

  @override
  String get settingsAccountMessagesGoogleLinked => 'Google 계정이 연결되었습니다';

  @override
  String get settingsAccountMessagesGoogleLinkFailed => 'Google 계정을 연결하지 못했습니다';

  @override
  String get settingsAccountMessagesGoogleUnlinked => 'Google 계정 연결이 해제되었습니다';

  @override
  String get settingsAccountMessagesGoogleUnlinkFailed =>
      'Google 계정 연결을 해제하지 못했습니다';

  @override
  String get settingsAccountMessagesLineNotConfigured =>
      'LINE 로그인이 설정되어 있지 않습니다';

  @override
  String get settingsAccountMessagesLineLinkFailed => 'LINE 계정을 연결하지 못했습니다';

  @override
  String get settingsAccountMessagesLineUnlinked => 'LINE 계정 연결이 해제되었습니다';

  @override
  String get settingsAccountMessagesLineUnlinkFailed =>
      'LINE 계정 연결을 해제하지 못했습니다';

  @override
  String get settingsAccountMessagesDeletePasswordRequired =>
      '삭제를 확인하려면 비밀번호를 입력하세요';

  @override
  String get settingsAccountMessagesDeleteEmailMismatch =>
      '삭제를 확인하려면 올바른 계정 이메일을 입력하세요';

  @override
  String get settingsAccountMessagesDeleteFailed => '계정을 삭제하지 못했습니다';

  @override
  String get dashboardTitle => '대시보드';

  @override
  String dashboardSubtitle(Object month) {
    return '$month의 수입, 지출, 카테고리와 최근 거래입니다.';
  }

  @override
  String get dashboardUncategorized => '미분류';

  @override
  String get dashboardKpiTotalIncome => '총수입';

  @override
  String get dashboardKpiTotalExpense => '총지출';

  @override
  String get dashboardKpiNet => '순액';

  @override
  String get dashboardKpiTodayExpense => '오늘 지출';

  @override
  String get dashboardKpiBankAccounts => '은행 계좌';

  @override
  String get dashboardKpiStockMarketValue => '주식 평가액';

  @override
  String get dashboardOverviewTitle => '월간 현금흐름 요약';

  @override
  String get dashboardOverviewBalance => '이번 달 흑자';

  @override
  String get dashboardOverviewDeficit => '이번 달 적자';

  @override
  String get dashboardOverviewIncome => '수입';

  @override
  String get dashboardOverviewExpense => '지출';

  @override
  String get dashboardOverviewNet => '순액';

  @override
  String get dashboardRatioTitle => '수입 / 지출 비율';

  @override
  String get dashboardRatioIncomeShare => '수입 비중';

  @override
  String get dashboardRatioExpenseShare => '지출 비중';

  @override
  String get dashboardSectionsExpenseCategories => '지출 카테고리';

  @override
  String get dashboardSectionsIncomeCategories => '수입 카테고리';

  @override
  String get dashboardSectionsRecentTransactions => '최근 거래';

  @override
  String dashboardSectionsRecentCount(Object count) {
    return '최근 $count건';
  }

  @override
  String get dashboardEmptyNoExpense => '이번 달 지출이 없습니다';

  @override
  String get dashboardEmptyNoIncome => '이번 달 수입이 없습니다';

  @override
  String get dashboardEmptyNoTransactions => '이번 달 거래가 없습니다';

  @override
  String get dashboardTableDate => '날짜';

  @override
  String get dashboardTableCategory => '카테고리';

  @override
  String get dashboardTableNote => '메모';

  @override
  String get dashboardTableAmount => '금액';

  @override
  String get dashboardFiltersPreviousMonth => '이전 달';

  @override
  String get dashboardFiltersNextMonth => '다음 달';

  @override
  String get dashboardFiltersCurrentMonth => '이번 달';

  @override
  String get publicCommonBackHome => '홈으로 돌아가기';

  @override
  String get publicCommonPrivacy => '개인정보 처리방침';

  @override
  String get publicCommonTerms => '서비스 약관';

  @override
  String get publicCommonApiCredits => 'API 사용 및 크레딧';

  @override
  String publicCommonLastUpdated(Object date) {
    return '마지막 업데이트: $date';
  }

  @override
  String get publicCommonMetadataTitle => 'AssetPilot - 개인 재무 관리 센터';

  @override
  String get publicCommonMetadataDescription =>
      '지출, 예산, 대만 주식 투자와 분석을 위한 자체 호스팅 가능 암호화 개인 재무 관리자입니다.';

  @override
  String get publicCommonDatesApiCredits => '2026년 6월 11일';

  @override
  String get publicCommonDatesPrivacy => '2026년 6월 17일';

  @override
  String get publicCommonDatesTerms => '2026년 6월 11일';

  @override
  String get publicHomeTagline => '개인 재무 관리 센터';

  @override
  String get publicHomeLogin => '로그인';

  @override
  String get publicHomeRegister => '계정 만들기';

  @override
  String get publicHomeBadge => '자체 호스팅, 데이터 암호화, AGPL v3';

  @override
  String get publicHomeHeadline1 => '나만의 재무 컨트롤 센터';

  @override
  String get publicHomeHeadline2 => '홈 화면에서 먼저 확인하세요';

  @override
  String get publicHomeLeadBefore =>
      '대만 주식 투자, 수입과 지출, 예산, 보고서, 감사 기록을 한곳에서 관리합니다. 모든 금융 데이터는 저장 시';

  @override
  String get publicHomeLeadStrong => ' ChaCha20-Poly1305 ';

  @override
  String get publicHomeLeadAfter =>
      '로 암호화되며 특정 클라우드나 구독에 묶이지 않습니다. 로그인 전에 제품을 먼저 이해할 수 있습니다.';

  @override
  String get publicHomeStartUsing => '시작하기';

  @override
  String get publicHomeCreateFirst => '먼저 계정 만들기';

  @override
  String get publicHomeChipsOpenSource => '오픈소스 AGPL v3';

  @override
  String get publicHomeChipsEncrypted => '로컬 암호화 저장';

  @override
  String get publicHomeChipsNoCloudLock => '외부 클라우드 종속 없음';

  @override
  String get publicHomeChipsDocker => 'Docker 한 줄 배포';

  @override
  String get publicHomeChipsOpenapi => 'OpenAPI 3.2';

  @override
  String get publicHomeStatsModulesValue => '6+';

  @override
  String get publicHomeStatsModulesLabel => '핵심 모듈';

  @override
  String get publicHomeStatsModulesSublabel => '가계부, 주식, 보고서, 거버넌스';

  @override
  String get publicHomeStatsEncryptionValue => 'ChaCha20';

  @override
  String get publicHomeStatsEncryptionLabel => '데이터 암호화';

  @override
  String get publicHomeStatsEncryptionSublabel => 'Poly1305 AEAD + PBKDF2';

  @override
  String get publicHomeStatsStockSourceValue => 'TWSE';

  @override
  String get publicHomeStatsStockSourceLabel => '시세 출처';

  @override
  String get publicHomeStatsStockSourceSublabel => '장중, 장마감, 예비 경로';

  @override
  String get publicHomeStatsPrecisionValue => 'FIFO';

  @override
  String get publicHomeStatsPrecisionLabel => '정밀 계산';

  @override
  String get publicHomeStatsPrecisionSublabel => 'decimal.js 기반 로트별 손익';

  @override
  String get publicHomePreLoginNote =>
      '로그인하지 않아도 AssetPilot의 기능, 데이터 처리 방식, 배포 특성을 먼저 살펴본 뒤 로그인하거나 계정을 만들 수 있습니다.';

  @override
  String get publicHomeWhyLabel => 'AssetPilot을 쓰는 이유';

  @override
  String get publicHomeWhyTitle => '일상 기록, 투자 추적, 데이터 통제를 한곳에서';

  @override
  String get publicHomeWhyDescription =>
      'AssetPilot은 개인 재무를 직접 관리하는 사람을 위해 만들었습니다. 현금흐름, 예산, 대만 주식 추적을 모으면서 내보내기, 감사, 자체 호스팅의 선택지를 그대로 둡니다.';

  @override
  String get publicHomePillarsFinanceTitle => '현금흐름과 예산 관리';

  @override
  String get publicHomePillarsFinanceTag => '가계부 핵심';

  @override
  String get publicHomePillarsFinanceItemsOne => '여러 계좌 잔액과 계좌 간 이체 추적';

  @override
  String get publicHomePillarsFinanceItemsTwo => '월별 및 카테고리별 예산 진행률 관리';

  @override
  String get publicHomePillarsFinanceItemsThree => '반복 수입과 지출 자동 생성';

  @override
  String get publicHomePillarsFinanceItemsFour => '카테고리, 날짜, 삭제 일괄 처리';

  @override
  String get publicHomePillarsStocksTitle => '대만 주식 투자 추적';

  @override
  String get publicHomePillarsStocksTag => '주식 모듈';

  @override
  String get publicHomePillarsStocksItemsOne => 'TWSE 시세 조회와 배당락 정보 동기화';

  @override
  String get publicHomePillarsStocksItemsTwo => 'FIFO 기반 정밀 실현 손익 계산';

  @override
  String get publicHomePillarsStocksItemsThree => '배당 기록과 계좌 입금 추적';

  @override
  String get publicHomePillarsStocksItemsFour => '정기 투자와 상장폐지 표시 관리';

  @override
  String get publicHomePillarsSecurityTitle => '보안과 데이터 거버넌스';

  @override
  String get publicHomePillarsSecurityTag => '거버넌스';

  @override
  String get publicHomePillarsSecurityItemsOne =>
      'ChaCha20-Poly1305 저장 데이터 암호화';

  @override
  String get publicHomePillarsSecurityItemsTwo => '비밀번호, Google, Passkey 로그인';

  @override
  String get publicHomePillarsSecurityItemsThree => '내보내기/가져오기, 백업, 복원, 감사 로그';

  @override
  String get publicHomePillarsSecurityItemsFour =>
      'Rate limit, CSP, CSV injection 방지';

  @override
  String get publicHomePillarsSelfHostedTitle => '자체 호스팅과 계약';

  @override
  String get publicHomePillarsSelfHostedTag => 'Self-hosted';

  @override
  String get publicHomePillarsSelfHostedItemsOne => 'Docker 한 줄로 시작';

  @override
  String get publicHomePillarsSelfHostedItemsTwo => 'amd64와 arm64 지원';

  @override
  String get publicHomePillarsSelfHostedItemsThree => 'OpenAPI 3.2 계약 문서';

  @override
  String get publicHomePillarsSelfHostedItemsFour =>
      '북마크와 새로고침에 강한 URL-first 라우팅';

  @override
  String get publicHomeQuickStartLabel => '빠른 시작';

  @override
  String get publicHomeQuickStartTitle => '내 서버에서 60초 만에 실행';

  @override
  String get publicHomeQuickStartDescription =>
      'Docker로 빠르게 시작하세요. 첫 실행 시 JWT와 데이터베이스 암호화 키가 자동 생성됩니다. amd64와 arm64를 지원해 NAS, VPS 또는 직접 운영하는 Docker 호스트에 잘 맞습니다.';

  @override
  String get publicHomeQuickStartChipsImage => '약 180 MB 이미지';

  @override
  String get publicHomeQuickStartChipsArch => 'amd64 + arm64';

  @override
  String get publicHomeQuickStartChipsHealth => '내장 헬스 체크';

  @override
  String get publicHomeQuickStartChipsKeys => '첫 시작 시 키 자동 생성';

  @override
  String get publicHomeTechLabel => '기술 스택';

  @override
  String get publicHomeTechTitle => '기술 스택과 공개 정보';

  @override
  String get publicHomeTechDescription =>
      '주요 기술, 외부 데이터 출처, 라이선스 정보를 명확히 제시해 사용 전 서비스가 어떻게 작동하는지 이해할 수 있습니다.';

  @override
  String get publicHomeFooter => 'GNU AGPL v3. 직접 호스팅하고 통제하며 백업하는 개인 자산 관리.';

  @override
  String get publicApiCreditsPageTitle => 'API 사용 및 크레딧';

  @override
  String get publicApiCreditsPageMetadataTitle => 'API 사용 및 크레딧 — AssetPilot';

  @override
  String get publicApiCreditsPageBadge => '외부 API 투명성';

  @override
  String get publicApiCreditsPageDescription =>
      'AssetPilot은 기능에 필요할 때만 외부 데이터 출처에 연결합니다. 이 페이지는 자체 호스팅 시 컴플라이언스를 확인할 수 있도록 각 API의 목적, 라이선스 정보, 전송되는 데이터 범위를 정리합니다.';

  @override
  String get publicApiCreditsPageStatsExternalServices => '외부 서비스';

  @override
  String get publicApiCreditsPageStatsFreeSupported => '무료 지원';

  @override
  String get publicApiCreditsPageStatsAttributionRequired => '출처 표기 필요';

  @override
  String get publicApiCreditsPageServiceKindsData => '데이터 조회';

  @override
  String get publicApiCreditsPageServiceKindsAuth => '인증';

  @override
  String get publicApiCreditsPageServiceKindsEmail => '이메일 채널';

  @override
  String get publicApiCreditsPageServiceKindsBackup => '클라우드 백업';

  @override
  String get publicApiCreditsPageTransparencyTitle => '데이터 투명성';

  @override
  String get publicApiCreditsPageTransparencyText =>
      '아래 상황에서는 기능에 필요한 최소한의 데이터만 보내며, 사용자의 금융 세부 정보를 제3자 서비스에 넘기지 않습니다.';

  @override
  String get publicApiCreditsPageMinNecessary => '최소 필요 데이터 원칙';

  @override
  String get publicApiCreditsPageUsageNotesFxTitle => '환율 동기화';

  @override
  String get publicApiCreditsPageUsageNotesFxText =>
      '공개 환율 데이터만 조회하며 개인 금융 세부 정보는 보내지 않습니다.';

  @override
  String get publicApiCreditsPageUsageNotesStockTitle => '대만 주식 데이터';

  @override
  String get publicApiCreditsPageUsageNotesStockText =>
      '주식 코드와 시장 데이터만 보내며 계좌, 보유 원가, 거래 기록은 포함하지 않습니다.';

  @override
  String get publicApiCreditsPageUsageNotesAuditTitle => '로그인 감사';

  @override
  String get publicApiCreditsPageUsageNotesAuditText =>
      'IPinfo는 로그인 기록에서 국가 정보를 표시하는 데만 사용됩니다.';

  @override
  String get publicApiCreditsPageUsageNotesLoginTitle => '타사 로그인';

  @override
  String get publicApiCreditsPageUsageNotesLoginText =>
      'Google과 LINE은 사용자가 직접 로그인하거나 계정을 연결할 때만 사용됩니다.';

  @override
  String get publicApiCreditsPageUsageNotesBackupTitle => '클라우드 백업';

  @override
  String get publicApiCreditsPageUsageNotesBackupText =>
      'MEGA S4는 관리자가 명시적으로 백업을 업로드할 때만 전체 데이터베이스 파일을 받습니다.';

  @override
  String get publicApiCreditsPageServiceListTitle => '외부 서비스 목록';

  @override
  String publicApiCreditsPageServiceSummary(
    Object total,
    Object free,
    Object paid,
  ) {
    return '총 $total개 서비스 중 $free개는 무료 플랜을 지원하고 $paid개는 유료 플랜을 제공합니다.';
  }

  @override
  String get publicApiCreditsPageOfficialSite => '공식 사이트';

  @override
  String get publicApiCreditsPageFreePlan => '무료 플랜';

  @override
  String get publicApiCreditsPagePaidPlan => '유료 플랜';

  @override
  String get publicApiCreditsPageSupported => '지원';

  @override
  String get publicApiCreditsPageUnavailable => '제공 안 함';

  @override
  String get publicApiCreditsPageDescriptionsExchangeRate =>
      'TWD를 기준 통화로 하는 전 세계 실시간 환율';

  @override
  String get publicApiCreditsPageDescriptionsIpinfo =>
      '로그인 감사 기록의 국가 필드를 위한 IP 위치 조회';

  @override
  String get publicApiCreditsPageDescriptionsTwse => '실시간 시세, 배당락 데이터, 주식명 조회';

  @override
  String get publicApiCreditsPageDescriptionsGoogle => 'Google SSO 로그인';

  @override
  String get publicApiCreditsPageDescriptionsLine => 'LINE 로그인 및 계정 연결';

  @override
  String get publicApiCreditsPageDescriptionsSmtp =>
      'Gmail, Outlook 또는 기타 SMTP server를 통한 관리자 자산 보고서 이메일 발송 채널';

  @override
  String get publicApiCreditsPageDescriptionsZeabur =>
      'HTTP REST API를 통한 관리자 자산 보고서 이메일 발송 채널';

  @override
  String get publicApiCreditsPageDescriptionsResend => '관리자 자산 보고서 이메일 발송 채널';

  @override
  String get publicApiCreditsPageDescriptionsMega =>
      '관리자 전체 PostgreSQL SQL 백업을 저장하는 S3 호환 오브젝트 스토리지 대상';

  @override
  String get publicAppCallbackReturningTitle => 'AssetPilot 앱으로 돌아가는 중...';

  @override
  String get publicAppCallbackReturningBody =>
      '자동으로 돌아가지 않으면 최신 AssetPilot Android 앱이 설치되어 있는지 확인하세요.';

  @override
  String get publicAppCallbackPasskeyTitle => 'AssetPilot Passkey 로그인';

  @override
  String get publicAppCallbackPasskeyStarting => 'Passkey 로그인을 시작하는 중...';

  @override
  String get publicAppCallbackPasskeyUnsupported =>
      '이 브라우저는 Passkey를 지원하지 않습니다';

  @override
  String get publicAppCallbackPasskeyChallengeFailed =>
      'Passkey 로그인 challenge를 만들지 못했습니다';

  @override
  String get publicAppCallbackPasskeyVerify => '기기에서 Passkey 인증을 완료하세요...';

  @override
  String get publicAppCallbackPasskeyLoginFailed => 'Passkey 로그인 실패';

  @override
  String get publicAppCallbackReturningApp => '앱으로 돌아가는 중...';

  @override
  String get publicAppCallbackAppTicketFailed => '앱 로그인 credential을 만들지 못했습니다';

  @override
  String get featuresCommonActions => '작업';

  @override
  String get featuresCommonAccount => '계좌';

  @override
  String get featuresCommonAmount => '금액';

  @override
  String get featuresCommonDate => '날짜';

  @override
  String get featuresCommonEndDate => '종료';

  @override
  String get featuresCommonNote => '메모';

  @override
  String get featuresCommonStartDate => '시작';

  @override
  String get featuresCommonStatus => '상태';

  @override
  String get featuresCommonStock => '주식';

  @override
  String get featuresCommonType => '유형';

  @override
  String get featuresCommonName => '이름';

  @override
  String get featuresCommonCurrency => '통화';

  @override
  String get featuresCommonExchangeRate => '환율';

  @override
  String get featuresCommonIncome => '수입';

  @override
  String get featuresCommonExpense => '지출';

  @override
  String get featuresCommonUncategorized => '미분류';

  @override
  String get featuresCommonUnspecified => '미지정';

  @override
  String get featuresCommonAutoCalculate => '자동 계산';

  @override
  String get featuresCommonExcludeFromStats => '통계에서 제외';

  @override
  String get featuresCommonTopLevelCategory => '- 최상위 -';

  @override
  String get featuresCommonNotRecorded => '-';

  @override
  String get featuresCategoriesTitle => '카테고리 관리';

  @override
  String get featuresCategoriesExpenseTab => '지출 카테고리';

  @override
  String get featuresCategoriesIncomeTab => '수입 카테고리';

  @override
  String get featuresCategoriesAddCategory => '카테고리 추가';

  @override
  String get featuresCategoriesEditCategory => '카테고리 수정';

  @override
  String get featuresCategoriesNewCategory => '카테고리 추가';

  @override
  String get featuresCategoriesNameLabel => '이름 *';

  @override
  String get featuresCategoriesTypeLabel => '유형';

  @override
  String get featuresCategoriesParentLabel => '상위 카테고리';

  @override
  String get featuresCategoriesColorLabel => '색상';

  @override
  String get featuresCategoriesExpense => '지출';

  @override
  String get featuresCategoriesIncome => '수입';

  @override
  String get featuresCategoriesDeleteMessage =>
      '이 카테고리를 삭제할까요? 하위 카테고리도 함께 삭제됩니다.';

  @override
  String get featuresCategoriesMessagesNameRequired => '카테고리 이름을 입력하세요';

  @override
  String get featuresCategoriesMessagesDeleteFailed => '삭제하지 못했습니다';

  @override
  String get featuresBudgetTitle => '예산';

  @override
  String featuresBudgetMonthLabel(Object year, Object month) {
    return '$year/$month';
  }

  @override
  String get featuresBudgetTotalBudget => '이번 달 총예산';

  @override
  String get featuresBudgetSpent => '사용액';

  @override
  String get featuresBudgetAddBudget => '예산 추가';

  @override
  String get featuresBudgetEditBudget => '예산 수정';

  @override
  String get featuresBudgetNewBudget => '예산 추가';

  @override
  String get featuresBudgetCategoryLabel => '카테고리 (비워 두면 총예산)';

  @override
  String get featuresBudgetTotalBudgetOption => '- 총예산 -';

  @override
  String get featuresBudgetAmountLabel => '예산 금액 *';

  @override
  String get featuresBudgetTotalBudgetName => '(총예산)';

  @override
  String get featuresBudgetOverBudget => '예산 초과';

  @override
  String get featuresBudgetDeleteMessage => '이 예산을 삭제할까요?';

  @override
  String get featuresBudgetMessagesAmountRequired => '올바른 예산 금액을 입력하세요';

  @override
  String get featuresReportsTitle => '보고서';

  @override
  String get featuresReportsTabsCategory => '카테고리 분석';

  @override
  String get featuresReportsTabsTrend => '추세 분석';

  @override
  String get featuresReportsTabsDaily => '일별 지출';

  @override
  String get featuresReportsPeriodsThisMonth => '이번 달';

  @override
  String get featuresReportsPeriodsLastMonth => '지난달';

  @override
  String get featuresReportsPeriodsLast3 => '최근 3개월';

  @override
  String get featuresReportsPeriodsLast6 => '최근 6개월';

  @override
  String get featuresReportsPeriodsThisYear => '올해';

  @override
  String get featuresReportsPeriodsCustom => '직접 설정';

  @override
  String get featuresReportsPeriodLabel => '기간';

  @override
  String get featuresReportsStart => '시작';

  @override
  String get featuresReportsEnd => '종료';

  @override
  String get featuresReportsCurrentTotal => '현재 합계';

  @override
  String get featuresReportsComparedPrevious => '이전 기간 대비';

  @override
  String featuresReportsPreviousNoData(Object delta) {
    return '$delta, 이전 기간 데이터 없음';
  }

  @override
  String featuresReportsCompareWithRate(Object delta, Object rate) {
    return '$delta ($rate%)';
  }

  @override
  String featuresReportsDetailTitle(Object type) {
    return '상세: $type';
  }

  @override
  String featuresReportsTotal(Object amount) {
    return '합계: $amount';
  }

  @override
  String get featuresReportsSelectedCategory => '선택한 카테고리: ';

  @override
  String featuresReportsSelectedCategoryAmount(Object amount) {
    return ', 금액 $amount';
  }

  @override
  String get featuresReportsViewTransactions => '관련 거래 보기';

  @override
  String get featuresRecurringTitle => '반복 수입/지출';

  @override
  String get featuresRecurringAdd => '반복 항목 추가';

  @override
  String get featuresRecurringEdit => '반복 항목 수정';

  @override
  String get featuresRecurringCreate => '반복 항목 추가';

  @override
  String get featuresRecurringAmountLabel => '금액 *';

  @override
  String get featuresRecurringFxFeeLabel => '해외 결제 수수료 (TWD)';

  @override
  String get featuresRecurringFxFeePlaceholder => '비워 두면 카드 수수료율로 자동 계산';

  @override
  String featuresRecurringFxFeeHint(Object rate, Object suggestion) {
    return '카드 해외 결제 수수료 $rate%$suggestion';
  }

  @override
  String featuresRecurringFxFeeSuggestion(Object amount) {
    return ', 권장 금액 NT\$ $amount';
  }

  @override
  String get featuresRecurringLatestRateLoading => '최신 환율을 가져오는 중...';

  @override
  String get featuresRecurringCategory => '카테고리';

  @override
  String get featuresRecurringFrequency => '주기';

  @override
  String get featuresRecurringStartDate => '시작일';

  @override
  String featuresRecurringNextRun(Object date) {
    return '다음 실행: $date';
  }

  @override
  String featuresRecurringCategoryLine(Object name) {
    return '카테고리: $name';
  }

  @override
  String featuresRecurringAccountLine(Object name) {
    return '계좌: $name';
  }

  @override
  String featuresRecurringFxFeeLine(Object amount) {
    return '해외 결제 수수료: NT\$ $amount';
  }

  @override
  String get featuresRecurringDeleteMessage => '이 반복 항목을 삭제할까요?';

  @override
  String get featuresRecurringCreatingTransfer => '생성 중...';

  @override
  String get featuresRecurringConfirmTransfer => '이체 확인';

  @override
  String get featuresRecurringFrequencyLabelsDaily => '매일';

  @override
  String get featuresRecurringFrequencyLabelsWeekly => '매주';

  @override
  String get featuresRecurringFrequencyLabelsMonthly => '매월';

  @override
  String get featuresRecurringFrequencyLabelsYearly => '매년';

  @override
  String get featuresRecurringMessagesAmountRequired => '올바른 금액을 입력하세요';

  @override
  String get featuresDataTransferTitle => '데이터 내보내기/가져오기';

  @override
  String get featuresDataTransferExportStartDate => '내보내기 시작일';

  @override
  String get featuresDataTransferExportEndDate => '내보내기 종료일';

  @override
  String featuresDataTransferCsvColumns(Object columns) {
    return 'CSV 내보내기와 가져오기를 지원합니다. 열: $columns';
  }

  @override
  String get featuresDataTransferExportCsv => 'CSV 내보내기';

  @override
  String get featuresDataTransferExporting => '내보내는 중...';

  @override
  String get featuresDataTransferChooseCsv => '가져올 CSV 선택';

  @override
  String get featuresDataTransferImporting => '가져오는 중...';

  @override
  String featuresDataTransferImported(Object count) {
    return '가져옴: $count건';
  }

  @override
  String featuresDataTransferSkipped(Object count) {
    return '건너뜀: $count건';
  }

  @override
  String featuresDataTransferCreatedCategories(Object items) {
    return '자동 생성된 카테고리: $items';
  }

  @override
  String featuresDataTransferCreatedAccounts(Object items) {
    return '자동 생성된 계좌: $items';
  }

  @override
  String get featuresDataTransferWarning => '경고';

  @override
  String get featuresDataTransferError => '오류';

  @override
  String featuresDataTransferRowIssue(Object row, Object reason) {
    return '$row행: $reason';
  }

  @override
  String get featuresDataTransferModulesAccounts => '계좌';

  @override
  String get featuresDataTransferModulesTransactions => '거래';

  @override
  String get featuresDataTransferModulesCategories => '카테고리';

  @override
  String get featuresDataTransferModulesStockTransactions => '주식 거래';

  @override
  String get featuresDataTransferModulesStockDividends => '배당';

  @override
  String get featuresDataTransferMessagesExportSuccess => '내보내기가 완료되었습니다';

  @override
  String get featuresDataTransferMessagesExportFailed => '내보내기에 실패했습니다';

  @override
  String get featuresDataTransferMessagesEmptyCsv => '가져올 CSV 데이터가 없습니다';

  @override
  String featuresDataTransferMessagesImportComplete(Object name) {
    return '$name 가져오기가 완료되었습니다';
  }

  @override
  String get featuresDataTransferMessagesImportFailed => '가져오기에 실패했습니다';

  @override
  String get featuresDataTransferMessagesBundleExportDone =>
      '전체 데이터 백업을 다운로드했습니다';

  @override
  String get featuresDataTransferMessagesBundleExportFailed =>
      '전체 데이터 백업을 다운로드하지 못했습니다';

  @override
  String get featuresDataTransferMessagesRestoreDone => '복원이 완료되었습니다';

  @override
  String get featuresDataTransferMessagesBundleRestoreFailed =>
      '데이터 백업을 복원하지 못했습니다';

  @override
  String get featuresDataTransferMessagesDbExportDone => '데이터베이스 백업을 다운로드했습니다';

  @override
  String get featuresDataTransferMessagesDbExportFailed =>
      '데이터베이스 백업을 만들지 못했습니다';

  @override
  String get featuresDataTransferMessagesDbRestoreDone => '데이터베이스가 복원되었습니다';

  @override
  String get featuresDataTransferMessagesDbRestoreFailed =>
      '데이터베이스를 복원하지 못했습니다';

  @override
  String featuresDataTransferMessagesUploadedTo(Object bucket, Object key) {
    return '$bucket/$key에 업로드했습니다';
  }

  @override
  String get featuresDataTransferMessagesMegaBackupFailed => 'MEGA S4 백업 실패';

  @override
  String get featuresDataTransferMessagesRequireOneField => '하나 이상의 필드를 입력하세요';

  @override
  String get featuresDataTransferMessagesSaved => '설정이 저장되었습니다';

  @override
  String get featuresDataTransferMessagesSaveFailed => '설정을 저장하지 못했습니다';

  @override
  String get featuresDataTransferBundleTitle => '전체 데이터 백업 (사진 포함)';

  @override
  String get featuresDataTransferBundleDescription1 =>
      '거래, 계좌, 카테고리, 예산, 청구 주기, 환율, 주식, 영수증 사진 등 모든 개인 데이터를 하나의 ZIP으로 다운로드합니다.';

  @override
  String get featuresDataTransferBundleDescription2 =>
      '같은 ZIP 파일을 업로드해 데이터를 복원할 수 있습니다.';

  @override
  String get featuresDataTransferBundleRestorePrefix => '복원은';

  @override
  String get featuresDataTransferBundleMergeMode => '병합 모드';

  @override
  String get featuresDataTransferBundleRestoreMiddle =>
      '를 사용합니다. 기존 데이터는 건너뛰고 없는 항목만 추가합니다;';

  @override
  String get featuresDataTransferBundleNoOverwrite =>
      '현재 데이터는 삭제되거나 덮어쓰기 되지 않습니다';

  @override
  String get featuresDataTransferBundleDownload => '전체 데이터 백업 다운로드';

  @override
  String get featuresDataTransferBundleDownloading => '다운로드 준비 중...';

  @override
  String get featuresDataTransferBundleRestore => '복원할 데이터 백업 업로드';

  @override
  String get featuresDataTransferBundleRestoring => '복원 중...';

  @override
  String get featuresDataTransferDatabaseTitle => '전체 데이터베이스 백업 / 복원';

  @override
  String get featuresDataTransferDatabaseDescription =>
      '관리자 전용입니다. SQLite 모드에서는 `.db` 백업을 다운로드하고 PostgreSQL에서는 `.sql`을 다운로드합니다. 복원하려면 해당 형식의 파일을 업로드하세요.';

  @override
  String get featuresDataTransferDatabaseDownload => '데이터베이스 백업 다운로드';

  @override
  String get featuresDataTransferDatabaseDownloading => '다운로드 중...';

  @override
  String get featuresDataTransferDatabaseRestore => '복원할 데이터베이스 백업 선택';

  @override
  String get featuresDataTransferDatabaseRestoring => '복원 중...';

  @override
  String get featuresDataTransferMegaTitle => 'MEGA S4 클라우드 백업';

  @override
  String get featuresDataTransferMegaDescription =>
      '현재 SQLite 전체 백업을 MEGA S4 bucket의 object로 업로드합니다. 연결 정보는 서버 환경 변수로 설정되며, 키는 브라우저에 입력하거나 표시하지 않습니다.';

  @override
  String get featuresDataTransferMegaState => '상태: ';

  @override
  String get featuresDataTransferMegaConfigured => '설정됨';

  @override
  String get featuresDataTransferMegaNotConfigured => '설정 미완료';

  @override
  String get featuresDataTransferMegaBucket => 'Bucket: ';

  @override
  String featuresDataTransferMegaMissing(Object items) {
    return '누락된 환경 변수: $items';
  }

  @override
  String get featuresDataTransferMegaUpload => 'MEGA S4로 백업 업로드';

  @override
  String get featuresDataTransferMegaUploading => '업로드 중...';

  @override
  String get featuresDataTransferMegaConfigure => '설정';

  @override
  String get featuresDataTransferMegaCancelConfigure => '설정 취소';

  @override
  String get featuresDataTransferMegaFormHelp =>
      '설정은 서버의 영구 파일에 저장되고 즉시 적용됩니다. 키 필드는 다시 입력해야 하며 자동으로 채워지지 않습니다.';

  @override
  String get featuresDataTransferMegaBucketName => 'Bucket 이름';

  @override
  String get featuresDataTransferMegaPrefix => 'Prefix (선택 사항)';

  @override
  String get featuresDataTransferMegaEndpoint =>
      'Endpoint (선택 사항, 비워 두면 자동 감지)';

  @override
  String get featuresDataTransferMegaSaveSettings => '설정 저장';

  @override
  String get featuresAccountsTitle => '계좌';

  @override
  String get featuresAccountsTypeLabelsBank => '은행 계좌';

  @override
  String get featuresAccountsTypeLabelsCredit_card => '신용카드';

  @override
  String get featuresAccountsTypeLabelsCash => '현금';

  @override
  String get featuresAccountsTypeLabelsVirtual_wallet => '전자지갑';

  @override
  String get featuresAccountsTypeLabelsOther => '기타';

  @override
  String get featuresAccountsTotalAssets => '총자산';

  @override
  String get featuresAccountsCreditOutstanding => '카드 미결제액';

  @override
  String get featuresAccountsAddAccount => '계좌 추가';

  @override
  String get featuresAccountsEditAccount => '계좌 수정';

  @override
  String get featuresAccountsNewAccount => '계좌 추가';

  @override
  String get featuresAccountsAccountName => '계좌 이름 *';

  @override
  String get featuresAccountsInitialBalance => '초기 잔액';

  @override
  String get featuresAccountsInitialBalanceEdit => '초기 잔액 / 현재 설정';

  @override
  String get featuresAccountsLinkedBank => '은행';

  @override
  String get featuresAccountsUngrouped => '그룹 없음';

  @override
  String get featuresAccountsOverseasFeeRate => '해외 결제 수수료율 (%)';

  @override
  String get featuresAccountsStatementClosingDay => '명세서 마감일 (1-31)';

  @override
  String get featuresAccountsStatementClosingDayPlaceholder =>
      '예: 15. 현재 주기를 계산하지 않으려면 비워 두세요.';

  @override
  String get featuresAccountsExcludeFromTotal => '총자산에 포함하지 않음';

  @override
  String get featuresAccountsOtherAccounts => '기타 계좌';

  @override
  String featuresAccountsConvertedTotal(Object amount) {
    return '환산 후 합계: $amount';
  }

  @override
  String featuresAccountsLinkedBankLine(Object name) {
    return '연결된 은행: $name';
  }

  @override
  String featuresAccountsOverseasFeeRateLine(Object rate) {
    return '해외 결제 수수료: $rate%';
  }

  @override
  String featuresAccountsClosingDayLine(Object day) {
    return '월 마감일: $day';
  }

  @override
  String featuresAccountsCycleSpending(Object amount) {
    return '현재 주기 지출: $amount';
  }

  @override
  String get featuresAccountsLastCycleBill => '이전 명세서: ';

  @override
  String featuresAccountsBillSpending(Object amount) {
    return '지출 $amount';
  }

  @override
  String featuresAccountsBillPaid(Object amount) {
    return '결제 $amount';
  }

  @override
  String get featuresAccountsViewCycles => '주기 상세 보기 ›';

  @override
  String get featuresAccountsRepaymentTitle => '신용카드 결제';

  @override
  String get featuresAccountsRepaymentPaymentAccount => '결제 계좌';

  @override
  String get featuresAccountsRepaymentPaymentDate => '결제일';

  @override
  String get featuresAccountsRepaymentNoLinkedCards => '이 은행에 연결된 카드가 없습니다';

  @override
  String featuresAccountsRepaymentCurrentBalance(Object amount) {
    return '현재 잔액: $amount';
  }

  @override
  String get featuresAccountsRepaymentRepaymentAmount => '결제 금액';

  @override
  String get featuresAccountsRepaymentConfirm => '결제 확인';

  @override
  String get featuresAccountsDeleteMessage => '이 계좌를 삭제할까요?';

  @override
  String get featuresAccountsCyclesTitle => '명세서 주기 상세';

  @override
  String featuresAccountsCyclesClosingDay(Object name, Object day) {
    return '$name 월 마감일 $day';
  }

  @override
  String get featuresAccountsCyclesHelp =>
      '결제는 마감된 명세서에 매칭됩니다. 마감 이후 결제한 금액은 해당 주기에 반영됩니다.';

  @override
  String get featuresAccountsCyclesPeriod => '기간';

  @override
  String get featuresAccountsCyclesSpending => '지출';

  @override
  String get featuresAccountsCyclesPayment => '실제 결제';

  @override
  String get featuresAccountsCyclesCurrent => '현재';

  @override
  String get featuresAccountsFxTitle => '환율 관리';

  @override
  String get featuresAccountsFxAutoUpdate => '환율 자동 업데이트';

  @override
  String get featuresAccountsFxSyncNow => '지금 동기화';

  @override
  String get featuresAccountsFxSyncing => '동기화 중...';

  @override
  String featuresAccountsFxLastSynced(Object date) {
    return '마지막 동기화: $date';
  }

  @override
  String get featuresAccountsFxCurrency => '통화';

  @override
  String get featuresAccountsFxUnitToTwd => '1 단위 = TWD';

  @override
  String get featuresAccountsFxEmpty => '설정된 외화 환율이 없습니다';

  @override
  String get featuresAccountsFxCurrencyLabel => '통화 (예: USD)';

  @override
  String get featuresAccountsFxRateToTwd => 'TWD 기준 환율';

  @override
  String get featuresAccountsFxAddOrUpdate => '추가 / 업데이트';

  @override
  String get featuresAccountsMessagesNameRequired => '계좌 이름을 입력하세요';

  @override
  String get featuresAccountsMessagesRepaymentAccountRequired => '결제 계좌를 선택하세요';

  @override
  String get featuresAccountsMessagesRepaymentAmountRequired =>
      '하나 이상의 카드 결제 금액을 입력하세요';

  @override
  String get featuresAccountsMessagesCurrencyInvalid => '통화는 3글자 코드여야 합니다';

  @override
  String get featuresAccountsMessagesRateInvalid => '올바른 환율을 입력하세요';

  @override
  String get featuresAccountsMessagesSaved => '저장되었습니다';

  @override
  String get featuresAccountsMessagesSaveFailed => '저장하지 못했습니다';

  @override
  String get featuresAccountsMessagesDeleteFailed => '삭제하지 못했습니다';

  @override
  String get featuresAccountsMessagesRatesUpdated => '환율이 업데이트되었습니다';

  @override
  String get featuresAccountsMessagesSyncFailed => '동기화에 실패했습니다';

  @override
  String get featuresAccountsMessagesLoadFailed => '불러오지 못했습니다';

  @override
  String get featuresTransactionsTitle => '거래';

  @override
  String get featuresTransactionsSearchPlaceholder => '메모 검색...';

  @override
  String get featuresTransactionsAllTypes => '모든 유형';

  @override
  String get featuresTransactionsAllAccounts => '모든 계좌';

  @override
  String get featuresTransactionsAllCategories => '모든 카테고리';

  @override
  String get featuresTransactionsTransfer => '이체';

  @override
  String get featuresTransactionsFuture => '예정 거래';

  @override
  String featuresTransactionsParentAll(Object name) {
    return '$name (전체)';
  }

  @override
  String get featuresTransactionsStartDateTitle => '시작일';

  @override
  String get featuresTransactionsEndDateTitle => '종료일';

  @override
  String get featuresTransactionsAdd => '거래 추가';

  @override
  String get featuresTransactionsEdit => '거래 수정';

  @override
  String get featuresTransactionsCreate => '거래 추가';

  @override
  String get featuresTransactionsAccountTransfer => '계좌 간 이체';

  @override
  String get featuresTransactionsBatchCategory => '카테고리 일괄 변경';

  @override
  String get featuresTransactionsBatchDate => '날짜 일괄 변경';

  @override
  String featuresTransactionsDeleteSelected(Object count) {
    return '선택 삭제 ($count)';
  }

  @override
  String get featuresTransactionsPageIncome => '현재 페이지 수입';

  @override
  String get featuresTransactionsPageExpense => '현재 페이지 지출';

  @override
  String get featuresTransactionsPageTotal => '현재 페이지 합계';

  @override
  String get featuresTransactionsPageSummaryAria => '현재 페이지 거래 요약';

  @override
  String get featuresTransactionsEmpty => '조건에 맞는 거래가 없습니다';

  @override
  String featuresTransactionsSource(Object name) {
    return '출처: $name';
  }

  @override
  String get featuresTransactionsFxFee => '해외 카드 수수료';

  @override
  String get featuresTransactionsPhotoOne => '사진 1장';

  @override
  String featuresTransactionsPhotoCount(Object count) {
    return '사진 $count장';
  }

  @override
  String get featuresTransactionsDateRequiredLabel => '날짜 *';

  @override
  String get featuresTransactionsAmountRequiredLabel => '금액 *';

  @override
  String featuresTransactionsFxRateLabel(Object currency) {
    return '환율 (1 $currency = ? TWD)';
  }

  @override
  String get featuresTransactionsFxRatePlaceholder => '비워 두면 시스템 환율 사용';

  @override
  String get featuresTransactionsLatestRateLoading => '최신 환율을 가져오는 중...';

  @override
  String get featuresTransactionsFxFeePlaceholder => '비워 두면 카드 수수료율로 자동 계산';

  @override
  String featuresTransactionsFxFeeHint(Object rate, Object suggestion) {
    return '카드 해외 결제 수수료 $rate%$suggestion';
  }

  @override
  String featuresTransactionsFxFeeSuggestion(Object amount) {
    return ', 권장 금액 NT\$ $amount';
  }

  @override
  String get featuresTransactionsPhotos => '사진';

  @override
  String get featuresTransactionsLoadingPhotos => '사진 불러오는 중...';

  @override
  String get featuresTransactionsTakePhoto => '사진 촬영';

  @override
  String get featuresTransactionsChooseImage => '이미지 선택';

  @override
  String featuresTransactionsPhotoHelp(Object maxMb) {
    return '모바일에서는 사진을 찍거나 갤러리에서 선택할 수 있습니다. 최대 5장, 각 사진은 $maxMb MB까지 가능합니다.';
  }

  @override
  String featuresTransactionsNewPhotos(Object count) {
    return '새 사진 $count장';
  }

  @override
  String get featuresTransactionsRemove => '제거';

  @override
  String get featuresTransactionsChoosePhoto => '사진 선택';

  @override
  String get featuresTransactionsTransferOut => '출금 계좌 *';

  @override
  String get featuresTransactionsTransferIn => '입금 계좌 *';

  @override
  String get featuresTransactionsSelectPlaceholder => '선택';

  @override
  String get featuresTransactionsCreating => '생성 중...';

  @override
  String get featuresTransactionsConfirmTransfer => '이체 확인';

  @override
  String get featuresTransactionsBatchCategoryTitle => '카테고리 일괄 변경';

  @override
  String get featuresTransactionsBatchDateTitle => '날짜 일괄 변경';

  @override
  String get featuresTransactionsNewCategory => '새 카테고리';

  @override
  String get featuresTransactionsNewDate => '새 날짜';

  @override
  String featuresTransactionsApplyTo(Object count) {
    return '$count건에 적용';
  }

  @override
  String get featuresTransactionsDeleteMessage =>
      '이 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.';

  @override
  String featuresTransactionsBatchDeleteConfirm(Object count) {
    return '선택한 거래 $count건을 삭제할까요?';
  }

  @override
  String featuresTransactionsUpdatedWithWarning(Object message) {
    return '거래가 업데이트되었지만 $message';
  }

  @override
  String featuresTransactionsCreatedWithWarning(Object message) {
    return '거래가 생성되었지만 $message';
  }

  @override
  String get featuresTransactionsMessagesEditTransferBlocked =>
      '이체 거래는 삭제한 뒤 다시 만들어야 합니다';

  @override
  String get featuresTransactionsMessagesEditFxFeeBlocked =>
      '해외 카드 수수료는 자동으로 생성됩니다. 연결된 외화 거래를 수정하면 수수료가 함께 동기화됩니다.';

  @override
  String get featuresTransactionsMessagesPhotoUploadFailed => '사진을 업로드하지 못했습니다';

  @override
  String get featuresTransactionsMessagesDateRequired => '날짜를 선택하세요';

  @override
  String get featuresTransactionsMessagesAmountRequired => '올바른 금액을 입력하세요';

  @override
  String get featuresTransactionsMessagesTransferAccountsRequired =>
      '출금 계좌와 입금 계좌를 선택하세요';

  @override
  String get featuresTransactionsMessagesTransferSameAccount =>
      '출금 계좌와 입금 계좌는 같을 수 없습니다';

  @override
  String get featuresTransactionsTypeLabelsIncome => '수입';

  @override
  String get featuresTransactionsTypeLabelsExpense => '지출';

  @override
  String get featuresTransactionsTypeLabelsTransfer_in => '이체 입금';

  @override
  String get featuresTransactionsTypeLabelsTransfer_out => '이체 출금';

  @override
  String get featuresStocksTabsPortfolio => '포트폴리오';

  @override
  String get featuresStocksTabsTransactions => '거래';

  @override
  String get featuresStocksTabsDividends => '배당';

  @override
  String get featuresStocksTabsRealized => '실현 손익';

  @override
  String get featuresStocksTabsSettings => '거래 설정';

  @override
  String get featuresStocksCommonStockLabel => '주식';

  @override
  String get featuresStocksCommonStockRequired => '주식 *';

  @override
  String get featuresStocksCommonStockTypeStock => '주식';

  @override
  String get featuresStocksCommonStockTypeEtf => 'ETF';

  @override
  String get featuresStocksCommonStockTypeWarrant => '워런트';

  @override
  String get featuresStocksCommonDate => '날짜';

  @override
  String get featuresStocksCommonShares => '주식 수';

  @override
  String get featuresStocksCommonPrice => '가격';

  @override
  String get featuresStocksCommonTotal => '합계';

  @override
  String get featuresStocksCommonReturnRate => '수익률';

  @override
  String get featuresStocksCommonOverallReturnRate => '전체 수익률';

  @override
  String get featuresStocksCommonEstimatedPL => '예상 손익';

  @override
  String get featuresStocksCommonRealizedPL => '실현 손익';

  @override
  String get featuresStocksCommonTotalRealizedPL => '총 실현 손익';

  @override
  String get featuresStocksCommonYearRealizedPL => '올해 실현 손익';

  @override
  String get featuresStocksCommonRealizedCount => '실현 기록 수';

  @override
  String featuresStocksCommonRecordsCount(Object count) {
    return '$count건';
  }

  @override
  String get featuresStocksCommonSellAverage => '평균 매도가';

  @override
  String get featuresStocksCommonCostAverage => '평균 원가';

  @override
  String get featuresStocksCommonFeeAndTax => '수수료 + 세금';

  @override
  String get featuresStocksCommonCashDividend => '현금 배당';

  @override
  String get featuresStocksCommonStockDividend => '주식 배당';

  @override
  String get featuresStocksCommonStockSymbol => '종목 코드 *';

  @override
  String get featuresStocksCommonStockName => '종목명';

  @override
  String get featuresStocksCommonSearching => '검색 중...';

  @override
  String get featuresStocksCommonCancelAccounting => '- 계좌 반영 안 함 (주식 배당만) -';

  @override
  String get featuresStocksCommonAutoCalculate => '자동 계산';

  @override
  String get featuresStocksCommonBuy => '매수';

  @override
  String get featuresStocksCommonSell => '매도';

  @override
  String get featuresStocksPortfolioTitle => '포트폴리오';

  @override
  String get featuresStocksPortfolioTotalMarketValue => '총 평가액';

  @override
  String get featuresStocksPortfolioTotalCost => '총 투자 원가';

  @override
  String get featuresStocksPortfolioTotalDividend => '총 배당';

  @override
  String get featuresStocksPortfolioAddStock => '주식 추가';

  @override
  String get featuresStocksPortfolioEditStock => '주식 수정';

  @override
  String get featuresStocksPortfolioNewStock => '주식 추가';

  @override
  String get featuresStocksPortfolioUpdatePrices => '가격 업데이트';

  @override
  String get featuresStocksPortfolioBatchUpdate => '일괄 자동 업데이트';

  @override
  String get featuresStocksPortfolioUpdating => '업데이트 중...';

  @override
  String get featuresStocksPortfolioPriceModalDescription =>
      'AssetPilot은 먼저 브라우저에서 TWSE 공개 API를 호출합니다. 요청이 차단되면 로그인 후 사용자 API 프록시를 사용해 보유 종목을 업데이트합니다.';

  @override
  String featuresStocksPortfolioPriceResult(Object updated) {
    return '업데이트 완료: $updated건 성공.';
  }

  @override
  String featuresStocksPortfolioPriceResultWithFailed(
    Object updated,
    Object failed,
  ) {
    return '업데이트 완료: $updated건 성공, $failed건 실패.';
  }

  @override
  String get featuresStocksPortfolioBrowserQuoteUnavailable =>
      '브라우저에서 TWSE 데이터를 가져오지 못했습니다';

  @override
  String get featuresStocksPortfolioHeldShares => '보유 주식 수';

  @override
  String featuresStocksPortfolioShareUnit(Object count) {
    return '$count주';
  }

  @override
  String get featuresStocksPortfolioCurrentPrice => '현재가';

  @override
  String get featuresStocksPortfolioMarketValue => '평가액';

  @override
  String get featuresStocksPortfolioMessagesSymbolRequired => '종목 코드를 입력하세요';

  @override
  String get featuresStocksTransactionsTitle => '주식 거래';

  @override
  String get featuresStocksTransactionsAddTransaction => '거래 추가';

  @override
  String get featuresStocksTransactionsEditTransaction => '거래 수정';

  @override
  String get featuresStocksTransactionsNewTransaction => '거래 추가';

  @override
  String get featuresStocksTransactionsTypeLabel => '유형';

  @override
  String get featuresStocksTransactionsDateLabel => '날짜 *';

  @override
  String get featuresStocksTransactionsSharesLabel => '주식 수 *';

  @override
  String get featuresStocksTransactionsPriceLabel => '단가 *';

  @override
  String get featuresStocksTransactionsFeeLabel => '수수료';

  @override
  String get featuresStocksTransactionsTaxLabel => '거래세';

  @override
  String get featuresStocksTransactionsDeleteMessage => '이 거래를 삭제할까요?';

  @override
  String get featuresStocksTransactionsMessagesStockRequired => '주식을 선택하세요';

  @override
  String get featuresStocksTransactionsMessagesSharesRequired =>
      '올바른 주식 수를 입력하세요';

  @override
  String get featuresStocksTransactionsMessagesPriceRequired => '올바른 가격을 입력하세요';

  @override
  String get featuresStocksDividendsTitle => '배당';

  @override
  String get featuresStocksDividendsAddDividend => '배당 추가';

  @override
  String get featuresStocksDividendsEditDividend => '배당 수정';

  @override
  String get featuresStocksDividendsNewDividend => '배당 추가';

  @override
  String get featuresStocksDividendsSyncExDividends => '배당락 정보 동기화';

  @override
  String get featuresStocksDividendsSyncDescription =>
      '보유 종목을 기준으로 TWSE의 과거 배당락 데이터를 자동으로 동기화합니다.';

  @override
  String get featuresStocksDividendsSyncStart => '동기화 시작';

  @override
  String get featuresStocksDividendsSyncing => '동기화 중...';

  @override
  String featuresStocksDividendsSyncResult(Object synced, Object skipped) {
    return '$synced건 추가, $skipped건 건너뜀.';
  }

  @override
  String featuresStocksDividendsSyncResultWithFailed(
    Object synced,
    Object skipped,
    Object failed,
  ) {
    return '$synced건 추가, $skipped건 건너뜀, $failed건 실패.';
  }

  @override
  String get featuresStocksDividendsCashDividendLabel => '현금 배당 (NT\$)';

  @override
  String get featuresStocksDividendsStockDividendLabel => '주식 배당';

  @override
  String get featuresStocksDividendsDepositAccount => '입금 계좌';

  @override
  String get featuresStocksDividendsDeleteMessage => '이 배당을 삭제할까요?';

  @override
  String get featuresStocksDividendsMessagesStockRequired => '주식을 선택하세요';

  @override
  String get featuresStocksDividendsMessagesDividendRequired =>
      '현금 배당 또는 주식 배당을 입력하세요';

  @override
  String get featuresStocksRealizedTitle => '실현 손익';

  @override
  String get featuresStocksSettingsTitle => '거래 설정';

  @override
  String get featuresStocksSettingsFeeTitle => '수수료 / 거래세';

  @override
  String get featuresStocksSettingsFeeRate => '수수료율';

  @override
  String get featuresStocksSettingsFeeDiscount => '할인율 (0-1)';

  @override
  String get featuresStocksSettingsFeeMinLot => '최소 수수료 (정규 단위)';

  @override
  String get featuresStocksSettingsFeeMinOdd => '최소 수수료 (단주)';

  @override
  String get featuresStocksSettingsSellTaxRateStock => '매도세율 (주식)';

  @override
  String get featuresStocksSettingsSellTaxRateEtf => '매도세율 (ETF)';

  @override
  String get featuresStocksSettingsSellTaxRateWarrant => '매도세율 (워런트)';

  @override
  String get featuresStocksSettingsSellTaxMin => '최소 거래세';

  @override
  String get featuresStocksSettingsSaveSettings => '설정 저장';

  @override
  String get featuresStocksSettingsStockStatusTitle => '주식 상태';

  @override
  String get featuresStocksSettingsCurrentPrice => '현재가';

  @override
  String get featuresStocksSettingsNormalTracking => '일반 추적';

  @override
  String get featuresStocksSettingsDelisted => '상장폐지';

  @override
  String get featuresStocksSettingsRestoreTracking => '추적 복원';

  @override
  String get featuresStocksSettingsMarkDelisted => '상장폐지 표시';

  @override
  String get featuresStocksSettingsRecurringTitle => '주식 반복 투자';

  @override
  String get featuresStocksSettingsAddRecurringShort => '추가';

  @override
  String get featuresStocksSettingsEditRecurring => '반복 투자 수정';

  @override
  String get featuresStocksSettingsNewRecurring => '반복 투자 추가';

  @override
  String get featuresStocksSettingsRecurringAmountLabel => '금액 (NT\$) *';

  @override
  String get featuresStocksSettingsFrequency => '주기';

  @override
  String get featuresStocksSettingsStartDate => '시작일';

  @override
  String get featuresStocksSettingsLastGenerated => '마지막 생성';

  @override
  String get featuresStocksSettingsActive => '활성';

  @override
  String get featuresStocksSettingsInactive => '비활성';

  @override
  String get featuresStocksSettingsDeleteRecurringConfirm => '이 반복 투자를 삭제할까요?';

  @override
  String get featuresStocksSettingsFrequencyLabelsDaily => '매일';

  @override
  String get featuresStocksSettingsFrequencyLabelsWeekly => '매주';

  @override
  String get featuresStocksSettingsFrequencyLabelsMonthly => '매월';

  @override
  String get featuresStocksSettingsFrequencyLabelsYearly => '매년';

  @override
  String get featuresStocksSettingsMessagesSaved => '설정이 저장되었습니다';

  @override
  String featuresStocksSettingsMessagesSaveFailed(Object message) {
    return '저장하지 못했습니다: $message';
  }

  @override
  String get featuresStocksSettingsMessagesStockRequired => '주식을 선택하세요';

  @override
  String get featuresStocksSettingsMessagesAmountRequired => '올바른 금액을 입력하세요';

  @override
  String featuresStocksSettingsMessagesStockStatusUpdated(
    Object symbol,
    Object status,
  ) {
    return '$symbol: 상태 $status';
  }

  @override
  String get featuresStocksSettingsMessagesRestoredStatus => '일반 추적으로 복원됨';

  @override
  String get featuresStocksSettingsMessagesDelistedStatus => '상장폐지로 표시됨';

  @override
  String get featuresStocksSettingsMessagesDelistedUpdateFailed =>
      '상장폐지 상태를 업데이트하지 못했습니다';

  @override
  String get notificationsBrand => 'AssetPilot';

  @override
  String get notificationsReportTypeDaily => '일일 현금흐름 보고서';

  @override
  String get notificationsReportTypeWeekly => '주간 현금흐름 보고서';

  @override
  String get notificationsReportTypeMonthly => '월간 현금흐름 보고서';

  @override
  String notificationsSubjectDaily(Object date, Object weekday) {
    return '일일 현금흐름 보고서｜$date ($weekday)';
  }

  @override
  String notificationsSubjectWeekly(Object start, Object end) {
    return '주간 현금흐름 보고서｜$start ~ $end';
  }

  @override
  String notificationsSubjectMonthly(Object month) {
    return '월간 현금흐름 보고서｜$month';
  }

  @override
  String notificationsHeaderTitleDaily(
    Object name,
    Object date,
    Object weekday,
  ) {
    return '$name님의 $date ($weekday) 현금흐름';
  }

  @override
  String notificationsHeaderTitleWeekly(Object name, Object start, Object end) {
    return '$name님의 $start ~ $end 현금흐름';
  }

  @override
  String notificationsHeaderTitleMonthly(Object name, Object month) {
    return '$name님의 $month 현금흐름';
  }

  @override
  String notificationsHeaderMetaDaily(Object date, Object sendDate) {
    return '📅 보고일 $date　·　발송일 $sendDate';
  }

  @override
  String notificationsHeaderMetaWeekly(
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '📅 보고 기간 $start ~ $end　·　발송일 $sendDate';
  }

  @override
  String notificationsHeaderMetaMonthly(Object month, Object sendDate) {
    return '📅 보고 월 $month　·　발송일 $sendDate';
  }

  @override
  String notificationsBannerDaily(
    Object date,
    Object weekday,
    Object sendDate,
  ) {
    return '어제 하루 전체($date, $weekday) 요약, 오늘($sendDate) 발송';
  }

  @override
  String notificationsBannerWeekly(Object start, Object end, Object sendDate) {
    return '최근 7일($start ~ $end) 요약, 오늘($sendDate) 발송';
  }

  @override
  String notificationsBannerMonthly(
    Object month,
    Object start,
    Object end,
    Object sendDate,
  ) {
    return '지난달($month, $start ~ $end) 요약, 이번 달($sendDate) 발송';
  }

  @override
  String get notificationsLeadDaily => '어제';

  @override
  String get notificationsLeadWeekly => '이번 주';

  @override
  String get notificationsLeadMonthly => '지난달';

  @override
  String notificationsKpiIncome(Object lead) {
    return '$lead 수입';
  }

  @override
  String notificationsKpiExpense(Object lead) {
    return '$lead 지출';
  }

  @override
  String notificationsKpiNet(Object lead) {
    return '$lead 순액';
  }

  @override
  String get notificationsCompareLabelDaily => '전일 대비';

  @override
  String get notificationsCompareLabelWeekly => '전주 대비';

  @override
  String get notificationsCompareLabelMonthly => '전월 대비';

  @override
  String notificationsPeriodLabelDaily(Object date) {
    return '어제($date)';
  }

  @override
  String notificationsPeriodLabelWeekly(Object start, Object end) {
    return '최근 7일($start ~ $end)';
  }

  @override
  String notificationsPeriodLabelMonthly(Object month) {
    return '지난달($month)';
  }

  @override
  String get notificationsSectionsBalance => '계좌 잔액';

  @override
  String get notificationsSectionsTopCategories => '이번 달 지출 Top 5';

  @override
  String notificationsSectionsTopCategoriesMonthly(Object month) {
    return '$month 지출 Top 5';
  }

  @override
  String get notificationsSectionsDailyDetail => '일별 상세';

  @override
  String notificationsSectionsMonthlyAccrual(Object month) {
    return '이번 달 누계($month)';
  }

  @override
  String get notificationsSectionsStock => '주식 투자';

  @override
  String get notificationsSectionsRecentDaily => '어제 거래';

  @override
  String get notificationsSectionsRecentWeekly => '이번 주 거래';

  @override
  String get notificationsSectionsRecentMonthly => '지난달 거래';

  @override
  String get notificationsLabelsIncome => '수입';

  @override
  String get notificationsLabelsExpense => '지출';

  @override
  String get notificationsLabelsNet => '순액';

  @override
  String get notificationsLabelsCost => '총원가';

  @override
  String get notificationsLabelsMarketValue => '평가액';

  @override
  String get notificationsLabelsUnrealizedPL => '미실현 손익';

  @override
  String get notificationsLabelsReturnRate => '수익률';

  @override
  String get notificationsLabelsUncategorized => '미분류';

  @override
  String get notificationsTableDate => '날짜';

  @override
  String get notificationsEmptyNoAccount => '아직 계좌가 없습니다';

  @override
  String get notificationsEmptyNoExpense => '아직 지출 기록이 없습니다';

  @override
  String notificationsEmptyNoTx(Object label) {
    return '$label 거래가 없습니다';
  }

  @override
  String notificationsStockInline(Object marketValue, Object pl) {
    return '주식 투자: 평가액 $marketValue, 미실현 손익 $pl';
  }

  @override
  String get notificationsCtaViewFullReport => '전체 보고서 보기';

  @override
  String get notificationsCtaViewLineRecord => 'LINE 기록 보기';

  @override
  String get notificationsReminderAltText => '지출 기록 알림';

  @override
  String get notificationsReminderTitle => '오늘 지출을 기록해 주세요';

  @override
  String notificationsReminderBody(Object name) {
    return '$name님, 월말에 빠뜨리지 않도록 오늘 지출을 10초만에 기록해 보세요.';
  }

  @override
  String get notificationsReminderHint =>
      '지출 추가를 누른 뒤 금액 메모 날짜를 입력하세요. 날짜는 생략할 수 있습니다.';

  @override
  String get notificationsReminderFallbackName => '안녕하세요';

  @override
  String get notificationsReminderAddExpense => '지출 추가';

  @override
  String get notificationsReminderViewToday => '오늘 기록 보기';

  @override
  String get notificationsFallbackUser => '사용자';

  @override
  String get mobileLegacyMessagebde18a20 => '・총자산에서 제외';

  @override
  String get mobileLegacyNoneCreateAsParent => '(없음, 상위 카테고리로 생성)';

  @override
  String get mobileLegacyHomeShowsMonthlyIncomeExpensesNetCashFlow =>
      '홈은 월별 수입, 지출, 순액과 지출 카테고리를 보여줍니다. 월을 바꿔 보며 돈이 어디에 쓰였는지 확인하세요.';

  @override
  String get mobileLegacyPaymentsAreAssignedToTheStatementTheySettle =>
      '납부는 상환한 청구서에 연결됩니다. 결제일 이후 다음 주기에 납부한 금액도 해당 청구서에 반영됩니다.';

  @override
  String get mobileLegacy0NoPayment => '0 = 상환 안 함';

  @override
  String get mobileLegacyMon => '월';

  @override
  String get mobileLegacyStock => '일반 주식';

  @override
  String get mobileLegacyStocks => '일반 주식 (%)';

  @override
  String get mobileLegacyTue => '화';

  @override
  String get mobileLegacyDepositAccountRequiredForCashDividends =>
      '입금 계좌 (현금 배당 시 필수)';

  @override
  String get mobileLegacyWed => '수';

  @override
  String get mobileLegacyPreviousStatement => '이전 청구서 ';

  @override
  String get mobileLegacyNext => '다음';

  @override
  String get mobileLegacyDelisted => '상장폐지';

  @override
  String get mobileLegacySubcategory => '하위 카테고리';

  @override
  String get mobileLegacyDeleted => '삭제됨';

  @override
  String get mobileLegacyUpdated => '업데이트됨';

  @override
  String get mobileLegacyLinked => '연결됨';

  @override
  String get mobileLegacyUnlinked => '연결 해제됨';

  @override
  String get mobileLegacyTotalRealizedPL => '실현 손익 합계';

  @override
  String get mobileLegacyFri => '금';

  @override
  String get mobileLegacyStandardRate01 => '표준 세율: 0.1%';

  @override
  String get mobileLegacyStandardRate03 => '표준 세율: 0.3%';

  @override
  String get mobileLegacySat => '토';

  @override
  String get mobileLegacyCategoryName => '카테고리 이름';

  @override
  String get mobileLegacyFeeOptional => '수수료 (선택 사항)';

  @override
  String get mobileLegacyLeaveFeeAndTaxBlankToCalculateThem =>
      '수수료/거래세를 비워 두면 서버에서 자동 계산합니다';

  @override
  String get mobileLegacyCommissionRate => '수수료율 (%)';

  @override
  String get mobileLegacyDay => '일';

  @override
  String get mobileLegacyMonthlyBudget => '월간 총예산';

  @override
  String get mobileLegacyParentCategoryNoneCreatesAParent =>
      '상위 카테고리 (선택하지 않으면 상위 카테고리로 생성)';

  @override
  String get mobileLegacyTheme => '테마';

  @override
  String get mobileLegacyThu => '목';

  @override
  String get mobileLegacyUnnamedPasskey => 'Unnamed passkey';

  @override
  String get mobileLegacyUnknownCategory => '알 수 없는 카테고리';

  @override
  String get mobileLegacyNotLinked => '연결 안 됨';

  @override
  String get mobileLegacyNoTransactionsThisMonth => '이번 달 거래가 없습니다';

  @override
  String get mobileLegacyNoBudgetThisMonth => '이번 달 예산이 없습니다';

  @override
  String get mobileLegacyNetThisMonth => '이번 달 순액';

  @override
  String get mobileLegacyPositiveWholeNumber => '양의 정수';

  @override
  String get mobileLegacyDeletePermanently => '영구 삭제';

  @override
  String get mobileLegacyPermanentlyDeleteYourAccountAndAllData =>
      '계정과 모든 데이터를 영구 삭제하며 복구할 수 없음';

  @override
  String get mobileLegacyNoReleaseNotesAvailable => '현재 업데이트 내용이 없습니다';

  @override
  String get mobileLegacyCurrentDevice => '현재 기기';

  @override
  String get mobileLegacyTransactions => '거래';

  @override
  String get mobileLegacyAll => '전체';

  @override
  String get mobileLegacyAllCategories => '모든 카테고리';

  @override
  String get mobileLegacyAllAccounts => '모든 계좌';

  @override
  String get mobileLegacyPaymentAmountForEachCardInCardCurrency =>
      '각 카드 상환 금액(카드 통화 기준)';

  @override
  String get mobileLegacySyncDividends => '배당 동기화';

  @override
  String get mobileLegacyNameOptionalFilledAutomatically =>
      '이름 (선택 사항, 비워 두면 자동 입력)';

  @override
  String get mobileLegacyAddATickerSuchAs2330OnThe =>
      '주식 탭에서 2330 같은 종목 코드를 입력하면 가격, 실현/미실현 손익을 추적하고 배당 정보도 자동으로 동기화합니다.';

  @override
  String get mobileLegacyTapOnTheTransactionsTabToAddIncome =>
      '하단 거래 탭에서 +를 눌러 수입이나 지출을 추가하세요. 여러 통화와 계좌 간 이체를 지원합니다. 왼쪽으로 밀면 삭제, 탭하면 수정할 수 있습니다.';

  @override
  String get mobileLegacyNoDataForThisPeriod => '이 기간에는 데이터가 없습니다';

  @override
  String get mobileLegacyThisPermanentlyDeletesYourAccountAndAllData =>
      '이 작업은 계정과 모든 데이터를 영구 삭제합니다. 거래, 계좌, 주식, 설정이 포함되며 복구할 수 없습니다.';

  @override
  String get mobileLegacyCustomizeScheduledCashFlowReports =>
      '정기 현금흐름 보고서 발송 시간 설정';

  @override
  String get mobileLegacyAutomatic => '자동';

  @override
  String get mobileLegacyAtLeast8Characters => '8자 이상';

  @override
  String get mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers =>
      '8자 이상, 대문자/소문자/숫자/특수문자 포함';

  @override
  String
  get mobileLegacyYourPersonalFinanceCompanionForTransactionsBudgetsTaiwan =>
      '거래, 예산, 대만 주식 투자와 보고서를 한 앱에서 관리하는 개인 재무 도우미입니다. 핵심 기능을 1분 안에 살펴보세요.';

  @override
  String get mobileLegacyDeletePasskey => 'Passkey 삭제';

  @override
  String get mobileLegacyDeleteCategory => '카테고리 삭제';

  @override
  String get mobileLegacyDeleteTransaction => '거래 삭제';

  @override
  String get mobileLegacyDeleteDividend => '배당 삭제';

  @override
  String get mobileLegacyDeleteStock => '주식 삭제';

  @override
  String get mobileLegacyDeleteAccount => '계좌 삭제';

  @override
  String get mobileLegacyDeleteSchedule => '일정 삭제';

  @override
  String get mobileLegacyDeletePhoto => '사진 삭제';

  @override
  String get mobileLegacyADepositAccountIsRequiredForCashDividends =>
      '현금 배당이 있으면 입금 계좌가 필요합니다';

  @override
  String get mobileLegacyNoTransactionsMatchTheseFilters => '필터에 맞는 거래가 없습니다';

  @override
  String get mobileLegacyDiscount01 => '할인율 (0~1)';

  @override
  String get mobileLegacyImproved => '개선';

  @override
  String get mobileLegacyMore => '더보기';

  @override
  String get mobileLegacyUpdatedd9db02d0 => '업데이트';

  @override
  String get mobileLegacyLastDayOfEachMonth => '매월 마지막 날';

  @override
  String get mobileLegacyNoPricesToUpdate => '업데이트할 가격이 없습니다';

  @override
  String get mobileLegacyNoNewDividendsToSync => '동기화할 새 배당이 없습니다';

  @override
  String get mobileLegacySignedOutAndClearedTheLocalSession =>
      '사용자가 로그아웃되어 로컬 로그인을 지웠습니다';

  @override
  String get mobileLegacyGettingStarted => '시작 가이드';

  @override
  String get mobileLegacyExample06MeansA40Discount => '예: 0.6은 40% 할인을 의미합니다';

  @override
  String get mobileLegacyExample15Means15FeesAre =>
      '예: 1.5는 1.5%를 뜻하며 외화 결제 시 수수료가 자동 계산됩니다';

  @override
  String get mobileLegacyUseMoreToSetMonthlyBudgetsViewReports =>
      '더보기에서 월별 예산을 설정하고, 보고서를 보고, 계좌와 카테고리를 관리하며 반복 거래와 보고서 알림도 설정할 수 있습니다. 준비되면 기록을 시작하세요.';

  @override
  String get mobileLegacyStandardBrokerageRate01425 => '증권사 표준 수수료율: 0.1425%';

  @override
  String get mobileLegacyNotSentYet => '아직 발송되지 않음';

  @override
  String get mobileLegacyNoRealizedReturns => '실현 손익이 없습니다';

  @override
  String get mobileLegacyNoCategoriesYet => '아직 카테고리가 없습니다';

  @override
  String get mobileLegacyNoTransactionsYetTapAddTransactionToBegin =>
      '아직 거래가 없습니다. 오른쪽 아래 버튼을 눌러 추가하세요.';

  @override
  String get mobileLegacyNoRecurringTransactions => '반복 거래가 없습니다';

  @override
  String get mobileLegacyNoDividendRecords => '배당 기록이 없습니다';

  @override
  String get mobileLegacyNoStockTransactions => '주식 거래가 없습니다';

  @override
  String get mobileLegacyNoHoldingsYet => '아직 보유 종목이 없습니다';

  @override
  String get mobileLegacyN => '尚無排程，點右下角新增\\n可設定每日／每週／每月定時收到收支報表';

  @override
  String get mobileLegacyNoSignInHistory => '로그인 기록이 없습니다';

  @override
  String
  get mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired =>
      '브라우저에서 등록을 완료하세요 (기기 생체 인증 필요)';

  @override
  String get mobileLegacyNotice => '알림';

  @override
  String get mobileLegacyDividends => '배당';

  @override
  String get mobileLegacyDividendSyncCompleted => '배당 동기화 완료';

  @override
  String get mobileLegacyTickerEG2330 => '종목 코드 (예: 2330)';

  @override
  String get mobileLegacyStockMarketValue => '주식 평가액';

  @override
  String get mobileLegacyHoldings => '포트폴리오';

  @override
  String get mobileLegacyDayOfWeek => '요일';

  @override
  String get mobileLegacyViewTheCurrentVersionAndReleaseNotes =>
      '현재 버전과 업데이트 내용 보기';

  @override
  String get mobileLegacyRename => '이름 변경';

  @override
  String get mobileLegacyCheckAgain => '다시 확인';

  @override
  String get mobileLegacyRetry => '다시 시도';

  @override
  String get mobileLegacyHome => '홈';

  @override
  String get mobileLegacyFixed => '수정';

  @override
  String get mobileLegacyApply => '적용';

  @override
  String get mobileLegacyTime => '시간';

  @override
  String get mobileLegacyForeignTransactionFeeInTwdOptional =>
      '해외 결제 수수료 TWD (선택 사항)';

  @override
  String get mobileLegacyAddTransaction => '거래 추가';

  @override
  String get mobileLegacyTransactions8084a8ea => '거래';

  @override
  String get mobileLegacyStartDate => '시작일';

  @override
  String get mobileLegacyTrackTaiwanStocks => '대만 주식 투자 추적';

  @override
  String get mobileLegacyStockDividendSharesOptional => '주식 배당 수량 (선택 사항)';

  @override
  String get mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe =>
      '해외 카드 수수료는 원래 거래에서 자동 생성됩니다. 연결된 해외 거래를 수정하세요.';

  @override
  String get mobileLegacyPasswordMustBeAtLeast8Characters =>
      '비밀번호는 8자 이상이어야 합니다';

  @override
  String get mobileLegacyAccountName => '계좌 이름';

  @override
  String get mobileLegacyAccountDeleted => '계정이 삭제되었습니다';

  @override
  String get mobileLegacyAccountSecurity => '계정 보안';

  @override
  String get mobileLegacyLinkedAccounts => '연결된 계정';

  @override
  String get mobileLegacyFrequentlyUsedCurrencies => '자주 쓰는 통화';

  @override
  String get mobileLegacyChooseFromGallery => '앨범에서 선택';

  @override
  String get mobileLegacyEnabled => '사용';

  @override
  String get mobileLegacyDark => '다크';

  @override
  String get mobileLegacyLight => '라이트';

  @override
  String get mobileLegacyClearDates => '날짜 지우기';

  @override
  String get mobileLegacyClearFilters => '필터 지우기';

  @override
  String get mobileLegacyCashDividendTotalOptional => '현금 배당 (총액, 선택 사항)';

  @override
  String get mobileLegacyEnterACashOrStockDividend =>
      '현금 배당 또는 주식 배당 중 하나를 입력하세요';

  @override
  String get mobileLegacyWhenSetTheAccountCardShowsSpendingFor =>
      '설정하면 계좌 카드에 이번 청구 주기 지출이 표시됩니다. 비워두면 계산하지 않습니다';

  @override
  String get mobileLegacyNoteOptional => '메모 (선택 사항)';

  @override
  String get mobileLegacyNoteKeyword => '메모 키워드';

  @override
  String get mobileLegacyMinimumTransactionTax => '최소 거래세';

  @override
  String get mobileLegacyUpTo5PhotosPerTransaction => '거래 1건당 사진 최대 5장';

  @override
  String get mobileLegacyReportNotifications => '보고서 알림';

  @override
  String get mobileLegacySeeYourCompleteCashFlow => '현금흐름을 한눈에';

  @override
  String get mobileLegacyUnableToCreateLineSignInState =>
      'Unable to create LINE sign-in state';

  @override
  String get mobileLegacyUnableToOpenBrowser => '브라우저를 열 수 없습니다';

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
      '로그인이 만료되었습니다. 다시 로그인하세요';

  @override
  String get mobileLegacyTheSignInResponseDidNotIncludeAn =>
      '로그인 응답에 인증 Cookie가 없습니다. 백엔드 설정을 확인하세요';

  @override
  String get mobileLegacySignedIn => '로그인되었습니다';

  @override
  String get mobileLegacySignInHistory => '로그인 기록';

  @override
  String get mobileLegacySignedInDevices => '로그인된 기기';

  @override
  String get mobileLegacySignInRequestConnectionFailed => '로그인 요청 연결에 실패했습니다';

  @override
  String get mobileLegacyEndDate => '종료일';

  @override
  String get mobileLegacyTheSignUpResponseDidNotIncludeAn =>
      '가입 응답에 인증 Cookie가 없습니다. 백엔드 설정을 확인하세요';

  @override
  String get mobileLegacySignUpAndSignIn => '가입하고 로그인';

  @override
  String get mobileLegacyBuy => '매수';

  @override
  String get mobileLegacyFrequency => '주기';

  @override
  String get mobileLegacyExchangeRateMustBeGreaterThan0 => '환율은 0보다 커야 합니다';

  @override
  String get mobileLegacyReturns => '손익';

  @override
  String get mobileLegacyAddPasskey => 'Passkey 추가';

  @override
  String get mobileLegacyAddStockTransaction => '주식 거래 추가';

  @override
  String get mobileLegacyAddSchedule => '일정 추가';

  @override
  String get mobileLegacyAddReportSchedule => '보고서 일정 추가';

  @override
  String get mobileLegacyAddPhotosOptional => '사진 추가 (선택 사항)';

  @override
  String get mobileLegacyFailedToLoadPhoto => '사진을 불러오지 못했습니다';

  @override
  String get mobileLegacyLink => '연결';

  @override
  String get mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking =>
      '연결은 브라우저에서 인증을 완료해야 합니다. 연결을 해제하기 전에 다른 로그인 방법이 있는지 확인하세요.';

  @override
  String get mobileLegacyUnlink => '연결 해제';

  @override
  String get mobileLegacyPersonalFinanceAndroidApp => '개인 재무 · Android 앱';

  @override
  String get mobileLegacySkip => '건너뛰기';

  @override
  String get mobileLegacyMinimumOddLotCommission => '단주 최소 수수료';

  @override
  String get mobileLegacyIncorrectEmailOrPassword => '이메일 또는 비밀번호가 올바르지 않습니다';

  @override
  String get mobileLegacyDefaultCurrency => '기본 통화';

  @override
  String get mobileLegacyDefaultAndFrequentlyUsedCurrencies =>
      '기본 통화와 자주 쓰는 통화';

  @override
  String get mobileLegacyBudgets => '예산';

  @override
  String get mobileLegacyBudgetsReportsAndMore => '예산, 보고서, 더 많은 기능';

  @override
  String get mobileLegacyBudgetAmount => '예산 금액';

  @override
  String get mobileLegacyCurrencySettings => '통화 설정';

  @override
  String get mobileLegacyAppNotificationAndWebLanguage => '앱, 알림, 웹 언어';

  @override
  String get mobileLegacyBank => '은행';

  @override
  String get mobileLegacyBankBalance => '은행 잔액';

  @override
  String get mobileLegacyRequiresALinkedLineAccount => 'LINE 계정 연결 필요';

  @override
  String get mobileLegacyACreditCardAndANonCreditCard =>
      '상환을 기록하려면 신용카드 1개와 신용카드가 아닌 계좌 1개 이상이 필요합니다';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols =>
      '대문자, 소문자, 숫자, 특수문자를 포함하세요';

  @override
  String get mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3 =>
      '대문자, 소문자, 숫자, 특수문자를 포함하세요';

  @override
  String get mobileLegacyDeleteThisReportNotificationSchedule =>
      '이 보고서 알림 일정을 삭제할까요?';

  @override
  String get mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone =>
      '업로드된 이 사진을 삭제할까요? 이 작업은 되돌릴 수 없습니다.';

  @override
  String get mobileLegacyEditStockTransaction => '주식 거래 수정';

  @override
  String get mobileLegacyEditReportSchedule => '보고서 일정 수정';

  @override
  String get mobileLegacyCompleteTheVerificationBelowFirst => '먼저 아래 인증을 완료하세요';

  @override
  String get mobileLegacyAddAStockOnTheHoldingsTabFirst =>
      '먼저 보유 탭에서 주식을 추가하세요';

  @override
  String get mobileLegacySelectAParentCategoryFirst => '먼저 상위 카테고리를 선택하세요';

  @override
  String get mobileLegacyEnterAPaymentForAtLeastOneCard =>
      '카드 하나 이상의 상환 금액을 입력하세요';

  @override
  String get mobileLegacySelectAtLeastOneNotificationMethod =>
      '알림 방식을 하나 이상 선택하세요';

  @override
  String get mobileLegacyEnterANumberGreaterThanOrEqualTo => '0 이상의 숫자를 입력하세요';

  @override
  String get mobileLegacyEnterAValueFrom1To31 => '1~31 사이 값을 입력하세요';

  @override
  String get mobileLegacyEnterAnAmountGreaterThan0 => '0보다 큰 금액을 입력하세요';

  @override
  String get mobileLegacyEnterATicker => '종목 코드를 입력하세요';

  @override
  String get mobileLegacyEnterAPositiveWholeNumber => '양의 정수를 입력하세요';

  @override
  String get mobileLegacyEnterAName => '이름을 입력하세요';

  @override
  String get mobileLegacyEnterAValidEmailAddress => '올바른 이메일을 입력하세요';

  @override
  String get mobileLegacyEnterYourPasswordToConfirm => '확인을 위해 비밀번호를 입력하세요';

  @override
  String get mobileLegacyEnterTheAccountEmailToConfirm =>
      '확인을 위해 계정 이메일을 입력하세요';

  @override
  String get mobileLegacyEnterADisplayName => '표시 이름을 입력하세요';

  @override
  String get mobileLegacySelectASubcategory => '하위 카테고리를 선택하세요';

  @override
  String get mobileLegacySelectACategory => '카테고리를 선택하세요';

  @override
  String get mobileLegacySelectAParentCategory => '상위 카테고리를 선택하세요';

  @override
  String get mobileLegacySelectAnAccount => '계좌를 선택하세요';

  @override
  String get mobileLegacySelectADestinationAccount => '입금 계좌를 선택하세요';

  @override
  String get mobileLegacySell => '매도';

  @override
  String get mobileLegacyMinimumBoardLotCommission => '정규 단위 최소 수수료';

  @override
  String get mobileLegacyFilter => '필터';

  @override
  String get mobileLegacyFilterTransactions => '거래 필터';

  @override
  String get mobileLegacyChooseTheme => '테마 선택';

  @override
  String get mobileLegacyLogTransactionsInSeconds => '거래를 빠르게 기록';

  @override
  String get mobileLegacyMarketValue => '총 평가액';

  @override
  String get mobileLegacyTotalAssetsInTwd => '총자산(TWD 환산)';

  @override
  String get mobileLegacyTraditionalChineseEnglish => '중국어 번체 / English';

  @override
  String get mobileLegacyDonTHaveAnAccountSignUp => '계정이 없나요? 가입하기';

  @override
  String get mobileLegacyPaymentRecorded => '상환이 기록되었습니다';

  @override
  String get mobileLegacyToAccount => '입금 계좌';

  @override
  String get mobileLegacyFromAccount => '출금 계좌';

  @override
  String get mobileLegacyTheSourceAndDestinationAccountsMustDiffer =>
      '출금 계좌와 입금 계좌는 같을 수 없습니다';

  @override
  String get mobileLegacyEditTransfersInTheWebApp => '이체는 웹 버전에서 수정하세요';

  @override
  String get mobileLegacyTransactionTaxSell => '거래세 (매도)';

  @override
  String get mobileLegacyTransactionTaxOptional => '거래세 (선택 사항)';

  @override
  String get mobileLegacyTypeAffectsTransactionTax => '유형 (거래세율에 영향)';

  @override
  String get mobileLegacyWarrants => '워런트 (%)';

  @override
  String get mobileLegacyWelcomeToAssetpilot => 'AssetPilot에 오신 것을 환영합니다';

  @override
  String get mobileLegacyOtherDevicesWillBeSignedOutAfterThis =>
      '변경 후 다른 기기는 로그아웃됩니다.';

  @override
  String get mobileLegacyTestSentryConfiguration => 'Sentry 설정 테스트';

  @override
  String get mobileLegacyApiReturned401TheExpiredLocalSessionWas =>
      'API가 401을 반환했습니다. 세션이 만료되어 로컬 로그인을 지웠습니다';

  @override
  String get mobileLegacyApiRequestFailed => 'API 요청 실패';

  @override
  String get mobileLegacyApiRequestConnectionFailed => 'API 요청 연결에 실패했습니다';

  @override
  String get mobileLegacyTheAppSignInResponseDidNotInclude =>
      '앱 로그인 응답에 인증 Cookie가 없습니다';

  @override
  String get mobileLegacyEmailNotifications => '이메일 알림';

  @override
  String get mobileLegacyTheGoogleSignInResponseDidNotInclude =>
      'Google 로그인 응답에 인증 Cookie가 없습니다';

  @override
  String get mobileLegacyGoogleSignInStateMismatchTryAgain =>
      'Google sign-in state mismatch. Try again.';

  @override
  String get mobileLegacyGoogleSignInTimedOutOrWasCancelled =>
      'Google sign-in timed out or was cancelled';

  @override
  String get mobileLegacyLineNotifications => 'LINE 알림';

  @override
  String get mobileLegacyTheLineSignInResponseDidNotInclude =>
      'LINE 로그인 응답에 인증 Cookie가 없습니다';

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
      'TWD는 항상 포함됩니다. 선택한 통화는 거래와 반복 거래의 통화 목록 앞쪽에 표시됩니다.';

  @override
  String mobileDynamicDayOfMonth(Object day) {
    return '$day일';
  }

  @override
  String mobileDynamicLastSent(Object value) {
    return '마지막 발송 $value';
  }

  @override
  String mobileDynamicCurrentVersion(Object version) {
    return '현재 버전 v$version';
  }

  @override
  String mobileDynamicVersionAvailable(Object version) {
    return 'v$version 업데이트 가능';
  }

  @override
  String mobileDynamicMonthlyOnDay(Object day) {
    return '매월 $day일';
  }

  @override
  String mobileDynamicEveryWeekday(Object weekday) {
    return '매주 $weekday';
  }

  @override
  String mobileDynamicWeekday(Object weekday) {
    return '$weekday';
  }

  @override
  String mobileDynamicCreatedAt(Object value) {
    return '생성일 $value';
  }

  @override
  String mobileDynamicLanguageUpdated(Object value) {
    return '언어가 업데이트되었습니다: $value';
  }

  @override
  String mobileDynamicFailedToLoad(Object value) {
    return '불러오지 못했습니다: $value';
  }

  @override
  String mobileDynamicUnexpectedError(Object value) {
    return '예상치 못한 오류: $value';
  }

  @override
  String mobileDynamicProviderLoginFailed(Object provider, Object error) {
    return '$provider 로그인 실패: $error';
  }

  @override
  String mobileDynamicFailedUpdatePrices(Object value) {
    return '가격 업데이트 실패: $value';
  }

  @override
  String mobileDynamicFailedSyncDividends(Object value) {
    return '배당 동기화 실패: $value';
  }

  @override
  String mobileDynamicPhotoUploadFailed(Object value) {
    return '사진 업로드 실패: $value';
  }

  @override
  String mobileDynamicRequestFailed(Object code) {
    return '요청 실패(HTTP $code)';
  }

  @override
  String mobileDynamicLoginHttpFailed(Object code) {
    return '로그인 실패(HTTP $code)';
  }

  @override
  String mobileDynamicBackendConnectFailed(Object target, Object error) {
    return '서버에 연결할 수 없습니다($target): $error';
  }

  @override
  String mobileDynamicConfirmDeleteNamed(Object name) {
    return '“$name”을(를) 삭제할까요?';
  }

  @override
  String mobileDynamicUnlinkProvider(Object provider) {
    return '$provider 연결 해제';
  }

  @override
  String mobileDynamicConfirmUnlinkProvider(Object provider) {
    return '$provider 연결을 해제할까요?';
  }

  @override
  String mobileDynamicProviderBinding(Object provider) {
    return '$provider 연결';
  }

  @override
  String mobileDynamicAllForName(Object name) {
    return '$name (전체)';
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
    return '데이터 조회 시간 $time';
  }

  @override
  String get dashboardAttentionTitle => '확인 필요';

  @override
  String get dashboardAttentionAllClear => '현재 확인이 필요한 항목이 없습니다';

  @override
  String dashboardAttentionRecurring(Object count) {
    return '반복 거래 $count건을 확인해야 합니다';
  }

  @override
  String dashboardAttentionUncategorized(Object count, Object amount) {
    return '미분류 거래 $count건 · $amount';
  }

  @override
  String dashboardAttentionUnpriced(Object count) {
    return '보유 종목 $count개에 가격이 없습니다';
  }

  @override
  String get dashboardDriversTitle => '이번 달 상위 3개 요인';

  @override
  String dashboardDriversSubtitle(Object month) {
    return '$month에 가장 큰 비중을 차지한 항목';
  }

  @override
  String dashboardDriversShare(Object share) {
    return '이 유형의 $share%';
  }

  @override
  String get dashboardPersonalizeTrigger => '홈 맞춤 설정';

  @override
  String get dashboardPersonalizeTitle => '홈 맞춤 설정';

  @override
  String get dashboardPersonalizeDescription => '표시할 모듈을 선택하고 사용 순서에 맞게 배치하세요.';

  @override
  String get dashboardPersonalizeModulesAssets => '자산 개요';

  @override
  String get dashboardPersonalizeModulesAttention => '확인 필요';

  @override
  String get dashboardPersonalizeModulesWhyChanged => '현금흐름 변동 이유';

  @override
  String get dashboardPersonalizeModulesSpending => '지출 카테고리';

  @override
  String get dashboardPersonalizeModulesPortfolioHealth => '포트폴리오 상태';

  @override
  String get dashboardPersonalizeModulesIncomeRecent => '수입 및 최근 거래';

  @override
  String dashboardPersonalizeMoveUp(Object module) {
    return '$module 위로 이동';
  }

  @override
  String dashboardPersonalizeMoveDown(Object module) {
    return '$module 아래로 이동';
  }

  @override
  String get dashboardPersonalizeSaved => '대시보드 레이아웃을 저장했습니다';

  @override
  String get dashboardPersonalizeSaveError => '대시보드 레이아웃을 저장할 수 없습니다';

  @override
  String get dashboardPersonalizeReset => '초기화';

  @override
  String get dashboardPersonalizeApply => '적용';

  @override
  String get dashboardComparisonTitle => '현금흐름 변동 이유';

  @override
  String dashboardComparisonMtd(
    Object currentStart,
    Object currentEnd,
    Object previousStart,
    Object previousEnd,
  ) {
    return '$currentStart–$currentEnd와 $previousStart–$previousEnd 비교';
  }

  @override
  String dashboardComparisonFull(Object previousStart, Object previousEnd) {
    return '전체 월과 $previousStart–$previousEnd 비교';
  }

  @override
  String get dashboardComparisonUnavailable => '이 달에는 비교할 이전 기간이 없습니다.';

  @override
  String get dashboardComparisonNoChanges => '기록된 현금흐름이 비교 기간과 같습니다.';

  @override
  String get dashboardComparisonPreviousNet => '이전 순현금흐름';

  @override
  String get dashboardComparisonNetChange => '순현금흐름 변화';

  @override
  String get dashboardComparisonNewThisPeriod => '이번 기간 신규';

  @override
  String get dashboardComparisonIncreased => '금액 증가';

  @override
  String get dashboardComparisonDecreased => '금액 감소';

  @override
  String get dashboardPortfolioHealthTitle => '포트폴리오 원가 상태';

  @override
  String get dashboardPortfolioHealthSubtitle => '현재 가치와 남은 FIFO 원가 비교';

  @override
  String get dashboardPortfolioHealthNoHoldings =>
      '보유 종목을 추가하면 원가 분석을 볼 수 있습니다.';

  @override
  String get dashboardPortfolioHealthMissingPrices => '이 비교에는 현재 가격이 필요합니다.';

  @override
  String get dashboardPortfolioHealthMixedCurrencies =>
      '여러 통화의 보유 자산에는 합산 비율을 제공할 수 없습니다.';

  @override
  String get dashboardPortfolioHealthMarketValue => '가격 확인 시가';

  @override
  String get dashboardPortfolioHealthCost => '가격 확인 종목 원가';

  @override
  String get dashboardPortfolioHealthUnrealizedGross => '미실현 총손익';

  @override
  String dashboardPortfolioHealthLargestHolding(Object name, Object share) {
    return '최대 보유 종목: $name · 가격 확인 가치의 $share%';
  }

  @override
  String get dashboardPortfolioHealthDisclaimer =>
      '현재 가격과 기록된 FIFO 원가를 비교한 값입니다. 시장 지수 벤치마크나 시간가중수익률이 아닙니다.';

  @override
  String dashboardPortfolioHealthCoverage(Object priced, Object total) {
    return '가격 확인: 보유 종목 $total개 중 $priced개';
  }
}

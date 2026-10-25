# 建立 AssetPilot iOS 專案的 WidgetKit 擴充 Target，並把 App Intents 接進主 App。
#
# 用法：
#   GEM_HOME=~/.gem ruby tool/setup_ios_targets.rb
#
# 為何需要腳本：Xcode 專案的 target / build phase / build setting 皆記錄在
# project.pbxproj，以人工編輯容易出錯且不可重現。此腳本讓 iOS 工程設定
# 可重複產生，便於 CI 與後續擴充 Target 時保持一致。
#
# 架構說明（重要）：
# - App Intents **不需要**獨立的 App Extension target。Apple 官方說明
#   `openAppWhenRun = true` 在 App Extension 中執行時會產生錯誤，而
#   `UIApplication.shared` 對擴充是 NS_EXTENSION_UNAVAILABLE，因此
#   「開啟 App 由使用者確認」的 Intent 必須放在主 App target 內。
# - WidgetKit 擴充則必須是獨立的 App Extension（WidgetKit Extension 點）。
# - 舊版曾在這裡建立 AssetPilotIntents 擴充 target，導致
#   `UIApplication.shared` 無法編譯；本腳本會移除該 target。
require 'xcodeproj'

ROOT = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(ROOT, 'ios', 'Runner.xcodeproj')
BUNDLE_PREFIX = 'com.assetpilot.assetpilot'
DEPLOYMENT_TARGET = '16.0'

# 已移除的 target：App Intents 改為放在主 App target 內。
RETIRED_TARGETS = ['AssetPilotIntents'].freeze

project = Xcodeproj::Project.open(PROJECT_PATH)
runner = project.targets.find { |t| t.name == 'Runner' }
raise 'Runner target not found' unless runner

# ── 共用 helper ────────────────────────────────────────────────

def apply_common_settings(target, deployment_target, extra = {})
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings['IPHONEOS_DEPLOYMENT_TARGET'] = deployment_target
    settings['SWIFT_VERSION'] = '5.0'
    settings['TARGETED_DEVICE_FAMILY'] = '1,2'
    settings['CODE_SIGN_STYLE'] = 'Automatic'
    extra.each { |key, value| settings[key] = value }
  end
end

# 清空階段內容。
#
# 注意：不能用 `remove_file_reference(build_file)` —— 該方法參數是
# PBXFileReference，傳入 PBXBuildFile 會靜默無作用，導致每次執行腳本
# 都會累積重複項目（實測曾讓 Widget 的 Sources 階段膨脹到 40 筆）。
# 這裡直接用 `remove_build_file`，才是移除 PBXBuildFile 的正確做法。
def clear_phase(phase)
  phase.files.to_a.each do |build_file|
    phase.remove_build_file(build_file)
  end
end

# 依路徑找出（或建立）群組。
def sync_group(project, group_path)
  group = project.main_group.find_subpath(group_path, true)
  group.set_source_tree('SOURCE_ROOT')
  group
end

# 取得 target Sources 階段的檔案名稱清單。
def runner_source_phase_names(target)
  target.source_build_phase.files.map { |f| f.file_ref&.path.to_s }
end

# 把指定目錄底下的 Swift 檔案加入 target 的 Sources 階段。
#
# 以「路徑」而不是「檔名」判斷重複，避免不同目錄的同名檔互相覆蓋。
def add_sources(target, group, paths)
  # 先清掉群組中指向同一路徑的重複引用。
  seen = {}
  group.files.to_a.each do |file|
    key = file.real_path.to_s
    if seen.key?(key)
      group.remove_reference(file)
    else
      seen[key] = true
    end
  end

  refs = paths.map do |path|
    existing = group.files.find { |f| f.real_path.to_s == File.expand_path(path) }
    existing || group.new_reference(path)
  end
  target.add_file_references(refs)
end

# ── 1. Runner 本身：entitlements 與 deployment target ─────────

runner.build_configurations.each do |config|
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = DEPLOYMENT_TARGET
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'Runner/Runner.entitlements'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
end

# 專案層級的 deployment target 一併對齊，避免新 target 繼承到較舊的
# 預設值而導致 App Intents（需 iOS 16+）編譯失敗。
project.build_configurations.each do |config|
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = DEPLOYMENT_TARGET
end

# ── 2. 移除舊的 App Intents 擴充 target ───────────────────────
# 放在 App Intents 擴充中無法呼叫 UIApplication.shared，
# 「開啟 App 讓使用者確認」的行為改由主 App target 內的 Intent 負責。

RETIRED_TARGETS.each do |name|
  target = project.targets.find { |t| t.name == name }
  next if target.nil?

  # 先解除 Runner 對它的相依與嵌入。
  # xcodeproj 沒有 remove_dependency 便捷方法，需自行移除相依物件。
  runner.dependencies.to_a.each do |dep|
    next unless dep.target == target
    runner.dependencies.delete(dep)
    dep.remove_from_project
  end
  runner.build_phases.dup.each do |phase|
    next unless phase.respond_to?(:symbol_dst_subfolder_spec)
    next unless phase.symbol_dst_subfolder_spec == :plug_ins
    phase.files.to_a.each do |build_file|
      next unless build_file.file_ref == target.product_reference
      phase.remove_build_file(build_file)
    end
  end
  project.targets.delete(target)
  target.remove_from_project
end

# 移除對應的 product 檔案引用與群組。
RETIRED_TARGETS.each do |name|
  project.products_group.files.to_a.each do |file|
    next unless file.path.to_s.start_with?("#{name}.")
    file.remove_from_project
  end
  group = project.main_group.groups.find { |g| g.display_name == name }
  group.remove_from_project if group
end

# ── 3. Runner target：加入原生 Swift 檔與 App Intents 框架 ────

runner_group = sync_group(project, 'Runner')

runner_sources = Dir.glob(File.join(ROOT, 'ios', 'Runner', '*.swift')).sort
add_sources(runner, runner_group, runner_sources)

# App Intents.framework：主 App 內的 Intent 需要它。
# 以路徑去重，避免重複執行腳本時累積。
app_intents_path = 'System/Library/Frameworks/AppIntents.framework'
seen_app_intents = false
runner.frameworks_build_phase.files.to_a.each do |build_file|
  ref = build_file.file_ref
  next if ref.nil?
  next unless ref.path.to_s == app_intents_path
  # 保留第一筆，其餘移除。
  if seen_app_intents
    runner.frameworks_build_phase.remove_build_file(build_file)
  else
    seen_app_intents = true
  end
end

unless runner.frameworks_build_phase.files.any? { |bf| bf.file_ref&.path.to_s == app_intents_path }
  runner.frameworks_build_phase.add_file_reference(
    project.frameworks_group.new_reference(app_intents_path)
  )
end

# ── 4. 擴充 Target（WidgetKit）────────────────────────────────

EXTENSIONS = [
  {
    name: 'AssetPilotWidget',
    dir: 'AssetPilotWidget',
    entitlements: 'AssetPilotWidget/AssetPilotWidget.entitlements',
    frameworks: %w[WidgetKit.framework SwiftUI.framework]
  }
].freeze

EXTENSIONS.each do |ext|
  ext_dir = File.join(ROOT, 'ios', ext[:dir])
  bundle_id = "#{BUNDLE_PREFIX}.#{ext[:name]}"

  target = project.targets.find { |t| t.name == ext[:name] }
  if target.nil?
    target = project.new_target(
      :app_extension,
      ext[:name],
      :ios,
      DEPLOYMENT_TARGET,
      project.products_group,
      :swift
    )
  end

  apply_common_settings(target, DEPLOYMENT_TARGET, {
    'PRODUCT_BUNDLE_IDENTIFIER' => bundle_id,
    'PRODUCT_NAME' => ext[:name],
    'INFOPLIST_FILE' => "#{ext[:name]}/Info.plist",
    'CODE_SIGN_ENTITLEMENTS' => ext[:entitlements],
    'APPLICATION_EXTENSION_API_ONLY' => 'YES',
    'SKIP_INSTALL' => 'YES',
    # 擴充沿用 Flutter 產生的版本號，確保 App 與擴充版本一致
    # （App Store 會檢查嵌入擴充的 CFBundleVersion）。
    'FLUTTER_BUILD_NAME' => '$(FLUTTER_BUILD_NAME)',
    'FLUTTER_BUILD_NUMBER' => '$(FLUTTER_BUILD_NUMBER)',
    'LD_RUNPATH_SEARCH_PATHS' => [
      '$(inherited)',
      '@executable_path/Frameworks',
      '@executable_path/../../Frameworks'
    ]
  })

  # 擴充沿用 Flutter 的 xcconfig，才能取得 FLUTTER_BUILD_NAME／NUMBER，
  # 讓 App 與嵌入擴充的版本號一致（App Store 會檢查）。
  flutter_group = project.main_group['Flutter']
  extensions_xcconfig = flutter_group&.files&.find do |f|
    f.path.to_s.end_with?('Extensions.xcconfig')
  end
  unless extensions_xcconfig
    extensions_xcconfig = flutter_group.new_reference('Flutter/Extensions.xcconfig')
  end
  target.build_configurations.each do |config|
    config.base_configuration_reference = extensions_xcconfig
  end

  # 重建來源檔引用，避免重複執行腳本時累積重複項目。
  clear_phase(target.source_build_phase)
  clear_phase(target.frameworks_build_phase)

  group = sync_group(project, ext[:dir])
  add_sources(target, group, Dir.glob(File.join(ext_dir, '*.swift')).sort)

  ext[:frameworks].each do |framework|
    target.frameworks_build_phase.add_file_reference(
      project.frameworks_group.new_reference("System/Library/Frameworks/#{framework}")
    )
  end
end

# ── 5. 將擴充嵌入 App ─────────────────────────────────────────

# 擴充必須在 App 編譯後嵌入，並讓 Runner 依賴擴充 target 的建置結果。
EXTENSIONS.each do |ext|
  target = project.targets.find { |t| t.name == ext[:name] }
  next if runner.dependencies.any? { |d| d.target == target }

  runner.add_dependency(target)
end

# 移除既有的 embed 階段（重跑腳本時不重複新增）。
runner.build_phases.dup.each do |phase|
  next unless phase.respond_to?(:symbol_dst_subfolder_spec)
  next unless phase.symbol_dst_subfolder_spec == :plug_ins
  runner.build_phases.delete(phase)
end

embed_phase = runner.new_copy_files_build_phase('Embed Foundation Extensions')
embed_phase.symbol_dst_subfolder_spec = :plug_ins

EXTENSIONS.each do |ext|
  target = project.targets.find { |t| t.name == ext[:name] }
  build_file = embed_phase.add_file_reference(target.product_reference)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

# 階段順序很重要：擴充的嵌入必須排在 "Thin Binary" **之前**。
#
# 原因（否則 Xcode 會回報 "Cycle inside Runner"）：
# - ProcessInfoPlistFile 產出 Runner.app/Info.plist，並視整個 Runner.app
#   為其產出，因此寫入 Runner.app/PlugIns 的拷貝階段必須排在其後。
# - Flutter 的 "Thin Binary" 腳本以 ${TARGET_BUILD_DIR}/${INFOPLIST_PATH}
#   為輸入，必須排在 ProcessInfoPlistFile 之後。
# - 若把拷貝階段放在 "Thin Binary" 之後，就會形成
#   拷貝 → Thin Binary → ProcessInfoPlistFile → 拷貝 的循環。
#
# 這也是原生 Xcode App target 的慣例（Embed App Extensions 在 Thin Binary 之前）。
thin_binary_index = runner.build_phases.index do |phase|
  phase.respond_to?(:name) && phase.name == 'Thin Binary'
end
if thin_binary_index
  runner.build_phases.move(embed_phase, thin_binary_index)
end

# ── 6. 單元測試 target ────────────────────────────────────────
#
# `ios/RunnerTests/` 放的是原生端單元測試（XCTest），用來驗證
# 深層連結佇列（`ios/Runner/DeepLinkQueue.swift`）這類「不依賴 Flutter
# 引擎」的規則。放在這裡管理的原因：Xcode 專案裡 target 與 build phase
# 記錄在 project.pbxproj，人工編輯容易出錯且不可重現。
#
# 測試需要 `@testable import Runner`，因此主 App 的 Debug 組態必須開啟
# `ENABLE_TESTABILITY`（Swift 才會輸出可供測試使用的符號）。
tests_target = project.targets.find { |t| t.name == 'RunnerTests' }

if tests_target.nil?
  tests_target = project.new_target(
    :unit_test_bundle,
    'RunnerTests',
    :ios,
    DEPLOYMENT_TARGET,
    project.products_group,
    :swift
  )
end

apply_common_settings(tests_target, DEPLOYMENT_TARGET, {
  'PRODUCT_BUNDLE_IDENTIFIER' => "#{BUNDLE_PREFIX}.RunnerTests",
  'PRODUCT_NAME' => '$(TARGET_NAME)',
  'GENERATE_INFOPLIST_FILE' => 'YES',
  'BUNDLE_LOADER' => '$(TEST_HOST)',
  'TEST_HOST' => '$(BUILT_PRODUCTS_DIR)/Runner.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Runner',
  # 測試以 App 為宿主執行（RunnerTests 是 unit test bundle），
  # 需要 Runner 的符號才能 `@testable import Runner`。
  'ENABLE_TESTABILITY' => 'YES',
  'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => 'DEBUG'
})

# 主 App 的 Debug 組態必須輸出可測試符號，否則 `@testable import Runner` 會失敗。
runner.build_configurations.each do |config|
  next unless config.name == 'Debug'
  config.build_settings['ENABLE_TESTABILITY'] = 'YES'
  # 讓測試可以 import 主 App 的 Swift 模組。
  config.build_settings['DEFINES_MODULE'] = 'YES'
end

tests_group = sync_group(project, 'RunnerTests')
tests_source_phase = tests_target.source_build_phase
clear_phase(tests_source_phase)
add_sources(
  tests_target,
  tests_group,
  Dir.glob(File.join(ROOT, 'ios', 'RunnerTests', '*.swift')).sort
)

# ── 7. 存檔與自我驗證 ─────────────────────────────────────────

project.save

# 自我驗證：確認關鍵設定確實套用，避免腳本靜默失效。
errors = []

EXTENSIONS.each do |ext|
  target = project.targets.find { |t| t.name == ext[:name] }
  if target.nil?
    errors << "缺少 target: #{ext[:name]}"
    next
  end
  target.build_configurations.each do |config|
    settings = config.build_settings
    if settings['IPHONEOS_DEPLOYMENT_TARGET'] != DEPLOYMENT_TARGET
      errors << "#{ext[:name]}/#{config.name} deployment target 為 " \
                "#{settings['IPHONEOS_DEPLOYMENT_TARGET']}（應為 #{DEPLOYMENT_TARGET}）"
    end
    if settings['PRODUCT_BUNDLE_IDENTIFIER'] != "#{BUNDLE_PREFIX}.#{ext[:name]}"
      errors << "#{ext[:name]}/#{config.name} bundle id 不符"
    end
    if config.base_configuration_reference.nil?
      errors << "#{ext[:name]}/#{config.name} 缺少 base configuration（Extensions.xcconfig）"
    end
  end
  if target.source_build_phase.files.count.zero?
    errors << "#{ext[:name]} 沒有任何 Swift 原始檔"
  end
  # Sources 階段不得有重複項目（腳本重複執行時最容易出錯的地方）。
  source_names = runner_source_phase_names(target)
  duplicates = source_names.group_by { |n| n }.select { |_, list| list.size > 1 }.keys
  unless duplicates.empty?
    errors << "#{ext[:name]} Sources 階段有重複檔案：#{duplicates.join(', ')}"
  end
end

# 舊的 App Intents 擴充必須已經消失。
RETIRED_TARGETS.each do |name|
  if project.targets.any? { |t| t.name == name }
    errors << "舊的 App Intents 擴充 target 仍存在: #{name}"
  end
end

runner.build_configurations.each do |config|
  next unless config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] != DEPLOYMENT_TARGET
  errors << "Runner/#{config.name} deployment target 不符"
end

# 主 App 內的 App Intent 必須在 Runner 的 Sources 階段。
runner_source_names = runner.source_build_phase.files.map { |f| f.file_ref&.path.to_s }
%w[RecordTransactionIntent.swift AssetPilotShortcuts.swift].each do |name|
  unless runner_source_names.any? { |p| p.to_s.split('/').last == name }
    errors << "Runner Sources 階段缺少 #{name}"
  end
end

# 主 App 需要 AppIntents.framework。
unless runner.frameworks_build_phase.files.any? { |bf| bf.file_ref&.path.to_s == app_intents_path }
  errors << 'Runner 缺少 AppIntents.framework'
end

# 擴充必須被嵌入 App，否則 Widget 不會出現在系統中。
embed_phase = runner.build_phases.find do |phase|
  phase.respond_to?(:symbol_dst_subfolder_spec) &&
    phase.symbol_dst_subfolder_spec == :plug_ins
end
if embed_phase.nil?
  errors << '缺少 Embed Foundation Extensions 階段'
else
  embedded = embed_phase.files.map { |f| f.file_ref&.path.to_s }.compact
  EXTENSIONS.each do |ext|
    expected = "#{ext[:name]}.appex"
    errors << "embed 階段缺少 #{expected}" unless embedded.include?(expected)
  end

  # 嵌入階段必須排在 "Thin Binary" 之前，否則會形成建置循環。
  phases = runner.build_phases
  embed_index = phases.index(embed_phase)
  thin_index = phases.index do |phase|
    phase.respond_to?(:name) && phase.name == 'Thin Binary'
  end
  if embed_index && thin_index && embed_index > thin_index
    errors << 'Embed Foundation Extensions 必須排在 Thin Binary 之前（會造成建置循環）'
  end
end

# 單元測試 target 必須存在，且已收錄所有 RunnerTests 原始檔。
tests_target = project.targets.find { |t| t.name == 'RunnerTests' }
if tests_target.nil?
  errors << '缺少單元測試 target: RunnerTests'
else
  test_sources = tests_target.source_build_phase.files.map { |f| f.file_ref&.path.to_s }
  expected_tests = Dir.glob(File.join(ROOT, 'ios', 'RunnerTests', '*.swift')).sort
  if expected_tests.empty?
    errors << 'ios/RunnerTests/ 沒有任何測試原始檔'
  end
  expected_tests.each do |path|
    name = File.basename(path)
    unless test_sources.any? { |p| p.to_s.split('/').last == name }
      errors << "RunnerTests Sources 階段缺少 #{name}"
    end
  end
  if test_sources.count.zero?
    errors << 'RunnerTests 沒有任何 Swift 原始檔'
  end
  # 測試以 App 為宿主執行，必須設定 TEST_HOST。
  tests_target.build_configurations.each do |config|
    settings = config.build_settings
    if settings['TEST_HOST'].to_s.empty?
      errors << "RunnerTests/#{config.name} 缺少 TEST_HOST"
    end
    if settings['ENABLE_TESTABILITY'] != 'YES'
      errors << "RunnerTests/#{config.name} 未開啟 ENABLE_TESTABILITY"
    end
  end
end

# 主 App 的 Debug 組態必須可被 `@testable import`。
runner_debug = runner.build_configurations.find { |c| c.name == 'Debug' }
if runner_debug.nil?
  errors << 'Runner 缺少 Debug 組態'
elsif runner_debug.build_settings['ENABLE_TESTABILITY'] != 'YES'
  errors << 'Runner/Debug 未開啟 ENABLE_TESTABILITY（`@testable import Runner` 會失敗）'
end

unless errors.empty?
  warn 'iOS target 設定驗證失敗：'
  errors.each { |e| warn "  - #{e}" }
  exit 1
end
puts "Targets: #{project.targets.map(&:name).join(', ')}"
EXTENSIONS.each { |ext| puts "#{ext[:name]} bundle id: #{BUNDLE_PREFIX}.#{ext[:name]}" }
puts "Deployment target: #{DEPLOYMENT_TARGET} (all targets)"
puts 'iOS targets configured and verified.'

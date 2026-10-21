#!/usr/bin/env bash
# 一次跑完 iOS 端的三層測試：原生 XCTest → 整合測試 → Dart 單元測試。
#
# 為什麼需要這個腳本（而不是直接照順序手動執行）：
#
# 1. **順序有意義。** 整合測試（`flutter test integration_test`）會把
#    `ios/Flutter/Generated.xcconfig` 的 `FLUTTER_TARGET` 改寫成暫存目錄裡的
#    `listener.dart`；測試結束後該目錄會被刪除。若之後再執行 `xcodebuild`，
#    就會因找不到 listener.dart 而建置失敗。因此 **原生 XCTest 必須排在
#    整合測試之前**。
# 2. **整合測試需要模擬器。** 沒有多個模擬器時，指定第一個可用者。
# 3. **收尾要還原 FLUTTER_TARGET。** 最後重新產生一次建置設定，
#    讓後續的 `xcodebuild`／`flutter build` 不會踩到 (1)。
#
# 用法：
#   tool/test_ios.sh                 # 自動挑選第一個可用模擬器
#   tool/test_ios.sh <simulator-udid> # 指定模擬器
set -euo pipefail

cd "$(dirname "$0")/.."

SIMULATOR_ID="${1:-}"

if [ -z "${SIMULATOR_ID}" ]; then
  # 取第一個已開機的 iPhone 模擬器；沒有就啟動第一個可用的。
  pick_device() {
    local state_filter="$1"
    SIMCTL_FILTER="$state_filter" python3 -c '
import json, os, subprocess
wanted = os.environ["SIMCTL_FILTER"]
data = json.loads(subprocess.run(
    ["xcrun", "simctl", "list", "devices", "-j"],
    capture_output=True, text=True, check=True).stdout)
for devices in data["devices"].values():
    for device in devices:
        if "iPhone" not in device["name"]:
            continue
        if wanted == "booted" and device["state"] != "Booted":
            continue
        if wanted == "available" and device.get("isAvailable") is False:
            continue
        print(device["udid"])
        raise SystemExit
print("")
'
  }

  SIMULATOR_ID=$(pick_device booted)
  if [ -z "${SIMULATOR_ID}" ]; then
    SIMULATOR_ID=$(pick_device available)
    if [ -z "${SIMULATOR_ID}" ]; then
      echo "找不到可用的 iPhone 模擬器，請先建立或啟動一個。" >&2
      exit 1
    fi
  fi
fi

echo "==> 模擬器：${SIMULATOR_ID}"

# 確保模擬器是開機狀態。
#
# `xcodebuild test` 會在「Clone」裝置上跑測試，結束後可能把原裝置關機，
# 因此每次需要模擬器前都要確認狀態。
ensure_booted() {
  local state
  state=$(SIMCTL_UDID="${SIMULATOR_ID}" python3 -c '
import json, os, subprocess
udid = os.environ["SIMCTL_UDID"]
data = json.loads(subprocess.run(
    ["xcrun", "simctl", "list", "devices", "-j"],
    capture_output=True, text=True, check=True).stdout)
for devices in data["devices"].values():
    for device in devices:
        if device["udid"] == udid:
            print(device["state"])
            raise SystemExit
print("")
')
  if [ "$state" != "Booted" ]; then
    echo "==> 啟動模擬器 ${SIMULATOR_ID}（目前狀態：${state:-未知}）"
    xcrun simctl boot "${SIMULATOR_ID}" 2>/dev/null || true
    xcrun simctl bootstatus "${SIMULATOR_ID}" -b >/dev/null 2>&1 || true
    sleep 10
  fi
}

ensure_booted

echo "==> 1/4 iOS 原生單元測試（XCTest）"
# 必須在整合測試之前執行，理由見檔頭說明。
xcodebuild test \
  -project ios/Runner.xcodeproj \
  -scheme Runner \
  -destination "id=${SIMULATOR_ID}" \
  -only-testing:RunnerTests \
  CODE_SIGNING_ALLOWED=NO

echo "==> 2/4 iOS 整合測試（模擬器上的 Dart↔原生往返）"
# XCTest 跑完可能讓原裝置關機，這裡重新確認。
ensure_booted
flutter test integration_test -d "${SIMULATOR_ID}"

echo "==> 3/4 Dart 單元測試"
flutter test

echo "==> 4/4 還原 FLUTTER_TARGET"
# 整合測試會把 FLUTTER_TARGET 指向已刪除的暫存目錄；重新建置可還原它。
flutter build ios --simulator --debug --no-codesign

echo "==> 全部完成"

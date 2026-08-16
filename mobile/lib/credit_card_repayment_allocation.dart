// mobile/lib/credit_card_repayment_allocation.dart — 信用卡還款分配（純整數運算，dart:core BigInt）。
//
// 權威定義見 specs/006-credit-card-total-repayment/research.md 第 4 節。
// 本檔與 lib/creditCardRepaymentAllocation.ts（TypeScript）逐步驟對應，
// 並以同一份 shared/repayment-allocation/cases.json 黃金測資釘住（FR-016a、SC-009）。
// 不引入任何 decimal 套件；dart:core 的 BigInt 即為任意精度整數。

/// 納入分配的一張卡（呼叫端已正規化 debt 為正整數）。
class AllocationCard {
  final String id;
  final int debt; // 付款帳戶幣別的正整數欠款，恆 ≥ 1

  const AllocationCard({required this.id, required this.debt});
}

/// 分配結果。
class AllocationResult {
  final String cardId;
  final int amount; // 付款帳戶幣別的整數分配金額，恆 ≥ 1

  const AllocationResult({required this.cardId, required this.amount});
}

/// halfUpDiv(n, m) = ⌊(2n + m) / 2m⌋，等價於 round_half_up(n / m)，全程 BigInt。
/// n ≥ 0、m > 0；回傳非負整數。
BigInt _halfUpDiv(BigInt n, BigInt m) => (BigInt.two * n + m) ~/ (BigInt.two * m);

/// 依 research.md 第 4 節的權威定義分配總金額。
///
/// [totalAmount] 正整數總金額（付款帳戶幣別）。
/// [cards] 已依標準順序排好的卡片（建立時間早→晚，同值再 id 升冪），長度 ≥ 1。
///
/// 拋出 [StateError] 當前置條件不成立（totalAmount 非正整數、cards 為空、totalAmount < cards.length）
/// 或後置條件不成立（總和 ≠ totalAmount，或任一 amount < 1）。
List<AllocationResult> allocateRepayment(int totalAmount, List<AllocationCard> cards) {
  // 前置條件（呼叫端先擋，函式再 assert）。
  if (cards.isEmpty) {
    throw StateError('allocateRepayment: cards 至少需 1 張');
  }
  if (totalAmount <= 0) {
    throw StateError('allocateRepayment: totalAmount 必須為正整數');
  }
  if (totalAmount < cards.length) {
    throw StateError('allocateRepayment: totalAmount 不得小於卡片張數');
  }

  final n = cards.length;
  final T = BigInt.from(totalAmount);

  // 步驟 1：sumDebt = Σ debt_i
  var sumDebt = BigInt.zero;
  final debts = <BigInt>[];
  for (final c in cards) {
    if (c.debt < 1) {
      throw StateError('allocateRepayment: 每張卡 debt 必須為正整數');
    }
    final d = BigInt.from(c.debt);
    debts.add(d);
    sumDebt += d;
  }
  if (sumDebt <= BigInt.zero) {
    throw StateError('allocateRepayment: sumDebt 必須 > 0');
  }

  // 步驟 2：anchor = 「欠款最大」的索引：由前往後掃描，只有嚴格大於目前最大值才更新
  //        → 並列時取陣列中最前者（FR-005b）
  var anchor = 0;
  var maxDebt = debts[0];
  for (var i = 1; i < n; i++) {
    if (debts[i] > maxDebt) {
      maxDebt = debts[i];
      anchor = i;
    }
  }

  // 步驟 3：amount_i = halfUpDiv(T × debt_i, sumDebt)
  final amounts = List<BigInt>.filled(n, BigInt.zero);
  var sumAmount = BigInt.zero;
  for (var i = 0; i < n; i++) {
    amounts[i] = _halfUpDiv(T * debts[i], sumDebt);
    sumAmount += amounts[i];
  }

  // 步驟 4：amount_anchor += T − Σ amount_i（殘差併入最大卡；有號）
  amounts[anchor] += T - sumAmount;

  // 步驟 5：對每個 amount_i < 1 者設為 1（FR-005a 保底）
  for (var i = 0; i < n; i++) {
    if (amounts[i] < BigInt.one) amounts[i] = BigInt.one;
  }

  // 步驟 6：diff = Σ amount_i − T
  var diff = amounts.fold(BigInt.zero, (a, b) => a + b) - T;
  if (diff > BigInt.zero) {
    // 依「amount 由大到小、同值依陣列順序」逐張扣減，每張最多扣到剩 1，直到 diff = 0。
    // ★ 排序在進入步驟 6 時計算一次（穩定排序），之後依該固定順序單趟掃描，
    //   每張卡最多被處理一次，不因扣減而重新排序。Dart 的 List.sort 非穩定排序，
    //   須以索引作為次要比較鍵確保與 TS 端逐位元一致。
    final order = List.generate(n, (i) => <BigInt>[amounts[i], BigInt.from(i)])
      ..sort((a, b) {
        final cmp = b[0].compareTo(a[0]); // amount 由大到小
        if (cmp != 0) return cmp;
        return a[1].compareTo(b[1]); // 同值依原索引升冪（穩定）
      });
    for (final entry in order) {
      if (diff <= BigInt.zero) break;
      final idx = entry[1].toInt();
      final canTake = amounts[idx] - BigInt.one;
      if (canTake <= BigInt.zero) continue;
      final take = canTake < diff ? canTake : diff;
      amounts[idx] -= take;
      diff -= take;
    }
  } else if (diff < BigInt.zero) {
    // diff < 0：全數加到 anchor（防禦性分支；理論上不可達，保留以免靜默失衡）
    amounts[anchor] += -diff;
  }

  // 步驟 7：後置條件 assert
  final finalSum = amounts.fold(BigInt.zero, (a, b) => a + b);
  if (finalSum != T) {
    throw StateError('allocateRepayment: 後置條件失敗（總和 $finalSum ≠ $T）');
  }
  for (var i = 0; i < n; i++) {
    if (amounts[i] < BigInt.one) {
      throw StateError('allocateRepayment: 後置條件失敗（第 $i 張 amount ${amounts[i]} < 1）');
    }
  }

  return List.generate(n, (i) => AllocationResult(cardId: cards[i].id, amount: amounts[i].toInt()));
}
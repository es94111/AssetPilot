// mobile/test/credit_card_repayment_allocation_test.dart — 不需模擬器、不新增套件。
// 以 dart:io 讀取 ../shared/repayment-allocation/cases.json（flutter test 工作目錄為 mobile/），
// 對每組案例斷言 Dart 版 allocateRepayment() 輸出與 expected 逐張相同並滿足後置條件（SC-009）。
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:assetpilot/credit_card_repayment_allocation.dart';

void main() {
  final file = File('../shared/repayment-allocation/cases.json');
  final cases = (jsonDecode(file.readAsStringSync()) as List)
      .map((e) => e as Map<String, dynamic>)
      .toList();

  for (final c in cases) {
    final name = c['name'] as String;
    final totalAmount = (c['totalAmount'] as num).toInt();
    final debts = (c['debts'] as List).map((d) => (d as num).toInt()).toList();
    final expected = (c['expected'] as List).map((d) => (d as num).toInt()).toList();

    test('黃金測資：$name', () {
      final cards = List.generate(
        debts.length,
        (i) => AllocationCard(id: 'card_$i', debt: debts[i]),
      );
      final result = allocateRepayment(totalAmount, cards);
      expect(result.length, expected.length, reason: '張數應相同');
      final got = result.map((r) => r.amount).toList();
      expect(got, expected, reason: '輸出應逐張等於期望值');
      final sum = got.fold(0, (a, b) => a + b);
      expect(sum, totalAmount, reason: '總和應等於 totalAmount');
      for (final a in got) {
        expect(a, greaterThanOrEqualTo(1), reason: '每張應 ≥ 1');
      }
    });
  }

  test('後置條件：回傳的 cardId 對應輸入順序', () {
    final cards = [
      AllocationCard(id: 'A', debt: 6000),
      AllocationCard(id: 'B', debt: 3000),
      AllocationCard(id: 'C', debt: 1000),
    ];
    final result = allocateRepayment(10000, cards);
    expect(result.map((r) => r.cardId).toList(), ['A', 'B', 'C']);
  });

  test('前置條件違反：cards 為空 → 拋例外', () {
    expect(() => allocateRepayment(100, []), throwsStateError);
  });

  test('前置條件違反：totalAmount ≤ 0 → 拋例外', () {
    expect(() => allocateRepayment(0, [AllocationCard(id: 'A', debt: 5)]), throwsStateError);
    expect(() => allocateRepayment(-3, [AllocationCard(id: 'A', debt: 5)]), throwsStateError);
  });

  test('前置條件違反：totalAmount < cards.length → 拋例外', () {
    expect(
      () => allocateRepayment(2, [
        AllocationCard(id: 'A', debt: 5),
        AllocationCard(id: 'B', debt: 5),
        AllocationCard(id: 'C', debt: 5),
      ]),
      throwsStateError,
    );
  });

  test('前置條件違反：debt < 1 → 拋例外', () {
    expect(() => allocateRepayment(100, [AllocationCard(id: 'A', debt: 0)]), throwsStateError);
  });
}
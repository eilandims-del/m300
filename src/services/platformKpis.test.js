import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePrimeiroLogin,
  resolvePrimeiroDespacho,
  resolvePrimeiroDesloc,
  averagePrimeiroLogin,
  averagePrimeiroDespacho,
  averagePrimeiroDesloc,
  setPlatformKpiColumns,
  resetPlatformKpiColumns
} from './platformKpis.js';
import { buildAnalytics } from './kpiCalculator.js';

test('usa colunas Spotfire e ignora fallback por OS quando a coluna existe', () => {
  setPlatformKpiColumns({
    primeiroLoginCorrigido: '1º Login Corrigido',
    primeiroDespacho: '1º Despacho',
    primeiroDesloc: '1º Desloc'
  });

  const row = {
    primeiroLoginCorrigido: 0,
    primeiroDespacho: null,
    primeiroDesloc: null,
    // Timestamps por OS — NÃO devem contaminar a média quando a coluna oficial está vazia.
    inicioCalendario: Date.parse('2026-07-08T07:00:00'),
    logInCorrigido: Date.parse('2026-07-08T06:44:00'),
    horaPrimeiroDespacho: Date.parse('2026-07-08T11:00:00'),
    horaPrimeiroDeslocamento: Date.parse('2026-07-08T12:00:00'),
    despachada: Date.parse('2026-07-08T15:00:00'),
    aCaminho: Date.parse('2026-07-08T16:00:00')
  };

  assert.equal(resolvePrimeiroLogin(row), 0);
  assert.equal(resolvePrimeiroDespacho(row), null);
  assert.equal(resolvePrimeiroDesloc(row), null);
  resetPlatformKpiColumns();
});

test('em arquivo legado (sem colunas oficiais) reconstrói só a partir de Hora 1º *', () => {
  resetPlatformKpiColumns();
  const row = {
    primeiroDespacho: null,
    primeiroDesloc: null,
    inicioCalendario: Date.parse('2026-07-08T07:00:00'),
    horaPrimeiroDespacho: Date.parse('2026-07-08T07:15:00'),
    horaPrimeiroDeslocamento: Date.parse('2026-07-08T07:17:00'),
    despachada: Date.parse('2026-07-08T15:00:00'),
    aCaminho: Date.parse('2026-07-08T16:00:00')
  };

  assert.equal(resolvePrimeiroDespacho(row), 15);
  assert.equal(resolvePrimeiroDesloc(row), 17);
});

test('média de plataforma não é distorcida por outliers de fallback', () => {
  setPlatformKpiColumns({
    primeiroLoginCorrigido: '1º Login Corrigido',
    primeiroDespacho: '1º Despacho',
    primeiroDesloc: '1º Desloc'
  });

  const rows = [
    {
      equipe: 'A',
      dataReferenciaKey: '01/07/2026',
      dataReferenciaDate: Date.parse('2026-07-01'),
      primeiroLoginCorrigido: 0,
      primeiroDespacho: 10,
      primeiroDesloc: 18,
      retornoBase: 40,
      qtdDeslocamentos: 4,
      htTotal: 80,
      hdTotal: 100,
      taskTimeTotalTr: 50,
      tempoPadraoTotalCal: 100,
      trTotalCal: 100,
      baseResolvida: 'ATLÂNTICO',
      tipoResolvido: 'EMERGENCIA',
      periodoResolvido: 'Manhã'
    },
    {
      equipe: 'A',
      dataReferenciaKey: '01/07/2026',
      dataReferenciaDate: Date.parse('2026-07-01'),
      // Segunda OS do mesmo dia — deve ser deduplicada.
      primeiroLoginCorrigido: 0,
      primeiroDespacho: 10,
      primeiroDesloc: 18,
      retornoBase: 40,
      qtdDeslocamentos: 4,
      htTotal: 80,
      hdTotal: 100,
      taskTimeTotalTr: 50,
      tempoPadraoTotalCal: 100,
      trTotalCal: 100,
      baseResolvida: 'ATLÂNTICO',
      tipoResolvido: 'EMERGENCIA',
      periodoResolvido: 'Manhã',
      // Se o fallback antigo rodasse, estes valores inflariam o KPI.
      inicioCalendario: Date.parse('2026-07-01T07:00:00'),
      despachada: Date.parse('2026-07-01T15:00:00'),
      aCaminho: Date.parse('2026-07-01T16:00:00')
    },
    {
      equipe: 'B',
      dataReferenciaKey: '01/07/2026',
      dataReferenciaDate: Date.parse('2026-07-01'),
      primeiroLoginCorrigido: 2,
      primeiroDespacho: null, // Spotfire em branco → fora da média
      primeiroDesloc: 16,
      retornoBase: 50,
      qtdDeslocamentos: 5,
      htTotal: 70,
      hdTotal: 100,
      taskTimeTotalTr: 40,
      tempoPadraoTotalCal: 90,
      trTotalCal: 100,
      baseResolvida: 'ATLÂNTICO',
      tipoResolvido: 'EMERGENCIA',
      periodoResolvido: 'Manhã',
      inicioCalendario: Date.parse('2026-07-01T07:00:00'),
      horaPrimeiroDespacho: Date.parse('2026-07-01T14:00:00')
    }
  ];

  const analytics = buildAnalytics(rows, {
    columnMap: {
      primeiroLoginCorrigido: '1º Login Corrigido',
      primeiroDespacho: '1º Despacho',
      primeiroDesloc: '1º Desloc'
    }
  });

  assert.equal(analytics.rankings['1º Login'].average, 1); // (0+2)/2
  assert.equal(analytics.rankings['1º Despacho'].average, 10); // só o dia A
  assert.equal(analytics.rankings['1º Desloc.'].average, 17); // (18+16)/2
  resetPlatformKpiColumns();
});

test('average helpers respeitam null', () => {
  setPlatformKpiColumns({
    primeiroDespacho: '1º Despacho',
    primeiroDesloc: '1º Desloc',
    primeiroLoginCorrigido: '1º Login Corrigido'
  });
  const rows = [
    { primeiroLoginCorrigido: 1, primeiroDespacho: 10, primeiroDesloc: null },
    { primeiroLoginCorrigido: 3, primeiroDespacho: null, primeiroDesloc: 20 }
  ];
  assert.equal(averagePrimeiroLogin(rows), 2);
  assert.equal(averagePrimeiroDespacho(rows), 10);
  assert.equal(averagePrimeiroDesloc(rows), 20);
  resetPlatformKpiColumns();
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dividirQuadra, gerarQuadras, juntarQuadras, renumerar } from '../src/lib/quadras.js';

// Um quadrado de ~440 m em Cidade Exemplo, cortado por uma rua vertical e uma horizontal no meio.
const [lat, lng, d] = [-16.46, -54.61, 0.002];
const contorno = { type: 'Polygon', coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] };
const ruaVertical = [[lng, lat - 0.004], [lng, lat + 0.004]];
const ruaHorizontal = [[lng - 0.004, lat], [lng + 0.004, lat]];

describe('gerarQuadras', () => {
  it('duas ruas em cruz dividem o contorno em 4 quadras', () => {
    const q = gerarQuadras(contorno, [ruaVertical, ruaHorizontal]);
    assert.equal(q.length, 4);
    assert.deepEqual(q.map((x) => x.numero), [1, 2, 3, 4]);
    assert.ok(q.every((x) => x.areaM2 > 40000 && x.areaM2 < 50000), JSON.stringify(q.map((x) => x.areaM2)));
  });

  it('numera de cima para baixo, da esquerda para a direita', () => {
    const q = gerarQuadras(contorno, [ruaVertical, ruaHorizontal]);
    const centroX = (g) => g.coordinates[0].reduce((s, p) => s + p[0], 0) / g.coordinates[0].length;
    const centroY = (g) => g.coordinates[0].reduce((s, p) => s + p[1], 0) / g.coordinates[0].length;
    assert.ok(centroY(q[0].geometria) > lat && centroX(q[0].geometria) < lng, 'quadra 1 = noroeste');
    assert.ok(centroY(q[1].geometria) > lat && centroX(q[1].geometria) > lng, 'quadra 2 = nordeste');
    assert.ok(centroY(q[2].geometria) < lat && centroX(q[2].geometria) < lng, 'quadra 3 = sudoeste');
  });

  it('rua fora do contorno não muda nada; sem ruas, o contorno inteiro é uma quadra', () => {
    const longe = [[lng + 0.05, lat - 0.05], [lng + 0.05, lat + 0.05]];
    assert.equal(gerarQuadras(contorno, [longe]).length, 1);
    assert.equal(gerarQuadras(contorno, []).length, 1);
  });

  it('rua sem saída não divide a quadra', () => {
    const semSaida = [[lng, lat - d - 0.001], [lng, lat]]; // entra pelo sul e para no meio
    assert.equal(gerarQuadras(contorno, [semSaida]).length, 1);
  });
});

describe('ajustes manuais', () => {
  it('dividir uma quadra com uma linha que a atravessa', () => {
    const pedacos = dividirQuadra(contorno, [[lng - 0.003, lat], [lng + 0.003, lat]]);
    assert.equal(pedacos.length, 2);
  });

  it('linha que não atravessa a quadra não divide', () => {
    assert.equal(dividirQuadra(contorno, [[lng - 0.003, lat], [lng - 0.0025, lat]]), null);
  });

  it('juntar duas quadras e renumerar', () => {
    const q = gerarQuadras(contorno, [ruaVertical, ruaHorizontal]);
    const unida = juntarQuadras([q[0].geometria, q[1].geometria]);
    assert.ok(unida);
    const nova = renumerar([{ geometria: unida }, q[2], q[3]]);
    assert.deepEqual(nova.map((x) => x.numero), [1, 2, 3]);
  });
});

describe('o que conta como rua', async () => {
  const { ehRua } = await import('../src/lib/ruas.js');
  it('ruas normais sempre contam', () => {
    assert.equal(ehRua({ highway: 'residential' }), true);
    assert.equal(ehRua({ highway: 'secondary', name: 'Perimetral' }), true);
  });
  it('caminho/estrada de terra só conta se tiver nome (ex.: Rua G cadastrada como "path")', () => {
    assert.equal(ehRua({ highway: 'path', name: 'Rua G' }), true);
    assert.equal(ehRua({ highway: 'track', name: 'Avenida J' }), true);
    assert.equal(ehRua({ highway: 'path' }), false);
    assert.equal(ehRua({ highway: 'footway', name: '  ' }), false);
  });
  it('outras coisas não contam', () => {
    assert.equal(ehRua({ highway: 'proposed', name: 'Rua X' }), false);
    assert.equal(ehRua({ building: 'yes' }), false);
    assert.equal(ehRua(undefined), false);
  });
});

describe('contorno válido', async () => {
  const { contornoValido } = await import('../src/lib/quadras.js');
  it('recusa contorno vazio ou sem área', () => {
    assert.equal(contornoValido(null), false);
    assert.equal(contornoValido({ type: 'Polygon', coordinates: [[]] }), false);
    assert.equal(contornoValido({ type: 'Polygon', coordinates: [[[-54.6, -16.4], [-54.6, -16.4], [-54.6, -16.4], [-54.6, -16.4]]] }), false);
  });
  it('aceita um contorno de verdade', () => {
    assert.equal(contornoValido({ type: 'Polygon', coordinates: [[[-54.61, -16.46], [-54.60, -16.46], [-54.60, -16.45], [-54.61, -16.46]]] }), true);
  });
});

describe('limite da congregação', async () => {
  const { areasSemTerritorio } = await import('../src/lib/limite.js');
  const quadrado = (x0, y0, lado) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x0 + lado, y0], [x0 + lado, y0 + lado], [x0, y0 + lado], [x0, y0]]] });
  it('mede quanto do limite está coberto e devolve as áreas vazias', () => {
    const limite = { type: 'Feature', properties: {}, geometry: quadrado(-54.62, -16.47, 0.01) };
    const r = areasSemTerritorio(limite, [quadrado(-54.62, -16.47, 0.005)]);
    assert.ok(r.porcentagem >= 24 && r.porcentagem <= 26, `cobertura ${r.porcentagem}%`);
    assert.equal(r.vazios.features.length, 1);
  });
  it('sem nenhum território desenhado, o limite inteiro é vazio', () => {
    const limite = { type: 'Feature', properties: {}, geometry: quadrado(-54.62, -16.47, 0.01) };
    assert.equal(areasSemTerritorio(limite, []).porcentagem, 0);
  });
});

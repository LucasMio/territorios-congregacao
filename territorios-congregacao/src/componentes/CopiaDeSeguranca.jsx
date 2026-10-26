// Administrador: baixa uma planilha Excel com tudo do sistema (cópia de segurança do mês).
// A biblioteca de Excel só é carregada quando o botão é tocado.
import { useState } from 'react';
import { supabase } from '../supabase.js';
import { hojeLocal } from '../lib/situacao.js';
import Aviso from './Aviso.jsx';
import Icone from './Icone.jsx';

/** Lê uma tabela inteira, de 1000 em 1000 linhas (limite de cada consulta). */
async function lerTudo(tabela, colunas, ordem) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select(colunas).order(ordem).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

const ABAS = [
  {
    nome: 'Territórios',
    tabela: 'territorios',
    colunas: 'numero, bairro, grupo, ultima_data, ciclo_atual, link_localizacao, link_mapa, observacoes',
    ordem: 'numero',
    cabecalho: { numero: 'Nº', bairro: 'Bairro', grupo: 'Grupo', ultima_data: 'Última conclusão', ciclo_atual: 'Volta atual', link_localizacao: 'Google Maps', link_mapa: 'Mapa antigo', observacoes: 'Observações' },
  },
  {
    nome: 'Conclusões',
    tabela: 'conclusoes',
    colunas: 'territorio_numero, data, ciclo, ciclo_iniciado_em, manual, concluida_por_nome',
    ordem: 'data',
    cabecalho: { territorio_numero: 'Território', data: 'Concluído em', ciclo: 'Volta', ciclo_iniciado_em: 'Volta começou em', manual: 'À mão', concluida_por_nome: 'Concluído por' },
  },
  {
    nome: 'Quadras marcadas',
    tabela: 'marcacoes',
    colunas: 'territorio_numero, data, dirigente_nome, ciclo, criada_em, quadras(numero)',
    ordem: 'data',
    transformar: (l) => ({ ...l, quadra: l.quadras?.numero }),
    cabecalho: { territorio_numero: 'Território', quadra: 'Quadra', data: 'Trabalhada em', dirigente_nome: 'Dirigente', ciclo: 'Volta', criada_em: 'Marcada no sistema em' },
  },
  {
    nome: 'Programação',
    tabela: 'saidas',
    colunas: 'data, horario, local, grupo, dirigente_nome, territorio_numero, sem_territorio, observacao, chave',
    ordem: 'data',
    filtro: (l) => !l.chave?.startsWith('teste:'),
    cabecalho: { data: 'Data', horario: 'Horário', local: 'Local', grupo: 'Grupo', dirigente_nome: 'Dirigente', territorio_numero: 'Território', sem_territorio: 'Sem território (cartas)', observacao: 'Observação' },
  },
  {
    nome: 'Campanhas',
    tabela: 'campanhas',
    colunas: 'nome, inicio, fim, meta_territorios, encerrada_em',
    ordem: 'inicio',
    cabecalho: { nome: 'Campanha', inicio: 'Início', fim: 'Fim', meta_territorios: 'Meta', encerrada_em: 'Encerrada em' },
  },
];

export default function CopiaDeSeguranca() {
  const [estado, setEstado] = useState('');
  const [erro, setErro] = useState('');

  async function baixar() {
    setErro('');
    try {
      setEstado('Preparando a planilha…');
      const { default: ExcelJS } = await import('exceljs');
      const livro = new ExcelJS.Workbook();
      livro.creator = 'Territórios – Vila Exemplo';
      for (const aba of ABAS) {
        setEstado(`Lendo ${aba.nome.toLowerCase()}…`);
        const linhas = (await lerTudo(aba.tabela, aba.colunas, aba.ordem)).filter(aba.filtro ?? (() => true)).map(aba.transformar ?? ((l) => l));
        const folha = livro.addWorksheet(aba.nome);
        const chaves = Object.keys(aba.cabecalho);
        folha.columns = chaves.map((k) => ({ header: aba.cabecalho[k], key: k, width: Math.max(12, aba.cabecalho[k].length + 4) }));
        folha.getRow(1).font = { bold: true };
        folha.views = [{ state: 'frozen', ySplit: 1 }];
        for (const l of linhas) {
          folha.addRow(Object.fromEntries(chaves.map((k) => [k, typeof l[k] === 'boolean' ? (l[k] ? 'sim' : 'não') : l[k] ?? ''])));
        }
      }
      setEstado('Gerando o arquivo…');
      const dados = await livro.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: `territorios-copia-${hojeLocal()}.xlsx` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setEstado('Pronto! A planilha foi baixada (veja em Downloads).');
    } catch (e) {
      setEstado('');
      setErro(`Não foi possível gerar a planilha: ${e.message}`);
    }
  }

  return (
    <div className="copia-seguranca">
      <button className="secundario pequeno" onClick={baixar} disabled={Boolean(estado) && !estado.startsWith('Pronto')}>
        <Icone nome="lista" tamanho={18} /> Baixar cópia de segurança (Excel)
      </button>
      {estado && <p className="dica" role="status">{estado}</p>}
      <Aviso tipo="erro">{erro}</Aviso>
    </div>
  );
}

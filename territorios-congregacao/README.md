# Territórios – Congregação Vila Exemplo

Sistema web para controle dos territórios. Os dirigentes de campo entram pelo celular (telefone + senha), veem os territórios e, nas próximas etapas, marcam no mapa as quadras trabalhadas.

## Etapas

| Etapa | O que entrega | Situação |
|---|---|---|
| 1 | Login por telefone, cadastro de irmãos, lista dos 96 territórios com as cores da legenda | **pronta** |
| 2 | Mapa com o contorno de cada território e geração automática das quadras | **pronta** (falta desenhar os 96 contornos) |
| 3 | Dirigente marca as quadras trabalhadas no dia | **pronta** |
| 4 | Histórico e relatórios | a fazer |

## Configurar (uma vez só)

Todos os comandos são digitados no PowerShell **dentro desta pasta** (`Desktop\Autos\territorios`).

1. **Chaves do Supabase.** Abra o arquivo `.env.local` no Bloco de Notas e preencha:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`: Supabase > Project Settings > API.
   - `SUPABASE_SERVICE_ROLE_KEY`: mesma tela, chave **service_role** (secreta: não mande para ninguém).
   - `SUPABASE_DB_URL`: botão **Connect** no topo do Supabase > **Session pooler** > copie a URI e troque `[YOUR-PASSWORD]` pela senha do banco criada junto com o projeto.

2. **Criar as tabelas:**
   ```
   npm run banco
   ```
3. **Importar os 96 territórios** (lidos de `dados\territorios.json`):
   ```
   npm run importar-territorios
   ```
4. **Cadastrar você como administrador:**
   ```
   npm run cadastrar -- "Seu Nome" "(66) 99999-1234" admin
   ```
   O comando mostra um **código de acesso** de 6 dígitos. No primeiro login o sistema pede para criar uma senha.

## Desenhar o mapa de um território (administrador)

1. Abra o território e toque em **Desenhar mapa**.
2. **Desenhar contorno**: toque em cada canto do território; para fechar, toque no primeiro ponto. Use a imagem antiga do território (botão "Ver mapa do território") como referência.
3. **Gerar quadras**: o sistema recorta o contorno pelas ruas do OpenStreetMap e numera as quadras.
4. Confira e corrija. Toque numa quadra para selecionar e use:
   - **Apagar**: tira quadras que não fazem parte (praça, área vazia);
   - **Juntar**: une duas ou mais quadras;
   - **Dividir quadra**: desenhe uma linha atravessando a quadra (ex.: rua de terra que o mapa não tem); toque duas vezes no último ponto para terminar;
   - **Ajustar pontos**: arraste os cantos do contorno.
5. **Salvar mapa**.

As ruas usadas ficam em `public/ruas.json` (baixadas com `npm run baixar-ruas`, direto da API oficial do OpenStreetMap). Em bairros novos, algumas ruas de verdade estão cadastradas no OpenStreetMap como "caminho" ou "estrada de terra" (aparecem como linhas pontilhadas no mapa): elas entram **se tiverem nome** (ex.: "Rua G"). Caminhos sem nome e ruas só projetadas não entram; use "Dividir quadra" nesses casos.

## Programação de campo (página inicial)

Os territórios são designados para os **dias de saída**, não para os dirigentes. A página inicial mostra a programação (dia, horário, local, dirigente e território), com as saídas de quem está usando **em destaque** e o cartão "Sua próxima saída".

- **De onde vem:** da planilha mensal dos dirigentes, importada no sistema de lembretes (`npm run importar-dirigentes`, na pasta "designações auto"). Depois de importar ou de trocar um dirigente (`npm run trocar`), o site é atualizado sozinho. Para atualizar à mão: `npm run sincronizar-programacao` (aqui na pasta territorios).
- **Grupo de territórios de cada dia:** segunda = Casa do Osvaldo; 1ª e 2ª quartas = Salão do Reino; 3ª quarta em diante = cartas (sem território); sábado e 1º domingo = Congregação; demais domingos = uma saída para cada chefe de grupo (Márcio Lopes, Tiago, Samuel), criadas automaticamente às 08:30. **Nos domingos dos grupos o próprio chefe decide** em quais territórios e quadras trabalhar: o sistema não escolhe território, e o chefe vê e marca todos os territórios do grupo dele (de 7 dias antes até 7 dias depois do domingo). Os grupos Samuel e Casa do Osvaldo são uma reserva só. As regras ficam em `src/lib/programacao.js`.
- **Escolha automática do território:** dentro do grupo do dia, primeiro o que está **em andamento** (faltam quadras), depois o **mais tempo sem ser concluído**, sem repetir território. A escolha é refeita conforme as quadras são marcadas; a saída de hoje não muda depois de escolhida. Se a observação da planilha citar um território ("território n63"), ele é usado.
- **Administrador:** botão **Alterar** em cada saída para escolher outro território ou **substituir o dirigente**. O que for alterado no site não é desfeito pela planilha.
- **Dirigente:** vê e marca o território das saídas dele, de 7 dias atrás em diante.

## Mapa geral

Aba **Mapa geral**: todos os territórios desenhados num só mapa, cada um com sua cor e número (ou colorido por grupo ou por situação). Os que faltam desenhar aparecem como círculo cinza tracejado no ponto do Google Maps, e o administrador tem a lista "Faltam desenhar" com atalho para o editor.

## Marcar quadras trabalhadas (dirigente)

1. Abra o território e toque em **Marcar quadras trabalhadas**.
2. Confira a **data do trabalho** (hoje, ou até 7 dias atrás se esqueceu de marcar).
3. Toque nas quadras trabalhadas: ficam **verdes**. Tocou errado? Toque de novo para desmarcar.
4. Toque em **Concluir marcação**.

Regras:
- Cada quadra conta uma vez por **ciclo**. Quando todas as quadras do território foram feitas, ele é **concluído sozinho**: a "última data" vira a data da última quadra, a conclusão vai para o histórico e começa um ciclo novo.
- O dirigente só desmarca o que **ele mesmo** marcou, **no mesmo dia**. O administrador pode desmarcar qualquer quadra.
- Ninguém marca em nome de outro irmão; o nome de quem marcou aparece ao tocar na quadra.
- Redesenhar o mapa de um território apaga as marcações do ciclo atual dele (o sistema avisa antes).

## Site na internet

Endereço: **https://territorios-exemplo.vercel.app**

Publicado na Vercel, na conta **pessoal** (área "Ricardo", plano Hobby gratuito).

Depois de qualquer mudança no site, publique de novo:
```
npm run publicar
```
Só as chaves **públicas** do Supabase vão para a Vercel. A chave secreta, a senha do banco e a pasta `dados\` ficam só no seu computador (veja `.vercelignore`).

## Uso no dia a dia

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o site no seu computador para testar (endereço aparece na tela, ex.: http://localhost:5173) |
| `npm run cadastrar -- "Nome" "(66) 9xxxx-xxxx"` | Cadastra um dirigente e mostra a mensagem com o código para mandar pelo WhatsApp |
| `npm run cadastrar -- "Nome" "(66) 9xxxx-xxxx" admin` | Cadastra um administrador |
| `npm run cadastrar -- --novo-codigo "(66) 9xxxx-xxxx"` | Gera um código novo para quem esqueceu a senha |
| `npm run enviar-acesso -- "Nome"` | Gera um código novo e **envia pelo seu WhatsApp** (pelo sistema de lembretes, que precisa estar ligado). Administradores recebem também a explicação de como desenhar os mapas |
| `npm run sincronizar-programacao` | Traz a programação dos dirigentes (do sistema de lembretes) e escolhe os territórios dos dias |
| `npm run cadastrar-lote -- dados/dirigentes.json` | Cadastra vários de uma vez; as mensagens com os códigos vão para `dados\acessos-para-enviar.txt` (quem já existe é pulado) |
| `npm run importar-territorios` | Atualiza os territórios a partir de `dados\territorios.json` |
| `npm run localizar-territorios` | Lê a posição de cada território a partir do link do Google Maps (`-- --todos` refaz todos) |
| `npm run baixar-ruas` | Baixa de novo as ruas da região do OpenStreetMap (só se as ruas mudarem muito) |
| `npm test` | Roda os testes automáticos |

## Aparência e acessibilidade

O visual foi pensado para celular e para irmãos de todas as idades:

- Letra grande (18px) que acompanha o tamanho de letra escolhido no celular; botões com pelo menos 48px de altura.
- Cores com bom contraste (padrão WCAG AA). A situação dos territórios aparece sempre com **texto e ícone**, não só pela cor.
- No mapa, quadra feita tem **borda contínua e número verde**; quadra que falta tem **borda tracejada**. Assim quem tem daltonismo também distingue.
- As quadras também podem ser marcadas por uma **lista** ("Ver as quadras em lista"), sem precisar acertar o dedo no mapa. Funciona com leitor de tela (TalkBack/VoiceOver) e teclado.
- Mensagens são anunciadas pelo leitor de tela; foco amarelo bem visível para quem usa teclado; animações desligadas para quem pediu "reduzir movimento" no celular.
- Ícone próprio: em "Adicionar à tela inicial" o sistema fica como um aplicativo.
- **No computador** (tela larga) o layout muda: informações e botões numa coluna à esquerda e o mapa grande à direita; na lista, filtros num painel lateral e territórios em colunas. Ao passar o mouse numa quadra aparece quando foi feita e por quem. A tecla **Esc** termina a marcação (ou cancela o desenho no editor).

Conferido com o verificador automático **axe** em todas as telas (nenhum problema encontrado).

## Quem vê o quê

- **Sem login:** nada.
- **Dirigente:** vê a programação inteira e vê/marca só os territórios das saídas dele.
- **Administrador:** vê e altera tudo.

As regras ficam no próprio banco (Row Level Security), então valem mesmo que alguém tente acessar o banco por fora do site.

## Privacidade

- Só os dados da aba **Territórios** da planilha da congregação entram no sistema. As outras abas (registros de publicadores, relatórios, contas) **não** devem ser importadas.
- `.env.local` (chaves) e `dados\` (dados extraídos) estão no `.gitignore` e não vão para a internet.

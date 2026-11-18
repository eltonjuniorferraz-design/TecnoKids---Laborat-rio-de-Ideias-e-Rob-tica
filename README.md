# TecnoKids — Laboratório de Ideias

Site educativo estático em português com três estações: missões de lógica, oficina maker e mural da turma. Inclui portal do professor, página para os alunos, compartilhamento por link/QR Code e importação de projetos para o mural de apresentação.

## Fluxo de sala de aula

1. O professor abre **Espaço do Professor**, nomeia a atividade e cria o link e o QR Code.
2. Os alunos escaneiam o código, escolhem um apelido de equipe e trabalham nas estações em seus próprios dispositivos.
3. Cada equipe salva sua invenção no mural local e baixa o arquivo JSON para enviar ao professor pelo canal escolhido pela escola.
4. O professor seleciona os arquivos recebidos em **Importar projetos dos alunos**. Os projetos são reunidos no mural daquele navegador para apresentação e impressão.

## Privacidade e limites

- Não há servidor, login, sincronização ao vivo, analytics ou formulário remoto. A galeria só aparece no mural do professor depois que os arquivos JSON são importados.
- O código da sala, o nome curto da atividade e as orientações ficam no fragmento (`#...`) do link do aluno. O jogo não os envia a um servidor, mas qualquer pessoa com o link pode abrir a atividade. Não inclua informações pessoais ou sensíveis no título/instruções.
- Os alunos devem usar apelidos de equipe. O arquivo JSON enviado ao professor inclui o apelido, o nome da invenção, sua descrição e escolhas maker. Revise os arquivos antes de compartilhá-los fora do canal da escola.
- A sala e o mural do professor ficam no `localStorage` do navegador do professor. Os projetos dos alunos também ficam no navegador deles até a exportação. Para apresentar em outro computador, importe os arquivos nesse computador.
- O QR é gerado no navegador. O jogo carrega Tailwind CSS e a biblioteca QR Code de CDNs externos; esses serviços recebem a solicitação normal do navegador para baixar o código da biblioteca, mas não recebem o link da sala nem os projetos.

## Publicar sem linha de comando

### GitHub Pages

1. No GitHub, crie ou use um repositório e envie `index.html` para a raiz. Este arquivo já está nomeado como página inicial.
2. Abra **Settings → Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, selecione `main` e a pasta `/ (root)`, e salve.
3. Aguarde a publicação indicada na mesma página. O endereço terá o formato `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. Abra o site publicado antes de criar o QR Code. O QR deve apontar para o endereço público do jogo.

O [guia oficial do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) descreve a publicação de arquivos estáticos.

### Netlify Drop

1. Acesse [Netlify Drop](https://app.netlify.com/drop).
2. Arraste uma pasta contendo `index.html` para a área indicada.
3. Use o link publicado para abrir o portal do professor e gerar o QR. Para atualizar, envie novamente a pasta.

Veja o guia oficial de [criação de deploys do Netlify](https://docs.netlify.com/deploy/create-deploys/).

## Arquivos

- `index.html` — site completo, pronto para publicação.
- `LEIA-ME.md` — este guia.

### Crédito da biblioteca QR

A geração do QR Code usa `qrcode-generator` 1.4.4, de Kazuhiko Arase, sob licença MIT. A cópia é servida pelo [cdnjs](https://cdnjs.com/libraries/qrcode-generator/1.4.4); veja a [licença MIT original](https://github.com/kazuhikoarase/qrcode-generator/blob/master/LICENSE). O QR é montado no navegador e o conteúdo do link não é enviado ao CDN.


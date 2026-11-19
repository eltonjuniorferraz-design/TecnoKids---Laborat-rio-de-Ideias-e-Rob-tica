# TecnoKids — Laboratório de Ideias

Jogo educativo em português com três estações: missões de lógica, oficina maker e mural de apresentação. O portal do professor usa conta com e-mail e senha; os alunos entram na sala por link ou QR Code, sem e-mail ou senha, informando apenas o primeiro nome.

## Como funciona a sala

1. O professor cria a conta, entra e prepara uma sala com atividade, link e QR Code.
2. Cada aluno entra no próprio aparelho e informa somente o primeiro nome.
3. A turma percorre as etapas em ordem: lógica → oficina maker → mural/apresentação. A próxima etapa fica bloqueada até concluir a anterior.
4. O professor acompanha os nomes e a etapa atual da turma. Os projetos aparecem no mural compartilhado da sala.

## Dados e privacidade

- O TecnoKids guarda no Supabase o e-mail de acesso do professor, o código e as orientações da sala, o primeiro nome dos alunos, o progresso e os projetos criados.
- Alunos usam sessões anônimas sem e-mail. A sessão fica vinculada ao navegador/aparelho; se os dados do navegador forem apagados ou o aluno trocar de aparelho, ele pode perder a sessão anterior.
- As regras do banco limitam o professor às próprias salas e os projetos aos participantes da mesma sala. O mural não é uma página pública aberta para busca.
- O QR e o link são convites: compartilhe somente com a turma e encerre a sala quando não for mais usada. Evite sobrenomes, contatos e detalhes pessoais no título, orientações e projetos.
- O professor deve revisar as regras da escola para dados de estudantes e apagar salas/projetos quando deixarem de ser necessários.
- A entrada anônima pode ser alvo de criação automatizada de sessões. Para uso público amplo, configure CAPTCHA no Supabase e acompanhe os limites de uso do plano.
- O jogo ainda usa CDNs públicos para Tailwind CSS, QR Code e cliente Supabase. Esses serviços recebem as solicitações normais de carregamento da biblioteca, não o conteúdo dos projetos.

## Publicação no GitHub Pages

Envie para a raiz do repositório todos estes arquivos:

- `index.html`
- `supabase-config.js`
- `supabase-online.js`

O arquivo `supabase-config.js` contém a URL do projeto e a chave **publishable**, própria para navegador. Nunca coloque uma chave `secret` ou `service_role` nesse arquivo.

O projeto Supabase **TecnoKids** foi criado em São Paulo. O esquema está em `supabase/schema.sql`; ele cria as tabelas e regras de acesso. Para aplicar em outro projeto, abra o SQL Editor no Supabase, cole o arquivo e execute.

No GitHub, em **Settings → Pages**, escolha **Deploy from a branch**, `main` e `/ (root)`. Depois de publicado, confira o site:

[Abrir TecnoKids](https://eltonjuniorferraz-design.github.io/TecnoKids---Laborat-rio-de-Ideias-e-Rob-tica/)

O GitHub Pages hospeda os arquivos estáticos; login e dados das salas ficam no Supabase.

## Configurações do Supabase

O projeto já tem o banco do TecnoKids, e-mail/senha e sessões anônimas habilitadas. O endereço do GitHub Pages está configurado como destino padrão e permitido para recuperação de senha. O e-mail padrão do Supabase pode ter limites de envio; antes do uso amplo, configure um provedor SMTP próprio e o CAPTCHA.

## Crédito da biblioteca QR

A geração do QR Code usa `qrcode-generator` 1.4.4, de Kazuhiko Arase, sob licença MIT. Veja a [licença MIT](https://github.com/kazuhikoarase/qrcode-generator/blob/master/LICENSE). O QR é gerado no navegador.


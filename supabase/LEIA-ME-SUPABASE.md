# Supabase do TecnoKids

O projeto **TecnoKids** está criado no plano gratuito, na região South America (São Paulo). As tabelas, regras de acesso e funções de entrada/progresso foram aplicadas. A autenticação de professor por e-mail e as sessões anônimas de alunos estão habilitadas. A URL do GitHub Pages está configurada como destino de recuperação.

## Componentes

- `schema.sql` — estrutura do banco, políticas Row Level Security e funções RPC para entrar numa sala e avançar etapa.
- `../supabase-config.js` — URL do projeto e chave pública `publishable`, usada pelo navegador.
- `../supabase-online.js` — cadastro/entrada/recuperação do professor, entrada anônima do aluno, salas, mural e acompanhamento.

Nunca substitua a chave pública por uma chave `secret` ou `service_role`. A chave pública só é segura quando as regras RLS permanecem habilitadas.

## Sala e etapas

Cada sala pertence a um professor e tem um código de sete caracteres. Os alunos iniciam sessão anônima no navegador, informam apenas o primeiro nome e entram pelo link/QR. Quatro das cinco missões de lógica liberam a oficina maker; a Fase 5 é opcional. Salvar o projeto libera o mural/apresentação. A função do banco aceita somente a etapa atual. O painel do professor atualiza a lista aproximadamente a cada sete segundos.

## Privacidade e operação

- O professor vê o primeiro nome, o progresso e os projetos da própria sala. Alunos não precisam de e-mail ou senha.
- Participantes da sala podem ler o mural compartilhado daquela sala. O QR/link funciona como convite; compartilhe apenas com a turma.
- A sessão anônima pertence ao aparelho/navegador. Se os dados do navegador forem apagados ou o aluno trocar de aparelho, ele pode perder a identidade da sessão.
- O projeto recomenda configurar CAPTCHA para reduzir tentativas automatizadas de criar sessões anônimas. Ainda não há CAPTCHA configurado; acompanhe as cotas de uso.
- Configure um provedor SMTP próprio antes de usar recuperação de senha com muitas contas de professor. O serviço de e-mail padrão pode ter limites.
- Encerre ou remova as salas quando os dados não forem mais necessários, conforme as regras de privacidade da escola.

## Reaplicar em outro projeto

1. Crie outro projeto Supabase e habilite autenticação por e-mail e acesso anônimo.
2. Execute `schema.sql` no SQL Editor.
3. Copie a URL do projeto e a chave **publishable** para `../supabase-config.js`.
4. Em Authentication → URL Configuration, defina o GitHub Pages do TecnoKids como Site URL e adicione esse caminho à lista de redirecionamentos permitidos.


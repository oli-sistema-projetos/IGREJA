# AD GASPAR — gestão do culto

Aplicação web para coordenar Recepção, Altar e Som durante a realização de um culto.

## Executar localmente

```bash
npm install
npm run dev
```

Sem uma conexão Supabase configurada, o app pode ser usado em **modo local**. Nesse modo, as informações ficam no `localStorage` daquele navegador e não são compartilhadas com outros aparelhos.

## Publicar no GitHub Pages

O workflow [deploy-pages.yml](./.github/workflows/deploy-pages.yml) compila e publica automaticamente o app no GitHub Pages a cada envio para `main`. No repositório, abra **Settings → Secrets and variables → Actions → New repository secret** e crie o secret `VITE_YOUTUBE_API_KEY` com uma chave nova e restrita à YouTube Data API v3 e ao domínio do site. Depois, em **Settings → Pages**, selecione **GitHub Actions** como origem da publicação. O endereço esperado é `https://oli-sistema-projetos.github.io/IGREJA/`.

O valor fornecido anteriormente deve ser revogado no Google Cloud e substituído por uma chave nova antes de cadastrá-la. Mesmo armazenada como secret para o processo de build, uma chave `VITE_*` será incluída no JavaScript entregue ao navegador; restrinja-a por HTTP referrer e API. Não a coloque no código-fonte ou em arquivos commitados.

## Sincronização com Supabase

1. Crie um projeto Supabase.
2. Execute [`supabase/migrations/20261012000000_initial_schema.sql`](./supabase/migrations/20261012000000_initial_schema.sql) no SQL Editor do projeto.
3. Execute também [`supabase/migrations/20261012195500_reception_music_fields.sql`](./supabase/migrations/20261012195500_reception_music_fields.sql) para adicionar os dados de cantor e acompanhamento aos recebimentos.
4. Abra **Configurações** no app e informe a Project URL e a chave pública (anon/publishable). Também é possível definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em um arquivo `.env.local` baseado em [`.env.example`](./.env.example).
5. Para buscar playback, crie uma chave da YouTube Data API v3 no Google Cloud, restrinja-a ao domínio do app e somente à API YouTube Data API v3, e informe `VITE_YOUTUBE_API_KEY` no `.env.local`. Reinicie o servidor após alterar esse arquivo. Como a busca acontece no navegador, essa chave será visível ao usuário do app; nunca use uma chave irrestrita.
6. Abra o app em cada aparelho e selecione o mesmo culto. O indicador no cabeçalho mostra o estado da conexão em tempo real.

O app nunca precisa da chave `service_role`; não a coloque no navegador nem em variáveis `VITE_*`.

## Atenção sobre acesso

Esta versão não implementa autenticação de usuários. A migração inicial permite operações públicas via chave anon para tornar o fluxo funcional sem login, portanto qualquer pessoa com a URL e a chave do projeto poderá ler e alterar esses dados. Use apenas em um ambiente confiável. Antes de publicar para uso aberto, adicione autenticação real e políticas RLS restritas a usuários autorizados.

## Funcionalidades

- **Recepção:** registrar visitantes pelo nome e cadastrar louvores com o nome de quem canta, informando se será com banda ou playback escolhido na busca do YouTube; também recebe testemunhos, pregações, avisos e outras participações.
- **Altar:** acompanhar o item atual, o próximo e marcar itens concluídos.
- **Som:** acompanhar a fila de louvores, abrir vídeos do YouTube e ativar tela cheia.
- **Configurações:** informar a conexão Supabase.

O módulo de organização pastoral foi removido. Nesta versão, a programação é exibida no Altar e no Som, mas não pode ser criada ou editada pelo app.

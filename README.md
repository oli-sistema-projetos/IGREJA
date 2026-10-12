# AD GASPAR — gestão do culto

Aplicação web para coordenar Recepção, Altar e Som durante a realização de um culto.

## Executar localmente

```bash
npm install
npm run dev
```

Sem uma conexão Supabase configurada, o app pode ser usado em **modo local**. Nesse modo, as informações ficam no `localStorage` daquele navegador e não são compartilhadas com outros aparelhos.

## Publicar no Vercel ou GitHub Pages

No Vercel, importe este repositório GitHub como um projeto Vite e configure estas variáveis em **Settings → Environment Variables** para os ambientes necessários:

- `VITE_SUPABASE_URL`: URL do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: chave pública/publishable do Supabase.

Faça um novo deploy após salvar as variáveis. Não coloque a chave da YouTube API em `VITE_*`.

Para publicar no GitHub Pages, o workflow [deploy-pages.yml](./.github/workflows/deploy-pages.yml) compila e publica automaticamente a cada envio para `main`. Antes do primeiro deploy, abra **Settings → Pages** e selecione **GitHub Actions** como origem.

Configure a chave da YouTube Data API como secret `YOUTUBE_API_KEY` no projeto Supabase; a Edge Function usa a chave no servidor, sem incluí-la no bundle público do app. Restrinja-a à YouTube Data API v3 e nunca a coloque no código-fonte ou em variáveis `VITE_*`. Para permitir a chamada a partir do Vercel, configure também o secret `APP_ALLOWED_ORIGINS` com a origem exata do site, por exemplo `https://seu-projeto.vercel.app` (sem barra no final). Se usar domínio personalizado, inclua-o também, separado por vírgula. A busca é pública no app atual, então monitore a cota da API; o CORS limita as origens de navegador autorizadas, mas não substitui autenticação.

## Sincronização com Supabase

1. Crie um projeto Supabase.
2. Execute [`supabase/migrations/20261012000000_initial_schema.sql`](./supabase/migrations/20261012000000_initial_schema.sql) no SQL Editor do projeto.
3. Execute também [`supabase/migrations/20261012195500_reception_music_fields.sql`](./supabase/migrations/20261012195500_reception_music_fields.sql) para adicionar os dados de cantor e acompanhamento aos recebimentos.
4. Abra **Configurações** no app e informe a Project URL e a chave pública (anon/publishable). Também é possível definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em um arquivo `.env.local` baseado em [`.env.example`](./.env.example).
5. Para buscar playback, crie uma chave da YouTube Data API v3 no Google Cloud, restrinja-a somente à API YouTube Data API v3 e configure `YOUTUBE_API_KEY` e `APP_ALLOWED_ORIGINS` em **Project Settings → Edge Functions → Secrets**. Publique a Edge Function `search-youtube` com `supabase functions deploy search-youtube --project-ref oxymbjbdmhxxaayebcpt`; a chave fica no servidor e não é incluída no JavaScript do app. A CLI exige login (`supabase login`) e o projeto deve estar vinculado com `supabase link --project-ref oxymbjbdmhxxaayebcpt`.
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

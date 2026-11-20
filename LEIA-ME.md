# BABA HUMILDES — primeira versão

Portal esportivo do baba de domingo da Palestina, Salvador - BA. Identidade visual inicial verde-escuro, preto e dourado; contribuição padrão R$ 25; dois times iniciais (Time A e Time B).

## O que já está nesta versão

- Portal público responsivo.
- Visão geral com atletas, times, gols e total recebido.
- Cadastro/edição de atletas e times (quando autenticado no Supabase).
- Cadastro de partidas, placar e status.
- Registro de gols e cartões.
- Artilharia e estatísticas de cartões.
- Controle financeiro com registro manual de Pix/dinheiro/transferência e status pago/pendente.
- Supabase Auth para login administrativo.
- SQL com tabelas, índices e políticas RLS.
- Modo demonstração local para experimentar a interface sem configurar serviços.

## Limitações importantes

1. O modo demonstração salva dados apenas no navegador atual (localStorage). Não é multiusuário e não deve receber dados reais.
2. Para produção, configure Supabase e RLS conforme abaixo. Não compartilhe a chave `service_role` no navegador.
3. O cadastro de administrador é controlado pela tabela `admins`. O primeiro administrador precisa ser adicionado manualmente pelo proprietário do projeto, usando o UUID do usuário criado no Supabase Auth.
4. O financeiro é privado para administradores. Esta primeira versão registra pagamentos manualmente; Pix automático/Mercado Pago ainda não está integrado. Não anuncie Pix automático até implementar backend e webhook verificado.
5. O formulário de eventos registra gols/cartões, mas o placar da partida é atualizado no formulário de edição da partida. Confira se os totais batem antes de finalizar.
6. Antes de publicar dados pessoais, obtenha autorização dos atletas. Não publique telefone, documentos ou dados financeiros individuais.

## Testar localmente sem custo

É necessário ter Node.js instalado. Na pasta do projeto execute:

```bash
npx serve .
```

Abra o endereço local mostrado no terminal. Também pode usar a extensão Live Server do VS Code. O modo demonstração permite testar a navegação, mas a área administrativa fica bloqueada até configurar Supabase.

## Configurar Supabase

1. Crie um projeto em https://supabase.com/.
2. Abra SQL Editor e execute todo o conteúdo de `sql/schema.sql`.
3. Em Authentication > Providers, mantenha Email habilitado. Desative cadastro público se somente o administrador deve ter acesso. Crie o usuário administrador em Authentication > Users.
4. Copie o UUID desse usuário e execute no SQL Editor:

```sql
insert into public.admins(user_id)
values ('UUID-DO-USUARIO-ADMINISTRADOR');
```

5. Em Project Settings > API, copie Project URL e a chave `anon`/`publishable`.
6. Cole os valores em `config.js`:

```js
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA_CHAVE_PUBLICA_ANON';
```

7. Publique novamente o site. O login administrativo estará disponível pelo botão “Área administrativa”.

**Segurança:** nunca coloque `service_role`/secret key em `config.js`, HTML, JavaScript do navegador, GitHub público ou qualquer arquivo entregue ao visitante. A proteção depende das políticas RLS do SQL. Faça um teste em janela anônima: o público deve conseguir ler atletas/times/partidas/gols/cartões, mas não alterar dados nem consultar pagamentos.

## Publicar gratuitamente no Cloudflare Pages

1. Crie uma conta em https://github.com/ e um repositório privado ou público para o projeto.
2. Envie os arquivos desta pasta para o repositório (`index.html`, `styles.css`, `app.js`, `config.js` e a pasta `sql`).
3. Crie uma conta em https://pages.cloudflare.com/ e escolha **Create a project > Connect to Git**.
4. Selecione o repositório.
5. Como é um site estático, deixe o comando de build vazio e use ` / ` como diretório de saída (ou `.` conforme a tela da Cloudflare).
6. Publique. A Cloudflare fornecerá um endereço `*.pages.dev`.
7. Depois de configurar o Supabase, confirme que a URL do site está autorizada em Authentication > URL Configuration, se necessário.

Alternativa: Vercel também pode hospedar o site estático, mas Cloudflare Pages é suficiente para esta versão.

## Estrutura

- `index.html` — estrutura do portal.
- `styles.css` — visual responsivo premium.
- `app.js` — navegação, telas e operações.
- `config.js` — URL e chave pública Supabase.
- `sql/schema.sql` — banco, relacionamentos, índices e RLS.

## Próximas melhorias recomendadas

- Upload de fotos dos atletas e escudos usando Supabase Storage.
- Edição e exclusão de partidas/eventos com validações adicionais.
- Atualização automática do placar a partir dos gols registrados.
- Relatórios financeiros e exportação CSV.
- Integração Pix real via Mercado Pago, com criação da cobrança no servidor e webhook validado por assinatura/API. Nunca confiar apenas no redirecionamento do navegador.
- Cadastro de períodos de contribuição e regras de inadimplência.
- Backup e política de privacidade.

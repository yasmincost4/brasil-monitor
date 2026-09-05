# Gerar o APK — só com o celular, sem subir pastas

A ideia: você sobe **um único arquivo** (o `.zip` do projeto) e cria **um único
arquivo** de configuração colando texto. O GitHub compila o APK na nuvem e publica
numa Release, e você baixa e instala pelo próprio celular. Nada de subir pasta por
pasta, nada de Netlify, nada de PC.

## Passo a passo (tudo no navegador do celular)

### 1. Criar o repositório
Em github.com, crie um repositório novo e vazio (pode ser privado). Ex.: `brasil-monitor`.

### 2. Criar o arquivo do workflow (colando)
No repositório: **Add file > Create new file**. No nome do arquivo, digite exatamente:
```
.github/workflows/build-apk.yml
```
(as barras criam as pastas sozinhas). No corpo, **cole todo o conteúdo** do arquivo
`build-apk.yml` que veio no projeto (está em `.github/workflows/build-apk.yml`, e o
texto está reproduzido no fim deste guia). Clique em **Commit**.

### 3. Subir o zip (1 arquivo só)
**Add file > Upload files** e selecione o **`brasil-monitor.zip`** do seu celular.
É upload de um arquivo único — o GitHub web aceita isso tranquilo no celular. Commit.

> Deixe o zip com esse nome e na raiz do repositório. O workflow procura `*.zip`.

### 4. Definir 2 segredos
**Settings > Secrets and variables > Actions > New repository secret**. Crie:
- `VITE_SUPABASE_URL` — a URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — a anon/public key

### 5. Rodar o build
Aba **Actions > "Build APK" > Run workflow**. Leva ~5–10 min. Dá pra acompanhar pelo
app do GitHub ou pelo navegador.

### 6. Baixar e instalar (no próprio celular)
Terminou? Vá em **Releases** (na página do repo) → toque em **`app-debug.apk`** →
confirme a instalação (o Android vai pedir pra permitir "instalar apps desconhecidos"
na primeira vez). Instalado.

### Atualizar depois
Quando eu te mandar um zip novo: **Add file > Upload files**, suba o zip novo (ele
substitui o antigo), e rode o workflow de novo. A Release `apk-latest` atualiza com o
APK novo.

---

## Observações
- O APK de **debug** já vem assinado com a chave de debug do Android — instala normal
  pra uso pessoal. (Para a Play Store seria um APK/AAB de *release* assinado — outro
  passo, só se quiser publicar um dia.)
- O **ícone e o splash** (o "radar" do app) são gerados no build a partir de
  `web/assets/icon.png` e `web/assets/splash.png`.
- **Offline**: o Capacitor embute os arquivos no APK, então o app abre sem internet;
  os dados aparecem quando houver conexão (com o último estado em cache).
- A **anon key** fica embutida no APK — tudo bem, é pública e o acesso é protegido
  pelo RLS. Os secrets de verdade (token da Transparência, chave do Anthropic) ficam
  só nas Edge Functions, nunca no app.
- Quer outro nome de pacote? Edite `appId` em `web/capacitor.config.json`.

---

## Conteúdo do `.github/workflows/build-apk.yml` (para colar no passo 2)

```yaml
name: Build APK
on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Descompactar o projeto
        run: unzip -o *.zip
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
      - uses: android-actions/setup-android@v3
      - name: Instalar dependencias
        working-directory: brasil-monitor/web
        run: npm install
      - name: Build do app web
        working-directory: brasil-monitor/web
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build
      - name: Plataforma Android + icone/splash
        working-directory: brasil-monitor/web
        run: |
          npx cap add android
          npx cap sync android
          npx capacitor-assets generate --android
      - name: Compilar APK
        working-directory: brasil-monitor/web/android
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug
      - name: Publicar APK na Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: apk-latest
          name: Brasil Monitor - APK
          files: brasil-monitor/web/android/app/build/outputs/apk/debug/app-debug.apk
```

# Dashboard M300

Aplicação web estática para análise operacional de equipes a partir de arquivos `.xlsx`, `.xls`, `.csv` e `.tsv`.
Todo o processamento roda no navegador, sem backend.

## Como rodar no computador

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

A pasta final fica em `dist/`.

## Publicar no GitHub Pages (recomendado agora)

### 1. Crie um repositório no GitHub

1. Entre em [https://github.com](https://github.com)
2. Clique em **New repository**
3. Nome sugerido: `scanner-m300`
4. Deixe **Public**
5. **Não** marque README, .gitignore ou license
6. Clique em **Create repository**

### 2. Envie o projeto do computador

Abra o PowerShell na pasta do app:

```powershell
cd "c:\Users\Lucass\Downloads\m300\m300"
git init
git add .
git commit -m "Publicar Scanner M300 no GitHub Pages"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/scanner-m300.git
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuário do GitHub.

### 3. Ative o GitHub Pages

1. Abra o repositório no GitHub
2. Vá em **Settings**
3. No menu lateral, clique em **Pages**
4. Em **Build and deployment** → **Source**, escolha **GitHub Actions**
5. Salve

### 4. Espere o deploy

1. Vá na aba **Actions**
2. Espere o workflow **Deploy GitHub Pages** ficar verde
3. Abra o site em:

```text
https://SEU_USUARIO.github.io/scanner-m300/
```

### Atualizar o site depois

Sempre que mudar o sistema:

```powershell
cd "c:\Users\Lucass\Downloads\m300\m300"
git add .
git commit -m "Atualizar Scanner M300"
git push
```

O GitHub Pages atualiza sozinho.

## Observações

- O Vite gera a pasta `dist` automaticamente no GitHub Actions.
- O arquivo `.github/workflows/deploy-github-pages.yml` já está preparado.
- O `base` do Vite é ajustado automaticamente para `/nome-do-repositorio/`.

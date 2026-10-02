# Publicar o Reroll na Hostinger

1. Rode `npm run build:web`.
2. No Gerenciador de Arquivos da Hostinger, abra a pasta do domínio (`public_html` para o domínio principal).
3. Envie **o conteúdo** de `out/web/` para essa pasta. Não envie a pasta `out/web` inteira, porque o arquivo `index.html` precisa ficar diretamente dentro de `public_html`.
4. Acesse o domínio usando `https://`. HTTPS é necessário para a cópia e para o navegador manter os dados de forma confiável.

Não há banco de dados ou servidor para configurar. Cada pessoa guarda seus próprios dados no navegador e no aparelho que estiver usando:

- personagens, fichas, anotações e presets: IndexedDB;
- preferências de aparência: localStorage;
- persistência: o site pede ao navegador para proteger esses dados contra limpezas automáticas por falta de espaço.

A versão publicada limita a criação a três personagens por navegador. O acabamento de resina com flores continua no app desktop, mas não aparece na versão web.

Os dados não seguem para outro computador e podem ser apagados se a pessoa limpar os dados do site no navegador. O botão de exportar pacote continua sendo o backup para trocar de aparelho ou navegador.

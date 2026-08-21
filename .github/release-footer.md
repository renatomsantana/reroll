
---

## Conferir o download

Antes de instalar, confira que o arquivo é o mesmo que saiu daqui. No PowerShell:

```powershell
Get-FileHash .\Reroll-Setup-*.exe -Algorithm SHA256
```

O resultado tem que bater com a linha correspondente em `SHA256SUMS.txt`, anexado abaixo.

O Reroll não tem certificado de assinatura digital, então o Windows mostra um aviso do SmartScreen
na primeira execução ("Mais informações" → "Executar assim mesmo"). O resumo acima e o código aberto
neste repositório são o que existe no lugar do certificado.

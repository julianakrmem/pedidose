# PediDose 💧

Calculadora de doses pediátricas por peso. Você informa peso, idade e apresentação, e ela devolve o volume pronto para prescrever (mL, gotas, comprimidos ou jatos), com travas de segurança e a referência usada no cálculo.

> [!WARNING]
> **Ferramenta educacional e de apoio ao estudo.** Ela não substitui o julgamento clínico. Antes de prescrever, confira sempre a bula vigente (ANVISA) e o protocolo da sua instituição. Concentrações e gotas/mL variam entre fabricantes.

## Funcionalidades

- **10 fármacos comuns no PS e na enfermaria pediátrica:** dipirona, paracetamol, ibuprofeno, amoxicilina, amoxicilina + clavulanato, azitromicina, prednisolona, dexametasona, ondansetrona e salbutamol.
- **Resultado prático:** dose em mg por tomada e por dia, mais o volume real a administrar, arredondado para algo que dá para medir.
- **Travas de segurança automáticas:**
  - teto por tomada, teto diário absoluto e teto diário em mg/kg, sempre com aviso quando a dose é limitada;
  - contraindicação por idade ou peso, que bloqueia o cálculo (ex.: ibuprofeno abaixo de 6 meses, dipirona abaixo de 3 meses ou 5 kg);
  - apresentação inadequada (ex.: comprimido para lactente, dose pequena demais para um comprimido inteiro);
  - aviso quando o arredondamento altera a dose em mais de 10% ou quando o volume fica impraticável.
- **Rastreabilidade:** as referências de cada fármaco aparecem logo abaixo do resultado.
- **Rascunho de prescrição** que se copia com um toque.
- **PWA:** pode ser instalado no celular e funciona offline.

## Arquitetura

```
src/
├── data/drugs.ts              ← base de fármacos (só dados: doses, tetos, apresentações, referências)
├── domain/
│   ├── types.ts               ← tipos do domínio
│   ├── calculate.ts           ← cálculo puro: sem React e sem efeitos colaterais
│   ├── prescription.ts        ← texto de prescrição
│   └── calculate.test.ts      ← testes unitários (Vitest)
├── App.tsx                    ← interface (React + Tailwind)
└── main.tsx                   ← entrada e registro do service worker
```

**Princípio central: a regra clínica nunca se mistura com a tela.**

- Para mudar uma dose, edite `src/data/drugs.ts`. Não é preciso tocar no código de cálculo nem na UI.
- `calculate()` é uma função pura: recebe `{ peso, idade, fármaco, esquema, apresentação }` e devolve dose, volume, posologia e alertas. Por isso pode ser reaproveitada num app React Native, numa API ou numa CLI.

### Fluxo do cálculo

1. Valida peso (0,5–150 kg) e idade (0–18 anos).
2. Aplica as travas de idade e peso do fármaco e da apresentação.
3. Calcula a dose por tomada (`mg/kg/dose` ou `mg/kg/dia ÷ nº de tomadas`).
4. Aplica a dose mínima, o teto por tomada e os tetos diários.
5. Converte para a apresentação, arredondando sem ultrapassar o teto.
6. Gera os alertas, ordenados por gravidade.

## Testes

```bash
npm test
```

Os testes cobrem:

- cenários de referência, como 4 kg (bloqueio por peso), 10 kg, 45 kg (teto da dose máxima) e 70 kg;
- conversão entre apresentações (gotas, suspensão, comprimido, jatos);
- bloqueios por idade e peso, entrada inválida e mg/kg fora da faixa;
- integridade da base (faixas coerentes, campos obrigatórios por tipo de apresentação);
- **um invariante de segurança:** para todas as combinações de fármaco × esquema × apresentação × 14 pesos × limites da faixa de mg/kg, nenhum resultado ultrapassa o teto por tomada ou o teto diário.

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento
npm test         # testes
npm run build    # build de produção em dist/
```

## Deploy (GitHub Pages)

O workflow `.github/workflows/ci.yml` roda os testes e o build a cada push e publica na `main` automaticamente.
Para ativar, vá em **Settings → Pages → Source: GitHub Actions**.

## Como adicionar um fármaco

1. Acrescente um objeto em `DRUGS` (`src/data/drugs.ts`) com esquemas, apresentações, travas e referências.
2. Escreva pelo menos dois testes: um caso típico e um caso que bata no teto.
3. Rode `npm test`. O teste de integridade e o invariante de segurança passam a cobrir o novo fármaco automaticamente.

## Roadmap

- [ ] Ampliar a base: cefalexina, loratadina, hidroxizina, sulfato ferroso, entre outros
- [ ] Doses neonatais com ajuste por idade gestacional e pós-natal
- [ ] Ajuste por função renal
- [ ] Estimativa de peso pela idade (fórmulas APLS) quando não houver balança
- [ ] Modo emergência: drogas da PCR e da intubação por peso

## Referências

Cada fármaco lista suas fontes em `src/data/drugs.ts`. As principais são o Nelson Textbook of Pediatrics, as bulas ANVISA, a Sociedade Brasileira de Pediatria, a AAP (Otite Média Aguda, 2013), o GINA 2024 e o Cochrane (corticoide no crupe).

## Licença

MIT. Veja [LICENSE](LICENSE).

---

Desenvolvido por **Juliana Carmem Costa**, estudante de Medicina.

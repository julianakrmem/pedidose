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
  - **erro de digitação no peso:** acima de 150 kg o cálculo é bloqueado (com a sugestão "180 → 18 kg"); com a idade informada, compara o peso com a mediana para a idade e pergunta "você quis dizer 14 kg?";
  - **período neonatal (< 28 dias):** cálculo bloqueado, porque as posologias são outras; peso < 3 kg sem idade gera alerta;
  - **arredondamento prático:** gotas sempre inteiras; volume arredondado conforme a seringa indicada (1 mL → passo de 0,05 mL; 3 mL → 0,1 mL; 5–10 mL → 0,2 mL); meio comprimido apenas quando sulcado;
  - aviso quando o arredondamento altera a dose em mais de 10% ou quando o volume fica impraticável.
- **Rastreabilidade:** as referências de cada fármaco aparecem logo abaixo do resultado.
- **Prescrição formatada** no estilo de receita (via de uso, fármaco e concentração, quantidade em mL/gotas/comprimidos, mg, intervalo, condição de uso, diluição e duração), copiada com um toque.
- **Indicação do dispositivo de medida:** seringa de 1, 3, 5, 10 ou 20 mL, conta-gotas ou espaçador.
- **Temas claro, escuro e alto contraste** (este com amarelo sobre preto, para pouca luz ou baixa visão); a escolha fica salva no navegador.
- **PWA:** pode ser instalado no celular e funciona offline.

## Arquitetura

```
src/
├── data/drugs.ts              ← base de fármacos (só dados: doses, tetos, apresentações, referências)
├── domain/
│   ├── types.ts               ← tipos do domínio
│   ├── calculate.ts           ← cálculo puro: sem React e sem efeitos colaterais
│   ├── prescription.ts        ← prescrição formatada
│   ├── growth.ts              ← peso mediano por idade (só para detectar erro de digitação)
│   └── *.test.ts              ← testes unitários (Vitest)
├── App.tsx                    ← interface (React + Tailwind)
├── theme.ts                   ← temas claro / escuro / alto contraste
└── main.tsx                   ← entrada e registro do service worker
```

**Princípio central: a regra clínica nunca se mistura com a tela.**

- Para mudar uma dose, edite `src/data/drugs.ts`. Não é preciso tocar no código de cálculo nem na UI.
- `calculate()` é uma função pura: recebe `{ peso, idade, fármaco, esquema, apresentação }` e devolve dose, volume, posologia e alertas. Por isso pode ser reaproveitada num app React Native, numa API ou numa CLI.

### Fluxo do cálculo

1. Valida peso (0,5–150 kg) e idade (0–18 anos).
2. Confere se o peso é plausível para a idade e bloqueia o período neonatal.
3. Aplica as travas de idade e peso do fármaco e da apresentação.
4. Calcula a dose por tomada (`mg/kg/dose` ou `mg/kg/dia ÷ nº de tomadas`).
5. Aplica a dose mínima, o teto por tomada e os tetos diários.
6. Converte para a apresentação, arredondando conforme a seringa e sem ultrapassar o teto.
7. Gera os alertas, ordenados por gravidade.

## Testes

```bash
npm test
```

Os testes cobrem:

- cenários de referência, como 4 kg (bloqueio por peso), 10 kg, 45 kg (teto da dose máxima) e 70 kg;
- conversão entre apresentações (gotas, suspensão, comprimido, jatos);
- bloqueios por idade e peso, neonatos, peso digitado errado, entrada inválida e mg/kg fora da faixa;
- escolha da seringa, passos de arredondamento e texto da prescrição formatada;
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

Desenvolvido por **Juliana Carmem Costa**, estudante de Medicina, com auxílio de IA (Claude).

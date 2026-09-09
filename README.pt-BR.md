🇺🇸 [Read in English](README.md)

# API Health Checker

Uma API pequena que verifica se endpoints HTTP(S) estão no ar, construída como um
projeto de portfólio de backend focado — não uma plataforma completa de monitoramento.

## O que ela faz

Você fornece uma URL, ela faz uma requisição GET para essa URL e retorna:

- status `UP` / `DOWN`
- HTTP status code
- tempo de resposta em milissegundos
- um motivo de erro específico quando o próprio check falha (`TIMEOUT`,
  `CONNECTION_ERROR`, `BLOCKED_ADDRESS`)

Também é possível verificar várias URLs de forma concorrente em uma única requisição.

## Stack

- Node.js + TypeScript (ESM, strict mode)
- [Fastify](https://fastify.dev/) — framework HTTP, validação de request via JSON Schema
- `fetch` nativo (undici, já embutido no Node) — sem biblioteca de HTTP client
- [Vitest](https://vitest.dev/) — testes unitários e de rota, sem chamadas de rede reais

Deliberadamente **não** utilizados: banco de dados, fila, frontend ou orquestrador de
containers. O escopo é uma única API stateless.

## Executando localmente

Requer Node.js 20+.

```bash
npm install
npm run dev     # tsx watch, reinicia a cada mudança de arquivo
```

O servidor escuta em `http://localhost:3000` (pode ser sobrescrito com a variável de
ambiente `PORT`).

```bash
npm run build   # compila para dist/
npm start       # executa o build compilado
```

## Executando com Docker

```bash
docker build -t api-health-checker .
docker run -p 3000:3000 api-health-checker
```

## Executando os testes

```bash
npm test
```

Os testes mockam o `fetch` e o cliente HTTP interno — nenhum acesso real à rede é
necessário ou realizado durante a execução dos testes.

## API

### `GET /health`

Liveness check da própria API.

```json
{ "status": "ok" }
```

### `POST /checks`

Verifica uma única URL.

```json
// request
{ "url": "https://example.com", "timeout": 5000 }
```

```json
// response — target saudável
{ "status": "UP", "statusCode": 200, "responseTimeMs": 143 }
```

```json
// response — target retornou um status de erro
{ "status": "DOWN", "statusCode": 500, "responseTimeMs": 89 }
```

```json
// response — target não respondeu a tempo
{ "status": "DOWN", "error": "TIMEOUT", "responseTimeMs": 5000 }
```

`timeout` é opcional (padrão `5000`ms, faixa permitida `100`–`30000`ms). Uma URL
malformada ou um protocolo que não seja `http(s)` é rejeitado com `400 VALIDATION_ERROR`
antes de qualquer requisição ser feita.

### `POST /checks/batch`

Verifica até 20 URLs concorrentemente (`Promise.all`, uma URL falhando nunca bloqueia as
outras).

```json
// request
{ "urls": ["https://example.com", "https://example.org", "not-a-url"] }
```

```json
// response
{
  "results": [
    { "url": "https://example.com", "status": "UP", "statusCode": 200, "responseTimeMs": 143 },
    { "url": "https://example.org", "status": "UP", "statusCode": 200, "responseTimeMs": 98 },
    { "url": "not-a-url", "status": "DOWN", "error": "INVALID_URL", "responseTimeMs": 0 }
  ]
}
```

## Decisões arquiteturais

- **`fetch` nativo em vez de uma biblioteca HTTP.** O `fetch` embutido do Node (undici)
  já cobre tudo que este projeto precisa: timeouts (`AbortSignal.timeout`), status codes
  e exposição de erros de conexão. Adicionar `axios` ou similar não traria benefício.
- **Separação `client → service`.** `clients/httpClient.ts` só sabe fazer uma requisição
  e medir sua duração; `services/healthCheckService.ts` é quem decide a regra de negócio
  UP/DOWN. Isso mantém os testes de "a chamada de rede funcionou" independentes dos
  testes de "404 é considerado saudável?".
- **Validação em duas camadas.** A validação estrutural (tipos, tamanho de string,
  limites de timeout) é expressa como um JSON Schema do Fastify/AJV — sem biblioteca de
  validação extra. Já a validação semântica (a URL é de fato parseável? o protocolo é
  `http`/`https`?) usa a classe nativa `URL` diretamente, já que JSON Schema não expressa
  bem esse tipo de checagem. Erros das duas camadas são normalizados no mesmo formato
  `400 { error, message }` por um único `setErrorHandler`.
  Veja [src/schemas/checkSchema.ts](src/schemas/checkSchema.ts) e
  [src/schemas/url.ts](src/schemas/url.ts).
- **Timeout e erro de conexão são um resultado de negócio, não um erro da API.** Um
  target que dá timeout ou recusa a conexão ainda retorna `200` *desta* API, com
  `status: "DOWN"` — a requisição ao health checker funcionou; foi o target que falhou.
  Só uma entrada inválida para o próprio health checker (URL ruim, protocolo ruim,
  timeout fora do range) retorna `4xx`.
- **Concorrência do batch sem pool de workers.** `POST /checks/batch` dispara todos os
  checks em um único `Promise.all`, com cada item envolvido em seu próprio `try/catch`
  para que uma falha de validação ou de rede em uma URL se torne um resultado normal em
  vez de rejeitar o lote inteiro. O tamanho do batch é limitado (`maxItems: 20`) em vez
  de adicionar um limitador de concorrência — o array já é pequeno e limitado por
  design, então um limitador adicionaria complexidade sem um problema real a resolver.
- **O bloqueio de SSRF reaproveita a infraestrutura de falha já existente.** Um endereço
  bloqueado é reportado como `{ "status": "DOWN", "error": "BLOCKED_ADDRESS" }` — um
  `200`, não um `400` — porque é implementado como mais um modo de falha do `fetchUrl`
  (junto de `TIMEOUT` e `CONNECTION_ERROR`), então ele flui pelo `checkHealth` e pelo
  endpoint de batch sem nenhuma mudança nas camadas de rota ou validação.

## Limitações

- **SSRF é apenas parcialmente mitigado.** A API aceita uma URL arbitrária fornecida
  pelo usuário por design, o que é um vetor clássico de SSRF: um target poderia apontar
  para `http://localhost`, `169.254.169.254` (endpoints de metadata de cloud) ou outro
  serviço interno. Antes de conectar, o hostname do target é resolvido uma vez e
  rejeitado se cair em uma faixa privada/loopback/link-local conhecida (veja
  `assertPublicHost` em [src/clients/httpClient.ts](src/clients/httpClient.ts)) — mas
  **não há proteção contra DNS rebinding** (o endereço pode resolver de forma diferente
  entre essa checagem e a chamada real de `fetch` momentos depois). Fechar essa lacuna
  direito exigiria reutilizar o IP já resolvido na própria conexão, o que o `fetch`
  nativo não permite sem um `dns.lookup` customizado — fora do escopo aqui.
- Sem persistência: os resultados dos checks nunca são armazenados, não há histórico.
- Sem autenticação/rate limiting — qualquer um que alcance a API pode disparar checks.
- Sem validação do destino de redirects: o `fetch` segue redirects por padrão, então uma
  URL validada ainda poderia redirecionar para um protocolo não permitido ou um endereço
  interno depois que a checagem inicial de SSRF passa.

## Possíveis melhorias futuras

- Fechar a lacuna de DNS rebinding acima (fixar a conexão no IP já resolvido).
- Persistir resultados dos checks (seria a primeira justificativa real para adicionar um
  banco de dados).
- Rate limiting por cliente.

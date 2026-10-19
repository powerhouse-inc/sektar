# Sektar assistant

`ph run assistant` starts a headless agent (Mastra, OpenAI-compatible chat API on
port 4910) whose reactor is the project's switchboard — start that first
(`ph run switchboard`, or any compound that members it).

The model is routed through OpenRouter. Put the key in the environment before
starting:

```sh
OPENROUTER_API_KEY=sk-or-… ph run assistant
```

Without the key the host answers as the demo agent. Prompts live in `agents/`;
`ph run assistant build` compiles them to `dist/skills`.

Smoke test:

```sh
curl -s http://127.0.0.1:4910/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"sektar","messages":[{"role":"user","content":"Which invoices are overdue?"}]}'
```

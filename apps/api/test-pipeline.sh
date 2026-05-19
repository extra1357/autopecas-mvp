#!/bin/bash

BASE="http://localhost:3001/api"
FONE="5511988887777"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 1 — Cliente pergunta peça"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Oi, preciso de um amortecedor dianteiro para HB20 2021\"}" \
  | python3 -m json.tool

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 2 — Cliente pergunta sobre entrega"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 1
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Vocês fazem entrega? Quanto fica?\"}" \
  | python3 -m json.tool

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 3 — Cliente quer falar com vendedor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 1
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Quero falar com um vendedor\"}" \
  | python3 -m json.tool

echo ""
echo "✅ Testes concluídos!"

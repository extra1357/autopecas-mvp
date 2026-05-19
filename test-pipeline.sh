#!/bin/bash

BASE="http://localhost:3001/api"
FONE="5511977776666"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 1 — Cliente pergunta peca"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Oi, preciso de um amortecedor dianteiro para HB20 2021\"}" \
  | python3 -m json.tool

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 2 — Cliente escolhe pagamento PIX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 1
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Quero pagar no PIX\"}" \
  | python3 -m json.tool

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 3 — Cliente pergunta entrega"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 1
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Voces fazem entrega?\"}" \
  | python3 -m json.tool

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE 4 — Cliente quer vendedor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 1
curl -s -X POST "$BASE/test/mensagem" \
  -H "Content-Type: application/json" \
  -d "{\"telefone\":\"$FONE\",\"mensagem\":\"Quero falar com um vendedor\"}" \
  | python3 -m json.tool

echo ""
echo "✅ Testes concluidos!"

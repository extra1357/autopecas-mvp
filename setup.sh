#!/bin/bash

echo "🚀 Criando estrutura do projeto autopeças MVP..."

# Root
mkdir -p autopecas-mvp
cd autopeças-mvp

# Apps
mkdir -p apps/api/src/{modules/{conversations,workflows,ai,whatsapp,inventory,orders,handoff},core,common,infra,prisma}
mkdir -p apps/web/src/{app,components,lib}
mkdir -p apps/worker/src

# Packages
mkdir -p packages/core/src
mkdir -p packages/workflows/src
mkdir -p packages/ai/src
mkdir -p packages/integrations/src

# Config files placeholder
touch apps/api/.env.example
touch apps/web/.env.example
touch apps/worker/.env.example

echo "✅ Estrutura criada com sucesso!"
find . -type d | sort

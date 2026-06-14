import pathlib

file = r"C:\autopecas\autopecas-mvp-main\apps\api\src\modules\rag\rag.service.ts"
content = pathlib.Path(file).read_text(encoding="utf-8")

old = """    await this.prisma.$executeRaw`
      INSERT INTO base_conhecimento (id, titulo, conteudo, embedding, "criadoEm", "atualizadoEm")
      VALUES (
        gen_random_uuid(),
        ${perguntaDoc.pergunta},
        ${texto},
        ${embeddingStr}::vector,
        NOW(),
        NOW()
      )
    `;"""

new = """    await this.prisma.$executeRaw`
      INSERT INTO base_conhecimento (id, titulo, conteudo, tags, relevancia, embedding, "criadoEm")
      VALUES (
        gen_random_uuid(),
        ${perguntaDoc.pergunta},
        ${texto},
        ARRAY[]::text[],
        1,
        ${embeddingStr}::vector,
        NOW()
      )
    `;"""

if old in content:
    content = content.replace(old, new)
    pathlib.Path(file).write_text(content, encoding="utf-8")
    print("SUCESSO! marcarResolvida corrigido.")
else:
    print("ERRO: trecho nao encontrado, vou mostrar o que existe")
    idx = content.find("INSERT INTO base_conhecimento")
    # acha a segunda ocorrencia (a primeira é a do RAG buscarConhecimento... na verdade so tem uma)
    print(repr(content[idx:idx+400]))

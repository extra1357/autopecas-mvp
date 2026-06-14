import pathlib

file = r"C:\autopecas\autopecas-mvp-main\apps\api\src\modules\rag\rag.service.ts"
content = pathlib.Path(file).read_text(encoding="utf-8")

old = "const embedding = await this.gerarEmbedding(texto);"
new = "const embedding = await this.gerarEmbedding(perguntaDoc.pergunta);"

count = content.count(old)
print("Ocorrencias encontradas:", count)

if count > 0:
    content = content.replace(old, new)
    pathlib.Path(file).write_text(content, encoding="utf-8")
    print("SUCESSO!")
else:
    print("ERRO: nao encontrado")

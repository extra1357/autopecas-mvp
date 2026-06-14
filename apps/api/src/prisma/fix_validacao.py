import pathlib

file = r"C:\autopecas\autopecas-mvp-main\apps\api\src\modules\rag\rag.service.ts"
content = pathlib.Path(file).read_text(encoding="utf-8")

old = """    // Valida que a resposta e sobre politica, nao sobre peca especifica
    const tipo = this.classificarPergunta(perguntaDoc.pergunta);
    if (tipo === "peca") {
      throw new Error("Perguntas sobre pecas nao devem ser respondidas manualmente. Cadastre a peca no catalogo.");
    }

    const texto = `Pergunta: ${perguntaDoc.pergunta}\\nResposta: ${resposta}`;"""

new = """    const texto = `Pergunta: ${perguntaDoc.pergunta}\\nResposta: ${resposta}`;"""

if old in content:
    content = content.replace(old, new)
    pathlib.Path(file).write_text(content, encoding="utf-8")
    print("SUCESSO! Validacao removida.")
else:
    print("ERRO: trecho nao encontrado")
    idx = content.find("Valida que a resposta")
    print(repr(content[idx-50:idx+400]))

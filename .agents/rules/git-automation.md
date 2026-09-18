# Git Automation Rules

- Sempre que o usuário solicitar para subir as coisas para o GitHub, commitar ou salvar o progresso:
  1. Executar `git status` para verificar as alterações.
  2. Adicionar os arquivos relevantes com `git add .`.
  3. Criar uma mensagem de commit semântica e objetiva (`git commit -m "tipo: mensagem"`).
  4. Enviar diretamente para a branch `main` com `git push origin main`.
- Se o usuário pedir para criar uma funcionalidade ou refatorar e pedir para subir junto, execute o push ao final do trabalho sem necessidade de confirmação manual.

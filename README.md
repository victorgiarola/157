# ⚔️ Huntera Multi-Client (4 Contas)

Painel desktop de alto desempenho construído com **Electron** para gerenciar **4 contas simultâneas** do jogo **Huntera (Tibia Idle)** (`huntera.com.br`).

---

## 🌟 Funcionalidades

* **Sessões 100% Isoladas**: Cada conta roda em uma partição independente (`persist:huntera_account_1` a `4`). Logue em até 4 contas diferentes sem que uma derrube a outra.
* **Anti-Inatividade / Zero Throttling**: O aplicativo impede o Chromium de pausar ou desacelerar os timers de JavaScript em segundo plano, garantindo que o seu treino e caça permaneçam 100% ativos.
* **Layout Grade 2x2 ou Modo Foco**:
  * Visualize as 4 contas simultaneamente em uma grade balanceada.
  * Alterne para foco em tela cheia na conta desejada com um clique ou atalho de teclado.
* **Personalização dos Personagens**: Renomeie cada slot (ex: *Knight*, *Paladin*, *Sorcerer*, *Druid* ou o nome do seu char). Os nomes são salvos automaticamente no computador.
* **Controles Rápidos por Slot**:
  * **Zoom individual** (`A+` / `A-`) com percentual salvo na máquina.
  * **Silenciar individualmente** (`🔊` / `🔇`) para evitar ruído excessivo de efeitos sonoros.
  * **Recarregar individual** ou **Recarregar Todas**.

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `Ctrl + 0` ou `Esc` | Retorna para a visualização em **Grade 2x2** |
| `Ctrl + 1` | Foca na **Conta #1** em tela cheia |
| `Ctrl + 2` | Foca na **Conta #2** em tela cheia |
| `Ctrl + 3` | Foca na **Conta #3** em tela cheia |
| `Ctrl + 4` | Foca na **Conta #4** em tela cheia |
| `Ctrl + Shift + R` | Recarrega todas as 4 contas de uma vez |

---

## 🚀 Como Iniciar

Você pode iniciar de duas formas:

1. **Pelo arquivo executável rápido:**
   * Dê dois cliques no arquivo `iniciar.bat`.

2. **Pelo Terminal:**
   ```bash
   npm start
   ```

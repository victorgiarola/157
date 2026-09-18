// ==========================================================
// HUNTERA MULTI-CLIENT - RENDERER LOGIC
// ==========================================================

const SLOTS_COUNT = 4;
let currentMode = 'grid'; // 'grid' | 'focus-1' | 'focus-2' | 'focus-3' | 'focus-4'
let isAllMuted = false;

// Estado de zoom e mute por slot
const slotState = {
  1: { zoom: 0.9, muted: false },
  2: { zoom: 0.9, muted: false },
  3: { zoom: 0.9, muted: false },
  4: { zoom: 0.9, muted: false },
};

document.addEventListener('DOMContentLoaded', () => {
  initSlots();
  initLayoutNav();
  initGlobalActions();
  initKeyboardShortcuts();
});

// Inicialização dos 4 Slots
function initSlots() {
  for (let i = 1; i <= SLOTS_COUNT; i++) {
    const slotIndex = i;
    const webview = document.getElementById(`webview-${slotIndex}`);
    const loader = document.getElementById(`loader-${slotIndex}`);
    const statusPill = document.getElementById(`status-${slotIndex}`);
    const nameInput = document.getElementById(`name-input-${slotIndex}`);
    const navLabel = document.getElementById(`nav-label-${slotIndex}`);
    const zoomLabel = document.getElementById(`zoom-label-${slotIndex}`);
    const muteBtn = document.getElementById(`mute-btn-${slotIndex}`);

    // Restaurar nomes salvos do localStorage
    const savedName = localStorage.getItem(`huntera_slot_name_${slotIndex}`);
    if (savedName) {
      nameInput.value = savedName;
      if (navLabel) navLabel.textContent = savedName;
    }

    // Salvar alteração de nome
    nameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim() || `Conta ${slotIndex}`;
      localStorage.setItem(`huntera_slot_name_${slotIndex}`, val);
      if (navLabel) navLabel.textContent = val;
    });

    // Restaurar zoom salvo
    const savedZoom = localStorage.getItem(`huntera_slot_zoom_${slotIndex}`);
    if (savedZoom) {
      slotState[slotIndex].zoom = parseFloat(savedZoom);
      if (zoomLabel) zoomLabel.textContent = `${Math.round(slotState[slotIndex].zoom * 100)}%`;
    }

    // Eventos do Webview
    if (webview) {
      webview.addEventListener('did-start-loading', () => {
        statusPill.innerHTML = '<span class="dot"></span> Carregando...';
        statusPill.className = 'status-pill loading';
      });

      webview.addEventListener('did-stop-loading', () => {
        statusPill.innerHTML = '<span class="dot"></span> Online';
        statusPill.className = 'status-pill';
        loader.classList.add('hidden');

        // Aplicar zoom configurado assim que o DOM estiver pronto
        try {
          webview.setZoomFactor(slotState[slotIndex].zoom);
        } catch (err) {
          console.warn('Erro ao definir zoom inicial:', err);
        }
      });

      webview.addEventListener('did-fail-load', (e) => {
        if (e.errorCode !== -3) { // Ignora aborts normais
          statusPill.innerHTML = '<span class="dot" style="background:#ef4444"></span> Falha na rede';
          statusPill.className = 'status-pill';
        }
      });
    }

    // Botões de Zoom
    const btnZoomIn = document.querySelector(`.btn-zoom-in[data-slot="${slotIndex}"]`);
    const btnZoomOut = document.querySelector(`.btn-zoom-out[data-slot="${slotIndex}"]`);

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        if (slotState[slotIndex].zoom < 1.6) {
          slotState[slotIndex].zoom = +(slotState[slotIndex].zoom + 0.1).toFixed(1);
          applyZoom(slotIndex);
        }
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        if (slotState[slotIndex].zoom > 0.5) {
          slotState[slotIndex].zoom = +(slotState[slotIndex].zoom - 0.1).toFixed(1);
          applyZoom(slotIndex);
        }
      });
    }

    // Botão de Silenciar Individual
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        toggleMute(slotIndex);
      });
    }

    // Botão de Recarregar Individual
    const reloadBtn = document.querySelector(`.btn-reload[data-slot="${slotIndex}"]`);
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        if (webview) webview.reload();
      });
    }

    // Botão Expandir para Foco
    const expandBtn = document.querySelector(`.btn-expand[data-slot="${slotIndex}"]`);
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        if (currentMode === `focus-${slotIndex}`) {
          setMode('grid');
        } else {
          setMode(`focus-${slotIndex}`);
        }
      });
    }
  }
}

// Aplicar Zoom no Webview
function applyZoom(slotIndex) {
  const webview = document.getElementById(`webview-${slotIndex}`);
  const zoomLabel = document.getElementById(`zoom-label-${slotIndex}`);
  const zoomFactor = slotState[slotIndex].zoom;

  if (webview) {
    try {
      webview.setZoomFactor(zoomFactor);
    } catch (err) {
      console.warn('Erro ao aplicar zoom:', err);
    }
  }

  if (zoomLabel) {
    zoomLabel.textContent = `${Math.round(zoomFactor * 100)}%`;
  }

  localStorage.setItem(`huntera_slot_zoom_${slotIndex}`, zoomFactor.toString());
}

// Alternar Silenciamento
function toggleMute(slotIndex) {
  const webview = document.getElementById(`webview-${slotIndex}`);
  const muteBtn = document.getElementById(`mute-btn-${slotIndex}`);
  const isMuted = !slotState[slotIndex].muted;

  slotState[slotIndex].muted = isMuted;

  if (webview) {
    try {
      webview.setAudioMuted(isMuted);
    } catch (err) {
      console.warn('Erro ao alternar áudio:', err);
    }
  }

  if (muteBtn) {
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', isMuted);
  }
}

// Navegação de Layout (Grade 2x2 vs Foco)
function initLayoutNav() {
  const btnGrid = document.getElementById('btn-mode-grid');
  if (btnGrid) {
    btnGrid.addEventListener('click', () => setMode('grid'));
  }

  for (let i = 1; i <= SLOTS_COUNT; i++) {
    const target = i;
    const btnFocus = document.getElementById(`btn-focus-${target}`);
    if (btnFocus) {
      btnFocus.addEventListener('click', () => setMode(`focus-${target}`));
    }
  }
}

function setMode(mode) {
  currentMode = mode;
  const container = document.getElementById('main-container');
  if (!container) return;

  // Atualizar classes do container
  container.className = `grid-container mode-${mode}`;

  // Atualizar botões da topbar
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  if (mode === 'grid') {
    const btn = document.getElementById('btn-mode-grid');
    if (btn) btn.classList.add('active');
  } else {
    const slotId = mode.replace('focus-', '');
    const btn = document.getElementById(`btn-focus-${slotId}`);
    if (btn) btn.classList.add('active');
  }
}

// Ações Globais
function initGlobalActions() {
  const btnReloadAll = document.getElementById('btn-reload-all');
  if (btnReloadAll) {
    btnReloadAll.addEventListener('click', () => {
      for (let i = 1; i <= SLOTS_COUNT; i++) {
        const webview = document.getElementById(`webview-${i}`);
        if (webview) webview.reload();
      }
    });
  }

  const btnMuteAll = document.getElementById('btn-mute-all');
  const muteAllIcon = document.getElementById('mute-all-icon');
  if (btnMuteAll) {
    btnMuteAll.addEventListener('click', () => {
      isAllMuted = !isAllMuted;
      for (let i = 1; i <= SLOTS_COUNT; i++) {
        const webview = document.getElementById(`webview-${i}`);
        const muteBtn = document.getElementById(`mute-btn-${i}`);
        slotState[i].muted = isAllMuted;

        if (webview) {
          try {
            webview.setAudioMuted(isAllMuted);
          } catch (e) {}
        }
        if (muteBtn) {
          muteBtn.textContent = isAllMuted ? '🔇' : '🔊';
          muteBtn.classList.toggle('muted', isAllMuted);
        }
      }

      if (muteAllIcon) {
        muteAllIcon.textContent = isAllMuted ? '🔇' : '🔊';
      }
      btnMuteAll.classList.toggle('active-muted', isAllMuted);
    });
  }
}

// Atalhos de Teclado
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Ctrl + 0 -> Modo Grade
    if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      setMode('grid');
    }
    // Ctrl + 1..4 -> Modo Foco
    if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      setMode(`focus-${e.key}`);
    }
    // Escape -> Voltar para Grade se estiver em Foco
    if (e.key === 'Escape' && currentMode !== 'grid') {
      e.preventDefault();
      setMode('grid');
    }
    // Ctrl + Shift + R -> Recarregar Todas
    if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault();
      const btn = document.getElementById('btn-reload-all');
      if (btn) btn.click();
    }
  });
}

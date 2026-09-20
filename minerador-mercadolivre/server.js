// Prevenir que qualquer erro não tratado derrube o servidor
process.on('uncaughtException', (err) => {
  console.error('⚠️ [Uncaught Exception capturada e protegida]:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Unhandled Rejection capturada e protegida]:', reason?.message || reason);
});

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Categorias mapeadas
const CATEGORIES = [
  { id: 'ofertas', name: '⚡ OFERTAS RELÂMPAGO (Até 80% OFF)', url: 'https://www.mercadolivre.com.br/ofertas', isDeals: true },
  { id: 'geral', name: '🏆 Geral (Mais Vendidos)', url: 'https://www.mercadolivre.com.br/mais-vendidos' },
  { id: 'eletronicos', name: '🎧 Eletrônicos & Áudio', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1000' },
  { id: 'informatica', name: '💻 Informática & Acessórios', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1648' },
  { id: 'celulares', name: '📱 Celulares e Telefones', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1051' },
  { id: 'casa', name: '🏠 Casa & Cozinha', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1574' },
  { id: 'beleza', name: '💄 Beleza & Cuidado', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1246' },
  { id: 'ferramentas', name: '🔧 Ferramentas', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB263532' },
  { id: 'games', name: '🎮 Games & Consoles', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1144' },
  { id: 'esportes', name: '⚽ Esportes & Fitness', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1276' },
];

const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

function parseCleanPrice(ariaLabel, fractionText, centsText) {
  if (ariaLabel) {
    const match = ariaLabel.match(/([\d\.]+)\s*reais(?:\s*com\s*(\d+)\s*centavos)?/i);
    if (match) {
      const intPart = match[1].replace(/\./g, '');
      const centPart = match[2] ? match[2].padEnd(2, '0').slice(0, 2) : '00';
      const parsed = parseFloat(`${intPart}.${centPart}`);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  if (fractionText) {
    const intPart = fractionText.replace(/[^\d]/g, '');
    const centPart = centsText ? centsText.replace(/[^\d]/g, '').padEnd(2, '0').slice(0, 2) : '00';
    const parsed = parseFloat(`${intPart}.${centPart}`);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function isLegitProduct(title, price) {
  if (!title || !price || price < 5 || price > 50000) return false;
  const lower = title.toLowerCase();
  const blackList = ['cartão presente', 'gift card', 'razer gold', 'google play', 'playstation store', 'xbox live', 'roblox', 'recarga de celular'];
  return !blackList.some(term => lower.includes(term));
}

// Scraper de Ofertas
async function scrapeDealsPage(targetUrl) {
  const cached = cache.get(targetUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const res = await axios.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const products = [];

  $('[class*="poly-card"], [class*="promotion-item"], [class*="ui-search-result"]').each((i, el) => {
    const $el = $(el);
    const link = $el.find('a[href*="MLB"]').first().attr('href') || $el.find('a').attr('href');
    const title = $el.find('[class*="poly-component__title"], [class*="title"], h2, h3').first().text().trim();
    let img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || $el.find('img').attr('data-srcset')?.split(' ')[0];
    if (img && (img.startsWith('data:') || img.includes('logo__large_plus') || img.includes('.svg'))) {
      img = null;
    }
    if (img && img.includes('mlstatic.com')) {
      img = img.replace(/\.webp$/i, '.jpg').replace(/-[A-Z]{1,2}\.jpg$/i, '-O.jpg');
    }

    const currentPriceEl = $el.find('.poly-price__current .andes-money-amount, [class*="price__current"] .andes-money-amount').first();
    const currentAria = currentPriceEl.attr('aria-label');
    const currentFraction = currentPriceEl.find('[class*="fraction"]').text().trim();
    const currentCents = currentPriceEl.find('[class*="cents"]').text().trim();
    const price = parseCleanPrice(currentAria, currentFraction, currentCents);

    const oldPriceEl = $el.find('s.andes-money-amount, [class*="previous"] .andes-money-amount').first();
    const oldAria = oldPriceEl.attr('aria-label');
    const oldFraction = oldPriceEl.find('[class*="fraction"]').text().trim();
    const oldPrice = parseCleanPrice(oldAria, oldFraction, null);

    let discountText = $el.find('[class*="discount"], .polylabel-pill').first().text().trim();
    if (!discountText && oldPrice && price && oldPrice > price) {
      const discountPct = Math.round(((oldPrice - price) / oldPrice) * 100);
      discountText = `${discountPct}% OFF`;
    }

    const cardText = $el.text();
    const salesMatch = cardText.match(/\+(\d+\s*(?:mil)?)\s*vendidos/i);
    const salesCount = salesMatch ? `+${salesMatch[1]} vendidos` : null;
    const ratingMatch = cardText.match(/(\d\.\d)\s*\|\s*\+/);
    const rating = ratingMatch ? ratingMatch[1] : '4.8';

    const isFreeShipping = cardText.toLowerCase().includes('frete grátis') || cardText.toLowerCase().includes('chegará grátis');
    const isFull = cardText.includes('FULL') || (link && link.includes('full'));

    if (title && price && link && img && isLegitProduct(title, price)) {
      const cleanLink = link.startsWith('http') ? link : `https://www.mercadolivre.com.br${link}`;
      if (!products.some(p => p.link === cleanLink || p.title === title)) {
        products.push({
          id: `deal-${i}-${Math.random().toString(36).substring(2, 6)}`,
          rank: i + 1,
          title,
          price,
          priceFormatted: `R$ ${price.toFixed(2).replace('.', ',')}`,
          oldPrice: oldPrice || +(price * 1.35).toFixed(2),
          oldPriceFormatted: oldPrice ? `R$ ${oldPrice.toFixed(2).replace('.', ',')}` : `R$ ${(price * 1.35).toFixed(2).replace('.', ',')}`,
          discount: discountText || 'OFERTA',
          rating,
          salesCount,
          img: img,
          link: cleanLink,
          isFreeShipping,
          isFull,
        });
      }
    }
  });

  cache.set(targetUrl, { data: products, timestamp: Date.now() });
  return products;
}

// Scraper de Mais Vendidos
async function scrapeBestSellers(targetUrl) {
  const cached = cache.get(targetUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const res = await axios.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const products = [];

  $('a[href*="/p/MLB"], a[href*="MLB-"]').each((i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const title = $el.find('.dynamic-carousel__title').text().trim() || $el.find('img').attr('alt') || '';
    let img = $el.find('img').attr('src') || $el.find('img').attr('data-src');
    if (img && (img.startsWith('data:') || img.includes('logo__large_plus') || img.includes('.svg'))) {
      img = null;
    }
    if (img && img.includes('mlstatic.com')) {
      img = img.replace(/\.webp$/i, '.jpg').replace(/-[A-Z]{1,2}\.jpg$/i, '-O.jpg');
    }
    const rankText = $el.find('.dynamic-carousel__pill-container--text').text().trim();
    
    const priceBlock = $el.find('.dynamic-carousel__price').text().trim();
    const priceMatch = priceBlock.match(/R\$\s*([\d\.]+)(?:,(\d{2}))?/);
    let price = null;
    if (priceMatch) {
      const intP = priceMatch[1].replace(/\./g, '');
      const centP = priceMatch[2] || '00';
      price = parseFloat(`${intP}.${centP}`);
    }

    if (title && price && href && img && isLegitProduct(title, price)) {
      const rankMatch = rankText.match(/(\d+)º/);
      const rank = rankMatch ? parseInt(rankMatch[1]) : products.length + 1;
      const suggestedOldPrice = +(price * 1.3).toFixed(2);

      if (!products.some(p => p.link === href)) {
        products.push({
          id: `mlb-${rank}-${Math.random().toString(36).substring(2, 6)}`,
          rank,
          title,
          price,
          priceFormatted: `R$ ${price.toFixed(2).replace('.', ',')}`,
          oldPrice: suggestedOldPrice,
          oldPriceFormatted: `R$ ${suggestedOldPrice.toFixed(2).replace('.', ',')}`,
          discount: '30% OFF',
          rating: '4.8',
          salesCount: '+1mil vendidos',
          img: img,
          link: href.startsWith('http') ? href : `https://www.mercadolivre.com.br${href}`,
          isFreeShipping: price > 79,
          isFull: true,
        });
      }
    }
  });

  cache.set(targetUrl, { data: products, timestamp: Date.now() });
  return products;
}

// ==========================================================
// MOTOR DE AUTOMAÇÃO WHATSAPP WEB
// ==========================================================
let waClient = null;
let waStatus = 'disconnected'; // 'disconnected' | 'qr_ready' | 'authenticating' | 'ready'
let qrCodeDataUrl = null;
let isAutoPosting = false;
let nextPostTimeout = null;
let nextPostTimestamp = null;
const HISTORY_FILE = path.join(__dirname, 'posted-history.json');
const CONFIG_FILE = path.join(__dirname, 'autopost-config.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (Array.isArray(data)) return new Set(data);
    }
  } catch (e) {}
  return new Set();
}

function saveHistory(historySet) {
  try {
    const list = Array.from(historySet).slice(-1000);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

const postedProductsHistory = loadHistory();

function isProductAlreadyPosted(product) {
  if (!product) return true;
  const idKey = (product.link || '').match(/(MLB-?\d+)/i)?.[1]?.toUpperCase() || product.id;
  const titleKey = (product.title || '').trim().toLowerCase();
  return (idKey && postedProductsHistory.has(idKey)) || (titleKey && postedProductsHistory.has(titleKey));
}

function recordProductPosted(product) {
  if (!product) return;
  const idKey = (product.link || '').match(/(MLB-?\d+)/i)?.[1]?.toUpperCase() || product.id;
  const titleKey = (product.title || '').trim().toLowerCase();
  if (idKey) postedProductsHistory.add(idKey);
  if (titleKey) postedProductsHistory.add(titleKey);
  saveHistory(postedProductsHistory);
}

function loadAutoPostConfig() {
  const defaults = {
    targetGroupId: '',
    targetGroupName: '',
    affiliateTag: 'givi713407',
    delays: [3, 5, 7, 9, 12, 15, 25],
    copyStyle: 'urgencia',
    minDiscount: 20,
    operatingHours: {
      enabled: true,
      start: '07:30',
      end: '21:30'
    },
    antiBot: {
      enabled: true,
      typingSimulation: true,
      jitterSeconds: true,
      spintax: true,
    }
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        ...defaults,
        ...saved,
        operatingHours: { ...defaults.operatingHours, ...(saved.operatingHours || {}) },
        antiBot: { ...defaults.antiBot, ...(saved.antiBot || {}) }
      };
    }
  } catch (e) {}
  return defaults;
}

function saveAutoPostConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}

// Verifica se o horário atual está na janela de funcionamento (ex: 07:30 às 21:30)
function checkOperatingHours() {
  const cfg = autoPostConfig.operatingHours || { enabled: true, start: '07:30', end: '21:30' };
  if (!cfg.enabled) {
    return { isAllowed: true, formattedWake: null };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = (cfg.start || '07:30').split(':').map(Number);
  const [endH, endM] = (cfg.end || '21:30').split(':').map(Number);

  const startMinutes = (isNaN(startH) ? 7 : startH) * 60 + (isNaN(startM) ? 30 : startM);
  const endMinutes = (isNaN(endH) ? 21 : endH) * 60 + (isNaN(endM) ? 30 : endM);

  // Está dentro do horário permitido?
  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return { isAllowed: true, formattedWake: null };
  }

  // Período noturno/madrugada (repouso)
  const wakeDate = new Date(now);
  if (currentMinutes >= endMinutes) {
    // Passou do horário limite da noite (ex: após 21:30) -> acorda amanhã de manhã
    wakeDate.setDate(wakeDate.getDate() + 1);
  }

  // Jitter humano aleatório no despertar matinal (entre 15 e 75 segundos após o minuto)
  const randomSec = Math.floor(Math.random() * 60) + 15;
  wakeDate.setHours(startH, startM, randomSec, 0);

  const waitMs = Math.max(wakeDate.getTime() - now.getTime(), 60000);
  const waitMinutes = Math.round(waitMs / (60 * 1000));
  const formattedWake = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

  return {
    isAllowed: false,
    wakeDate,
    waitMs,
    waitMinutes,
    formattedWake
  };
}

let autoPostConfig = loadAutoPostConfig();
let postLogs = [];

let cachedGroups = [];

// Limpa arquivos de trava do Chrome que podem impedir abertura
function cleanStaleLocks(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          cleanStaleLocks(fullPath);
        } else if (file === 'LOCK' || file === 'DevToolsActivePort') {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

function getBrowserExecutable() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (fs.existsSync(chromePath)) return chromePath;
  if (fs.existsSync(edgePath)) return edgePath;
  return undefined;
}

function initWhatsAppClient() {
  if (waClient) {
    if (waStatus === 'ready') return;
    try { waClient.destroy().catch(() => {}); } catch (e) {}
    waClient = null;
  }

  const authDir = path.join(process.cwd(), '.wwebjs_auth');
  cleanStaleLocks(authDir);

  waStatus = 'authenticating';
  const execPath = getBrowserExecutable();

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1030410331-alpha.html',
      strict: false,
    },
    puppeteer: {
      headless: true,
      executablePath: execPath,
      protocolTimeout: 180000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--js-flags=--max-old-space-size=1024'
      ],
    },
  });

  waClient.on('error', (err) => {
    console.error('⚠️ [WhatsApp Client Error capturado]:', err?.message || err);
  });

  waClient.on('qr', async (qr) => {
    console.log('📱 QR Code gerado para conexão WhatsApp!');
    waStatus = 'qr_ready';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
    } catch (e) {
      console.error('Erro ao gerar imagem do QR Code:', e.message);
    }
  });

  waClient.on('ready', async () => {
    console.log('✅ WhatsApp Web Conectado e Pronto!');
    waStatus = 'ready';
    qrCodeDataUrl = null;

    // Proteção profunda em nível de navegador para suprimir erros de memoização/getters em contas LID e mídias
    try {
      if (waClient.pupPage) {
        await waClient.pupPage.evaluate(() => {
          if (typeof window.WWebJS?.protectGetters === 'function') {
            window.WWebJS.protectGetters();
          }

          const getterModules = [
            'WAWebChatGetters',
            'WAWebFrontendChatGetters',
            'WAWebGroupMetadataGetters',
            'WAWebFrontendGroupMetadataGetters',
            'WAWebGroupParticipantGetters',
            'WAWebUnjoinedSubgroupMetadataGetters',
            'WAWebMsgGetters',
            'WAWebFrontendMsgGetters',
            'WAWebContactGetters',
            'WAWebFrontendContactGetters',
            'WAWebBusinessProfileGetters',
            'WAWebFrontendBusinessProfileGetters',
            'WAWebNewsletterMetadataGetters',
            'WAWebFrontendNewsletterMetadataGetters',
            'WAWebNewsletterPollVotesGetters',
            'WAWebFrontendNewsletterPollVotesGetters',
            'WAWebConnGetters',
            'WAWebStreamGetters',
            'WAWebMuteGetters',
            'WAWebCatalogGetters',
            'WAWebProductGetters',
            'WAWebProductImageGetters',
            'WAWebBroadcastMetadataGetters',
            'WAWebLabelGetters',
            'WAWebProfilePicThumbGetters',
            'WAWebSettingsGetters',
            'WAWebReactionsSendersGetters',
            'WAWebStatusGetters',
            'WAWebFrontendStatusGetters',
            'WAWebStickerGetters',
            'WAWebTextStatusGetters',
            'WAWebFrontendTextStatusGetters',
            'WAWebAiThreadGetters',
            'WAWebPresenceGetters',
            'WAWebFrontendPresenceGetters',
            'WAWebCommentGetters',
            'WAWebPinInChatGetters',
            'WAWebFrontendPinInChatGetters',
            'WAWebPollVoteGetters',
            'WAWebFrontendPollVoteGetters',
            'WAWebChatPreferenceGetters',
            'WAWebChatstateGetters'
          ];

          for (const modName of getterModules) {
            try {
              const mod = window.require(modName);
              if (!mod) continue;
              for (const k of Object.keys(mod)) {
                if (typeof mod[k] === 'function' && !mod[k].__shielded) {
                  const orig = mod[k];
                  const shielded = function(item) {
                    if (item == null) return undefined;
                    if (typeof item === 'object') {
                      if (!item.id) {
                        const syn = item._serialized || item.wid || item.key?.id || item.filehash || ('synthetic_' + Math.random().toString(36).slice(2, 9));
                        try {
                          item.id = syn;
                        } catch (e1) {
                          try {
                            Object.defineProperty(item, 'id', { value: syn, writable: true, configurable: true });
                          } catch (e2) {}
                        }
                      }
                    }
                    try {
                      return orig.apply(this, arguments);
                    } catch (err) {
                      if (err && err.message && (err.message.includes('id property') || err.message.includes('memoize'))) {
                        return undefined;
                      }
                      throw err;
                    }
                  };
                  shielded.__shielded = true;
                  mod[k] = shielded;
                }
              }
            } catch (e) {}
          }

          try {
            const lidUtils = window.require('WAWebLidMigrationUtils');
            if (lidUtils && typeof lidUtils.toPn === 'function' && !lidUtils.toPn.__shielded) {
              const origToPn = lidUtils.toPn;
              const shieldedToPn = function(wid) {
                try {
                  return origToPn.apply(this, arguments);
                } catch (e) {
                  return wid;
                }
              };
              shieldedToPn.__shielded = true;
              lidUtils.toPn = shieldedToPn;
            }
          } catch (e) {}
        });
      }
    } catch (e) {
      console.warn('Aviso: Não foi possível injetar proteção de getters:', e.message);
    }

    // Pré-carrega grupos após sincronização inicial
    setTimeout(() => {
      safeGetGroups().catch(() => {});
    }, 4000);
  });

  waClient.on('authenticated', () => {
    console.log('🔐 Sessão do WhatsApp Autenticada.');
    waStatus = 'authenticating';
  });

  waClient.on('auth_failure', (msg) => {
    console.warn('⚠️ Falha de autenticação no WhatsApp:', msg);
    waStatus = 'disconnected';
    qrCodeDataUrl = null;
  });

  waClient.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp Desconectado:', reason);
    waStatus = 'disconnected';
    qrCodeDataUrl = null;
    stopAutoPoster();
    waClient = null;
  });

  waClient.initialize().catch((err) => {
    console.error('Erro ao inicializar WhatsApp Client:', err.message);
    waStatus = 'disconnected';
    waClient = null;
  });
}

// Busca grupos de forma ultra rápida e leve diretamente do Store do Chromium (sem serializar conversas pesadas)
async function safeGetGroups() {
  if (!waClient || waStatus !== 'ready') return cachedGroups;

  try {
    if (waClient.pupPage) {
      const storeGroups = await withTimeout(waClient.pupPage.evaluate(() => {
        try {
          const collections = window.require('WAWebCollections');
          const chatModels = collections?.Chat?.getModelsArray?.() || [];
          const result = [];
          for (const c of chatModels) {
            const id = c.id?._serialized || (c.id ? c.id.toString() : '');
            if (id.endsWith('@g.us') || c.isGroup || c.id?.server === 'g.us') {
              result.push({
                id: id,
                name: c.formattedTitle || c.name || 'Grupo sem nome'
              });
            }
          }
          return result;
        } catch (e) {
          return [];
        }
      }), 10000, 'Timeout ao ler grupos do Store');

      if (storeGroups && storeGroups.length > 0) {
        const map = new Map();
        cachedGroups.forEach(item => map.set(item.id, item));
        storeGroups.forEach(item => map.set(item.id, item));
        cachedGroups = Array.from(map.values());
        return cachedGroups;
      }
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar lista de grupos:', err.message);
  }

  return cachedGroups;
}

// Localiza um grupo específico por nome, link de convite ou ID direto
async function findGroup(query) {
  if (!waClient || waStatus !== 'ready' || !query) return null;
  const raw = query.trim();

  // 1. Link de convite do WhatsApp (ex: https://chat.whatsapp.com/ABCDEF12345)
  const inviteMatch = raw.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  if (inviteMatch) {
    const code = inviteMatch[1];
    try {
      const inviteInfo = await waClient.getInviteInfo(code);
      if (inviteInfo) {
        const id = inviteInfo.id?._serialized || inviteInfo.id;
        const name = inviteInfo.subject || inviteInfo.name || 'Grupo via Link';
        const groupObj = { id, name };
        if (!cachedGroups.some(g => g.id === id)) cachedGroups.unshift(groupObj);
        return groupObj;
      }
    } catch (e) {
      try {
        const joinedId = await waClient.acceptInvite(code);
        if (joinedId) {
          const groupObj = { id: joinedId, name: 'Grupo via Convite' };
          if (!cachedGroups.some(g => g.id === joinedId)) cachedGroups.unshift(groupObj);
          return groupObj;
        }
      } catch (err2) {
        console.warn('Erro ao processar convite:', err2.message);
      }
    }
  }

  // 2. Já é um ID do WhatsApp direto
  if (raw.includes('@g.us')) {
    const inCache = cachedGroups.find(g => g.id === raw);
    if (inCache) return inCache;
    const groupObj = { id: raw, name: raw };
    cachedGroups.unshift(groupObj);
    return groupObj;
  }

  // 3. Busca por nome (sem acentos, case-insensitive)
  const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Primeiro no cache
  const fromCache = cachedGroups.find(g => {
    const gClean = (g.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return gClean.includes(clean);
  });
  if (fromCache) return fromCache;

  // Depois atualizando a lista completa
  const allGroups = await safeGetGroups();
  const matched = allGroups.find(g => {
    const gClean = (g.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return gClean.includes(clean);
  });
  if (matched) return matched;

  // 4. Busca direta no Store do Chromium por qualquer correspondência de título
  if (waClient.pupPage) {
    try {
      const storeMatch = await waClient.pupPage.evaluate((searchTerm) => {
        try {
          const collections = window.require('WAWebCollections');
          const chatModels = collections?.Chat?.getModelsArray?.() || [];
          for (const c of chatModels) {
            const id = c.id?._serialized || '';
            if (id.endsWith('@g.us') || c.isGroup) {
              const title = (c.formattedTitle || c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (title.includes(searchTerm)) {
                return { id, name: c.formattedTitle || c.name };
              }
            }
          }
        } catch (e) {}
        return null;
      }, clean);

      if (storeMatch) {
        if (!cachedGroups.some(g => g.id === storeMatch.id)) cachedGroups.unshift(storeMatch);
        return storeMatch;
      }
    } catch (e) {}
  }

  return null;
}

// Gera a URL mais curta e limpa oficial do Mercado Livre (ex: /p/MLB... ou produto.mercadolivre.com.br/MLB-...)
function cleanMercadoLivreUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // 1. Se for produto de catálogo /p/MLB...
    const pMatch = u.pathname.match(/\/p\/(MLB\d+)/i);
    if (pMatch) {
      return `https://www.mercadolivre.com.br/p/${pMatch[1].toUpperCase()}`;
    }

    // 2. Se for produto padrão com código MLB-...
    const mlbMatch = u.pathname.match(/(MLB-?\d+)/i);
    if (mlbMatch) {
      const cleanId = mlbMatch[1].toUpperCase();
      return `https://produto.mercadolivre.com.br/${cleanId}`;
    }

    // 3. Fallback: URL limpa sem query strings poluídas
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    const match = url.match(/\/p\/(MLB\d+)/i) || url.match(/(MLB-?\d+)/i);
    if (match) {
      return match[1].toUpperCase().startsWith('MLB') && !match[1].includes('-')
        ? `https://www.mercadolivre.com.br/p/${match[1].toUpperCase()}`
        : `https://produto.mercadolivre.com.br/${match[1].toUpperCase()}`;
    }
    return url.split('?')[0];
  }
}

// Baixa a imagem do produto em alta resolução e formato JPEG oficial para WhatsApp
async function getProductMedia(imageUrl, productLink) {
  let targetUrl = imageUrl;

  // Se não veio imagem ou veio placeholder, tenta extrair da página do produto
  if (!targetUrl || targetUrl.includes('logo__large_plus') || targetUrl.startsWith('data:')) {
    if (productLink) {
      try {
        const pageRes = await axios.get(productLink, {
          timeout: 7000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const match = pageRes.data.match(/https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^"'\s]+\.(?:jpg|jpeg|webp)/i);
        if (match) targetUrl = match[0];
      } catch (e) {}
    }
  }

  if (!targetUrl || targetUrl.includes('logo__large_plus') || targetUrl.startsWith('data:')) {
    console.warn('⚠️ Foto não encontrada para o produto.');
    return null;
  }

  // Prepara variações com preferência absoluta para JPEG em alta definição (-O.jpg)
  const candidates = [
    targetUrl.replace(/\.webp$/i, '.jpg').replace(/-[A-Z]{1,2}\.jpg$/i, '-O.jpg'),
    targetUrl.replace(/\.webp$/i, '.jpg'),
    targetUrl
  ];

  for (const candidate of candidates) {
    try {
      const res = await axios.get(candidate, {
        responseType: 'arraybuffer',
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/jpeg,image/png,image/*;q=0.9'
        }
      });

      let contentType = res.headers['content-type'] || 'image/jpeg';
      contentType = contentType.split(';')[0].trim();

      if (contentType.includes('svg') || contentType.includes('html') || res.data.length < 1000) {
        continue;
      }

      // Converte para image/jpeg para garantir que o WhatsApp Web trate como FOTO (e não sticker)
      if (contentType === 'image/webp') {
        contentType = 'image/jpeg';
      }

      const base64Data = Buffer.from(res.data).toString('base64');
      return new MessageMedia(contentType, base64Data, 'produto.jpg');
    } catch (err) {}
  }

  return null;
}

async function formatAffiliateMessage(product, style, tag) {
  let link = cleanMercadoLivreUrl(product.link);
  const effectiveTag = (tag && tag.trim()) ? tag.trim() : (autoPostConfig.affiliateTag || 'givi713407');
  if (effectiveTag) {
    if (effectiveTag.startsWith('http')) {
      link = effectiveTag;
    } else if (effectiveTag.includes('=')) {
      const sep = link.includes('?') ? '&' : '?';
      link = `${link}${sep}${effectiveTag}`;
    } else {
      const sep = link.includes('?') ? '&' : '?';
      link = `${link}${sep}matt_tool=${encodeURIComponent(effectiveTag)}`;
    }
  }

  console.log(`🔗 Link de afiliado gerado: ${link}`);

  const shortTitle = product.title.length > 70 ? product.title.substring(0, 67) + '...' : product.title;
  const oldPriceStr = product.oldPriceFormatted ? `~${product.oldPriceFormatted}~` : `~R$ ${(product.price * 1.35).toFixed(2).replace('.', ',')}~`;
  const discountStr = product.discount || 'OFERTA RELÂMPAGO';

  // Se spintax estiver ativado (padrão ativo), varia as frases para evitar fingerprinting de bot
  const useSpintax = autoPostConfig.antiBot?.spintax !== false;

  const freteOptions = product.isFreeShipping
    ? ['📦 *Frete Grátis*', '🚀 *Envio com Frete Grátis*', '📦 *Entrega Grátis ML*']
    : ['🚚 *Entrega Rápida ML*', '🚚 *Envio Imediato*', '📦 *Envio Rápido*'];
  const frete = useSpintax ? freteOptions[Math.floor(Math.random() * freteOptions.length)] : (product.isFreeShipping ? '📦 *Frete Grátis*' : '🚚 *Entrega Rápida ML*');
  const seloFull = product.isFull ? ' ⚡ *Envio FULL*' : '';

  const rating = product.rating || '4.8';
  const sales = product.salesCount ? `(${product.salesCount})` : '';
  const reviewLines = [
    `⭐ Avaliação: *${rating}★* ${sales}`,
    `⭐ Nota *${rating}★* • Destaque em vendas ${sales}`,
    `⭐ Top Avaliado pelos compradores (*${rating}★*)`,
    `⭐ Avaliado com *${rating}★* no Mercado Livre ${sales}`
  ];
  const reviewStr = useSpintax ? reviewLines[Math.floor(Math.random() * reviewLines.length)] : `⭐ ${product.salesCount ? `*${product.salesCount}* • ` : ''}Top Avaliado (${rating}★)`;

  const priceLines = [
    `❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (*${discountStr}*!)`,
    `❌ Era: ${oldPriceStr}\n🔥 Saindo por: *${product.priceFormatted}* (*${discountStr}*!)`,
    `🏷️ De ${oldPriceStr} por apenas *${product.priceFormatted}* (*${discountStr}*!)`,
    `📉 Caiu de ${oldPriceStr} para *${product.priceFormatted}* (*${discountStr}*!)`
  ];
  const priceStr = useSpintax ? priceLines[Math.floor(Math.random() * priceLines.length)] : `❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (*${discountStr}*!)`;

  const ctas = [
    `👇 *Garanta o seu antes que acabe o estoque:*\n🔗 ${link}`,
    `👇 *Aproveite a promoção no link oficial:*\n🔗 ${link}`,
    `🛒 *Compre pelo link com desconto garantido:*\n🔗 ${link}`,
    `👉 *Confira os detalhes e aproveite aqui:*\n🔗 ${link}`,
    `⚡ *Acesse a oferta oficial antes do fim:*\n🔗 ${link}`,
    `🛍️ *Clique no link oficial para garantir:*\n🔗 ${link}`
  ];
  const ctaStr = useSpintax ? ctas[Math.floor(Math.random() * ctas.length)] : `👇 *Aproveite a promoção aqui:*\n🔗 ${link}`;

  const footers = [
    `⚠️ _Estoque limitado, corre antes que o preço suba!_`,
    `⚠️ _Valor promocional sujeito a alteração rápida!_`,
    `⏳ _Desconto por tempo limitado no Mercado Livre._`,
    `🕒 _Corre que essa oferta costuma esgotar rápido!_`,
    `⚠️ _Preço promocional verificado agora no Mercado Livre!_`,
    `🚨 _Promoção ativa enquanto durar o estoque promocional._`
  ];
  const footerStr = useSpintax ? footers[Math.floor(Math.random() * footers.length)] : `⚠️ _Estoque limitado, corre antes que o preço suba!_`;

  if (style === 'achadinho') {
    const headersAchadinho = [
      '✨ *ACHADINHO DO MERCADO LIVRE!* ✨',
      '😍 *OLHA ESSE ACHADO QUE ENCONTREI!* 😍',
      '🌟 *ACHADINHO IMPERDÍVEL HOJE!* 🌟',
      '🛍️ *ACHADO DE OURO NO MERCADO LIVRE!* 🛍️',
      '💛 *ACHADINHO QUE VALE A PENA CONFERIR!* 💛'
    ];
    const header = useSpintax ? headersAchadinho[Math.floor(Math.random() * headersAchadinho.length)] : '✨ *ACHADINHO DO MERCADO LIVRE!* ✨';
    return `${header}\n\n😍 *${shortTitle}*\n${reviewStr}\n\n${priceStr}\n${frete}${seloFull}\n\n${ctaStr}\n\n${footerStr}`;
  }

  if (style === 'direto') {
    const headersDireto = [
      `🎯 *${discountStr} NO MERCADO LIVRE!* 🎯`,
      `⚡ *OFERTA DIRETA ML (${discountStr})* ⚡`,
      `🔥 *PROMOÇÃO DO DIA (${discountStr})* 🔥`,
      `💥 *DESCONTO CONFIRMADO: ${discountStr}!* 💥`
    ];
    const header = useSpintax ? headersDireto[Math.floor(Math.random() * headersDireto.length)] : `🎯 *${discountStr} NO MERCADO LIVRE!* 🎯`;
    return `${header}\n\n🔥 *${shortTitle}*\n\n💰 De: ${oldPriceStr} por *${product.priceFormatted}*\n${frete}${seloFull}\n\n👉 *Link oficial da promoção:*\n🔗 ${link}`;
  }

  // Padrão: Urgência
  const headersUrgencia = [
    '🚨 *OFERTA RELÂMPAGO NO MERCADO LIVRE!* 🚨',
    '⚡ *PROMOÇÃO IMPERDÍVEL ENCONTRADA!* ⚡',
    '🔥 *BAIXOU O PREÇO NO MERCADO LIVRE!* 🔥',
    '💥 *SUPER DESCONTO DETECTADO NO ML!* 💥',
    '🎯 *OPORTUNIDADE EXCLUSIVA HOJE!* 🎯',
    '🏷️ *DESCONTO FORTE NO MERCADO LIVRE!* 🏷️',
    '👀 *OLHA ESSE PREÇO QUE BAIXOU!* 👀',
    '⚡ *QUEIMA DE PREÇO NO MERCADO LIVRE!* ⚡'
  ];
  const header = useSpintax ? headersUrgencia[Math.floor(Math.random() * headersUrgencia.length)] : '🚨 *OFERTA RELÂMPAGO NO MERCADO LIVRE!* 🚨';
  return `${header}\n\n🔥 *${shortTitle}*\n${reviewStr}\n\n${priceStr}\n${frete}${seloFull}\n\n${ctaStr}\n\n${footerStr}`;
}

function withTimeout(promise, ms = 35000, errorMsg = 'Operação expirou (timeout)') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Envia oferta com foto e fallback inteligente para texto formatado caso o WhatsApp Web recuse a mídia
async function sendProductOffer(chatId, message, media) {
  if (!waClient || waStatus !== 'ready') {
    throw new Error('WhatsApp não está pronto ou conectado.');
  }

  // Assegura blindagem de getters antes de preparar o envio
  if (waClient.pupPage) {
    try {
      await withTimeout(waClient.pupPage.evaluate(() => {
        if (typeof window.WWebJS?.protectGetters === 'function') {
          window.WWebJS.protectGetters();
        }
      }), 5000, 'Getter shield timeout');
    } catch (e) {}
  }

  // 0. Simulação de presença humana (Anti-Bot / Anti-Ban)
  if (autoPostConfig.antiBot?.enabled !== false && autoPostConfig.antiBot?.typingSimulation !== false) {
    try {
      console.log(`🤖 [Anti-Bot] Simulando presença humana (abertura de conversa e digitação)...`);
      try {
        const chat = await waClient.getChatById(chatId).catch(() => null);
        if (chat) {
          await chat.sendSeen().catch(() => {});
          await chat.sendStateTyping().catch(() => {});
        }
      } catch (e) {}

      // Digitação realista entre 3.5s e 6.5s
      const typingMs = Math.floor(Math.random() * 3000) + 3500;
      await new Promise(r => setTimeout(r, typingMs));

      try {
        const chat = await waClient.getChatById(chatId).catch(() => null);
        if (chat) await chat.clearState().catch(() => {});
      } catch (e) {}
    } catch (presenceErr) {
      console.warn(`⚠️ [Anti-Bot] Aviso ao simular digitação: ${presenceErr.message}`);
    }
  }

  let sendResult = { success: false, hasImage: false };

  // 1. Tenta envio com foto do produto primeiro com timeout seguro
  if (media) {
    try {
      console.log(`📸 Enviando foto oficial do produto (${media.mimetype}, ~${Math.round(media.data.length * 0.75 / 1024)} KB) para ${chatId}...`);
      await withTimeout(waClient.sendMessage(chatId, media, { caption: message }), 35000, 'Timeout ao enviar foto pelo WhatsApp Web');
      console.log(`🎉 Oferta com FOTO enviada com sucesso para ${chatId}!`);
      sendResult = { success: true, hasImage: true };
    } catch (mediaErr) {
      console.warn(`⚠️ Envio de foto encontrou erro/timeout no WhatsApp Web: ${mediaErr.message}`);
      console.log(`📝 Entregando oferta com link oficial do Mercado Livre e preview enriquecido...`);
    }
  } else {
    console.warn(`⚠️ Mídia não disponível para este produto. Entregando texto com linkPreview.`);
  }

  // 2. Envio do texto formatado com linkPreview ativo caso a foto não tenha ido
  if (!sendResult.success) {
    try {
      await withTimeout(waClient.sendMessage(chatId, message, { linkPreview: true }), 25000, 'Timeout ao enviar mensagem com linkPreview');
      sendResult = { success: true, hasImage: false };
    } catch (e) {
      try {
        await withTimeout(waClient.sendMessage(chatId, message), 15000, 'Timeout ao enviar mensagem de texto simples');
        sendResult = { success: true, hasImage: false };
      } catch (errFinal) {
        console.error('❌ Falha total ao entregar mensagem no WhatsApp:', errFinal.message);
        throw errFinal;
      }
    }
  }

  // 3. Pausa humana de 1.5 a 2.5s após o envio
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 1500));

  return sendResult;
}

// Localiza o chat de destino seja por ID, Link de Convite ou Nome aproximado
async function resolveTargetChat(groupId, groupName) {
  if (!waClient || waStatus !== 'ready') return null;

  // 1. Se temos groupId direto (@g.us ou @c.us), usa envio direto (evita carregar modelo pesado com erro de getters)
  if (groupId && (groupId.includes('@g.us') || groupId.includes('@c.us'))) {
    return {
      id: { _serialized: groupId },
      name: groupName || groupId,
      sendMessage: (content, opts) => waClient.sendMessage(groupId, content, opts)
    };
  }

  // 2. Busca pelo termo (pode ser nome, ID ou link de convite)
  const target = (groupName || groupId || '').trim();
  if (target) {
    const found = await findGroup(target);
    if (found && found.id) {
      return {
        id: { _serialized: found.id },
        name: found.name,
        sendMessage: (content, opts) => waClient.sendMessage(found.id, content, opts)
      };
    }
  }

  return null;
}

// Busca ofertas navegando por múltiplas páginas de ofertas e categorias para sempre achar produtos novos
async function getNextUnpostedDeal(minDiscount = 20) {
  const sources = [
    'https://www.mercadolivre.com.br/ofertas?page=1',
    'https://www.mercadolivre.com.br/ofertas?page=2',
    'https://www.mercadolivre.com.br/ofertas?page=3',
    'https://www.mercadolivre.com.br/ofertas?page=4',
    'https://www.mercadolivre.com.br/ofertas?page=5',
    'https://www.mercadolivre.com.br/ofertas?page=6',
    'https://www.mercadolivre.com.br/ofertas?page=7',
    'https://www.mercadolivre.com.br/ofertas?page=8',
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1051', // Celulares
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1648', // Informática
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1000', // Eletrônicos
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1574', // Casa e Eletrodomésticos
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1246', // Beleza
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1144', // Games
    'https://www.mercadolivre.com.br/mais-vendidos/MLB263532', // Ferramentas
    'https://www.mercadolivre.com.br/mais-vendidos/MLB1276', // Esportes
  ];

  // 1. Primeira passada: busca produtos inéditos com o desconto mínimo pedido
  for (const src of sources) {
    try {
      const isDeals = src.includes('/ofertas');
      const deals = isDeals ? await scrapeDealsPage(src) : await scrapeBestSellers(src);
      for (const d of deals) {
        if (!d || !d.img) continue;
        if (isProductAlreadyPosted(d)) continue;
        const discountNum = parseInt((d.discount || '').replace(/\D/g, '')) || 0;
        if (discountNum >= minDiscount || !isDeals) {
          return d;
        }
      }
    } catch (e) {}
  }

  // 2. Fallback de resgate: se todos os produtos acima do desconto já foram postados, busca qualquer produto inédito com 15% ou mais
  for (const src of sources.slice(0, 5)) {
    try {
      const deals = await scrapeDealsPage(src);
      for (const d of deals) {
        if (!d || !d.img) continue;
        if (isProductAlreadyPosted(d)) continue;
        const discountNum = parseInt((d.discount || '').replace(/\D/g, '')) || 0;
        if (discountNum >= 15) {
          return d;
        }
      }
    } catch (e) {}
  }

  return null;
}

// Disparar uma oferta automática
async function dispatchNextDeal() {
  if (!isAutoPosting || waStatus !== 'ready') return;

  // 1. Checagem do Horário de Funcionamento (ex: repouso entre 21:30 e 07:30)
  const hoursCheck = checkOperatingHours();
  if (!hoursCheck.isAllowed) {
    const startStr = autoPostConfig.operatingHours?.start || '07:30';
    const endStr = autoPostConfig.operatingHours?.end || '21:30';
    console.log(`🌙 [Horário Noturno] Bot em repouso programado (${endStr} às ${startStr}).`);
    console.log(`⏰ Próximo disparo automático programado para ${hoursCheck.formattedWake} (daqui a ~${Math.round(hoursCheck.waitMinutes / 60)}h ${hoursCheck.waitMinutes % 60}m).`);

    // Registra log para visualização no painel
    const sleepTitle = `🌙 Repouso Noturno Ativo (${endStr} às ${startStr})`;
    if (!postLogs.length || postLogs[0].title !== sleepTitle) {
      postLogs.unshift({
        id: Date.now(),
        title: sleepTitle,
        price: '-',
        discount: '-',
        time: new Date().toLocaleTimeString('pt-BR'),
        status: `Dormindo até as ${hoursCheck.formattedWake} 💤`
      });
      if (postLogs.length > 50) postLogs.pop();
    }

    nextPostTimestamp = hoursCheck.wakeDate.getTime();
    if (nextPostTimeout) clearTimeout(nextPostTimeout);
    nextPostTimeout = setTimeout(() => {
      console.log('☀️ [Bom dia!] Horário comercial iniciado. Retomando postagens no grupo!');
      dispatchNextDeal();
    }, hoursCheck.waitMs);
    return;
  }

  try {
    const targetChat = await resolveTargetChat(autoPostConfig.targetGroupId, autoPostConfig.targetGroupName);
    if (!targetChat) {
      console.warn(`⚠️ Grupo de destino "${autoPostConfig.targetGroupName}" não encontrado. Tentando novamente em 2 minutos.`);
      scheduleNextRun(2);
      return;
    }

    // Busca o próximo produto 100% novo (nunca postado antes)
    const candidate = await getNextUnpostedDeal(autoPostConfig.minDiscount);

    if (candidate) {
      const message = await formatAffiliateMessage(candidate, autoPostConfig.copyStyle, autoPostConfig.affiliateTag);
      const media = await getProductMedia(candidate.img, candidate.link);

      const targetId = targetChat.id._serialized || targetChat.id;
      const result = await sendProductOffer(targetId, message, media);

      // Registra no histórico persistido em disco para NUNCA mais repetir
      recordProductPosted(candidate);

      postLogs.unshift({
        id: Date.now(),
        title: candidate.title,
        price: candidate.priceFormatted,
        discount: candidate.discount,
        time: new Date().toLocaleTimeString('pt-BR'),
        status: result.hasImage ? 'Foto + Oferta Enviada! 📸✅' : 'Oferta Enviada! 📝✅'
      });
      if (postLogs.length > 50) postLogs.pop();

      console.log(`🚀 [Auto-Post] Oferta enviada para "${targetChat.name}": ${candidate.title} (${result.hasImage ? 'com foto' : 'texto formatado'})`);
      scheduleNextRun();
    } else {
      console.log('ℹ️ [Auto-Post] Nenhuma oferta inédita no filtro atual. Repetindo varredura em 2 minutos...');
      postLogs.unshift({
        id: Date.now(),
        title: 'Buscando novas ofertas no Mercado Livre...',
        price: '-',
        discount: '-',
        time: new Date().toLocaleTimeString('pt-BR'),
        status: 'Buscando novos produtos 🔄'
      });
      if (postLogs.length > 50) postLogs.pop();
      scheduleNextRun(2);
    }
  } catch (err) {
    console.error('Erro ao disparar oferta automática:', err.message);
    scheduleNextRun(3);
  }
}

function scheduleNextRun(customMinutes = null) {
  if (!isAutoPosting) return;

  // Checa se o próximo ciclo cairia no horário noturno
  const hoursCheck = checkOperatingHours();
  if (!hoursCheck.isAllowed) {
    console.log(`🌙 [Auto-Post] Entrando em repouso noturno até as ${hoursCheck.formattedWake}.`);
    nextPostTimestamp = hoursCheck.wakeDate.getTime();
    if (nextPostTimeout) clearTimeout(nextPostTimeout);
    nextPostTimeout = setTimeout(() => {
      console.log('☀️ [Bom dia!] Horário comercial iniciado. Retomando postagens no grupo!');
      dispatchNextDeal();
    }, hoursCheck.waitMs);
    return;
  }

  const delays = (autoPostConfig.delays && autoPostConfig.delays.length > 0)
    ? autoPostConfig.delays
    : [3, 5, 7, 9, 12, 15, 25];

  const baseMinutes = (customMinutes !== null && customMinutes > 0)
    ? customMinutes
    : delays[Math.floor(Math.random() * delays.length)];

  // Adiciona variação aleatória de segundos (jitter humano) para quebrar padrão robótico
  const jitterSeconds = (autoPostConfig.antiBot?.jitterSeconds !== false)
    ? Math.floor(Math.random() * 42) + 12
    : 0;

  const delayMs = (baseMinutes * 60 + jitterSeconds) * 1000;

  nextPostTimestamp = Date.now() + delayMs;
  const totalSec = Math.round(delayMs / 1000);
  console.log(`⏱️ [Auto-Post] Próximo envio agendado para daqui a ${Math.floor(totalSec / 60)}m ${totalSec % 60}s.`);

  if (nextPostTimeout) clearTimeout(nextPostTimeout);
  nextPostTimeout = setTimeout(() => {
    dispatchNextDeal();
  }, delayMs);
}

function stopAutoPoster() {
  isAutoPosting = false;
  if (nextPostTimeout) {
    clearTimeout(nextPostTimeout);
    nextPostTimeout = null;
  }
  nextPostTimestamp = null;
  console.log('⏸️ [Auto-Post] Automação pausada.');
}

// ==========================================================
// ROTAS DA API
// ==========================================================

app.get('/api/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
});

app.get('/api/mine', async (req, res) => {
  const categoryId = req.query.category || 'ofertas';
  const categoryObj = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];

  try {
    let products = [];
    if (categoryObj.isDeals) {
      products = await scrapeDealsPage(categoryObj.url);
    } else {
      products = await scrapeBestSellers(categoryObj.url);
    }

    res.json({
      success: true,
      category: categoryObj,
      total: products.length,
      products,
    });
  } catch (err) {
    console.error(`Erro ao minerar ${categoryId}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/connect', (req, res) => {
  initWhatsAppClient();
  res.json({ success: true, status: waStatus });
});

app.get('/api/whatsapp/status', (req, res) => {
  const hoursCheck = checkOperatingHours();
  res.json({
    status: waStatus,
    qrCode: qrCodeDataUrl,
    isAutoPosting,
    autoPostConfig,
    nextPostTimestamp,
    isNightSleep: !hoursCheck.isAllowed,
    nextWakeFormatted: hoursCheck.formattedWake || '07:30',
    logs: postLogs.slice(0, 15),
  });
});

app.get('/api/whatsapp/groups', async (req, res) => {
  if (waStatus !== 'ready' || !waClient) {
    return res.json({
      success: true,
      groups: cachedGroups,
      message: 'WhatsApp ainda conectando e sincronizando conversas...'
    });
  }

  // Se já temos grupos em cache e não foi pedido reload forçado, responde instantaneamente
  if (cachedGroups.length > 0 && req.query.force !== 'true') {
    return res.json({
      success: true,
      groups: cachedGroups,
      total: cachedGroups.length
    });
  }

  try {
    const groups = await safeGetGroups();
    res.json({
      success: true,
      groups: (groups && groups.length > 0) ? groups : cachedGroups,
      total: (groups && groups.length > 0) ? groups.length : cachedGroups.length
    });
  } catch (err) {
    console.warn('Aviso: Erro ao obter grupos:', err.message);
    res.json({
      success: true,
      groups: cachedGroups,
      warning: err.message
    });
  }
});

// Busca ou valida grupo pelo nome, ID ou link de convite
app.post('/api/whatsapp/find-group', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, error: 'Digite o nome do grupo ou cole o link de convite.' });
  }

  if (waStatus !== 'ready') {
    return res.status(400).json({ success: false, error: 'Conecte o WhatsApp escaneando o QR Code primeiro!' });
  }

  try {
    const group = await findGroup(query.trim());
    if (group) {
      res.json({ success: true, group });
    } else {
      res.json({
        success: false,
        error: `Grupo "${query}" não foi encontrado. Dica: Se o grupo foi criado recentemente no celular e ainda não tem mensagens, envie um "oi" nele pelo celular para o WhatsApp Web sincronizar, ou cole o Link de Convite do grupo aqui!`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Envio de teste manual imediato
app.post('/api/whatsapp/send-test', async (req, res) => {
  const { targetGroupId, targetGroupName, affiliateTag, copyStyle } = req.body;

  if (waStatus !== 'ready') {
    return res.status(400).json({ success: false, error: 'Conecte o WhatsApp primeiro!' });
  }

  try {
    const targetChat = await resolveTargetChat(targetGroupId, targetGroupName);
    if (!targetChat) {
      return res.status(404).json({ success: false, error: `Grupo "${targetGroupName || targetGroupId}" não encontrado no seu WhatsApp.` });
    }

    // Busca oferta que ainda não foi postada e com imagem garantida
    let sample = await getNextUnpostedDeal(10);
    if (!sample) {
      const deals = await scrapeDealsPage('https://www.mercadolivre.com.br/ofertas');
      sample = deals.find(d => d.img) || deals[0];
    }

    if (!sample) {
      return res.status(404).json({ success: false, error: 'Nenhuma oferta encontrada para teste.' });
    }

    const message = await formatAffiliateMessage(sample, copyStyle || 'urgencia', affiliateTag);
    const media = await getProductMedia(sample.img, sample.link);

    const targetId = targetChat.id._serialized || targetChat.id;
    const result = await sendProductOffer(targetId, message, media);

    // Registra o produto testado no histórico persistido para não repetir no grupo
    recordProductPosted(sample);

    res.json({
      success: true,
      productTitle: sample.title,
      groupName: targetChat.name,
      hasImage: result.hasImage,
      affiliateLink: cleanMercadoLivreUrl(sample.link)
    });
  } catch (err) {
    console.error('Erro ao enviar teste:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/autopost/start', (req, res) => {
  const { targetGroupId, targetGroupName, affiliateTag, delays, copyStyle, minDiscount, operatingHours, antiBot } = req.body;

  if (waStatus !== 'ready') {
    return res.status(400).json({ success: false, error: 'Conecte o WhatsApp primeiro!' });
  }

  if (!targetGroupId && !targetGroupName) {
    return res.status(400).json({ success: false, error: 'Selecione ou digite o nome do grupo!' });
  }

  const effectiveTag = (affiliateTag && affiliateTag.trim()) ? affiliateTag.trim() : (autoPostConfig.affiliateTag || 'givi713407');

  autoPostConfig = {
    targetGroupId: targetGroupId || autoPostConfig.targetGroupId || '',
    targetGroupName: targetGroupName || autoPostConfig.targetGroupName || '',
    affiliateTag: effectiveTag,
    delays: (delays && delays.length) ? delays : [3, 5, 7, 9, 12, 15, 25],
    copyStyle: copyStyle || 'urgencia',
    minDiscount: minDiscount || 20,
    operatingHours: {
      enabled: operatingHours?.enabled !== undefined ? operatingHours.enabled : (autoPostConfig.operatingHours?.enabled ?? true),
      start: operatingHours?.start || autoPostConfig.operatingHours?.start || '07:30',
      end: operatingHours?.end || autoPostConfig.operatingHours?.end || '21:30',
    },
    antiBot: {
      enabled: antiBot?.enabled !== undefined ? antiBot.enabled : (autoPostConfig.antiBot?.enabled ?? true),
      typingSimulation: antiBot?.typingSimulation !== undefined ? antiBot.typingSimulation : (autoPostConfig.antiBot?.typingSimulation ?? true),
      jitterSeconds: antiBot?.jitterSeconds !== undefined ? antiBot.jitterSeconds : (autoPostConfig.antiBot?.jitterSeconds ?? true),
      spintax: antiBot?.spintax !== undefined ? antiBot.spintax : (autoPostConfig.antiBot?.spintax ?? true),
    }
  };

  saveAutoPostConfig(autoPostConfig);

  isAutoPosting = true;
  dispatchNextDeal();

  res.json({ success: true, config: autoPostConfig });
});

app.post('/api/whatsapp/autopost/config', (req, res) => {
  const { operatingHours, antiBot, delays, copyStyle, minDiscount, affiliateTag } = req.body;
  if (operatingHours) {
    autoPostConfig.operatingHours = { ...autoPostConfig.operatingHours, ...operatingHours };
  }
  if (antiBot) {
    autoPostConfig.antiBot = { ...autoPostConfig.antiBot, ...antiBot };
  }
  if (delays && delays.length) autoPostConfig.delays = delays;
  if (copyStyle) autoPostConfig.copyStyle = copyStyle;
  if (minDiscount) autoPostConfig.minDiscount = minDiscount;
  if (affiliateTag) autoPostConfig.affiliateTag = affiliateTag.trim();

  saveAutoPostConfig(autoPostConfig);
  res.json({ success: true, config: autoPostConfig });
});

app.post('/api/whatsapp/autopost/stop', (req, res) => {
  stopAutoPoster();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Minerador & Automação WhatsApp rodando em http://localhost:${PORT}`);
});

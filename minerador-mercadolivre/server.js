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
    const img = $el.find('img').attr('src') || $el.find('img').attr('data-src');

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

    if (title && price && link && isLegitProduct(title, price)) {
      if (!products.some(p => p.link === link)) {
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
          img: img || 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png',
          link: link.startsWith('http') ? link : `https://www.mercadolivre.com.br${link}`,
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
    const img = $el.find('img').attr('src') || $el.find('img').attr('data-src');
    const rankText = $el.find('.dynamic-carousel__pill-container--text').text().trim();
    
    const priceBlock = $el.find('.dynamic-carousel__price').text().trim();
    const priceMatch = priceBlock.match(/R\$\s*([\d\.]+)(?:,(\d{2}))?/);
    let price = null;
    if (priceMatch) {
      const intP = priceMatch[1].replace(/\./g, '');
      const centP = priceMatch[2] || '00';
      price = parseFloat(`${intP}.${centP}`);
    }

    if (title && price && href && isLegitProduct(title, price)) {
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
          img: img || 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png',
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
const postedProductsHistory = new Set();
let postLogs = [];

let autoPostConfig = {
  targetGroupId: '',
  targetGroupName: '',
  affiliateTag: '',
  delays: [3, 5, 7, 9, 12, 15, 25],
  copyStyle: 'urgencia',
  minDiscount: 20,
};

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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--js-flags=--max-old-space-size=512'
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

    // Proteção em nível de navegador para suprimir erros de memoização/getters em contas LID e mídias
    try {
      if (waClient.pupPage) {
        await waClient.pupPage.evaluate(() => {
          try {
            const lidUtils = window.require('WAWebLidMigrationUtils');
            if (lidUtils && typeof lidUtils.toPn === 'function') {
              const origToPn = lidUtils.toPn;
              lidUtils.toPn = function(wid) {
                try {
                  return origToPn.apply(this, arguments);
                } catch (e) {
                  return wid;
                }
              };
            }
          } catch (e) {}

          try {
            const contactGetters = window.require('WAWebContactGetters');
            if (contactGetters) {
              for (const k of Object.keys(contactGetters)) {
                if (typeof contactGetters[k] === 'function') {
                  const orig = contactGetters[k];
                  contactGetters[k] = function(contact) {
                    if (!contact) return false;
                    try {
                      return orig.apply(this, arguments);
                    } catch (e) {
                      return false;
                    }
                  };
                }
              }
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

// Busca grupos com tentativas e recuperação de frame
async function safeGetGroups() {
  if (!waClient || waStatus !== 'ready') return cachedGroups;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 1. Tenta via getChats() do whatsapp-web.js
      const chats = await waClient.getChats();
      if (chats && Array.isArray(chats)) {
        const groups = chats
          .filter(c => c && (
            c.isGroup === true ||
            (c.id?._serialized && c.id._serialized.endsWith('@g.us')) ||
            (c.id?.server === 'g.us') ||
            (typeof c.id === 'string' && c.id.endsWith('@g.us'))
          ))
          .map(g => ({
            id: g.id?._serialized || (typeof g.id === 'string' ? g.id : (g.id?.user ? g.id.user + '@g.us' : '')),
            name: g.formattedTitle || g.name || g.contact?.name || 'Grupo sem nome',
          }))
          .filter(g => g.id);

        if (groups.length > 0) {
          const map = new Map();
          cachedGroups.forEach(item => map.set(item.id, item));
          groups.forEach(item => map.set(item.id, item));
          cachedGroups = Array.from(map.values());
          return cachedGroups;
        }
      }

      // 2. Fallback direto via Store do Chromium caso getChats() filtre ou não tenha hidratado
      if (waClient.pupPage) {
        const storeGroups = await waClient.pupPage.evaluate(() => {
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
        });

        if (storeGroups && storeGroups.length > 0) {
          const map = new Map();
          cachedGroups.forEach(item => map.set(item.id, item));
          storeGroups.forEach(item => map.set(item.id, item));
          cachedGroups = Array.from(map.values());
          return cachedGroups;
        }
      }

      if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.warn(`[Tentativa ${attempt}/3 obter grupos]:`, err.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
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

// Limpa URL do Mercado Livre removendo parâmetros poluídos
function cleanMercadoLivreUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    return url.split('?')[0];
  }
}

// Encurtador de link via TinyURL (rápido, gratuito e sem cadastro)
async function shortenUrl(longUrl) {
  if (!longUrl) return '';
  try {
    const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, {
      timeout: 5000
    });
    if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
      return res.data.trim();
    }
  } catch (err) {
    console.warn('Aviso: Não foi possível encurtar via TinyURL, usando link limpo:', err.message);
  }
  return longUrl;
}

// Baixa a imagem do produto e prepara como MessageMedia para envio de foto no WhatsApp
async function getProductMedia(imageUrl) {
  if (!imageUrl || imageUrl.includes('logo__large_plus')) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    let contentType = res.headers['content-type'] || 'image/jpeg';
    contentType = contentType.split(';')[0].trim();

    if (contentType.includes('svg') || contentType.includes('html')) {
      return null;
    }

    const base64Data = Buffer.from(res.data).toString('base64');
    return new MessageMedia(contentType, base64Data, 'oferta.jpg');
  } catch (err) {
    console.warn('Aviso: Não foi possível baixar foto do produto para envio:', err.message);
    return null;
  }
}

async function formatAffiliateMessage(product, style, tag) {
  let link = cleanMercadoLivreUrl(product.link);
  if (tag && tag.trim()) {
    if (tag.startsWith('http')) {
      link = tag.trim();
    } else {
      const sep = link.includes('?') ? '&' : '?';
      link = `${link}${sep}matt_tool=${encodeURIComponent(tag.trim())}`;
    }
  }

  // Encurta o link para ficar pequeno e profissional
  link = await shortenUrl(link);

  const shortTitle = product.title.length > 70 ? product.title.substring(0, 67) + '...' : product.title;
  const oldPriceStr = product.oldPriceFormatted ? `~${product.oldPriceFormatted}~` : `~R$ ${(product.price * 1.35).toFixed(2).replace('.', ',')}~`;
  const discountStr = product.discount || 'OFERTA RELÂMPAGO';
  const frete = product.isFreeShipping ? '📦 *Frete Grátis*' : '🚚 *Entrega Rápida ML*';
  const seloFull = product.isFull ? '⚡ *Envio FULL*' : '';

  if (style === 'achadinho') {
    return `✨ *ACHADINHO DO MERCADO LIVRE!* ✨\n\n😍 *${shortTitle}*\n⭐ Avaliação: ${product.rating || '4.8'}★ ${product.salesCount ? `(${product.salesCount})` : ''}\n\n❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (${discountStr}!)\n${frete} ${seloFull}\n\n👇 *Compre antes que acabe o estoque:*\n🔗 ${link}\n\n⚠️ _Valor promocional sujeito a alteração rápida!_`;
  }

  if (style === 'direto') {
    return `🎯 *${discountStr} NO MERCADO LIVRE!* 🎯\n\n🔥 *${shortTitle}*\n\n💰 De: ${oldPriceStr} por *${product.priceFormatted}*\n${frete} ${seloFull}\n\n👉 *Link oficial da promoção:*\n🔗 ${link}`;
  }

  return `🚨 *OFERTA RELÂMPAGO NO MERCADO LIVRE!* 🚨\n\n🔥 *${shortTitle}*\n⭐ ${product.salesCount ? `*${product.salesCount}* • ` : ''}Top Avaliado (${product.rating || '4.8'}★)\n\n❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (*${discountStr}*!)\n${frete} ${seloFull}\n\n👇 *Aproveite a promoção aqui:*\n🔗 ${link}\n\n⚠️ _Estoque limitado, corre antes que o preço suba!_`;
}

// Envia oferta com foto e fallback inteligente para texto formatado caso o WhatsApp Web recuse a mídia
async function sendProductOffer(chatId, message, media) {
  if (!waClient || waStatus !== 'ready') {
    throw new Error('WhatsApp não está pronto ou conectado.');
  }

  // 1. Tenta envio com foto do produto primeiro
  if (media) {
    try {
      console.log(`📸 Tentando enviar oferta com foto para ${chatId}...`);
      await waClient.sendMessage(chatId, media, { caption: message });
      return { success: true, hasImage: true };
    } catch (mediaErr) {
      console.warn(`⚠️ Envio de foto encontrou incompatibilidade interna do WhatsApp Web (${mediaErr.message}).`);
      console.log(`📝 Entregando oferta com formato texto profissional e link curto para garantir o envio...`);
    }
  }

  // 2. Envio do texto formatado (com emojis, desconto e link curto encurtado)
  await waClient.sendMessage(chatId, message);
  return { success: true, hasImage: false };
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

// Disparar uma oferta automática
async function dispatchNextDeal() {
  if (!isAutoPosting || waStatus !== 'ready') return;

  try {
    const targetChat = await resolveTargetChat(autoPostConfig.targetGroupId, autoPostConfig.targetGroupName);
    if (!targetChat) {
      console.warn(`⚠️ Grupo de destino "${autoPostConfig.targetGroupName}" não encontrado. Tentando novamente.`);
      scheduleNextRun();
      return;
    }

    const deals = await scrapeDealsPage('https://www.mercadolivre.com.br/ofertas');
    const candidate = deals.find(d => {
      if (postedProductsHistory.has(d.title)) return false;
      const discountNum = parseInt((d.discount || '').replace(/\D/g, '')) || 0;
      return discountNum >= autoPostConfig.minDiscount;
    });

    if (candidate) {
      const message = await formatAffiliateMessage(candidate, autoPostConfig.copyStyle, autoPostConfig.affiliateTag);
      const media = await getProductMedia(candidate.img);

      const targetId = targetChat.id._serialized || targetChat.id;
      const result = await sendProductOffer(targetId, message, media);

      postedProductsHistory.add(candidate.title);
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
    }
  } catch (err) {
    console.error('Erro ao disparar oferta automática:', err.message);
  }

  scheduleNextRun();
}

function scheduleNextRun() {
  if (!isAutoPosting) return;

  const delays = (autoPostConfig.delays && autoPostConfig.delays.length > 0)
    ? autoPostConfig.delays
    : [3, 5, 7, 9, 12, 15, 25];

  const randomMinutes = delays[Math.floor(Math.random() * delays.length)];
  const delayMs = randomMinutes * 60 * 1000;

  nextPostTimestamp = Date.now() + delayMs;
  console.log(`⏱️ [Auto-Post] Próximo envio agendado para daqui a ${randomMinutes} minutos.`);

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
  res.json({
    status: waStatus,
    qrCode: qrCodeDataUrl,
    isAutoPosting,
    autoPostConfig,
    nextPostTimestamp,
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

    const deals = await scrapeDealsPage('https://www.mercadolivre.com.br/ofertas');
    if (deals.length === 0) {
      return res.status(404).json({ success: false, error: 'Nenhuma oferta encontrada para teste.' });
    }

    const sample = deals[0];
    const message = await formatAffiliateMessage(sample, copyStyle || 'urgencia', affiliateTag);
    const media = await getProductMedia(sample.img);

    const targetId = targetChat.id._serialized || targetChat.id;
    const result = await sendProductOffer(targetId, message, media);

    res.json({
      success: true,
      productTitle: sample.title,
      groupName: targetChat.name,
      hasImage: result.hasImage
    });
  } catch (err) {
    console.error('Erro ao enviar teste:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/autopost/start', (req, res) => {
  const { targetGroupId, targetGroupName, affiliateTag, delays, copyStyle, minDiscount } = req.body;

  if (waStatus !== 'ready') {
    return res.status(400).json({ success: false, error: 'Conecte o WhatsApp primeiro!' });
  }

  if (!targetGroupId && !targetGroupName) {
    return res.status(400).json({ success: false, error: 'Selecione ou digite o nome do grupo!' });
  }

  autoPostConfig = {
    targetGroupId: targetGroupId || '',
    targetGroupName: targetGroupName || '',
    affiliateTag: affiliateTag || '',
    delays: (delays && delays.length) ? delays : [3, 5, 7, 9, 12, 15, 25],
    copyStyle: copyStyle || 'urgencia',
    minDiscount: minDiscount || 20,
  };

  isAutoPosting = true;
  dispatchNextDeal();

  res.json({ success: true, config: autoPostConfig });
});

app.post('/api/whatsapp/autopost/stop', (req, res) => {
  stopAutoPoster();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Minerador & Automação WhatsApp rodando em http://localhost:${PORT}`);
});

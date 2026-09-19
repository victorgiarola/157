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
const { Client, LocalAuth } = pkg;
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

  waClient.on('ready', () => {
    console.log('✅ WhatsApp Web Conectado e Pronto!');
    waStatus = 'ready';
    qrCodeDataUrl = null;
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
      const chats = await waClient.getChats();
      if (chats && Array.isArray(chats)) {
        const groups = chats
          .filter(c => c && c.isGroup)
          .map(g => ({
            id: g.id?._serialized || g.id,
            name: g.name || 'Grupo sem nome',
          }));
        if (groups.length > 0) {
          cachedGroups = groups;
          return groups;
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

function formatAffiliateMessage(product, style, tag) {
  let link = product.link;
  if (tag && tag.trim()) {
    if (tag.startsWith('http')) {
      link = tag.trim();
    } else {
      const sep = link.includes('?') ? '&' : '?';
      link = `${link}${sep}matt_tool=${encodeURIComponent(tag.trim())}`;
    }
  }

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

// Localiza o chat de destino seja por ID ou por Nome aproximado
async function resolveTargetChat(groupId, groupName) {
  if (!waClient || waStatus !== 'ready') return null;

  // 1. Se temos groupId direto (@g.us ou @c.us)
  if (groupId && (groupId.includes('@g.us') || groupId.includes('@c.us'))) {
    try {
      const chat = await waClient.getChatById(groupId);
      if (chat) return chat;
    } catch (e) {
      return {
        name: groupName || groupId,
        sendMessage: (msg) => waClient.sendMessage(groupId, msg)
      };
    }
  }

  // 2. Busca por nome no cache imediato ou lista atualizada
  const cleanTarget = (groupName || groupId || '').trim().toLowerCase();
  if (cleanTarget) {
    const inCache = cachedGroups.find(g => g.name && g.name.toLowerCase().includes(cleanTarget));
    if (inCache) {
      try {
        const chat = await waClient.getChatById(inCache.id);
        if (chat) return chat;
      } catch (e) {
        return {
          name: inCache.name,
          sendMessage: (msg) => waClient.sendMessage(inCache.id, msg)
        };
      }
    }

    try {
      const allGroups = await safeGetGroups();
      const matched = allGroups.find(g => g.name && g.name.toLowerCase().includes(cleanTarget));
      if (matched) {
        try {
          const chat = await waClient.getChatById(matched.id);
          if (chat) return chat;
        } catch (e) {
          return {
            name: matched.name,
            sendMessage: (msg) => waClient.sendMessage(matched.id, msg)
          };
        }
      }
    } catch (err) {
      console.warn('Erro ao resolver grupo por nome:', err.message);
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
      const message = formatAffiliateMessage(candidate, autoPostConfig.copyStyle, autoPostConfig.affiliateTag);
      await targetChat.sendMessage(message);

      postedProductsHistory.add(candidate.title);
      postLogs.unshift({
        id: Date.now(),
        title: candidate.title,
        price: candidate.priceFormatted,
        discount: candidate.discount,
        time: new Date().toLocaleTimeString('pt-BR'),
        status: 'Enviado com Sucesso! ✅'
      });
      if (postLogs.length > 50) postLogs.pop();

      console.log(`🚀 [Auto-Post] Oferta enviada para "${targetChat.name}": ${candidate.title}`);
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
    const message = formatAffiliateMessage(sample, copyStyle || 'urgencia', affiliateTag);
    await targetChat.sendMessage(message);

    res.json({ success: true, productTitle: sample.title, groupName: targetChat.name });
  } catch (err) {
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

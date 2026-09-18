import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Categorias mapeadas dos Mais Vendidos
const CATEGORIES = [
  { id: 'geral', name: '🔥 Geral (Todos os Mais Vendidos)', url: 'https://www.mercadolivre.com.br/mais-vendidos' },
  { id: 'informatica', name: '💻 Informática & Acessórios', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1648' },
  { id: 'celulares', name: '📱 Celulares e Telefones', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1051' },
  { id: 'eletronicos', name: '🎧 Eletrônicos, Áudio e Vídeo', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1000' },
  { id: 'casa', name: '🏠 Casa, Móveis e Decoração', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1574' },
  { id: 'beleza', name: '💄 Beleza e Cuidado Pessoal', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1246' },
  { id: 'ferramentas', name: '🔧 Ferramentas e Construção', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB263532' },
  { id: 'veiculos', name: '🚗 Acessórios para Veículos', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB5726' },
  { id: 'games', name: '🎮 Games e Consoles', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1144' },
  { id: 'esportes', name: '⚽ Esportes e Fitness', url: 'https://www.mercadolivre.com.br/mais-vendidos/MLB1276' },
];

// Cache em memória (5 minutos por categoria)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function scrapeCategory(targetUrl) {
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
    const priceRaw = $el.find('.dynamic-carousel__price').text().trim();
    const rankText = $el.find('.dynamic-carousel__pill-container--text').text().trim();
    const img = $el.find('img').attr('src') || $el.find('img').attr('data-src');

    if (title && priceRaw && href) {
      const rankMatch = rankText.match(/(\d+)º/);
      const rank = rankMatch ? parseInt(rankMatch[1]) : products.length + 1;
      const priceClean = parseFloat(priceRaw.replace(/[^\d,\.]/g, '').replace(/\./g, '').replace(',', '.'));

      if (!products.some(p => p.link === href)) {
        // Cálculo inicial sugerido (40% de custo de fornecedor)
        const suggestedCost = +(priceClean * 0.40).toFixed(2);
        const mlFeePercent = 0.12; // 12% clássico
        const fixedFee = priceClean < 79 ? 6.00 : 0;
        const mlFeeTotal = +(priceClean * mlFeePercent + fixedFee).toFixed(2);
        const estimatedProfit = +(priceClean - suggestedCost - mlFeeTotal).toFixed(2);
        const marginPercent = +((estimatedProfit / priceClean) * 100).toFixed(1);

        products.push({
          id: `mlb-${rank}-${Math.random().toString(36).substring(2, 7)}`,
          rank,
          title,
          price: priceClean,
          priceFormatted: `R$ ${priceClean.toFixed(2).replace('.', ',')}`,
          img: img || 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png',
          link: href.startsWith('http') ? href : `https://www.mercadolivre.com.br${href}`,
          suggestedCost,
          mlFeeTotal,
          estimatedProfit,
          marginPercent,
          fullShipping: title.toLowerCase().includes('full') || href.includes('full'),
        });
      }
    }
  });

  cache.set(targetUrl, { data: products, timestamp: Date.now() });
  return products;
}

// Endpoint de categorias
app.get('/api/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
});

// Endpoint de mineração por categoria
app.get('/api/mine', async (req, res) => {
  const categoryId = req.query.category || 'geral';
  const categoryObj = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];

  try {
    const products = await scrapeCategory(categoryObj.url);
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

// Endpoint de busca de fornecedores (Shopee, AliExpress, Google Shopping)
app.get('/api/supplier-search', (req, res) => {
  const query = req.query.q || '';
  const encoded = encodeURIComponent(query);
  res.json({
    shopee: `https://shopee.com.br/search?keyword=${encoded}`,
    aliexpress: `https://pt.aliexpress.com/w/wholesale-${encoded}.html`,
    googleShopping: `https://www.google.com/search?tbm=shop&q=${encoded}`,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Minerador Mercado Livre API rodando na porta http://localhost:${PORT}`);
});

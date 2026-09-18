import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  TrendingUp,
  DollarSign,
  Package,
  ExternalLink,
  Star,
  Download,
  RefreshCw,
  ShoppingBag,
  Filter,
  CheckCircle2,
  Percent
} from 'lucide-react';

const CATEGORIES = [
  { id: 'geral', name: '🔥 Geral (Mais Vendidos)', icon: '🔥' },
  { id: 'informatica', name: '💻 Informática', icon: '💻' },
  { id: 'celulares', name: '📱 Celulares', icon: '📱' },
  { id: 'eletronicos', name: '🎧 Eletrônicos & Áudio', icon: '🎧' },
  { id: 'casa', name: '🏠 Casa & Decoração', icon: '🏠' },
  { id: 'beleza', name: '💄 Beleza & Cuidado', icon: '💄' },
  { id: 'ferramentas', name: '🔧 Ferramentas', icon: '🔧' },
  { id: 'veiculos', name: '🚗 Acessórios Automotivos', icon: '🚗' },
  { id: 'games', name: '🎮 Games & Consoles', icon: '🎮' },
  { id: 'esportes', name: '⚽ Esportes & Fitness', icon: '⚽' },
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('geral');
  const [searchQuery, setSearchQuery] = useState('');
  const [minMargin, setMinMargin] = useState(0);
  const [customCosts, setCustomCosts] = useState({});
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ml_favorites') || '[]');
    } catch {
      return [];
    }
  });

  // Buscar produtos minerados da API local
  const fetchProducts = async (catId) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/mine?category=${catId}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.warn('Erro ao conectar com API local, usando dados em cache:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(selectedCategory);
  }, [selectedCategory]);

  // Atualizar custo customizado de fornecedor
  const handleCostChange = (id, price, costVal) => {
    const cost = parseFloat(costVal) || 0;
    setCustomCosts(prev => ({ ...prev, [id]: cost }));
  };

  // Favoritar / Desfavoritar
  const toggleFavorite = (id) => {
    const next = favorites.includes(id)
      ? favorites.filter(f => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('ml_favorites', JSON.stringify(next));
  };

  // Produtos filtrados com recálculo em tempo real
  const computedProducts = useMemo(() => {
    return products.map(p => {
      const cost = customCosts[p.id] !== undefined ? customCosts[p.id] : p.suggestedCost;
      const fixedFee = p.price < 79 ? 6.00 : 0;
      const mlFee = +(p.price * 0.12 + fixedFee).toFixed(2);
      const profit = +(p.price - cost - mlFee).toFixed(2);
      const margin = p.price > 0 ? +((profit / p.price) * 100).toFixed(1) : 0;

      return {
        ...p,
        currentCost: cost,
        currentProfit: profit,
        currentMargin: margin,
        isFav: favorites.includes(p.id)
      };
    }).filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMargin = p.currentMargin >= minMargin;
      return matchesSearch && matchesMargin;
    });
  }, [products, searchQuery, minMargin, customCosts, favorites]);

  // Estatísticas do Dashboard
  const stats = useMemo(() => {
    if (!computedProducts.length) return { count: 0, avgPrice: 0, maxProfit: 0, avgMargin: 0 };
    const count = computedProducts.length;
    const avgPrice = (computedProducts.reduce((acc, p) => acc + p.price, 0) / count).toFixed(2);
    const maxProfit = Math.max(...computedProducts.map(p => p.currentProfit)).toFixed(2);
    const avgMargin = (computedProducts.reduce((acc, p) => acc + p.currentMargin, 0) / count).toFixed(1);
    return { count, avgPrice, maxProfit, avgMargin };
  }, [computedProducts]);

  // Exportar para CSV (Excel)
  const exportToCSV = () => {
    if (!computedProducts.length) return;
    const headers = 'Rank,Titulo,Preco_MercadoLivre,Custo_Fornecedor_Sugerido,Taxa_ML_Estimada,Lucro_Liquido,Margem_Percentual,Link_ML\n';
    const rows = computedProducts.map(p => {
      const titleEsc = `"${p.title.replace(/"/g, '""')}"`;
      return `${p.rank},${titleEsc},${p.price},${p.currentCost},${p.mlFeeTotal},${p.currentProfit},${p.currentMargin}%,${p.link}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos_minerados_ml_${selectedCategory}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gerador de busca de fornecedor
  const getSupplierLink = (title) => {
    // Pega as primeiras 4 palavras significativas para busca de atacado
    const cleanWords = title
      .replace(/[^\w\s]/gi, '')
      .split(' ')
      .filter(w => w.length > 2 && !['para', 'com', 'sem', 'pro'].includes(w.toLowerCase()))
      .slice(0, 4)
      .join(' ');
    return `https://shopee.com.br/search?keyword=${encodeURIComponent(cleanWords)}`;
  };

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-badge">ML PRO</div>
          <div>
            <h1 className="brand-title">MINERADOR DE TENDÊNCIAS</h1>
            <span className="brand-subtitle">Mercado Livre Brasil • Análise de Revenda em Tempo Real</span>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-chip live">
            <span className="pulse-dot"></span>
            <span>API Online • 150+ Produtos</span>
          </div>
          <button className="btn-primary" onClick={exportToCSV} title="Exportar dados para Excel/CSV">
            <Download size={15} /> Exportar Planilha
          </button>
        </div>
      </header>

      {/* CONTROLES E CATEGORIAS */}
      <section className="hero-controls">
        <div className="controls-row">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar produtos minerados (ex: fone, smartwatch, suporte, kit)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-toggle-btn" title="Filtrar por margem de lucro mínima">
            <Percent size={16} />
            <span>Margem mín:</span>
            <select
              value={minMargin}
              onChange={(e) => setMinMargin(Number(e.target.value))}
              style={{ background: 'transparent', color: '#fff', border: 'none', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            >
              <option value="0" style={{ background: '#0f172a' }}>Qualquer margem</option>
              <option value="20" style={{ background: '#0f172a' }}>≥ 20%</option>
              <option value="35" style={{ background: '#0f172a' }}>≥ 35% (Alta)</option>
              <option value="50" style={{ background: '#0f172a' }}>≥ 50% (Excelente)</option>
            </select>
          </div>

          <button
            className="filter-toggle-btn"
            onClick={() => fetchProducts(selectedCategory)}
            title="Recarregar dados em tempo real"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        {/* CHIPS DE CATEGORIAS */}
        <div className="categories-bar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* KPI METRICS CARDS */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon"><Package size={22} /></div>
          <div>
            <div className="metric-value">{stats.count}</div>
            <div className="metric-label">Produtos Minerados</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon"><DollarSign size={22} /></div>
          <div>
            <div className="metric-value">R$ {stats.avgPrice}</div>
            <div className="metric-label">Ticket Médio de Venda</div>
          </div>
        </div>

        <div className="metric-card green">
          <div className="metric-icon"><TrendingUp size={22} /></div>
          <div>
            <div className="metric-value">R$ {stats.maxProfit}</div>
            <div className="metric-label">Maior Lucro Estimado</div>
          </div>
        </div>

        <div className="metric-card green">
          <div className="metric-icon"><Percent size={22} /></div>
          <div>
            <div className="metric-value">{stats.avgMargin}%</div>
            <div className="metric-label">Margem Líquida Média</div>
          </div>
        </div>
      </section>

      {/* LISTA DE PRODUTOS */}
      <main className="products-container">
        {loading ? (
          <div className="loading-box">
            <div className="spinner-lg"></div>
            <p>Minerando os produtos mais vendidos no Mercado Livre em tempo real...</p>
          </div>
        ) : computedProducts.length === 0 ? (
          <div className="loading-box">
            <p>Nenhum produto encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="products-grid">
            {computedProducts.map((p) => {
              const marginClass = p.currentMargin >= 35 ? 'high' : p.currentMargin >= 20 ? 'medium' : 'low';
              const marginText = p.currentMargin >= 35 ? 'Alta Margem' : p.currentMargin >= 20 ? 'Boa Margem' : 'Margem Baixa';

              return (
                <div className="product-card" key={p.id}>
                  <div className="card-top">
                    <span className="rank-badge">#{p.rank} MAIS VENDIDO</span>
                    <button
                      className={`fav-btn ${p.isFav ? 'active' : ''}`}
                      onClick={() => toggleFavorite(p.id)}
                      title="Salvar produto nos favoritos"
                    >
                      <Star size={16} fill={p.isFav ? '#f59e0b' : 'none'} />
                    </button>
                    <img src={p.img} alt={p.title} loading="lazy" />
                  </div>

                  <div className="card-body">
                    <h2 className="product-title" title={p.title}>{p.title}</h2>

                    <div className="price-row">
                      <span className="price-label">Preço no Mercado Livre</span>
                      <span className="price-ml">{p.priceFormatted}</span>
                    </div>

                    {/* CALCULADORA INLINE DE MARGEM */}
                    <div className="margin-calc-box">
                      <div className="calc-row">
                        <span style={{ color: 'var(--text-muted)' }}>Custo Fornecedor (R$):</span>
                        <div className="calc-input-wrap">
                          <span>R$</span>
                          <input
                            type="number"
                            step="0.5"
                            value={p.currentCost}
                            onChange={(e) => handleCostChange(p.id, p.price, e.target.value)}
                            title="Digite quanto você paga no fornecedor para recalcular o lucro"
                          />
                        </div>
                      </div>

                      <div className="calc-row" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span>Taxa ML est. (~12%):</span>
                        <span>- R$ {p.mlFeeTotal.toFixed(2)}</span>
                      </div>

                      <div className="profit-highlight">
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Lucro Líquido</div>
                          <div className="profit-amount">R$ {p.currentProfit.toFixed(2)}</div>
                        </div>
                        <span className={`margin-tag ${marginClass}`}>
                          {p.currentMargin}% ({marginText})
                        </span>
                      </div>
                    </div>

                    {/* AÇÕES */}
                    <div className="card-actions">
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-action-ml"
                        title="Ver o anúncio original no Mercado Livre"
                      >
                        <ExternalLink size={13} /> Ver no ML
                      </a>
                      <a
                        href={getSupplierLink(p.title)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-action-supplier"
                        title="Buscar fornecedor deste produto no atacado / Shopee"
                      >
                        <ShoppingBag size={13} /> Fornecedores
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

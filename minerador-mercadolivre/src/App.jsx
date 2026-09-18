import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Zap,
  Tag,
  Share2,
  ExternalLink,
  Copy,
  Check,
  Star,
  Download,
  RefreshCw,
  ShoppingBag,
  Percent,
  MessageCircle,
  Eye,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';

const CATEGORIES = [
  { id: 'ofertas', name: '⚡ OFERTAS RELÂMPAGO (Até 80% OFF)', icon: '⚡' },
  { id: 'geral', name: '🏆 Geral (Mais Vendidos)', icon: '🏆' },
  { id: 'eletronicos', name: '🎧 Eletrônicos & Áudio', icon: '🎧' },
  { id: 'informatica', name: '💻 Informática & PC', icon: '💻' },
  { id: 'celulares', name: '📱 Celulares & Acessórios', icon: '📱' },
  { id: 'casa', name: '🏠 Casa & Cozinha', icon: '🏠' },
  { id: 'beleza', name: '💄 Beleza & Perfumaria', icon: '💄' },
  { id: 'ferramentas', name: '🔧 Ferramentas', icon: '🔧' },
  { id: 'games', name: '🎮 Games & Consoles', icon: '🎮' },
  { id: 'esportes', name: '⚽ Esportes & Fitness', icon: '⚽' },
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ofertas');
  const [searchQuery, setSearchQuery] = useState('');
  const [minDiscount, setMinDiscount] = useState(0); // 0, 30, 50%
  const [maxPrice, setMaxPrice] = useState(1000);
  const [copiedId, setCopiedId] = useState(null);
  const [previewProduct, setPreviewProduct] = useState(null);
  
  // Tag de afiliado ou link base salva
  const [affiliateTag, setAffiliateTag] = useState(() => {
    return localStorage.getItem('ml_affiliate_tag') || '';
  });

  const [copyStyle, setCopyStyle] = useState('urgencia'); // 'urgencia' | 'achadinho' | 'direto'

  // Salvar tag de afiliado
  const handleTagChange = (val) => {
    setAffiliateTag(val);
    localStorage.setItem('ml_affiliate_tag', val);
  };

  // Buscar produtos da API local
  const fetchProducts = async (catId) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/mine?category=${catId}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.warn('Erro ao conectar com API local:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(selectedCategory);
  }, [selectedCategory]);

  // Gerar o link final de afiliado
  const getAffiliateLink = (originalLink) => {
    if (!affiliateTag.trim()) return originalLink;
    // Se a tag for um link encurtador ou código de rastreio
    if (affiliateTag.startsWith('http')) {
      return affiliateTag;
    }
    const separator = originalLink.includes('?') ? '&' : '?';
    return `${originalLink}${separator}matt_tool=${encodeURIComponent(affiliateTag)}`;
  };

  // Gerador da Copy Chamativa para WhatsApp
  const generateWhatsAppCopy = (product, style = copyStyle) => {
    const link = getAffiliateLink(product.link);
    const shortTitle = product.title.length > 70 ? product.title.substring(0, 67) + '...' : product.title;
    const oldPriceStr = product.oldPriceFormatted ? `~${product.oldPriceFormatted}~` : `~R$ ${(product.price * 1.35).toFixed(2).replace('.', ',')}~`;
    const discountStr = product.discount || 'SUPER OFERTA';
    const frete = product.isFreeShipping ? '📦 *Frete Grátis*' : '🚚 *Envio Rápido pelo Mercado Livre*';
    const seloFull = product.isFull ? '⚡ *Entrega FULL*' : '';

    if (style === 'achadinho') {
      return `✨ *ACHADINHO DO MERCADO LIVRE!* ✨\n\n😍 *${shortTitle}*\n⭐ Avaliação: ${product.rating || '4.8'} ⭐ ${product.salesCount ? `(${product.salesCount})` : ''}\n\n❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (${discountStr}!)\n${frete} ${seloFull}\n\n👇 *Compre antes que acabe o estoque:*\n🔗 ${link}\n\n⚠️ _Valor promocional sujeito a alteração rápida!_`;
    }

    if (style === 'direto') {
      return `🎯 *${discountStr} NO MERCADO LIVRE!* 🎯\n\n🔥 *${shortTitle}*\n\n💰 De: ${oldPriceStr} por *${product.priceFormatted}*\n${frete} ${seloFull}\n\n👉 *Link oficial da promoção:*\n🔗 ${link}`;
    }

    // Padrão: Urgência / Relâmpago
    return `🚨 *OFERTA RELÂMPAGO NO MERCADO LIVRE!* 🚨\n\n🔥 *${shortTitle}*\n⭐ ${product.salesCount ? `*${product.salesCount}* • ` : ''}Top Avaliado (${product.rating || '4.8'}★)\n\n❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (*${discountStr}*!)\n${frete} ${seloFull}\n\n👇 *Aproveite a promoção aqui:*\n🔗 ${link}\n\n⚠️ _Estoque limitado, corre antes que o preço suba!_`;
  };

  // Copiar para a área de transferência
  const copyToClipboard = (product) => {
    const text = generateWhatsAppCopy(product);
    navigator.clipboard.writeText(text);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Enviar direto para o WhatsApp Web
  const sendToWhatsApp = (product) => {
    const text = generateWhatsAppCopy(product);
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Filtros aplicados
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = p.price <= maxPrice;
      
      let discountVal = 0;
      if (p.discount && p.discount.includes('%')) {
        discountVal = parseInt(p.discount.replace(/\D/g, '')) || 0;
      }
      const matchesDiscount = discountVal >= minDiscount;

      return matchesSearch && matchesPrice && matchesDiscount;
    });
  }, [products, searchQuery, minDiscount, maxPrice]);

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-badge">AFILIADOS PRO</div>
          <div>
            <h1 className="brand-title">RADAR DE OFERTAS & ACHADINHOS</h1>
            <span className="brand-subtitle">Mercado Livre Brasil • Gerador de Anúncios para Grupos de WhatsApp</span>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-chip live">
            <span className="pulse-dot"></span>
            <span>{filteredProducts.length} Ofertas Reais Disponíveis</span>
          </div>
        </div>
      </header>

      {/* BARRA DE CONFIGURAÇÃO DO AFILIADO */}
      <section style={{ background: '#111827', borderBottom: '1px solid #1f2937', padding: '12px 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>
            <Tag size={18} />
            <span>Sua Tag/Código de Afiliado ML:</span>
          </div>
          <input
            type="text"
            placeholder="Ex: seu-codigo ou cole o seu link encurtado..."
            value={affiliateTag}
            onChange={(e) => handleTagChange(e.target.value)}
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#fff',
              fontSize: 13,
              width: 340,
              outline: 'none'
            }}
          />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            *(Seus links gerados para o WhatsApp já incluirão sua comissão automaticamente).*
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Estilo da Copy:</span>
            <select
              value={copyStyle}
              onChange={(e) => setCopyStyle(e.target.value)}
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 6,
                padding: '6px 10px',
                color: '#ffe600',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <option value="urgencia">🚨 Oferta Relâmpago (Urgência)</option>
              <option value="achadinho">✨ Achadinho (Curiosidade)</option>
              <option value="direto">🎯 Direto ao Ponto (Super Desconto)</option>
            </select>
          </div>
        </div>
      </section>

      {/* CONTROLES E FILTROS */}
      <section className="hero-controls">
        <div className="controls-row">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar ofertas reais (ex: air fryer, fone bluetooth, robô aspirador, teclado)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-toggle-btn" title="Filtrar por desconto mínimo">
            <Percent size={16} />
            <span>Desconto mín:</span>
            <select
              value={minDiscount}
              onChange={(e) => setMinDiscount(Number(e.target.value))}
              style={{ background: 'transparent', color: '#fff', border: 'none', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            >
              <option value="0" style={{ background: '#0f172a' }}>Todos os descontos</option>
              <option value="20" style={{ background: '#0f172a' }}>≥ 20% OFF</option>
              <option value="35" style={{ background: '#0f172a' }}>≥ 35% OFF (Forte)</option>
              <option value="50" style={{ background: '#0f172a' }}>≥ 50% OFF (Metade do Preço!)</option>
            </select>
          </div>

          <div className="filter-toggle-btn" title="Preço Máximo">
            <span>Preço até:</span>
            <select
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              style={{ background: 'transparent', color: '#fff', border: 'none', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            >
              <option value="10000" style={{ background: '#0f172a' }}>Sem limite</option>
              <option value="150" style={{ background: '#0f172a' }}>Até R$ 150 (Ideal p/ Grupos)</option>
              <option value="300" style={{ background: '#0f172a' }}>Até R$ 300</option>
              <option value="800" style={{ background: '#0f172a' }}>Até R$ 800</option>
            </select>
          </div>

          <button
            className="filter-toggle-btn"
            onClick={() => fetchProducts(selectedCategory)}
            title="Recarregar ofertas do Mercado Livre agora"
          >
            <RefreshCw size={16} /> Atualizar Ofertas
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

      {/* GRID DE OFERTAS REAIS */}
      <main className="products-container">
        {loading ? (
          <div className="loading-box">
            <div className="spinner-lg"></div>
            <p>Garimpando as melhores ofertas reais do Mercado Livre em tempo real...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="loading-box">
            <p>Nenhuma oferta encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((p) => {
              const isCopied = copiedId === p.id;

              return (
                <div className="product-card" key={p.id}>
                  <div className="card-top">
                    <span className="rank-badge" style={{ background: '#e11d48', color: '#fff', borderColor: '#f43f5e' }}>
                      {p.discount}
                    </span>
                    {p.isFull && (
                      <span style={{ position: 'absolute', top: 10, right: 10, background: '#ffe600', color: '#000', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                        ⚡ FULL
                      </span>
                    )}
                    <img src={p.img} alt={p.title} loading="lazy" />
                  </div>

                  <div className="card-body">
                    <h2 className="product-title" title={p.title}>{p.title}</h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>⭐ {p.rating || '4.8'}</span>
                      {p.salesCount && <span>• {p.salesCount}</span>}
                      {p.isFreeShipping && <span style={{ color: '#10b981', fontWeight: 600 }}>• Frete Grátis</span>}
                    </div>

                    <div className="price-row">
                      <div>
                        {p.oldPriceFormatted && (
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                            De: {p.oldPriceFormatted}
                          </div>
                        )}
                        <span className="price-ml" style={{ color: '#10b981' }}>{p.priceFormatted}</span>
                      </div>
                      <span style={{ fontSize: 11, background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', padding: '3px 8px', borderRadius: 4, fontWeight: 800 }}>
                        {p.discount}
                      </span>
                    </div>

                    {/* BOTÕES DE AFILIADO PARA WHATSAPP */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => copyToClipboard(p)}
                        style={{
                          background: isCopied ? '#10b981' : '#ffe600',
                          color: isCopied ? '#fff' : '#000',
                          fontWeight: 800,
                          fontSize: 12,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                      >
                        {isCopied ? <Check size={16} /> : <Copy size={16} />}
                        {isCopied ? 'MENSAGEM COPIADA! ✅' : 'COPIAR ANÚNCIO P/ WHATSAPP'}
                      </button>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          onClick={() => sendToWhatsApp(p)}
                          style={{
                            background: '#25D366',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 11,
                            padding: '8px',
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                          }}
                        >
                          <MessageCircle size={14} /> Abrir no Zap
                        </button>

                        <button
                          onClick={() => setPreviewProduct(p)}
                          style={{
                            background: '#1f2937',
                            color: '#9ca3af',
                            fontWeight: 600,
                            fontSize: 11,
                            padding: '8px',
                            borderRadius: 6,
                            border: '1px solid #374151',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                          }}
                        >
                          <Eye size={14} /> Ver Prévia
                        </button>
                      </div>

                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          textAlign: 'center',
                          fontSize: 11,
                          color: '#60a5fa',
                          textDecoration: 'none',
                          paddingTop: 4
                        }}
                      >
                        Ver anúncio no Mercado Livre ↗
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL DE PRÉVIA DO WHATSAPP */}
      {previewProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.8)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#0c1317',
            border: '1px solid #1f2937',
            borderRadius: 14,
            maxWidth: 460,
            width: '100%',
            padding: 20,
            boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#25D366', fontWeight: 800, fontSize: 14 }}>
                <MessageCircle size={18} /> Prévia da Mensagem (WhatsApp)
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* BALÃO DO WHATSAPP */}
            <div style={{
              background: '#005c4b',
              color: '#e9edef',
              padding: 14,
              borderRadius: '8px 8px 0px 8px',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              marginBottom: 16
            }}>
              {generateWhatsAppCopy(previewProduct)}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  copyToClipboard(previewProduct);
                  setPreviewProduct(null);
                }}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Copy size={16} /> Copiar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

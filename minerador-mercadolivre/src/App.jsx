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
  Bot,
  Play,
  Pause,
  QrCode,
  Clock,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle
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
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'automacao'
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ofertas');
  const [searchQuery, setSearchQuery] = useState('');
  const [minDiscount, setMinDiscount] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [copiedId, setCopiedId] = useState(null);
  const [previewProduct, setPreviewProduct] = useState(null);
  
  // Tag de afiliado
  const [affiliateTag, setAffiliateTag] = useState(() => {
    return localStorage.getItem('ml_affiliate_tag') || '';
  });
  const [copyStyle, setCopyStyle] = useState('urgencia');

  // Estado da Automação WhatsApp
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [isAutoPosting, setIsAutoPosting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [delaysInput, setDelaysInput] = useState('3, 5, 7, 9, 12, 15, 25');
  const [minAutoDiscount, setMinAutoDiscount] = useState(25);
  const [nextPostTimestamp, setNextPostTimestamp] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [postLogs, setPostLogs] = useState([]);

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

  // Buscar status do WhatsApp
  const checkWaStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/status');
      const data = await res.json();
      setWaStatus(data.status);
      setQrCode(data.qrCode);
      setIsAutoPosting(data.isAutoPosting);
      setNextPostTimestamp(data.nextPostTimestamp);
      setPostLogs(data.logs || []);

      if (data.status === 'ready' && groups.length === 0) {
        fetchGroups();
      }
    } catch (err) {
      // Servidor ainda iniciando
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/groups');
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
        if (data.groups.length > 0 && !selectedGroup) {
          setSelectedGroup(data.groups[0].id);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar grupos:', err);
    }
  };

  const connectWhatsApp = async () => {
    try {
      setWaStatus('authenticating');
      await fetch('http://localhost:3001/api/whatsapp/connect', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const startAutoPoster = async () => {
    if (!selectedGroup) {
      alert('Por favor, selecione o grupo de WhatsApp de destino!');
      return;
    }

    const delays = delaysInput.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x) && x > 0);
    const grp = groups.find(g => g.id === selectedGroup);

    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/autopost/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGroupId: selectedGroup,
          targetGroupName: grp ? grp.name : 'Grupo de Ofertas',
          affiliateTag,
          delays,
          copyStyle,
          minDiscount: minAutoDiscount,
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsAutoPosting(true);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Erro ao iniciar automação.');
    }
  };

  const stopAutoPoster = async () => {
    try {
      await fetch('http://localhost:3001/api/whatsapp/autopost/stop', { method: 'POST' });
      setIsAutoPosting(false);
      setNextPostTimestamp(null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts(selectedCategory);
    checkWaStatus();
    const interval = setInterval(checkWaStatus, 3000);
    return () => clearInterval(interval);
  }, [selectedCategory]);

  // Contagem regressiva para o próximo post
  useEffect(() => {
    if (!nextPostTimestamp || !isAutoPosting) {
      setCountdown('');
      return;
    }

    const timer = setInterval(() => {
      const diff = nextPostTimestamp - Date.now();
      if (diff <= 0) {
        setCountdown('Disparando agora... 🚀');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextPostTimestamp, isAutoPosting]);

  const getAffiliateLink = (originalLink) => {
    if (!affiliateTag.trim()) return originalLink;
    if (affiliateTag.startsWith('http')) return affiliateTag;
    const separator = originalLink.includes('?') ? '&' : '?';
    return `${originalLink}${separator}matt_tool=${encodeURIComponent(affiliateTag)}`;
  };

  const generateWhatsAppCopy = (product, style = copyStyle) => {
    const link = getAffiliateLink(product.link);
    const shortTitle = product.title.length > 70 ? product.title.substring(0, 67) + '...' : product.title;
    const oldPriceStr = product.oldPriceFormatted ? `~${product.oldPriceFormatted}~` : `~R$ ${(product.price * 1.35).toFixed(2).replace('.', ',')}~`;
    const discountStr = product.discount || 'SUPER OFERTA';
    const frete = product.isFreeShipping ? '📦 *Frete Grátis*' : '🚚 *Envio Rápido pelo Mercado Livre*';
    const seloFull = product.isFull ? '⚡ *Entrega FULL*' : '';

    if (style === 'achadinho') {
      return `✨ *ACHADINHO DO MERCADO LIVRE!* ✨\n\n😍 *${shortTitle}*\n⭐ Avaliação: ${product.rating || '4.8'}★ ${product.salesCount ? `(${product.salesCount})` : ''}\n\n❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (${discountStr}!)\n${frete} ${seloFull}\n\n👇 *Compre antes que acabe o estoque:*\n🔗 ${link}\n\n⚠️ _Valor promocional sujeito a alteração rápida!_`;
    }

    if (style === 'direto') {
      return `🎯 *${discountStr} NO MERCADO LIVRE!* 🎯\n\n🔥 *${shortTitle}*\n\n💰 De: ${oldPriceStr} por *${product.priceFormatted}*\n${frete} ${seloFull}\n\n👉 *Link oficial da promoção:*\n🔗 ${link}`;
    }

    return `🚨 *OFERTA RELÂMPAGO NO MERCADO LIVRE!* 🚨\n\n🔥 *${shortTitle}*\n⭐ ${product.salesCount ? `*${product.salesCount}* • ` : ''}Top Avaliado (${product.rating || '4.8'}★)\n\n❌ De: ${oldPriceStr}\n✅ Por apenas: *${product.priceFormatted}* (*${discountStr}*!)\n${frete} ${seloFull}\n\n👇 *Aproveite a promoção aqui:*\n🔗 ${link}\n\n⚠️ _Estoque limitado, corre antes que o preço suba!_`;
  };

  const copyToClipboard = (product) => {
    const text = generateWhatsAppCopy(product);
    navigator.clipboard.writeText(text);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = p.price <= maxPrice;
      let discountVal = 0;
      if (p.discount && p.discount.includes('%')) {
        discountVal = parseInt(p.discount.replace(/\D/g, '')) || 0;
      }
      return matchesSearch && matchesPrice && discountVal >= minDiscount;
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
            <span className="brand-subtitle">Mercado Livre Brasil • Automação com Delays Humanizados</span>
          </div>
        </div>

        {/* ABAS SUPERIORES */}
        <div style={{ display: 'flex', gap: 8, background: '#1f2937', padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setActiveTab('radar')}
            style={{
              background: activeTab === 'radar' ? '#ffe600' : 'transparent',
              color: activeTab === 'radar' ? '#000' : '#9ca3af',
              fontWeight: 800,
              fontSize: 13,
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Zap size={16} /> Radar de Ofertas
          </button>

          <button
            onClick={() => setActiveTab('automacao')}
            style={{
              background: activeTab === 'automacao' ? '#25D366' : 'transparent',
              color: activeTab === 'automacao' ? '#fff' : '#9ca3af',
              fontWeight: 800,
              fontSize: 13,
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Bot size={16} /> Robô WhatsApp {isAutoPosting && '🟢 Ativo'}
          </button>
        </div>

        <div className="header-stats">
          <div className="stat-chip live">
            <span className="pulse-dot"></span>
            <span>{isAutoPosting ? 'Automação Rodando' : 'Painel Pronto'}</span>
          </div>
        </div>
      </header>

      {/* ABA 1: RADAR DE OFERTAS */}
      {activeTab === 'radar' && (
        <>
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
                  width: 320,
                  outline: 'none'
                }}
              />

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Estilo da Mensagem:</span>
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
                  <option value="direto">🎯 Direto ao Ponto (Desconto Puro)</option>
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

                        {/* BOTÕES DE AFILIADO */}
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
                              onClick={() => {
                                const text = generateWhatsAppCopy(p);
                                window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                              }}
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
        </>
      )}

      {/* ABA 2: ROBÔ DE AUTOMAÇÃO WHATSAPP */}
      {activeTab === 'automacao' && (
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '30px 24px', width: '100%' }}>
          
          {/* HEADER DA AUTOMAÇÃO */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bot size={28} color="#25D366" /> Robô Disparador de Ofertas (WhatsApp)
                </h2>
                <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
                  Postagem 100% automática no seu grupo com <strong>delays aleatórios anti-ban</strong> (3, 5, 7, 9, 12, 15, 25 min) e links de afiliado.
                </p>
              </div>

              {/* STATUS DE CONEXÃO */}
              <div>
                {waStatus === 'ready' ? (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '8px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="pulse-dot"></span> WhatsApp Conectado & Pronto
                  </div>
                ) : waStatus === 'qr_ready' ? (
                  <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', padding: '8px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QrCode size={16} /> Escaneie o QR Code Abaixo
                  </div>
                ) : waStatus === 'authenticating' ? (
                  <div style={{ color: '#9ca3af', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="spinner-lg" style={{ width: 16, height: 16, borderWidth: 2 }}></div> Inicializando WhatsApp...
                  </div>
                ) : (
                  <button
                    onClick={connectWhatsApp}
                    style={{
                      background: '#25D366',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 13,
                      padding: '10px 18px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)'
                    }}
                  >
                    <QrCode size={18} /> Conectar WhatsApp (Gerar QR Code)
                  </button>
                )}
              </div>
            </div>

            {/* SE ESTIVER NO QR CODE */}
            {waStatus === 'qr_ready' && qrCode && (
              <div style={{ marginTop: 24, background: '#0c1317', border: '1px solid #25D366', borderRadius: 12, padding: 24, display: 'flex', alignItems: 'center', gap: 30, flexWrap: 'wrap' }}>
                <img src={qrCode} alt="WhatsApp QR Code" style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
                <div>
                  <h3 style={{ fontSize: 18, color: '#25D366', fontWeight: 800, marginBottom: 8 }}>Escaneie com seu celular:</h3>
                  <ol style={{ color: '#e5e7eb', fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
                    <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                    <li>Toque em <strong>Mais opções (três pontinhos)</strong> ou <strong>Configurações</strong></li>
                    <li>Selecione <strong>Aparelhos conectados</strong> e depois <strong>Conectar um aparelho</strong></li>
                    <li>Aponte a câmera para o QR Code ao lado</li>
                  </ol>
                  <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 12 }}>
                    *(A conexão é salva no seu computador, você só precisa escanear uma vez).*
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PAINEL DE CONTROLE DE POSTAGEM */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
            
            {/* CONFIGURAÇÃO DOS DISPAROS */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffe600', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Sliders size={18} /> Configurações de Postagem
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                    Grupo de WhatsApp de Destino:
                  </label>
                  {groups.length > 0 ? (
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: 8, padding: '10px 12px', fontWeight: 700, fontSize: 13, outline: 'none' }}
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: 12, background: '#1f2937', padding: '10px', borderRadius: 6 }}>
                      {waStatus === 'ready' ? 'Buscando grupos...' : 'Conecte o WhatsApp para listar seus grupos.'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                    Intervalos Aleatórios entre Envios (Minutos):
                  </label>
                  <input
                    type="text"
                    value={delaysInput}
                    onChange={(e) => setDelaysInput(e.target.value)}
                    placeholder="3, 5, 7, 9, 12, 15, 25"
                    style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', color: '#ffe600', borderRadius: 8, padding: '10px 12px', fontWeight: 700, fontSize: 13, outline: 'none' }}
                  />
                  <span style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'block' }}>
                    O robô sorteará um desses tempos a cada post para parecer um envio 100% humano.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                      Desconto Mínimo:
                    </label>
                    <select
                      value={minAutoDiscount}
                      onChange={(e) => setMinAutoDiscount(Number(e.target.value))}
                      style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: 8, padding: '8px 10px', fontWeight: 700, fontSize: 12, outline: 'none' }}
                    >
                      <option value="20">≥ 20% OFF</option>
                      <option value="30">≥ 30% OFF</option>
                      <option value="40">≥ 40% OFF</option>
                      <option value="50">≥ 50% OFF (Metade do Preço)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                      Estilo da Copy:
                    </label>
                    <select
                      value={copyStyle}
                      onChange={(e) => setCopyStyle(e.target.value)}
                      style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: 8, padding: '8px 10px', fontWeight: 700, fontSize: 12, outline: 'none' }}
                    >
                      <option value="urgencia">🚨 Urgência</option>
                      <option value="achadinho">✨ Achadinho</option>
                      <option value="direto">🎯 Direto</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* STATUS E CONTROLE EM TEMPO REAL */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Radio size={18} /> Central de Controle do Robô
                </h3>

                <div style={{ background: '#1f2937', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Status do Robô:</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: isAutoPosting ? '#10b981' : '#f43f5e' }}>
                      {isAutoPosting ? '🟢 ATIVO (Postando no grupo)' : '🔴 PAUSADO'}
                    </span>
                  </div>

                  {isAutoPosting && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #374151' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Próximo disparo em:</span>
                      <span style={{ fontWeight: 900, fontSize: 20, color: '#ffe600', fontFamily: 'monospace' }}>
                        {countdown || 'Calculando...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTÕES DE PLAY / STOP */}
              <div style={{ display: 'flex', gap: 10 }}>
                {!isAutoPosting ? (
                  <button
                    onClick={startAutoPoster}
                    disabled={waStatus !== 'ready'}
                    style={{
                      flex: 1,
                      background: waStatus === 'ready' ? '#10b981' : '#374151',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 14,
                      padding: '14px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: waStatus === 'ready' ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: waStatus === 'ready' ? '0 4px 16px rgba(16, 185, 129, 0.4)' : 'none'
                    }}
                  >
                    <Play size={18} fill="#fff" /> INICIAR AUTOMAÇÃO NO GRUPO
                  </button>
                ) : (
                  <button
                    onClick={stopAutoPoster}
                    style={{
                      flex: 1,
                      background: '#f43f5e',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 14,
                      padding: '14px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(244, 63, 94, 0.4)'
                    }}
                  >
                    <Pause size={18} fill="#fff" /> PAUSAR AUTOMAÇÃO
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* HISTÓRICO DE DISPAROS AO VIVO */}
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={18} color="#60a5fa" /> Histórico de Mensagens Enviadas no Grupo
            </h3>

            {postLogs.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                Nenhuma oferta enviada ainda. Assim que você iniciar a automação, os envios aparecerão aqui em tempo real!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {postLogs.map(log => (
                  <div key={log.id} style={{ background: '#1f2937', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{log.title}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{log.price} • {log.discount}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ffe600' }}>{log.time}</div>
                      <div style={{ fontSize: 10, color: '#10b981' }}>{log.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      )}

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

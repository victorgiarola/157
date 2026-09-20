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
  Send,
  HelpCircle,
  Moon,
  Sun,
  ShieldCheck
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
  const [activeTab, setActiveTab] = useState('radar');
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
    return localStorage.getItem('ml_affiliate_tag') || 'givi713407';
  });
  const [copyStyle, setCopyStyle] = useState('urgencia');

  // Estado da Automação WhatsApp
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [isAutoPosting, setIsAutoPosting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [manualGroupName, setManualGroupName] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [delaysInput, setDelaysInput] = useState('3, 5, 7, 9, 12, 15, 25');
  const [minAutoDiscount, setMinAutoDiscount] = useState(25);
  const [nextPostTimestamp, setNextPostTimestamp] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [postLogs, setPostLogs] = useState([]);
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);
  const [searchingGroup, setSearchingGroup] = useState(false);
  const [groupFeedback, setGroupFeedback] = useState(null);

  // Repouso Noturno e Blindagem Anti-Bot
  const [isNightSleep, setIsNightSleep] = useState(false);
  const [nextWakeFormatted, setNextWakeFormatted] = useState('07:30');
  const [nightPauseEnabled, setNightPauseEnabled] = useState(true);
  const [nightStart, setNightStart] = useState('07:30');
  const [nightEnd, setNightEnd] = useState('21:30');

  const handleTagChange = (val) => {
    setAffiliateTag(val);
    localStorage.setItem('ml_affiliate_tag', val);
  };

  const handleFindGroup = async () => {
    const query = manualGroupName.trim();
    if (!query) {
      alert('Digite o nome do grupo ou cole o link de convite (ex: https://chat.whatsapp.com/...)');
      return;
    }

    setSearchingGroup(true);
    setGroupFeedback(null);
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/find-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.success && data.group) {
        setSelectedGroup(data.group.id);
        setManualGroupName(data.group.name);
        setGroups(prev => {
          if (prev.some(g => g.id === data.group.id)) return prev;
          return [data.group, ...prev];
        });
        setGroupFeedback({ type: 'success', text: `✅ Grupo "${data.group.name}" localizado e selecionado com sucesso!` });
      } else {
        setGroupFeedback({ type: 'error', text: data.error || 'Grupo não encontrado.' });
      }
    } catch (err) {
      setGroupFeedback({ type: 'error', text: 'Erro ao conectar ao servidor para localizar grupo.' });
    } finally {
      setSearchingGroup(false);
    }
  };

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

  const checkWaStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/status');
      const data = await res.json();
      setWaStatus(data.status);
      setQrCode(data.qrCode);
      setIsAutoPosting(data.isAutoPosting);
      setNextPostTimestamp(data.nextPostTimestamp);
      setPostLogs(data.logs || []);
      setIsNightSleep(data.isNightSleep || false);
      if (data.nextWakeFormatted) {
        setNextWakeFormatted(data.nextWakeFormatted);
      }

      if (data.autoPostConfig?.operatingHours) {
        if (data.autoPostConfig.operatingHours.enabled !== undefined) {
          setNightPauseEnabled(data.autoPostConfig.operatingHours.enabled);
        }
        if (data.autoPostConfig.operatingHours.start) {
          setNightStart(data.autoPostConfig.operatingHours.start);
        }
        if (data.autoPostConfig.operatingHours.end) {
          setNightEnd(data.autoPostConfig.operatingHours.end);
        }
      }

      if (data.status === 'ready' && groups.length === 0 && !loadingGroups) {
        fetchGroups();
      }
    } catch (err) {
      // Servidor iniciando
    }
  };

  const updateOperatingHoursConfig = async (enabled, start, end) => {
    try {
      await fetch('http://localhost:3001/api/whatsapp/autopost/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatingHours: { enabled, start, end }
        })
      });
    } catch (e) {}
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/groups');
      const data = await res.json();
      if (data.success && data.groups) {
        setGroups(data.groups);
        if (data.groups.length > 0 && !selectedGroup) {
          setSelectedGroup(data.groups[0].id);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar grupos:', err);
    } finally {
      setLoadingGroups(false);
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

  // Enviar teste imediato
  const sendTestMessage = async () => {
    const targetId = selectedGroup;
    const targetName = manualGroupName.trim();

    if (!targetId && !targetName) {
      alert('Selecione um grupo ou digite o nome do grupo para enviar o teste!');
      return;
    }

    setTestSending(true);
    setTestFeedback(null);
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGroupId: targetId,
          targetGroupName: targetName,
          affiliateTag,
          copyStyle,
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.hasImage) {
          setTestFeedback(`✅ Oferta de teste enviada com FOTO e link curto com sucesso para o grupo "${data.groupName}"! 📸🔗`);
        } else {
          setTestFeedback(`✅ Oferta de teste enviada como TEXTO formatado e link curto com sucesso para o grupo "${data.groupName}"! 📝🔗`);
        }
      } else {
        setTestFeedback(`❌ Erro: ${data.error}`);
      }
    } catch (err) {
      setTestFeedback('❌ Erro ao enviar mensagem de teste.');
    } finally {
      setTestSending(false);
    }
  };

  const startAutoPoster = async () => {
    const targetId = selectedGroup;
    const targetName = manualGroupName.trim();

    if (!targetId && !targetName) {
      alert('Por favor, selecione ou digite o nome do grupo do WhatsApp de destino!');
      return;
    }

    const delays = delaysInput.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x) && x > 0);
    const grp = groups.find(g => g.id === targetId);

    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/autopost/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGroupId: targetId,
          targetGroupName: targetName || (grp ? grp.name : ''),
          affiliateTag,
          delays,
          copyStyle,
          minDiscount: minAutoDiscount,
          operatingHours: {
            enabled: nightPauseEnabled,
            start: nightStart,
            end: nightEnd,
          },
          antiBot: {
            enabled: true,
            typingSimulation: true,
            jitterSeconds: true,
            spintax: true,
          }
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
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        if (hours > 0) {
          setCountdown(`${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
        } else {
          setCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextPostTimestamp, isAutoPosting]);

  const cleanMercadoLivreUrl = (url) => {
    if (!url) return '';
    try {
      const u = new URL(url);
      const pMatch = u.pathname.match(/\/p\/(MLB\d+)/i);
      if (pMatch) return `https://www.mercadolivre.com.br/p/${pMatch[1].toUpperCase()}`;
      const mlbMatch = u.pathname.match(/(MLB-?\d+)/i);
      if (mlbMatch) return `https://produto.mercadolivre.com.br/${mlbMatch[1].toUpperCase()}`;
      return `${u.origin}${u.pathname}`;
    } catch (e) {
      return url.split('?')[0];
    }
  };

  const getAffiliateLink = (originalLink) => {
    const clean = cleanMercadoLivreUrl(originalLink);
    const tag = (affiliateTag && affiliateTag.trim()) ? affiliateTag.trim() : 'givi713407';
    if (tag.startsWith('http')) return tag;
    const separator = clean.includes('?') ? '&' : '?';
    return `${clean}${separator}matt_tool=${encodeURIComponent(tag)}`;
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
            <span>{isAutoPosting ? 'Automação Ativa' : 'Painel Pronto'}</span>
          </div>
        </div>
      </header>

      {/* ABA 1: RADAR DE OFERTAS */}
      {activeTab === 'radar' && (
        <>
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
          
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bot size={28} color="#25D366" /> Robô Disparador de Ofertas (WhatsApp)
                </h2>
                <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
                  Postagem 100% automática no seu grupo com <strong>delays aleatórios anti-ban</strong> (3, 5, 7, 9, 12, 15, 25 min).
                </p>
              </div>

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
                  <div style={{ color: '#ffe600', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255, 230, 0, 0.1)', padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255, 230, 0, 0.3)', fontWeight: 600 }}>
                    <div className="spinner-lg" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                    <span>Conectando e sincronizando...</span>
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
                    *(A sessão fica salva no seu computador, você só precisa escanear uma vez).*
                  </p>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
            
            {/* CONFIGURAÇÃO DO GRUPO */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffe600', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sliders size={18} /> Grupo de Destino
                </h3>
                {waStatus === 'ready' && (
                  <button
                    onClick={fetchGroups}
                    disabled={loadingGroups}
                    style={{ background: 'transparent', border: '1px solid #374151', color: '#9ca3af', fontSize: 11, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <RefreshCw size={12} className={loadingGroups ? 'spin' : ''} />
                    {loadingGroups ? 'Buscando...' : 'Atualizar Lista'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* SELETOR DE GRUPOS */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                    1. Selecione o grupo detectado {groups.length > 0 ? `(${groups.length} grupos encontrados)` : ''}:
                  </label>
                  {groups.length > 0 ? (
                    <select
                      value={selectedGroup}
                      onChange={(e) => {
                        setSelectedGroup(e.target.value);
                        const found = groups.find(g => g.id === e.target.value);
                        if (found) setManualGroupName(found.name);
                      }}
                      style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: 8, padding: '10px 12px', fontWeight: 700, fontSize: 13, outline: 'none' }}
                    >
                      <option value="">-- Selecione o grupo ({groups.length} disponíveis) --</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ color: loadingGroups ? '#ffe600' : '#9ca3af', fontSize: 12, background: '#1f2937', padding: '12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {loadingGroups ? (
                        <>
                          <div className="spinner-lg" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                          <span>Sincronizando conversas com seu celular... aguarde 5 a 10s.</span>
                        </>
                      ) : waStatus === 'ready' ? (
                        <span>Carregando grupos... Se demorar, clique em <strong>Atualizar Lista</strong> acima ou digite o nome no campo 2 abaixo! ⬇️</span>
                      ) : (
                        <span>Conecte o WhatsApp escaneando o QR Code para listar seus grupos.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* DIGITAÇÃO MANUAL DO NOME OU LINK DO GRUPO */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                    2. Ou digite o nome / cole o Link de Convite do grupo:
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={manualGroupName}
                      onChange={(e) => {
                        setManualGroupName(e.target.value);
                        setGroupFeedback(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFindGroup();
                      }}
                      placeholder="Nome do grupo OU link https://chat.whatsapp.com/..."
                      style={{ flex: 1, background: '#1f2937', border: '1px solid #374151', color: '#60a5fa', borderRadius: 8, padding: '10px 12px', fontWeight: 700, fontSize: 13, outline: 'none' }}
                    />
                    <button
                      onClick={handleFindGroup}
                      disabled={searchingGroup || waStatus !== 'ready'}
                      style={{
                        background: waStatus === 'ready' ? '#3b82f6' : '#374151',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '0 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: waStatus === 'ready' ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Search size={14} className={searchingGroup ? 'spin' : ''} />
                      {searchingGroup ? 'Buscando...' : 'Localizar'}
                    </button>
                  </div>

                  {groupFeedback && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: groupFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: groupFeedback.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444',
                      color: groupFeedback.type === 'success' ? '#10b981' : '#f87171'
                    }}>
                      {groupFeedback.text}
                    </div>
                  )}

                  <div style={{ background: '#1f2937', border: '1px dashed #374151', borderRadius: 6, padding: '8px 10px', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af', display: 'block', lineHeight: 1.4 }}>
                      💡 <strong>DICA IMPORTANTE:</strong> Se você criou o grupo recentemente no seu celular e ele ainda está sem membros/sem mensagens, o WhatsApp Web ainda não o sincronizou. <strong>Envie qualquer mensagem nele pelo celular (ex: "oi")</strong> para ele subir no topo, ou <strong>cole aqui o Link de Convite do grupo</strong> e clique em <em>Localizar</em>!
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                    Intervalos entre Envios (Minutos):
                  </label>
                  <input
                    type="text"
                    value={delaysInput}
                    onChange={(e) => setDelaysInput(e.target.value)}
                    placeholder="3, 5, 7, 9, 12, 15, 25"
                    style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', color: '#ffe600', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 13, outline: 'none' }}
                  />
                </div>

                {/* HORÁRIO DE FUNCIONAMENTO (PAUSA NOTURNA) */}
                <div style={{ background: '#1f2937', borderRadius: 10, padding: 14, border: '1px solid #374151' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Moon size={15} color="#a78bfa" /> Pausa Noturna Automática
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: nightPauseEnabled ? '#10b981' : '#9ca3af' }}>
                      <input
                        type="checkbox"
                        checked={nightPauseEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setNightPauseEnabled(val);
                          updateOperatingHoursConfig(val, nightStart, nightEnd);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <strong>{nightPauseEnabled ? 'Ativada' : 'Desativada'}</strong>
                    </label>
                  </div>

                  {nightPauseEnabled ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                            🌙 Pausar à noite:
                          </label>
                          <input
                            type="time"
                            value={nightEnd}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNightEnd(val);
                              updateOperatingHoursConfig(nightPauseEnabled, nightStart, val);
                            }}
                            style={{ width: '100%', background: '#111827', border: '1px solid #4b5563', color: '#ffe600', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                            ☀️ Retomar pela manhã:
                          </label>
                          <input
                            type="time"
                            value={nightStart}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNightStart(val);
                              updateOperatingHoursConfig(nightPauseEnabled, val, nightEnd);
                            }}
                            style={{ width: '100%', background: '#111827', border: '1px solid #4b5563', color: '#ffe600', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: '#9ca3af', display: 'block', lineHeight: 1.3 }}>
                        💤 O robô suspende envios às <strong>{nightEnd}</strong> e volta a postar sozinho às <strong>{nightStart}</strong> sem incomodar o grupo na madrugada.
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: '#f59e0b', display: 'block' }}>
                      ⚠️ O robô funcionará 24h sem interrupção.
                    </span>
                  )}
                </div>

                {/* BOTÃO DE ENVIAR TESTE */}
                <div style={{ paddingTop: 8, borderTop: '1px dashed #374151' }}>
                  <button
                    onClick={sendTestMessage}
                    disabled={testSending || waStatus !== 'ready'}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #3b82f6',
                      color: '#60a5fa',
                      padding: '10px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: waStatus === 'ready' ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Send size={14} />
                    {testSending ? 'Enviando teste...' : '📲 Enviar 1 Oferta de Teste Agora'}
                  </button>

                  {testFeedback && (
                    <div style={{ marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 6, background: testFeedback.includes('✅') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: testFeedback.includes('✅') ? '#6ee7b7' : '#fca5a5' }}>
                      {testFeedback}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STATUS E CONTROLE EM TEMPO REAL */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Radio size={18} /> Central de Controle do Robô
                </h3>

                {/* BLINDAGEM ANTI-BOT */}
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <ShieldCheck size={16} /> Blindagem Anti-Bot & Humanização Ativa
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ fontSize: 11, color: '#d1fae5', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} color="#10b981" /> "Digitando..." real (3 a 6s)
                    </div>
                    <div style={{ fontSize: 11, color: '#d1fae5', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} color="#10b981" /> Spintax (textos únicos)
                    </div>
                    <div style={{ fontSize: 11, color: '#d1fae5', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} color="#10b981" /> Jitter orgânico de segundos
                    </div>
                    <div style={{ fontSize: 11, color: '#d1fae5', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} color="#10b981" /> Leitura prévia (sendSeen)
                    </div>
                  </div>
                </div>

                <div style={{ background: '#1f2937', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Status do Robô:</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: isAutoPosting ? (isNightSleep ? '#a78bfa' : '#10b981') : '#f43f5e' }}>
                      {isAutoPosting ? (isNightSleep ? `🌙 REPOUSO NOTURNO (Dormindo até ${nextWakeFormatted})` : '🟢 ATIVO (Postando no grupo)') : '🔴 PAUSADO'}
                    </span>
                  </div>

                  {isAutoPosting && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #374151' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                        {isNightSleep ? 'Despertando em:' : 'Próximo disparo em:'}
                      </span>
                      <span style={{ fontWeight: 900, fontSize: 20, color: isNightSleep ? '#a78bfa' : '#ffe600', fontFamily: 'monospace' }}>
                        {countdown || 'Calculando...'}
                      </span>
                    </div>
                  )}

                  {isAutoPosting && isNightSleep && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid #6366f1', borderRadius: 8, padding: '10px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Moon size={20} color="#818cf8" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e7ff' }}>Modo Repouso Noturno Ativo 💤</div>
                        <div style={{ fontSize: 11, color: '#c7d2fe', marginTop: 2 }}>
                          Disparos suspensos para respeitar a noite do grupo ({nightEnd} às {nightStart}). O bot acorda e volta a postar automaticamente às <strong>{nextWakeFormatted}</strong>.
                        </div>
                      </div>
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
                Nenhuma oferta enviada ainda. Assim que você iniciar a automação ou disparar um teste, os envios aparecerão aqui em tempo real!
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

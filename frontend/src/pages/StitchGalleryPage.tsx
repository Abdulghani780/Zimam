/**
 * ASAAS Server Control v2 - Google Stitch Sovereign Design Gallery.
 * Interactive showcase and browser for all 20 Stitch UI screens.
 */

import { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, Eye, Monitor, X } from 'lucide-react';

interface StitchScreen {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  folder: string;
  has_html: boolean;
  has_preview: boolean;
  html_url: string;
  preview_url: string;
}

export function StitchGalleryPage() {
  const [screens, setScreens] = useState<StitchScreen[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [selectedScreen, setSelectedScreen] = useState<StitchScreen | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stitch/screens')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.screens)) {
          setScreens(data.screens);
          if (data.screens.length > 0) {
            setSelectedScreen(data.screens[0]);
          }
        }
      })
      .catch((err) => console.error('Failed to load Stitch screens:', err));
  }, []);

  const categories = ['الكل', ...Array.from(new Set(screens.map((s) => s.category)))];

  const filteredScreens =
    activeCategory === 'الكل'
      ? screens
      : screens.filter((s) => s.category === activeCategory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 48 }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-ground) 100%)',
          border: '1px solid var(--gold-rim)',
          borderRadius: 16,
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 12px 32px var(--shadow-soft)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--accent-soft)',
                color: 'var(--gold-glow)',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Sparkles size={14} />
              معرض تصاميم Google Stitch السيادية (v2.5)
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              إجمالي {screens.length} شاشة وتصميم فائق الدقة
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-titles)' }}>
            منظومة واجهات وتصاميم ASAAS Server Control & Bastion
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-body)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
            تصاميم معتمدة بالكامل على نمط الفخامة السيبرانية الزجاجية (Cyber Dark Luxury Glassmorphism)، بهوية خطوط
            ثمانية الأصلية وهوية أساس الملكية، مع دعم كامل للرسم البياني الزمني لأنوية المعالج، وحصن الوصول الموحد.
          </p>
        </div>

        <button
          onClick={() => window.open(selectedScreen?.html_url || '/stitch/_2/code.html', '_blank')}
          style={{
            background: 'linear-gradient(135deg, var(--gold-glow) 0%, var(--primary-container) 100%)',
            color: 'var(--on-accent)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 16px var(--accent-soft)',
          }}
        >
          <ExternalLink size={16} />
          فتح الشاشة الحالية في نافذة مستقلة
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: activeCategory === cat ? 'var(--primary-container)' : 'var(--glass-rim-low)',
              color: activeCategory === cat ? '#000' : 'var(--text-2)',
              border: `1px solid ${activeCategory === cat ? 'var(--primary)' : 'var(--glass-rim-low)'}`,
              padding: '8px 18px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: activeCategory === cat ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            {cat} {cat === 'الكل' ? `(${screens.length})` : ''}
          </button>
        ))}
      </div>

      {/* Live Interactive Preview Box */}
      {selectedScreen && (
        <div
          style={{
            background: 'var(--surface-container-low, var(--glass-tint))',
            border: '1px solid var(--gold-rim)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 20px 48px var(--shadow-soft)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--glass-rim-low)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--shadow-soft)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Monitor size={18} />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-titles)' }}>
                  معاينة تفاعلية حية: {selectedScreen.title}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block' }}>
                  المسار: {selectedScreen.html_url} | التصنيف: {selectedScreen.category}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPreviewModalUrl(selectedScreen.preview_url)}
                style={{
                  background: 'var(--glass-rim-low)',
                  color: 'var(--text-titles)',
                  border: '1px solid var(--glass-rim-low)',
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Eye size={14} />
                عرض لقطة الشاشة الأصلية (HD)
              </button>

              <button
                onClick={() => window.open(selectedScreen.html_url, '_blank')}
                style={{
                  background: 'var(--primary)',
                  color: '#000',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ExternalLink size={14} />
                ملء الشاشة
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '780px', position: 'relative', background: 'var(--bg)' }}>
            <iframe
              src={selectedScreen.html_url}
              title={selectedScreen.title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {/* Screen Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-titles)', margin: '8px 0 0' }}>
          جميع شاشات المشروع المصممة عبر Google Stitch ({filteredScreens.length})
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {filteredScreens.map((screen) => {
            const isSelected = selectedScreen?.id === screen.id;
            return (
              <div
                key={screen.id}
                onClick={() => setSelectedScreen(screen)}
                style={{
                  background: isSelected
                    ? 'linear-gradient(180deg, var(--accent-soft) 0%, var(--surface-ground) 100%)'
                    : 'var(--surface-container-low, var(--glass-tint))',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--glass-rim-low)'}`,
                  borderRadius: 14,
                  padding: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 20px var(--accent-soft)' : 'none',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--bg)',
                    border: '1px solid var(--glass-rim-low)',
                    position: 'relative',
                  }}
                >
                  <img
                    src={screen.preview_url}
                    alt={screen.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                    }}
                    loading="lazy"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'var(--shadow-soft)',
                      backdropFilter: 'blur(8px)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    {screen.folder}
                  </div>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-titles)' }}>
                      {screen.title}
                    </h3>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-body)',
                      margin: 0,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {screen.description}
                  </p>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 10,
                    borderTop: '1px solid var(--glass-rim-low)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      background: 'var(--glass-rim-low)',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {screen.category}
                  </span>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(screen.html_url, '_blank');
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--accent-soft)',
                        color: 'var(--primary)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ExternalLink size={12} />
                      فتح مباشر
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full HD Image Modal */}
      {previewModalUrl && (
        <div
          onClick={() => setPreviewModalUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--shadow-soft)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 32,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              background: 'var(--surface-ground)',
              border: '1px solid var(--gold-rim)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 25px 60px var(--shadow-soft)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--shadow-soft)',
                borderBottom: '1px solid var(--glass-rim-low)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-titles)' }}>
                معاينة عالية الدقة (Stitch Export Screenshot)
              </span>
              <button
                onClick={() => setPreviewModalUrl(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(92vh - 60px)', padding: 12 }}>
              <img
                src={previewModalUrl}
                alt="Stitch Screenshot Preview"
                style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

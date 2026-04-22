'use client';

export default function SkeletonDashboard() {
    return (
        <div className="page-enter stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                    <div className="skeleton-box" style={{ width: '80px', height: '16px', borderRadius: '4px', marginBottom: '8px' }} />
                    <div className="skeleton-box" style={{ width: '200px', height: '40px', borderRadius: '8px', marginBottom: '4px' }} />
                    <div className="skeleton-box" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="skeleton-box" style={{ width: '140px', height: '32px', borderRadius: '8px' }} />
                    <div className="skeleton-box" style={{ width: '80px', height: '32px', borderRadius: '8px' }} />
                </div>
            </div>

            {/* Target Progress Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="skeleton-box" style={{ height: '150px', borderRadius: '14px' }} />
                <div className="skeleton-box" style={{ height: '150px', borderRadius: '14px' }} />
            </div>

            {/* Scopes Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 140px', gap: '10px' }}>
                <div className="skeleton-box" style={{ height: '120px', borderRadius: '12px' }} />
                <div className="skeleton-box" style={{ height: '120px', borderRadius: '12px' }} />
                <div className="skeleton-box" style={{ height: '120px', borderRadius: '12px' }} />
                <div className="skeleton-box" style={{ height: '120px', borderRadius: '12px' }} />
            </div>

            {/* Detailed charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                <div className="skeleton-box" style={{ height: '180px', borderRadius: '12px' }} />
                <div className="skeleton-box" style={{ height: '180px', borderRadius: '12px' }} />
            </div>

            <style jsx global>{`
        .skeleton-box {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
        </div>
    );
}

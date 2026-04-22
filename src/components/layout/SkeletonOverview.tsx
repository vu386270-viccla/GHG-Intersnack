'use client';

export default function SkeletonOverview() {
    return (
        <div className="overview-wrapper" style={{ animation: 'fade-in 0.5s ease-out' }}>
            <div className="overview-controls" style={{ opacity: 0.7 }}>
                <div className="skeleton-box" style={{ width: '100px', height: '32px', borderRadius: '6px' }} />
                <div className="ov-controls-divider" />
                <div className="skeleton-box" style={{ width: '220px', height: '32px', borderRadius: '6px' }} />
                <div className="ov-controls-divider" />
                <div className="skeleton-box" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
            </div>

            <div style={{ padding: '16px', display: 'flex', gap: '16px', height: '100%' }}>
                {/* Left Panel Skeleton */}
                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="skeleton-box" style={{ width: '100%', height: '120px', borderRadius: '12px' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div className="skeleton-box" style={{ flex: 1, height: '90px', borderRadius: '12px' }} />
                        <div className="skeleton-box" style={{ flex: 1, height: '90px', borderRadius: '12px' }} />
                        <div className="skeleton-box" style={{ flex: 1, height: '90px', borderRadius: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div className="skeleton-box" style={{ flex: 1, height: '160px', borderRadius: '12px' }} />
                        <div className="skeleton-box" style={{ flex: 1, height: '160px', borderRadius: '12px' }} />
                    </div>
                    <div className="skeleton-box" style={{ width: '100%', flex: 1, borderRadius: '12px', minHeight: '100px' }} />
                </div>

                {/* Right Panel Skeleton */}
                <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="skeleton-box" style={{ width: '100%', height: '30px', borderRadius: '8px', marginBottom: '8px' }} />
                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                        <div className="skeleton-box" style={{ flex: 1, height: '100%', borderRadius: '16px' }} />
                        <div className="skeleton-box" style={{ flex: 1, height: '100%', borderRadius: '16px' }} />
                    </div>
                </div>
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

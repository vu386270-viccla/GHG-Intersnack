'use client';

export default function SplashLoading() {
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#ffffff',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}
        >
            <div style={{ position: 'relative', width: '200px', textAlign: 'center' }}>
                {/* Core Logo */}
                <img
                    src="/intersnack-logo.jpg"
                    alt="Intersnack Group"
                    style={{
                        width: '180px',
                        height: 'auto',
                        marginBottom: '40px',
                        animation: 'fade-in-up 0.8s ease-out forwards',
                        opacity: 0,
                        transform: 'translateY(10px)',
                    }}
                />

                {/* Custom Progress Bar */}
                <div
                    style={{
                        width: '160px',
                        height: '4px',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '4px',
                        margin: '0 auto',
                        overflow: 'hidden',
                        position: 'relative',
                        opacity: 0,
                        animation: 'fade-in 0.5s ease-out 0.4s forwards',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            backgroundColor: '#E30613',
                            width: '40%',
                            borderRadius: '4px',
                            animation: 'indeterminate-progress 1.5s infinite ease-in-out',
                        }}
                    />
                </div>

                {/* Text Details */}
                <div
                    style={{
                        marginTop: '20px',
                        fontSize: '13px',
                        color: '#666',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        opacity: 0,
                        animation: 'fade-in 0.5s ease-out 0.6s forwards',
                    }}
                >
                    Loading Dashboard...
                </div>
            </div>

            <style jsx global>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes indeterminate-progress {
          0% {
            left: -40%;
            width: 40%;
          }
          50% {
            left: 30%;
            width: 80%;
          }
          100% {
            left: 100%;
            width: 40%;
          }
        }
      `}</style>
        </div>
    );
}

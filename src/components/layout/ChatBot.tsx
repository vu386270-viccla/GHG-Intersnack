'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const SUGGESTED_QUESTIONS = [
    'Scope 1, 2, 3 khác gì nhau?',
    'SBTi target 42% là tính từ năm nào?',
    'CO2 intensity là gì?',
    'Nhà máy nào phát thải nhiều nhất?',
];

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: content.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const updatedMessages = [...messages, userMessage];
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages }),
            });

            const data = await res.json();
            if (data.text) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
            } else {
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: '⚠️ Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.' },
                ]);
            }
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: '⚠️ Không kết nối được. Vui lòng thử lại.' },
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <>
            {/* Floating button */}
            <button
                id="chatbot-toggle"
                className={`chatbot-fab ${isOpen ? 'chatbot-fab--open' : ''}`}
                onClick={() => setIsOpen(o => !o)}
                aria-label="Toggle AI Assistant"
            >
                {isOpen ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        <circle cx="9" cy="10" r="1" fill="currentColor" />
                        <circle cx="12" cy="10" r="1" fill="currentColor" />
                        <circle cx="15" cy="10" r="1" fill="currentColor" />
                    </svg>
                )}
                {!isOpen && <span className="chatbot-fab__pulse" />}
            </button>

            {/* Chat panel */}
            <div className={`chatbot-panel ${isOpen ? 'chatbot-panel--open' : ''} ${isExpanded ? 'chatbot-panel--expanded' : ''}`}>
                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header__info">
                        <div className="chatbot-header__avatar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a8 8 0 0 1 8 8v12l-4-4H4a2 2 0 0 1-2-2V10a8 8 0 0 1 8-8z" />
                            </svg>
                        </div>
                        <div>
                            <div className="chatbot-header__name">GHG AI Assistant</div>
                            <div className="chatbot-header__status">
                                <span className="chatbot-status-dot" />
                                Powered by Gemini
                            </div>
                        </div>
                    </div>
                    <div className="chatbot-header__actions">
                        <button
                            className="chatbot-icon-btn"
                            onClick={() => setIsExpanded(e => !e)}
                            title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
                        >
                            {isExpanded ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                                    <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            )}
                        </button>
                        {messages.length > 0 && (
                            <button className="chatbot-icon-btn" onClick={clearChat} title="Xóa lịch sử">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages" id="chatbot-messages">
                    {messages.length === 0 && (
                        <div className="chatbot-welcome">
                            <div className="chatbot-welcome__icon">🌱</div>
                            <div className="chatbot-welcome__title">Xin chào!</div>
                            <div className="chatbot-welcome__subtitle">
                                Tôi là trợ lý AI chuyên về phát thải GHG & SBTi. Hỏi gì cũng được!
                            </div>
                            <div className="chatbot-suggestions">
                                {SUGGESTED_QUESTIONS.map((q, i) => (
                                    <button
                                        key={i}
                                        className="chatbot-suggestion-btn"
                                        onClick={() => sendMessage(q)}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`chatbot-message chatbot-message--${msg.role}`}>
                            {msg.role === 'assistant' && (
                                <div className="chatbot-message__avatar">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2a8 8 0 0 1 8 8v12l-4-4H4a2 2 0 0 1-2-2V10a8 8 0 0 1 8-8z" />
                                    </svg>
                                </div>
                            )}
                            <div className="chatbot-message__bubble">
                                {msg.content.split('\n').map((line, j) => (
                                    <span key={j}>
                                        {line}
                                        {j < msg.content.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="chatbot-message chatbot-message--assistant">
                            <div className="chatbot-message__avatar">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2a8 8 0 0 1 8 8v12l-4-4H4a2 2 0 0 1-2-2V10a8 8 0 0 1 8-8z" />
                                </svg>
                            </div>
                            <div className="chatbot-message__bubble chatbot-message__bubble--typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="chatbot-input-area">
                    <textarea
                        ref={inputRef}
                        id="chatbot-input"
                        className="chatbot-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập câu hỏi... (Enter để gửi)"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        id="chatbot-send"
                        className={`chatbot-send-btn ${isLoading || !input.trim() ? 'chatbot-send-btn--disabled' : ''}`}
                        onClick={() => sendMessage(input)}
                        disabled={isLoading || !input.trim()}
                        aria-label="Send message"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
}

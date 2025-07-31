import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Using a hash router is better for environments where server-side routing isn't configured.
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Helper & Mock Data ---
// In a real app, this would be a proper API call.
const callGeminiAPI = async (prompt, apiKey) => {
    // Basic exponential backoff implementation
    let attempt = 0;
    const maxAttempts = 5;
    const initialDelay = 1000; // 1 second

    // ** IMPORTANT **
    // If the API key is not provided by the environment, this will fail.
    // We add a check here to provide a clear error message.
    if (!apiKey) {
        console.error("API Key is missing.");
        return "AI functionality is disabled. The API key is missing from the application.";
    }

    while (attempt < maxAttempts) {
        try {
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Throw an error for non-2xx responses to trigger retry
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                return result.candidates[0].content.parts[0].text;
            } else {
                // Handle cases where the response structure is unexpected
                console.error("Unexpected API response structure:", result);
                return "AI response could not be generated due to an unexpected format.";
            }
        } catch (error) {
            console.error(`Error calling Gemini API on attempt ${attempt + 1}:`, error);
            attempt++;
            if (attempt >= maxAttempts) {
                return "There was an error communicating with the AI after multiple attempts. Please try again later.";
            }
            // Wait with exponential backoff before retrying
            const delay = initialDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return "Failed to get a response from the AI.";
};


// --- Shared Components ---

// src/components/MessageBox.jsx
const MessageBox = ({ message, type, onClose }) => {
    if (!message) return null;
    const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
    const textColor = 'text-white';
    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg z-50 flex items-center justify-between ${bgColor} ${textColor} animate-fade-in-down`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 font-bold">&times;</button>
        </div>
    );
};

// src/components/SearchableCoinSelect.jsx
const SearchableCoinSelect = ({ coins, value, onChange, placeholder, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filteredCoins = useMemo(() => {
        if (!searchTerm) return coins;
        return coins.filter(coin =>
            coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 50);
    }, [coins, searchTerm]);

    const selectedCoinName = value ? (coins.find(c => c.id === value)?.name || value) : '';

    return (
        <div className="relative">
            <input
                type="text"
                placeholder={isLoading ? "Loading coins..." : placeholder}
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                value={isOpen ? searchTerm : selectedCoinName}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Delay to allow click
                disabled={isLoading}
            />
            {isOpen && (
                <ul className="absolute z-20 w-full bg-gray-700 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {filteredCoins.length > 0 ? filteredCoins.map(coin => (
                        <li
                            key={coin.id}
                            className="p-3 hover:bg-gray-600 cursor-pointer text-white"
                            onMouseDown={() => { // Use onMouseDown to trigger before onBlur
                                onChange(coin.id);
                                setSearchTerm(''); // Clear search term after selection
                                setIsOpen(false);
                            }}
                        >
                            {coin.name} ({coin.symbol.toUpperCase()})
                        </li>
                    )) : (
                        <li className="p-3 text-gray-400">{isLoading ? "Loading..." : "No coins found."}</li>
                    )}
                </ul>
            )}
        </div>
    );
};


// src/components/Card.jsx
const Card = ({ title, children, className = '' }) => (
    <div className={`p-6 bg-gray-700 rounded-lg shadow-md ${className}`}>
        {title && <h2 className="text-2xl font-semibold text-white mb-4">{title}</h2>}
        {children}
    </div>
);

// src/components/StatWidget.jsx
const StatWidget = ({ label, value, valueColorClass = 'text-white' }) => (
    <div className="bg-gray-600 p-4 rounded-lg shadow-sm">
        <p className="text-sm text-gray-300">{label}</p>
        <p className={`text-2xl font-bold ${valueColorClass}`}>{value}</p>
    </div>
);

// src/components/ChatBubble.jsx
const ChatBubble = ({ message, isUser }) => (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-md p-3 rounded-lg shadow-md ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-100'}`}>
            {message}
        </div>
    </div>
);

// src/components/Sidebar.jsx
const Sidebar = ({ isSidebarOpen, toggleSidebar, navLinks }) => {
    const location = useLocation();

    return (
        <>
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={toggleSidebar}></div>
            )}
            <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-800 text-white p-4 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-50`}>
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-400">CryptoHub</h1>
                    <button onClick={toggleSidebar} className="md:hidden text-gray-400 hover:text-white focus:outline-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <nav>
                    <ul>
                        {navLinks.map((link) => (
                            <li key={link.path} className="mb-2">
                                <Link
                                    to={link.path}
                                    onClick={() => isSidebarOpen && toggleSidebar()}
                                    className={`flex items-center p-3 rounded-md transition-colors duration-200 ${location.pathname === link.path ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-700 text-gray-300 hover:text-white'}`}
                                >
                                    {link.icon}
                                    <span className="ml-3 text-lg">{link.name}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>
    );
};

// src/components/Topbar.jsx
const Topbar = ({ toggleSidebar, isDarkMode, toggleDarkMode }) => {
    const location = useLocation();
    // A more robust way to get the page title from navLinks
    const pageTitle =
        (location.pathname === '/' ? 'Dashboard' : location.pathname.replace('/', ''))
        .split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');


    return (
        <header className="sticky top-0 z-30 bg-gray-900 text-white p-4 shadow-md">
            <div className="flex justify-between items-center">
                <button onClick={toggleSidebar} className="md:hidden text-gray-400 hover:text-white focus:outline-none">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <div className="text-2xl font-semibold text-blue-300">
                    {pageTitle}
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={toggleDarkMode} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200">
                        {isDarkMode ? (
                            <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                        ) : (
                            <svg className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 4a1 1 0 011 1v1a1 1 0 11-2 0V7a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0V7a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0V7a1 1 0 011-1zm8-2a1 1 0 011 1v1a1 1 0 11-2 0V5a1 1 0 011-1zm-4-2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm8 8a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm8 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4 0a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" clipRule="evenodd"></path></svg>
                        )}
                    </button>
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">GR</div>
                </div>
            </div>
        </header>
    );
};

// src/components/Layout.jsx
const Layout = ({ children, isDarkMode, toggleDarkMode, navLinks }) => {
    // --- THESE TWO LINES WERE LIKELY MISSING ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    // ------------------------------------

    return (
        <div className="flex min-h-screen cyber-slideshow">
            <Sidebar 
                isSidebarOpen={isSidebarOpen} 
                toggleSidebar={toggleSidebar} 
                navLinks={navLinks} 
            />
            <div className="flex-1 flex flex-col md:ml-64">
                <Topbar 
                    toggleSidebar={toggleSidebar} 
                    isDarkMode={isDarkMode} 
                    toggleDarkMode={toggleDarkMode} 
                />
                <main className="flex-1 p-4 lg:p-8 text-slate-200">
                    {children}
                </main>
            </div>
        </div>
    );
};

// --- Page Components ---


// src/pages/Dashboard.jsx
const Dashboard = ({ portfolioData, totalPortfolioValue, totalProfitLoss, totalProfitLossPercent, loadingPrices, allCoins, pieChartData, COLORS }) => {
    const sortedBy24hChange = useMemo(() => {
        return [...portfolioData].sort((a, b) => (b.change24h || -Infinity) - (a.change24h || -Infinity));
    }, [portfolioData]);

    const topGainers = sortedBy24hChange.filter(item => item.change24h > 0).slice(0, 3);
    const topLosers = sortedBy24hChange.filter(item => item.change24h < 0).slice(0, 3).reverse();

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-6">Dashboard Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatWidget
                    label="Total Portfolio Value"
                    value={`$${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    valueColorClass="text-green-400"
                />
                <StatWidget
                    label="Total Profit/Loss (USD)"
                    value={`$${totalProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    valueColorClass={totalProfitLoss > 0 ? 'text-green-400' : totalProfitLoss < 0 ? 'text-red-400' : 'text-gray-300'}
                />
                <StatWidget
                    label="Total Profit/Loss (%)"
                    value={`${totalProfitLossPercent.toFixed(2)}%`}
                    valueColorClass={totalProfitLossPercent > 0 ? 'text-green-400' : totalProfitLossPercent < 0 ? 'text-red-400' : 'text-gray-300'}
                />
            </div>

            <Card title="Portfolio Distribution">
                {pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-gray-400 text-center">Add coins to your portfolio to see distribution.</p>
                )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Top 3 Gainers (24h)">
                    {topGainers.length > 0 ? (
                        <ul className="space-y-2">
                            {topGainers.map(coin => (
                                <li key={coin.id} className="flex justify-between items-center text-gray-200">
                                    <span>{coin.name} ({allCoins.find(c => c.id === coin.id)?.symbol.toUpperCase()})</span>
                                    <span className="text-green-400 font-semibold">+{coin.change24h.toFixed(2)}%</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400">No gainers in your portfolio yet.</p>
                    )}
                </Card>
                <Card title="Top 3 Losers (24h)">
                    {topLosers.length > 0 ? (
                        <ul className="space-y-2">
                            {topLosers.map(coin => (
                                <li key={coin.id} className="flex justify-between items-center text-gray-200">
                                    <span>{coin.name} ({allCoins.find(c => c.id === coin.id)?.symbol.toUpperCase()})</span>
                                    <span className="text-red-400 font-semibold">{coin.change24h.toFixed(2)}%</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400">No losers in your portfolio yet.</p>
                    )}
                </Card>
            </div>

            {loadingPrices && <p className="text-blue-300 text-center mt-4 animate-pulse">Updating prices...</p>}
        </div>
    );
};

// src/pages/GeminiAssistant.jsx
const GeminiAssistant = ({ allCoins, prices, portfolioData, totalPortfolioValue, totalProfitLoss, totalProfitLossPercent, apiKey }) => {
    const [chatHistory, setChatHistory] = useState([]);
    const [userPrompt, setUserPrompt] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    const handleAiRequest = useCallback(async (prompt) => {
        setIsThinking(true);
        setChatHistory(prev => [...prev, { message: prompt, isUser: true }]);
        setUserPrompt('');

        let response = "I'm sorry, I couldn't understand that request. Please try rephrasing.";
        const lowerPrompt = prompt.toLowerCase();

        try {
            if (lowerPrompt.includes("coin insight for")) {
                const coinNameMatch = lowerPrompt.match(/coin insight for ([\w\s-]+)/);
                if (coinNameMatch && coinNameMatch[1]) {
                    const coinName = coinNameMatch[1].trim();
                    const coin = allCoins.find(c => c.name.toLowerCase() === coinName || c.symbol.toLowerCase() === coinName);
                    if (coin) {
                        response = await callGeminiAPI(`Provide a very brief (2-3 sentences) general market insight about ${coin.name} (${coin.symbol.toUpperCase()}). Focus on recent general trends or common knowledge, without making specific price predictions or financial advice.`, apiKey);
                    } else {
                        response = `I couldn't find a coin named "${coinName}". Please try a different name or symbol.`;
                    }
                }
            } else if (lowerPrompt.includes("portfolio summary")) {
                if (portfolioData.length === 0) {
                    response = "Your portfolio is empty. Add some coins to get a summary!";
                } else {
                    const topPerformers = portfolioData.filter(item => item.profitLoss > 0).sort((a, b) => b.profitLoss - a.profitLoss).slice(0, 2).map(item => `${item.name} (${item.profitLossPercent.toFixed(2)}%)`);
                    const topLosers = portfolioData.filter(item => item.profitLoss < 0).sort((a, b) => a.profitLoss - b.profitLoss).slice(0, 2).map(item => `${item.name} (${item.profitLossPercent.toFixed(2)}%)`);
                    let summaryPrompt = `Analyze a cryptocurrency portfolio with a total value of $${totalPortfolioValue.toLocaleString()} and a total profit/loss of $${totalProfitLoss.toLocaleString()} (${totalProfitLossPercent.toFixed(2)}%).`;
                    if (topPerformers.length > 0) summaryPrompt += ` Top performers: ${topPerformers.join(', ')}.`;
                    if (topLosers.length > 0) summaryPrompt += ` Top losers: ${topLosers.join(', ')}.`;
                    summaryPrompt += ` Provide a concise (3-4 sentences) summary of this portfolio's performance, highlighting overall trends and key contributors, without offering financial advice.`;
                    response = await callGeminiAPI(summaryPrompt, apiKey);
                }
            } else if (lowerPrompt.includes("market sentiment")) {
                response = await callGeminiAPI(`Provide a very brief (2-3 sentences) general overview of the current cryptocurrency market sentiment. Focus on broad trends (e.g., bullish, bearish, sideways, volatility) without making specific price predictions or financial advice.`, apiKey);
            } else if (lowerPrompt.includes("explain")) {
                const termMatch = lowerPrompt.match(/explain (.+)/);
                if (termMatch && termMatch[1]) {
                    response = await callGeminiAPI(`Explain the cryptocurrency term "${termMatch[1]}" in 2-3 sentences. Keep it concise and easy to understand for someone new to crypto.`, apiKey);
                }
            } else {
                response = await callGeminiAPI(prompt, apiKey);
            }
        } catch (error) {
            console.error("Error in AI Request Handling:", error);
            response = "An error occurred while processing your request.";
        }

        setChatHistory(prev => [...prev, { message: response, isUser: false }]);
        setIsThinking(false);
    }, [allCoins, portfolioData, totalPortfolioValue, totalProfitLoss, totalProfitLossPercent, prices, apiKey]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (userPrompt.trim() && !isThinking) {
            handleAiRequest(userPrompt);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-6 p-4">✨ Gemini AI Assistant</h2>
            <div className="flex-1 overflow-y-auto p-4 border-t border-gray-600 bg-gray-700 custom-scrollbar">
                {chatHistory.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <p className="mb-2">Ask me anything about crypto!</p>
                        <p className="text-sm">Try: "What is Bitcoin?", "Portfolio summary", "Explain DeFi", "Market sentiment", "Coin insight for Ethereum"</p>
                    </div>
                ) : (
                    chatHistory.map((chat, index) => (
                        <ChatBubble key={index} message={chat.message} isUser={chat.isUser} />
                    ))
                )}
                {isThinking && <ChatBubble message="Thinking..." isUser={false} />}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-4 p-4 border-t border-gray-600">
                <input
                    type="text"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Ask the AI anything..."
                    className="flex-1 p-3 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                    disabled={isThinking}
                />
                <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isThinking || !userPrompt.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    );
};

// src/pages/Portfolio.jsx
const Portfolio = ({
    portfolio, prices, allCoins, setPortfolio, showMessage, portfolioData,
    alerts, setAlerts, loadingCoins
}) => {
    // State for the "Add New Holding" form
    const [newCoinId, setNewCoinId] = useState('');
    const [newCoinQuantity, setNewCoinQuantity] = useState('');
    const [newCoinPurchasePrice, setNewCoinPurchasePrice] = useState('');

    // State for inline editing
    const [editingCoinId, setEditingCoinId] = useState(null);
    const [editingQuantity, setEditingQuantity] = useState('');
    const [editingPurchasePrice, setEditingPurchasePrice] = useState('');

    // State for the "Price Alerts" form
    const [newAlertCoinId, setNewAlertCoinId] = useState('');
    const [newAlertPrice, setNewAlertPrice] = useState('');
    const [newAlertType, setNewAlertType] = useState('above');


    const handleAddHolding = (e) => {
        e.preventDefault();
        if (!newCoinId || !newCoinQuantity || isNaN(parseFloat(newCoinQuantity)) || parseFloat(newCoinQuantity) <= 0) {
            showMessage('Please select a coin and enter a valid positive quantity.', 'error');
            return;
        }

        const quantity = parseFloat(newCoinQuantity);
        const purchasePrice = parseFloat(newCoinPurchasePrice) || 0;

        const existingCoinIndex = portfolio.findIndex(item => item.id === newCoinId);
        let updatedPortfolio;

        if (existingCoinIndex > -1) {
            updatedPortfolio = [...portfolio];
            const existing = updatedPortfolio[existingCoinIndex];
            const oldTotalValue = existing.purchasePrice * existing.quantity;
            const newTotalValue = purchasePrice * quantity;
            const totalQuantity = existing.quantity + quantity;
            existing.quantity = totalQuantity;
            existing.purchasePrice = (oldTotalValue + newTotalValue) / totalQuantity;
        } else {
            updatedPortfolio = [...portfolio, { id: newCoinId, quantity, purchasePrice }];
        }
        setPortfolio(updatedPortfolio);
        showMessage('Portfolio updated successfully!', 'success');
        
        // Reset form
        setNewCoinId('');
        setNewCoinQuantity('');
        setNewCoinPurchasePrice('');
        e.target.reset(); // Also reset the native form state
    };

    const handleEditCoin = (coin) => {
        setEditingCoinId(coin.id);
        setEditingQuantity(coin.quantity.toString());
        setEditingPurchasePrice(coin.purchasePrice.toString());
    };

    const handleSaveEdit = (coinId) => {
        const quantity = parseFloat(editingQuantity);
        const purchasePrice = parseFloat(editingPurchasePrice);
        if (isNaN(quantity) || quantity <= 0 || isNaN(purchasePrice)) {
            showMessage('Please enter valid numbers for quantity and price.', 'error');
            return;
        }
        setPortfolio(portfolio.map(item =>
            item.id === coinId ? { ...item, quantity, purchasePrice } : item
        ));
        setEditingCoinId(null);
        showMessage('Holding updated.', 'success');
    };

    const handleCancelEdit = () => {
        setEditingCoinId(null);
        setEditingQuantity('');
        setEditingPurchasePrice('');
    };

    const handleRemoveCoin = (coinIdToRemove) => {
        // Removed window.confirm as per instructions
        setPortfolio(portfolio.filter(item => item.id !== coinIdToRemove));
        showMessage('Coin removed from portfolio.', 'info');
    };
    
    const handleAddAlert = (e) => {
        e.preventDefault();
        const price = parseFloat(newAlertPrice);
        if (!newAlertCoinId || isNaN(price) || price <= 0) {
            showMessage('Please select a coin and enter a valid target price.', 'error');
            return;
        }
        const newAlert = {
            id: Date.now().toString(),
            coinId: newAlertCoinId,
            targetPrice: price,
            type: newAlertType,
            triggered: false,
        };
        setAlerts([...alerts, newAlert]);
        showMessage('Price alert set!', 'success');
        setNewAlertCoinId('');
        setNewAlertPrice('');
    };

    const handleRemoveAlert = (alertId) => {
        setAlerts(alerts.filter(a => a.id !== alertId));
        showMessage('Alert removed.', 'info');
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-6">Your Portfolio</h2>
            
            <Card title="Add New Holding">
                <form onSubmit={handleAddHolding} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-gray-300 text-sm font-medium mb-2">Select Cryptocurrency:</label>
                        <SearchableCoinSelect
                            coins={allCoins}
                            value={newCoinId}
                            onChange={setNewCoinId}
                            placeholder="Search for a coin..."
                            isLoading={loadingCoins}
                        />
                    </div>
                    <div>
                        <label htmlFor="quantity" className="block text-gray-300 text-sm font-medium mb-2">Quantity:</label>
                        <input id="quantity" type="number" value={newCoinQuantity} onChange={e => setNewCoinQuantity(e.target.value)} className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 0.05" step="any" required />
                    </div>
                    <div>
                        <label htmlFor="purchase-price" className="block text-gray-300 text-sm font-medium mb-2">Purchase Price (USD):</label>
                        <input id="purchase-price" type="number" value={newCoinPurchasePrice} onChange={e => setNewCoinPurchasePrice(e.target.value)} className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 45000" step="any" />
                    </div>
                    <button type="submit" className="md:col-span-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 shadow-lg">
                        Add to Portfolio
                    </button>
                </form>
            </Card>

            <Card title="Your Current Holdings">
                {portfolio.length === 0 ? (
                    <p className="text-center text-gray-400 p-6">Your portfolio is empty. Add some coins to get started!</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-600">
                            <thead className="bg-gray-600">
                                <tr>
                                    {["Coin", "Quantity", "Current Price", "Total Value", "Avg. Purchase Price", "P/L (USD)", "P/L (%)", "24h Change", "Actions"].map(header => (
                                        <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-gray-700 divide-y divide-gray-600">
                                {portfolioData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-600 transition-colors duration-200">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-white">{item.name}</div>
                                            <div className="text-xs text-gray-400">{allCoins.find(c => c.id === item.id)?.symbol.toUpperCase()}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            {editingCoinId === item.id ? (
                                                <input type="number" value={editingQuantity} onChange={(e) => setEditingQuantity(e.target.value)} className="bg-gray-500 border border-gray-400 rounded-md text-white w-24 p-1" step="any" />
                                            ) : (
                                                item.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{typeof item.currentPrice === 'number' ? `$${item.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{typeof item.value === 'number' ? `$${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            {editingCoinId === item.id ? (
                                                <input type="number" value={editingPurchasePrice} onChange={(e) => setEditingPurchasePrice(e.target.value)} className="bg-gray-500 border border-gray-400 rounded-md text-white w-24 p-1" step="any" />
                                            ) : (
                                                typeof item.purchasePrice === 'number' && item.purchasePrice > 0 ? `$${item.purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.profitLoss > 0 ? 'text-green-400' : item.profitLoss < 0 ? 'text-red-400' : 'text-gray-300'}`}>{typeof item.profitLoss === 'number' ? `$${item.profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.profitLossPercent > 0 ? 'text-green-400' : item.profitLossPercent < 0 ? 'text-red-400' : 'text-gray-300'}`}>{typeof item.profitLossPercent === 'number' ? `${item.profitLossPercent.toFixed(2)}%` : 'N/A'}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.change24h > 0 ? 'text-green-400' : item.change24h < 0 ? 'text-red-400' : 'text-gray-300'}`}>{typeof item.change24h === 'number' ? `${item.change24h.toFixed(2)}%` : 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2">
                                            {editingCoinId === item.id ? (
                                                <>
                                                    <button onClick={() => handleSaveEdit(item.id)} className="text-blue-500 hover:text-blue-700" title="Save"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600" title="Cancel"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditCoin(item)} className="text-yellow-500 hover:text-yellow-700" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={() => handleRemoveCoin(item.id)} className="text-red-500 hover:text-red-700" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card title="Price Alerts">
                <form onSubmit={handleAddAlert} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-gray-300 text-sm font-medium mb-2">Coin:</label>
                        <SearchableCoinSelect coins={allCoins} value={newAlertCoinId} onChange={setNewAlertCoinId} placeholder="Search for a coin..." isLoading={loadingCoins} />
                    </div>
                    <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">Target Price (USD):</label>
                        <input type="number" value={newAlertPrice} onChange={(e) => setNewAlertPrice(e.target.value)} className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white" placeholder="e.g., 50000" required />
                    </div>
                    <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">Alert When:</label>
                        <select value={newAlertType} onChange={(e) => setNewAlertType(e.target.value)} className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white">
                            <option value="above">Above</option>
                            <option value="below">Below</option>
                        </select>
                    </div>
                    <button type="submit" className="md:col-span-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition">Set Price Alert</button>
                </form>
                {alerts.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-xl font-semibold text-white mb-2">Your Active Alerts:</h3>
                        <ul className="divide-y divide-gray-600">
                            {alerts.map(alert => {
                                const coinName = allCoins.find(c => c.id === alert.coinId)?.name || alert.coinId;
                                const currentPrice = prices[alert.coinId]?.usd;
                                return (
                                    <li key={alert.id} className="flex justify-between items-center py-3">
                                        <span className={`text-gray-300 ${alert.triggered ? 'text-yellow-400' : ''}`}>
                                            {coinName}: {alert.type === 'above' ? 'Above' : 'Below'} ${alert.targetPrice.toLocaleString()}
                                            {currentPrice && <span className="ml-2 text-sm text-gray-400">(Current: ${currentPrice.toLocaleString()})</span>}
                                            {alert.triggered && <span className="ml-2 text-sm font-bold animate-pulse">(TRIGGERED!)</span>}
                                        </span>
                                        <button onClick={() => handleRemoveAlert(alert.id)} className="text-red-500 hover:text-red-700" title="Remove alert"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </Card>
        </div>
    );
};

// src/pages/About.jsx
const About = () => {
    const skills = {
        "Blockchain & Web3": ["Web3", "Decentralized Applications (DApps)", "Smart Contracts", "Solidity", "ERC-20 Tokens"],
        "Cybersecurity": ["Penetration Testing", "Bug Bounty", "Digital Forensics"],
        "Forensic Science": ["Forensic Biology", "Forensic Toxicology", "Forensic Serology", "Question Document Examination"],
        "Core Competencies": ["Critical Thinking", "Root Cause Problem Solving", "Sustainable Design", "Green Chemistry"]
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto text-gray-200">
            {/* --- Profile & Intro Section --- */}
            <Card className="bg-gray-800/80 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-6">
                    <img
                        src='https://i.postimg.cc/2V1XcxqT/1748431305823.png'
                        alt="Gulshan Raj"
                        className="w-36 h-36 rounded-full object-cover border-4 border-purple-500 shadow-xl flex-shrink-0"
                    />
                    <div className="space-y-3">
                        <h2 className="text-4xl font-bold text-white">Gulshan Raj</h2>
                        <p className="text-xl text-purple-400 font-medium">Cyber Forensics Specialist & Blockchain Developer</p>
                        <p className="text-gray-300">
                            I am a detail-oriented investigator at heart, with a deep-seated passion for forensic science and cybersecurity. My journey has led me to the fascinating intersection of security and decentralization. I see blockchain not just as a technology, but as a new frontier for digital trust and forensic analysis.
                        </p>
                        <div className="flex gap-6 justify-center md:justify-start pt-2">
                             <a href="https://github.com/0xsherlocks" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-purple-400 transition-colors">
                                GitHub
                            </a>
                            <a href="https://www.linkedin.com/in/gulshan90" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-purple-400 transition-colors">
                                LinkedIn
                            </a>
                        </div>
                    </div>
                </div>
            </Card>

            {/* --- Project Motivation & Skills Section --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                     <Card className="h-full bg-gray-800/80 backdrop-blur-sm">
                        <h3 className="text-2xl font-semibold text-white mb-3">Why CryptoHub?</h3>
                        <p className="text-gray-300">
                            I built this dashboard as a practical exercise in applying my skills. It's my way of exploring the real-world utility of Web3, creating tools that are both functional and insightful. This project combines my love for data analysis, secure systems, and elegant design, turning complex information into a clear, manageable experience.
                        </p>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                     <Card className="h-full bg-gray-800/80 backdrop-blur-sm">
                        <h3 className="text-2xl font-semibold text-white mb-4">Skills & Expertise</h3>
                        <div className="space-y-4">
                            {Object.entries(skills).map(([category, list]) => (
                                <div key={category}>
                                    <h4 className="font-semibold text-purple-300 mb-2">{category}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {list.map((skill) => (
                                            <span key={skill} className="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-sm font-medium">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

function App() {
    // =================================================================================
    // ** IMPORTANT AI CONFIGURATION **
    // 1. Get your API key from Google AI Studio: https://aistudio.google.com/app/apikey
    // 2. Paste your key here.
    // NOTE: For this environment, the key might be provided automatically.
    // If AI features don't work, adding your key here is the first step.
    // =================================================================================
    const [apiKey] = useState("AIzaSyAL6l2zcezxZIuzv81CpJUnE86VCONwNWo"); 

    // UI State
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Data State
    const [allCoins, setAllCoins] = useState([]);
    const [loadingCoins, setLoadingCoins] = useState(true);
    const [prices, setPrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);

    // User Data State
    const [portfolio, setPortfolio] = useState(() => {
        try {
            const saved = localStorage.getItem('cryptoPortfolio');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            return [];
        }
    });
    const [alerts, setAlerts] = useState(() => {
        try {
            const saved = localStorage.getItem('cryptoAlerts');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            return [];
        }
    });

    // --- Effects for Data Fetching and Persistence ---

    // Fetch all coins list on initial load
    useEffect(() => {
        const fetchCoins = async () => {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
                const data = await response.json();
                setAllCoins(data);
            } catch (error) {
                showMessage('Failed to load coin list from CoinGecko.', 'error');
                console.error("Error fetching coin list:", error);
            } finally {
                setLoadingCoins(false);
            }
        };
        fetchCoins();
    }, []);

    // Fetch prices for portfolio coins periodically
    useEffect(() => {
        const fetchPrices = async () => {
            if (portfolio.length === 0) {
                setPrices({});
                return;
            };
            setLoadingPrices(true);
            const ids = portfolio.map(item => item.id).join(',');
            try {
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
                const data = await response.json();
                setPrices(data);
            } catch (error) {
                showMessage('Failed to update prices.', 'error');
                console.error("Error fetching prices:", error);
            } finally {
                setLoadingPrices(false);
            }
        };

        fetchPrices(); // Initial fetch
        const interval = setInterval(fetchPrices, 60000); // Refresh every 60 seconds
        return () => clearInterval(interval);
    }, [portfolio]);

    // Save portfolio and alerts to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio));
    }, [portfolio]);

    useEffect(() => {
        localStorage.setItem('cryptoAlerts', JSON.stringify(alerts));
    }, [alerts]);
    
    // Check for triggered alerts whenever prices or alerts change
    useEffect(() => {
        if (Object.keys(prices).length > 0 && alerts.length > 0) {
            const updatedAlerts = alerts.map(alert => {
                const currentPrice = prices[alert.coinId]?.usd;
                if (!currentPrice || alert.triggered) return alert;

                let triggered = false;
                if (alert.type === 'above' && currentPrice >= alert.targetPrice) {
                    triggered = true;
                } else if (alert.type === 'below' && currentPrice <= alert.targetPrice) {
                    triggered = true;
                }

                if (triggered) {
                    showMessage(`Alert! ${allCoins.find(c=>c.id === alert.coinId)?.name} is now ${alert.type} $${alert.targetPrice}`, 'info');
                    return { ...alert, triggered: true };
                }
                return alert;
            });
            setAlerts(updatedAlerts);
        }
    }, [prices, alerts, allCoins]);


    // --- Memoized Calculations for Performance ---

    const portfolioData = useMemo(() => {
        return portfolio.map(item => {
            const priceData = prices[item.id];
            const coinName = allCoins.find(coin => coin.id === item.id)?.name || item.id;
            const value = priceData?.usd ? (item.quantity * priceData.usd) : 0;
            const purchaseValue = item.purchasePrice ? (item.quantity * item.purchasePrice) : 0;
            const profitLoss = value - purchaseValue;
            const profitLossPercent = purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

            return {
                name: coinName,
                value,
                id: item.id,
                quantity: item.quantity,
                currentPrice: priceData?.usd,
                change24h: priceData?.usd_24h_change,
                purchasePrice: item.purchasePrice,
                purchaseValue,
                profitLoss,
                profitLossPercent
            };
        }).filter(item => item.quantity > 0);
    }, [portfolio, prices, allCoins]);

    const { totalPortfolioValue, totalProfitLoss, totalProfitLossPercent } = useMemo(() => {
        const totalValue = portfolioData.reduce((acc, item) => acc + item.value, 0);
        const totalPurchaseValue = portfolioData.reduce((acc, item) => acc + item.purchaseValue, 0);
        const profitLoss = totalValue - totalPurchaseValue;
        const profitLossPercent = totalPurchaseValue > 0 ? (profitLoss / totalPurchaseValue) * 100 : 0;
        return {
            totalPortfolioValue: totalValue,
            totalProfitLoss: profitLoss,
            totalProfitLossPercent: profitLossPercent
        };
    }, [portfolioData]);

    const pieChartData = useMemo(() => {
        return portfolioData
            .map(item => ({ name: allCoins.find(c => c.id === item.id)?.symbol.toUpperCase() || item.id, value: item.value }))
            .filter(item => item.value > 0);
    }, [portfolioData, allCoins]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943'];

    // --- Handler Functions ---

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

    const showMessage = (text, type = 'info', duration = 3000) => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), duration);
    };

    const navLinks = [
        { path: '/', name: 'Dashboard', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> },
        { path: '/portfolio', name: 'Portfolio', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> },
        { path: '/assistant', name: 'AI Assistant', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg> },
        { path: '/about', name: 'About', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> },
    ];

    return (
        <Router>
            <div className={isDarkMode ? 'dark' : ''}>
                <MessageBox message={message.text} type={message.type} onClose={() => setMessage({ text: '', type: '' })} />
                <Layout isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} navLinks={navLinks}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Dashboard
                                    portfolioData={portfolioData}
                                    totalPortfolioValue={totalPortfolioValue}
                                    totalProfitLoss={totalProfitLoss}
                                    totalProfitLossPercent={totalProfitLossPercent}
                                    loadingPrices={loadingPrices}
                                    allCoins={allCoins}
                                    pieChartData={pieChartData}
                                    COLORS={COLORS}
                                />
                            }
                        />
                        <Route
                            path="/portfolio"
                            element={
                                <Portfolio
                                    portfolio={portfolio}
                                    setPortfolio={setPortfolio}
                                    prices={prices}
                                    allCoins={allCoins}
                                    showMessage={showMessage}
                                    portfolioData={portfolioData}
                                    alerts={alerts}
                                    setAlerts={setAlerts}
                                    loadingCoins={loadingCoins}
                                />
                            }
                        />
                        <Route
                            path="/assistant"
                            element={
                                <GeminiAssistant
                                    allCoins={allCoins}
                                    prices={prices}
                                    portfolioData={portfolioData}
                                    totalPortfolioValue={totalPortfolioValue}
                                    totalProfitLoss={totalProfitLoss}
                                    totalProfitLossPercent={totalProfitLossPercent}
                                    apiKey={apiKey}
                                />
                            }
                        />
                        <Route
                            path="/about"
                            element={ <About /> }
                        />
                    </Routes>
                </Layout>
            </div>
        </Router>
    );
}

export default App;
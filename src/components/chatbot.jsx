import React, { useState, useEffect, useRef } from 'react';

/**
 * PAL Math Interpreter - Executes structured math expressions
 */
class PALInterpreter {
  executeMathExpression(expression) {
    try {
      // Clean the expression
      const cleaned = expression.trim().replace(/\s+/g, '');
      
      // Check for very large numbers (10+ digits)
      const hasLargeNumbers = /\d{10,}/.test(cleaned);
      
      if (hasLargeNumbers) {
        return this.evaluateBigInt(cleaned);
      }
      
      // Evaluate using safe function
      const result = Function(`"use strict"; return (${cleaned})`)();
      return {
        success: true,
        result: result,
        formatted: this.formatNumber(result)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  evaluateBigInt(expr) {
    try {
      const match = expr.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
      if (!match) {
        throw new Error('Complex expression not supported');
      }

      const [, num1, op, num2] = match;
      const a = BigInt(num1);
      const b = BigInt(num2);

      let result;
      switch (op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = a / b; break;
        default: throw new Error(`Unsupported operator: ${op}`);
      }

      return {
        success: true,
        result: result.toString(),
        formatted: result.toString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatNumber(num) {
    if (typeof num === 'string') return num;
    if (typeof num !== 'number') return String(num);
    
    if (Math.abs(num) < 0.0001 || Math.abs(num) > 1e10) {
      return num.toExponential(4);
    }
    
    return Math.round(num * 1e6) / 1e6;
  }
}

const palInterpreter = new PALInterpreter();

/**
 * Ollama Service with 3-Stage Pipeline
 */
class OllamaService {
  constructor() {
    this.baseUrl = 'http://localhost:11434';
    this.model = 'llama3';
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async generate(prompt, options = {}) {
    const requestBody = {
      model: options.model || this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        ...options.modelOptions
      }
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  isMathQuery(query) {
    const mathKeywords = [
      'calculate', 'compute', 'solve', 'what is', 'how much',
      'sum', 'difference', 'product', 'quotient', 'average',
      'percentage', 'percent', 'add', 'subtract', 'multiply', 'divide',
      'plus', 'minus', 'times'
    ];

    const lowerQuery = query.toLowerCase();
    const hasKeyword = mathKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasArithmetic = /\d+[\s]*[+\-*/^%][\s]*\d+/.test(query);
    
    return hasKeyword || hasArithmetic;
  }

  async solveWithPipeline(userQuery) {
    const stages = [];

    // STAGE 1: LLM extracts math expression
    stages.push({
      stage: 1,
      name: 'LLM: Extract Math Expression',
      status: 'running'
    });

    const extractPrompt = `Extract the mathematical expression from this question. Return ONLY the math expression with numbers and operators, nothing else.

Question: "${userQuery}"

Examples:
- "how much is 42987429742+43434343?" → "42987429742+43434343"
- "what is 25% of 480?" → "480*0.25"
- "calculate 100 minus 37" → "100-37"

Expression:`;

    const mathExpression = await this.generate(extractPrompt, { temperature: 0.1 });
    const cleanedExpression = mathExpression.trim().replace(/[^0-9+\-*/().]/g, '');

    stages[0].status = 'complete';
    stages[0].output = cleanedExpression;

    // STAGE 2: PAL executes the expression
    stages.push({
      stage: 2,
      name: 'PAL: Execute Math',
      status: 'running',
      input: cleanedExpression
    });

    const palResult = palInterpreter.executeMathExpression(cleanedExpression);

    if (!palResult.success) {
      stages[1].status = 'error';
      stages[1].error = palResult.error;
      return { stages, success: false };
    }

    stages[1].status = 'complete';
    stages[1].output = palResult.formatted;

    // STAGE 3: LLM formats the final response
    stages.push({
      stage: 3,
      name: 'LLM: Format Response',
      status: 'running',
      input: {
        question: userQuery,
        expression: cleanedExpression,
        result: palResult.formatted
      }
    });

    const formatPrompt = `Format this math solution into a friendly response.

Question: "${userQuery}"
Expression: ${cleanedExpression}
Result: ${palResult.formatted}

Provide a natural, conversational response that includes the answer. Be concise.`;

    const finalResponse = await this.generate(formatPrompt, { temperature: 0.5 });

    stages[2].status = 'complete';
    stages[2].output = finalResponse.trim();

    return {
      stages,
      success: true,
      finalAnswer: finalResponse.trim()
    };
  }
}

const ollamaService = new OllamaService();

/**
 * Chatbot Component
 */
const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showPipeline, setShowPipeline] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initializeChatbot();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeChatbot = async () => {
    setIsConnecting(true);
    try {
      const available = await ollamaService.isAvailable();
      setOllamaAvailable(available);

      if (available) {
        setMessages([{
          id: Date.now(),
          role: 'assistant',
          content: `Hello! I am your AI assistant.`,
          timestamp: new Date().toISOString()
        }]);
      } else {
        setMessages([{
          id: Date.now(),
          role: 'assistant',
          content: `❌ **Ollama Connection Failed**

Please start Ollama: \`ollama serve\``,
          timestamp: new Date().toISOString(),
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !ollamaAvailable) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      if (ollamaService.isMathQuery(currentInput)) {
        // Use 3-stage pipeline for math
        const pipelineResult = await ollamaService.solveWithPipeline(currentInput);

        if (pipelineResult.success) {
          let responseContent = '';

          if (showPipeline) {
            responseContent = `**AI Response**\n\n`;
            
            pipelineResult.stages.forEach(stage => {
              const statusEmoji = stage.status === 'complete' ? '✅' : stage.status === 'error' ? '❌' : '⏳';
              responseContent += `**${statusEmoji} Stage ${stage.stage}: ${stage.name}**\n`;
              
              if (stage.input) {
                responseContent += `Input: \`${typeof stage.input === 'string' ? stage.input : JSON.stringify(stage.input)}\`\n`;
              }
              
              if (stage.output) {
                responseContent += `Output: \`${stage.output}\`\n`;
              }
              
              if (stage.error) {
                responseContent += `Error: ${stage.error}\n`;
              }
              
              responseContent += '\n';
            });
            
            responseContent += `---\n\n**Final Answer:**\n${pipelineResult.finalAnswer}`;
          } else {
            responseContent = pipelineResult.finalAnswer;
          }

          const assistantMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString(),
            isPipeline: true
          };

          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error('Pipeline execution failed');
        }
      } else {
        // Regular chat for non-math queries
        const response = await ollamaService.generate(currentInput);
        
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ **Error:** ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm opacity-70">Connecting to Ollama...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI Assistant</h2>
            <p className="text-xs text-gray-500">
              {ollamaAvailable ? '' : 'Disconnected'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPipeline(!showPipeline)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              showPipeline 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-600 border border-gray-300'
            }`}
          >
            {showPipeline ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={() => {
              setMessages([]);
              initializeChatbot();
            }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : message.isPipeline
                  ? 'bg-white text-gray-900 border border-gray-200'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <div 
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: message.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
                    .replace(/---/g, '<hr class="my-3 border-gray-200">')
                    .replace(/\n/g, '<br>')
                }}
              />
              <div className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
              }`}>
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl px-4 py-3 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-gray-600">Processing pipeline...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={ollamaAvailable ? "Type your message..." : "Ollama not available"}
            className="flex-1 resize-none px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            rows="2"
            disabled={!ollamaAvailable || isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || !ollamaAvailable}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
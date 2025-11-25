# AI Learning Chatbot

A sophisticated chatbot that combines Large Language Models (LLM) with Program-Aided Language (PAL) capabilities for enhanced mathematical problem-solving.

## 🚀 Features

- **Natural Language Processing**: Powered by Ollama's LLM for understanding and generating human-like responses
- **Mathematical Precision**: PAL interpreter for accurate mathematical computations
- **3-Stage Processing Pipeline**:
  1. Expression Extraction
  2. Mathematical Execution
  3. Natural Language Response Generation
- **Responsive UI**: Clean, modern interface built with React and Tailwind CSS
- **Real-time Processing**: Immediate feedback with loading states

## 🏗️ Architecture

### Core Components

1. **OllamaService**
   - Manages communication with the Ollama LLM
   - Handles prompt engineering and response parsing
   - Implements the 3-stage processing pipeline

2. **PALInterpreter**
   - Safely executes mathematical expressions
   - Supports both regular numbers and BigInt for large calculations
   - Implements strict input validation and sanitization

3. **Chatbot UI**
   - State management with React Hooks
   - Responsive message rendering
   - Interactive input handling

## 🛠️ Technical Details

### Math Processing Pipeline

1. **Expression Extraction**
   - LLM parses natural language to extract mathematical expressions
   - Handles various phrasings and formats

2. **Mathematical Execution**
   - PAL evaluates expressions with precision
   - Supports:
     - Basic arithmetic (+, -, *, /)
     - Large number handling with BigInt
     - Percentage calculations

3. **Response Generation**
   - LLM formats results into natural language
   - Provides context-aware responses

### Security Measures
- Input sanitization
- Restricted function evaluation
- Error boundary handling
- No external code execution

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Ollama server running locally
- Ollama model (llama3) installed

### Installation
```bash
npm install
npm run dev
```

### Environment Variables
Create a `.env` file in the root directory:
```env
OLLAMA_API_URL=http://localhost:11434
```

## 📚 Usage

1. Start the development server
2. Open the chat interface
3. Type your math questions or general queries
4. View the step-by-step processing

## 🤖 Example Queries
- "What is 25% of 80?"
- "Calculate 1234567890 + 9876543210"
- "How much is 15 * (20 + 5)?"

## 📝 License
MIT

## 🙏 Acknowledgements
- [Ollama](https://ollama.ai/) for the LLM backend
- [React](https://reactjs.org/) for the UI framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import io from 'socket.io-client';
import axios from 'axios';
import Participants from './Participants';
import Chat from './Chat';

const LANGUAGES = ['javascript', 'python', 'c', 'cpp', 'java', 'text'];

const DEFAULT_CODES = {
  javascript: '// Start coding here',
  python: '# Start coding here',
  c: '/* Start coding here */',
  cpp: '// Start coding here',
  java: '// Start coding here',
  text: '',
};

function connectSocket(socketRef, roomId, user, color, setCodes, setLanguage, setParticipants, setTypingUsers) {
  try {
    const socket = io(process.env.REACT_APP_API_URL);
    socketRef.current = socket;

    socket.emit('join-room', {
      roomId,
      username: user,
      avatarColor: color
    });

    socket.on('room-joined', (data) => {
      setCodes(data.codes || { ...DEFAULT_CODES });
      setLanguage(data.language || 'javascript');
      setParticipants(data.participants);
    });

    socket.on('code-updated', (data) => {
      setCodes(prev => ({
        ...prev,
        [data.language]: data.code
      }));
    });

    socket.on('user-joined', (data) => {
      setParticipants(prev => {
        if (prev.find(p => p.socketId === data.socketId)) {
          return prev;
        }
        return [...prev, data];
      });
    });

    socket.on('user-left', (data) => {
      setParticipants(prev => prev.filter(p => p.socketId !== data.socketId));
    });

    socket.on('user-typing', (data) => {
      setTypingUsers(prev => [...prev, data.socketId]);
    });

    socket.on('user-stopped-typing', (data) => {
      setTypingUsers(prev => prev.filter(id => id !== data.socketId));
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data.message);
      alert('Connection error: ' + data.message);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      alert('Failed to connect to server: ' + err.message + '. Please ensure the server is running.');
    });

    // Cleanup function will be handled in useEffect
    return;
  } catch (err) {
    console.error('Failed to create socket connection:', err);
    alert('Failed to establish real-time connection. You can still edit locally, but collaboration features may not work.');
    return;
  }
}

const CodeEditor = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const [codes, setCodes] = useState({ ...DEFAULT_CODES });
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('dark');
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const socketRef = useRef();
  const editorRef = useRef();
  const saveTimeoutRef = useRef();

  const code = codes[language];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const state = location.state;
    try {
      if (state && state.username && state.avatarColor) {
        setUsername(state.username);
        connectSocket(
          socketRef,
          roomId,
          state.username,
          state.avatarColor,
          setCodes,
          setLanguage,
          setParticipants,
          setTypingUsers
        );
      } else {
        const promptUsername = prompt('Enter your username:');
        if (promptUsername) {
          setUsername(promptUsername);
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          connectSocket(
            socketRef,
            roomId,
            promptUsername,
            color,
            setCodes,
            setLanguage,
            setParticipants,
            setTypingUsers
          );
        }
      }
    } catch (err) {
      console.error('Failed to initialize editor:', err);
      alert('Failed to connect to the room. Please check if the server is running and try again.');
    }
    const cleanupSocket = socketRef.current;
    return () => {
      if (cleanupSocket) {
        cleanupSocket.emit('leave-room');
        cleanupSocket.disconnect();
      }
    };
  }, [roomId, location]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('custom-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#f3f4f6',
      }
    });
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
      }
    });
    monaco.editor.setTheme(theme === 'dark' ? 'custom-dark' : 'custom-light');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('');
    try {
      let result = '';
      if (language === 'javascript') {
        const oldLog = console.log;
        const oldError = console.error;
        let logs = [];
        console.log = (...args) => {
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
          oldLog.apply(console, args);
        };
        console.error = (...args) => {
          logs.push('Error: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
          oldError.apply(console, args);
        };
        try {
          // eslint-disable-next-line no-new-func
          new Function(code)();
          result = logs.join('\n') || 'Execution completed (no output).';
        } catch (e) {
          result = 'Error: ' + e.message;
        } finally {
          console.log = oldLog;
          console.error = oldError;
        }
      } else if (language === 'python') {
        result = 'Python execution is not available in this deployment.';
      } else if (language === 'text') {
        result = code || 'No text entered.';
      } else {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/execute`, { language, code });
        if (response.data.output) {
          result = response.data.output;
        }
        if (response.data.error) {
          result = 'Error: ' + response.data.error;
        }
      }
      setOutput(result);
    } catch (err) {
      setOutput('Error: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
    setOutput('');
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleCodeChange = (value) => {
    setCodes(prev => ({
      ...prev,
      [language]: value
    }));
    if (socketRef.current) {
      socketRef.current.emit('code-change', {
        roomId,
        language,
        code: value,
        timestamp: Date.now()
      });
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('save-snapshot', { roomId, code: value });
      }, 30000);
    }
  };

  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;
    const handler = (data) => {
      setCodes(prev => ({
        ...prev,
        [data.language]: data.code
      }));
    };
    socket.on('code-updated', handler);
    return () => {
      socket.off('code-updated', handler);
    };
  }, []);

  const handleTypingStart = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing-start', { roomId });
    }
  };

  const handleTypingStop = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing-stop', { roomId });
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      alert('Room ID copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <header className={`shadow px-4 py-2 flex justify-between items-center ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold">Room: {roomId}</h1>
          <button
            onClick={copyRoomId}
            className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            title="Copy Room ID"
          >
            📋
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm"
          >
            {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
          <Participants participants={participants} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 relative">
            <Editor
              key={language}
              height="70vh"
              language={language === 'text' ? 'plaintext' : language}
              value={codes[language]}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              onMouseDown={handleTypingStart}
              onKeyDown={handleTypingStart}
              onKeyUp={handleTypingStop}
              onMouseUp={handleTypingStop}
            />
            {typingUsers.length > 0 && (
              <div className={`absolute top-2 right-2 px-2 py-1 rounded text-sm ${theme === 'dark' ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-200'}`}>
                {typingUsers.length} user(s) typing...
              </div>
            )}
          </div>
          <div className={`h-[30vh] p-4 overflow-y-auto border-t ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-600 text-white'
              : 'bg-gray-100 border-gray-300 text-gray-800'
          }`}>
            <h3 className="font-semibold mb-2">Output:</h3>
            <pre className="whitespace-pre-wrap text-xs">{output || 'Click Run to see output here...'}</pre>
          </div>
        </div>
        <Chat socket={socketRef.current} roomId={roomId} username={username} theme={theme} />
      </div>
    </div>
  );
};

export default CodeEditor;
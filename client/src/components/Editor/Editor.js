/* global loadPyodide */

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import io from 'socket.io-client';
import axios from 'axios';
import Participants from './Participants';
import Chat from './Chat';

const CodeEditor = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const [code, setCode] = useState('// Start coding here');
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('dark');
  const [participants, setParticipants] = useState([]);
  const [cursors, setCursors] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [avatarColor, setAvatarColor] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideLoaded, setPyodideLoaded] = useState(false);
  const [pyodideInstance, setPyodideInstance] = useState(null); // NEW
  const socketRef = useRef();
  const editorRef = useRef();
  const saveTimeoutRef = useRef();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

useEffect(() => {
  let isMounted = true;
  async function loadPyodideScript() {
    if (!window.loadPyodide) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
      script.async = true;
      script.onerror = (e) => {
        console.error('Pyodide script failed to load:', e);
        setOutput('Pyodide script failed to load. Check your network, CDN access, or browser extensions.');
      };
      script.onload = async () => {
        if (window.loadPyodide) {
          try {
            const pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
            if (isMounted) {
              setPyodideInstance(pyodide);
              setPyodideLoaded(true);
            }
          } catch (err) {
            console.error('Pyodide failed to initialize:', err);
            setOutput('Pyodide failed to initialize.');
          }
        } else {
          setOutput('Pyodide global not found after script load.');
        }
      };
      document.head.appendChild(script);
    } else {
      try {
        const pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
        setPyodideInstance(pyodide);
        setPyodideLoaded(true);
      } catch (err) {
        console.error('Pyodide failed to initialize:', err);
        setOutput('Pyodide failed to initialize.');
      }
    }
  }
  loadPyodideScript();
  return () => { isMounted = false; };
}, []);

  useEffect(() => {
    const state = location.state;
    let cleanup;
    try {
      if (state && state.username && state.avatarColor) {
        setUsername(state.username);
        setAvatarColor(state.avatarColor);
        cleanup = connectSocket(state.username, state.avatarColor);
      } else {
        const promptUsername = prompt('Enter your username:');
        if (promptUsername) {
          setUsername(promptUsername);
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          setAvatarColor(color);
          cleanup = connectSocket(promptUsername, color);
        }
      }
    } catch (err) {
      console.error('Failed to initialize editor:', err);
      alert('Failed to connect to the room. Please check if the server is running on port 5000 and try again.');
    }
    return cleanup || (() => {});
  }, [roomId, location]);

  const connectSocket = (user, color) => {
    try {
      const socket = io('http://localhost:5000');
      socketRef.current = socket;

      socket.emit('join-room', {
        roomId,
        username: user,
        avatarColor: color
      });

      socket.on('room-joined', (data) => {
        try {
          setCode(data.code);
          setLanguage(data.language);
          setParticipants(data.participants);
        } catch (e) {
          console.error('Error handling room-joined:', e);
        }
      });

      socket.on('code-updated', (data) => {
        try {
          setCode(data.code);
        } catch (e) {
          console.error('Error handling code-updated:', e);
        }
      });

      socket.on('cursor-moved', (data) => {
        try {
          setCursors(prev => ({ ...prev, [data.socketId]: data }));
        } catch (e) {
          console.error('Error handling cursor-moved:', e);
        }
      });

      socket.on('user-joined', (data) => {
        try {
          setParticipants(prev => [...prev, data]);
        } catch (e) {
          console.error('Error handling user-joined:', e);
        }
      });

      socket.on('user-left', (data) => {
        try {
          setParticipants(prev => prev.filter(p => p.socketId !== data.socketId));
          setCursors(prev => {
            const newCursors = { ...prev };
            delete newCursors[data.socketId];
            return newCursors;
          });
        } catch (e) {
          console.error('Error handling user-left:', e);
        }
      });

      socket.on('user-typing', (data) => {
        try {
          setTypingUsers(prev => [...prev, data.socketId]);
        } catch (e) {
          console.error('Error handling user-typing:', e);
        }
      });

      socket.on('user-stopped-typing', (data) => {
        try {
          setTypingUsers(prev => prev.filter(id => id !== data.socketId));
        } catch (e) {
          console.error('Error handling user-stopped-typing:', e);
        }
      });

      socket.on('error', (data) => {
        try {
          console.error('Socket error:', data.message);
          alert('Connection error: ' + data.message);
        } catch (e) {
          console.error('Error in error handler:', e);
        }
      });

      socket.on('connect_error', (err) => {
        try {
          console.error('Connection error:', err);
          alert('Failed to connect to server: ' + err.message + '. Please ensure the server is running on port 5000.');
        } catch (e) {
          console.error('Error in connect_error handler:', e);
        }
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.emit('leave-room');
          socketRef.current.disconnect();
        }
      };
    } catch (err) {
      console.error('Failed to create socket connection:', err);
      alert('Failed to establish real-time connection. You can still edit locally, but collaboration features may not work.');
      return () => {};
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    // Add cursor decorations for other users
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
          new Function(code)();
          setOutput(logs.join('\n') || 'Execution completed (no output).');
        } catch (e) {
          setOutput('Error: ' + e.message);
        } finally {
          console.log = oldLog;
          console.error = oldError;
        }
      } else if (language === 'python') {
        if (!pyodideLoaded || !pyodideInstance) {
          setOutput('Pyodide is loading... Please wait and try again.');
          return;
        }
        try {
          let result = pyodideInstance.runPython(code);
          setOutput(result ? String(result) : 'Execution completed (no output).');
        } catch (e) {
          setOutput('Error: ' + e.message);
        }
      } else {
        // C, C++, Java - send to backend
        const response = await axios.post('http://localhost:5000/api/execute', { language, code });
        if (response.data.output) {
          setOutput(response.data.output);
        }
        if (response.data.error) {
          setOutput('Error: ' + response.data.error);
        }
      }
    } catch (err) {
      setOutput('Error: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCodeChange = (value) => {
    setCode(value);
    if (socketRef.current) {
      socketRef.current.emit('code-change', {
        roomId,
        code: value,
        timestamp: Date.now()
      });
      // Auto-save every 30 seconds
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('save-snapshot', { roomId, code: value });
      }, 30000);
    }
  };

  const handleCursorChange = (e) => {
    if (socketRef.current && e) {
      socketRef.current.emit('cursor-update', {
        roomId,
        position: e.position,
        selection: e.selection
      });
    }
  };

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

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <header className={`shadow px-4 py-2 flex justify-between items-center ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <h1 className="text-xl font-bold">Room: {roomId}</h1>
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
            onChange={(e) => setLanguage(e.target.value)}
            className="border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
          <Participants participants={participants} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 relative">
            <Editor
              height="70vh"
              language={language}
              value={code}
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
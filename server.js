const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());

const http = require('http');
const path = require('path');
const {Server} = require('socket.io');
const vm = require('vm');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

const ACTIONS = require('./src/actions/Actions');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

// Function to execute code based on language
async function executeCode(code, language) {
    const tempDir = os.tmpdir();
    const fileId = Date.now() + Math.random().toString(36).substr(2, 9);
    let filePath, command, args;

    try {
        switch (language) {
            case 'javascript':
            case 'jsx':
                // Use vm module for JavaScript
                const logs = [];
                const context = {
                    console: {
                        log: (...args) => logs.push(args.join(' ')),
                        error: (...args) => logs.push('ERROR: ' + args.join(' ')),
                        warn: (...args) => logs.push('WARN: ' + args.join(' '))
                    }
                };
                const script = new vm.Script(code);
                const result = script.runInNewContext(context, { timeout: 5000 });

                if (logs.length > 0) {
                    return logs.join('\n');
                }
                return result !== undefined ? result.toString() : 'Code executed successfully (no output)';

            case 'python':
                filePath = path.join(tempDir, `temp_${fileId}.py`);
                fs.writeFileSync(filePath, code);
                const pythonResult = await execAsync(`python3 "${filePath}" || python "${filePath}"`, { timeout: 10000 });
                return pythonResult.stdout || 'Code executed successfully (no output)';

            case 'java':
                try {
                    // Extract class name from the code - handle various formats
                    const classMatch = code.match(/(?:public\s+)?class\s+(\w+)[\s\S]*?\{/);
                    const className = classMatch ? classMatch[1] : 'Main';

                    // Check for package declaration
                    const packageMatch = code.match(/package\s+([\w.]+);/);
                    const packageName = packageMatch ? packageMatch[1] : null;

                    // Create proper file path
                    let fileName = `${className}.java`;
                    if (packageName) {
                        const packagePath = packageName.replace(/\./g, '/');
                        const packageDir = path.join(tempDir, packagePath);
                        fs.mkdirSync(packageDir, { recursive: true });
                        filePath = path.join(packageDir, fileName);
                    } else {
                        filePath = path.join(tempDir, fileName);
                    }

                    // Write the Java file
                    fs.writeFileSync(filePath, code);

                    // Compile the Java file
                    const compileCommand = packageName
                        ? `javac -d "${tempDir}" "${filePath}"`
                        : `javac "${filePath}"`;

                    const compileResult = await execAsync(compileCommand, { timeout: 10000 });

                    // Check for compilation errors
                    if (compileResult.stderr) {
                        return `Compilation Error:\n${compileResult.stderr}`;
                    }

                    // Run the Java program
                    const runCommand = packageName
                        ? `java -cp "${tempDir}" ${packageName}.${className}`
                        : `java -cp "${tempDir}" ${className}`;

                    const javaResult = await execAsync(runCommand, { timeout: 10000 });
                    return javaResult.stdout || 'Code executed successfully (no output)';

                } catch (compileError) {
                    // Handle compilation errors specifically
                    if (compileError.message.includes('javac')) {
                        return `Compilation Error: Please check your Java syntax. Common issues:\n- Class declarations should not have parentheses: 'class Main' not 'class Main()'\n- Missing semicolons or braces\n- Incorrect method signatures\n\nDetails: ${compileError.message}`;
                    }
                    return `Java Error: ${compileError.message}`;
                }

            case 'clike': // C/C++
                const isCpp = code.includes('#include <iostream>') || code.includes('using namespace std');
                const ext = isCpp ? 'cpp' : 'c';
                filePath = path.join(tempDir, `temp_${fileId}.${ext}`);
                fs.writeFileSync(filePath, code);
                const compiler = isCpp ? 'g++' : 'gcc';
                const exePath = path.join(tempDir, `temp_${fileId}`);
                await execAsync(`${compiler} "${filePath}" -o "${exePath}"`, { timeout: 10000 });
                const cResult = await execAsync(`"${exePath}"`, { timeout: 10000 });
                return cResult.stdout || 'Code executed successfully (no output)';

            case 'php':
                filePath = path.join(tempDir, `temp_${fileId}.php`);
                fs.writeFileSync(filePath, code);
                const phpResult = await execAsync(`php "${filePath}"`, { timeout: 10000 });
                return phpResult.stdout || 'Code executed successfully (no output)';

            case 'ruby':
                filePath = path.join(tempDir, `temp_${fileId}.rb`);
                fs.writeFileSync(filePath, code);
                const rubyResult = await execAsync(`ruby "${filePath}"`, { timeout: 10000 });
                return rubyResult.stdout || 'Code executed successfully (no output)';

            case 'go':
                filePath = path.join(tempDir, `temp_${fileId}.go`);
                fs.writeFileSync(filePath, code);
                const goResult = await execAsync(`go run "${filePath}"`, { timeout: 15000 });
                return goResult.stdout || 'Code executed successfully (no output)';

            case 'rust':
                filePath = path.join(tempDir, `temp_${fileId}.rs`);
                fs.writeFileSync(filePath, code);
                const rustResult = await execAsync(`rustc "${filePath}" --out-dir "${tempDir}" && "${path.join(tempDir, 'temp_' + fileId)}"`, { timeout: 15000 });
                return rustResult.stdout || 'Code executed successfully (no output)';

            case 'shell':
                const shellResult = await execAsync(code, { timeout: 10000, shell: true });
                return shellResult.stdout || 'Code executed successfully (no output)';

            case 'dart':
                filePath = path.join(tempDir, `temp_${fileId}.dart`);
                fs.writeFileSync(filePath, code);
                const dartResult = await execAsync(`dart run "${filePath}"`, { timeout: 10000 });
                return dartResult.stdout || 'Code executed successfully (no output)';

            case 'swift':
                filePath = path.join(tempDir, `temp_${fileId}.swift`);
                fs.writeFileSync(filePath, code);
                const swiftResult = await execAsync(`swift "${filePath}"`, { timeout: 10000 });
                return swiftResult.stdout || 'Code executed successfully (no output)';

            case 'r':
                filePath = path.join(tempDir, `temp_${fileId}.r`);
                fs.writeFileSync(filePath, code);
                const rResult = await execAsync(`Rscript "${filePath}"`, { timeout: 10000 });
                return rResult.stdout || 'Code executed successfully (no output)';

            default:
                return `Language '${language}' is not supported for execution.`;
        }
    } catch (error) {
        return `Error: ${error.message}`;
    } finally {
        // Clean up temporary files
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Clean up compiled files based on language
            if (language === 'java') {
                const classMatch = code.match(/(?:public\s+)?class\s+(\w+)/);
                const className = classMatch ? classMatch[1] : 'Main';
                const classFile = path.join(tempDir, `${className}.class`);
                if (fs.existsSync(classFile)) {
                    fs.unlinkSync(classFile);
                }
            } else {
                // For other languages, clean up executable files
                const exePath = path.join(tempDir, `temp_${fileId}`);
                if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
                if (fs.existsSync(exePath + '.exe')) fs.unlinkSync(exePath + '.exe');
            }
        } catch (cleanupError) {
            console.log('Cleanup error:', cleanupError.message);
        }
    }
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({roomId, username}) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({socketId}) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({roomId, code}) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    socket.on(ACTIONS.SYNC_CODE, ({socketId, code}) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    socket.on(ACTIONS.RUN_CODE, async ({roomId, code, language}) => {
        console.log('RUN_CODE received:', {roomId, language, codeLength: code.length});

        try {
            const output = await executeCode(code, language);
            console.log('Emitting CODE_OUTPUT:', output);
            io.in(roomId).emit(ACTIONS.CODE_OUTPUT, { output });
        } catch (error) {
            console.log('RUN_CODE error:', error);
            const errorMessage = `Error: ${error.message}`;
            io.in(roomId).emit(ACTIONS.CODE_OUTPUT, { output: errorMessage });
        }
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

// Serve response in production
app.get('/', (req, res) => {
    const htmlContent = '<h1>Welcome to the code editor server</h1>';
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
});

const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
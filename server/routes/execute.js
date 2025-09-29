const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const router = express.Router();

// Temp dir for compilation
const tempDir = path.join(os.tmpdir(), 'codecollab');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// POST /api/execute
router.post('/execute', async (req, res) => {
  const { language, code } = req.body;
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code required' });
  }

  const tempFile = path.join(tempDir, `code_${Date.now()}.${getExtension(language)}`);
  let output = '';
  let error = '';

  try {
    // Write code to temp file
    fs.writeFileSync(tempFile, code);

    let command;
    let execFile;

    switch (language) {
      case 'c':
        command = `gcc ${tempFile} -o ${tempFile}.out 2>&1 && ./${tempFile}.out`;
        execFile = tempFile + '.out';
        break;
      case 'cpp':
        command = `g++ ${tempFile} -o ${tempFile}.out 2>&1 && ./${tempFile}.out`;
        execFile = tempFile + '.out';
        break;
      case 'java':
        let javaCode = code;
        let className = 'Main';
        const classMatch = code.match(/public class (\w+)/);
        if (classMatch) {
          className = classMatch[1];
        } else {
          javaCode = `public class ${className} {\n${code}\n}`;
        }
        fs.writeFileSync(tempFile, javaCode);
        command = `javac ${tempFile} 2>&1 && java ${className}`;
        execFile = null; // Java runs in place
        break;
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    // Execute compilation and run
    exec(command, { cwd: tempDir, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        error = stderr || err.message;
      } else {
        output = stdout;
        if (execFile && fs.existsSync(execFile)) {
          // Run the executable if compilation succeeded
          exec(`./${path.basename(execFile)}`, { cwd: tempDir, timeout: 5000 }, (runErr, runStdout, runStderr) => {
            if (runErr) {
              error = runStderr || runErr.message;
            } else {
              output += runStdout;
            }
            cleanup();
            res.json({ output, error });
          });
        } else {
          cleanup();
          res.json({ output, error });
        }
      }
    });

    const cleanup = () => {
      try {
        fs.unlinkSync(tempFile);
        if (fs.existsSync(tempFile + '.out')) fs.unlinkSync(tempFile + '.out');
        if (language === 'java') {
          const classFile = tempFile.replace('.java', '.class');
          if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
        }
      } catch (e) {
        console.log('Cleanup error:', e);
      }
    };

  } catch (e) {
    error = e.message;
    res.json({ output, error });
  }
});

function getExtension(lang) {
  switch (lang) {
    case 'c': return 'c';
    case 'cpp': return 'cpp';
    case 'java': return 'java';
    default: return 'txt';
  }
}

module.exports = router;

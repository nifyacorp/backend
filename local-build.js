// Local build script to help diagnose build issues
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Function to execute a command and return a promise
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command}`);
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`);
        console.error(stderr);
        reject(error);
        return;
      }
      console.log(stdout);
      resolve(stdout);
    });
  });
}

// Main function to run the local build process
async function runLocalBuild() {
  try {
    console.log('Starting local build process...');
    
    // Step 1: Check and fix imports in index.js
    console.log('Checking index.js...');
    const indexPath = path.join(process.cwd(), 'src', 'index.js');
    let indexContent = await fs.readFile(indexPath, 'utf8');
    
    // Fix logger import if needed
    if (indexContent.includes("import { logger } from './shared/logging/logger.js'")) {
      console.log('Fixing logger import in index.js...');
      indexContent = indexContent.replace(
        "import { logger } from './shared/logging/logger.js'",
        "import * as loggerModule from './shared/logging/logger.js'"
      );
      
      // Add logger definition
      const loggerDefinition = `
// Create a logger object to match the import pattern used elsewhere
const logger = {
  info: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.debug(...args)
};
`;
      
      // Find where to insert the logger definition
      const serverConfigLine = "const { port, host } = fastify.serverConfig;";
      indexContent = indexContent.replace(
        serverConfigLine,
        `${serverConfigLine}\n${loggerDefinition}`
      );
      
      await fs.writeFile(indexPath, indexContent, 'utf8');
      console.log('Fixed logger import in index.js');
    }
    
    // Step 2: Create necessary directories and files if they don't exist
    console.log('Creating necessary directories and files if needed...');
    const dotEnvPath = path.join(process.cwd(), '.env');
    try {
      await fs.access(dotEnvPath);
    } catch (err) {
      // .env file doesn't exist, create it
      await fs.writeFile(dotEnvPath, `PORT=3000
HOST=localhost
NODE_ENV=development`, 'utf8');
      console.log('Created .env file');
    }
    
    // Step 3: Install dependencies if needed
    console.log('Installing dependencies...');
    await executeCommand('npm install');
    
    // Step 4: Run the server
    console.log('Starting server...');
    console.log('Run the following command to start the server:');
    console.log('node src/index.js');
    
    console.log('Local build completed successfully!');
    
  } catch (error) {
    console.error('Error in local build process:', error);
    process.exit(1);
  }
}

// Run the build process
runLocalBuild().catch(err => {
  console.error('Unhandled error in local build process:', err);
  process.exit(1);
}); 
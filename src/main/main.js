const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Try to load optional dependencies
let yaml;

try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('js-yaml not found. YAML files may not be supported.');
}

let mainWindow;
let mockServer;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startMockServer(spec) {
  if (mockServer) {
    mockServer.close();
  }

  const server = http.createServer((req, res) => {
    // Parse request URL and method
    const url = new URL(req.url, 'http://localhost:7070');
    const method = req.method;
    
    // Get path without query string
    let path = url.pathname;
    
    // Find matching path in spec
    let matchingPath;
    let pathParams = {};
    
    Object.keys(spec.paths || {}).forEach(specPath => {
      // Convert OpenAPI path format to regex
      const regexPath = specPath.replace(/{(.*?)}/g, '(.*?)');
      const regex = new RegExp(`^${regexPath}$`);
      
      if (regex.test(path)) {
        matchingPath = specPath;
        
        // Extract path parameters
        const matches = path.match(regex);
        const paramNames = specPath.match(/{(.*?)}/g)?.map(p => p.substring(1, p.length - 1)) || [];
        
        paramNames.forEach((name, index) => {
          if (matches && matches[index + 1]) {
            pathParams[name] = matches[index + 1];
          }
        });
      }
    });
    
    // Check if path and method exist in spec
    if (matchingPath && spec.paths[matchingPath][method.toLowerCase()]) {
      const operation = spec.paths[matchingPath][method.toLowerCase()];
      const responses = operation.responses;
      
      // Find a suitable response
      let response;
      if (responses['200']) {
        response = responses['200'];
      } else {
        response = Object.values(responses)[0];
      }
      
      // Set response headers
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      
      // Get example or default response
      let responseBody = {};
      if (response.content && response.content['application/json']) {
        responseBody = response.content['application/json'].example || 
                      response.content['application/json'].examples?.default?.value || 
                      {};
      }
      
      // Send response
      res.end(JSON.stringify(responseBody));
    } else {
      // Path not found
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  mockServer = server.listen(7070, () => {
    console.log('Mock server running at http://localhost:7070');
  });
}

app.on('ready', createMainWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (mockServer) {
    mockServer.close();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createMainWindow();
  }
});

ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'OpenAPI Files', extensions: ['yaml', 'yml', 'json'] }
      ]
    });
    
    if (canceled || filePaths.length === 0) {
      return null;
    }
    
    const filePath = filePaths[0];
    console.log('Processing file:', filePath);
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      console.log('File content length:', fileContent.length);
      
      let spec;
      if ((filePath.endsWith('.yaml') || filePath.endsWith('.yml')) && yaml) {
        console.log('Parsing YAML file');
        spec = yaml.load(fileContent);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        return { success: false, error: 'js-yaml not installed. YAML files are not supported.' };
      } else {
        console.log('Parsing JSON file');
        spec = JSON.parse(fileContent);
      }
      
      // Deep clone to remove any YAML prototype pollution or special properties
      spec = JSON.parse(JSON.stringify(spec));
      
      console.log('Parsed and cleaned spec:', JSON.stringify(spec, null, 2));
      
      // Validate spec has required version field
      if (!spec || typeof spec !== 'object') {
        console.error('Invalid spec object:', spec);
        return { success: false, error: 'Invalid OpenAPI spec format' };
      }
      
      // Ensure version fields are strings, not objects or other types
      if (spec.swagger !== undefined && typeof spec.swagger !== 'string') {
        console.error('Invalid swagger field type:', typeof spec.swagger, spec.swagger);
        return { success: false, error: `OpenAPI spec 'swagger' field must be a string, got ${typeof spec.swagger}` };
      }
      
      if (spec.openapi !== undefined && typeof spec.openapi !== 'string') {
        console.error('Invalid openapi field type:', typeof spec.openapi, spec.openapi);
        return { success: false, error: `OpenAPI spec 'openapi' field must be a string, got ${typeof spec.openapi}` };
      }
      
      if (!spec.swagger && !spec.openapi) {
        console.error('Missing version field:', spec);
        return { success: false, error: 'OpenAPI spec missing required version field (swagger or openapi)' };
      }
      
      console.log('Valid spec loaded:', { version: spec.swagger || spec.openapi });
      
      if (mainWindow) {
        // Send the cleaned spec object
        console.log('Sending spec to renderer:', { 
          hasSwagger: !!spec.swagger, 
          hasOpenapi: !!spec.openapi, 
          version: spec.swagger || spec.openapi,
          swaggerType: typeof spec.swagger,
          openapiType: typeof spec.openapi,
          specKeys: Object.keys(spec)
        });
        
        // Create a clean spec object without undefined fields
        // This prevents swagger: undefined from confusing Swagger UI
        const specForRenderer = {};
        for (const key of Object.keys(spec)) {
          if (spec[key] !== undefined) {
            specForRenderer[key] = spec[key];
          }
        }
        
        console.log('Sending clean spec to renderer:', {
          openapi: specForRenderer.openapi,
          swagger: specForRenderer.swagger,
          hasSwagger: 'swagger' in specForRenderer,
          hasOpenapi: 'openapi' in specForRenderer,
          totalKeys: Object.keys(specForRenderer).length
        });
        mainWindow.webContents.send('swagger-spec', specForRenderer);
      }
      startMockServer(spec);
      
      return { success: true, spec: spec };
    } catch (error) {
      console.error('Error processing file:', error);
      return { success: false, error: error.message };
    }
  });
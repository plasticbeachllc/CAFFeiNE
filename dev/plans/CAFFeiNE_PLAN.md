# CAFFeiNE Prep

## 🛠️ **Building a Custom AFFiNE Markdown Import API**

Based on AFFiNE's architecture, here's what is required:

### **Core Technical Requirements**

#### Understanding BlockSuite's Internal APIs

```javascript
// Key BlockSuite components we'd need to interface with
import {
  Workspace, // Main workspace manager
  Page, // Individual pages
  BlockSuiteTransformer, // Content conversion
  AttachmentManager, // File handling
  CollectionManager, // Collection management
} from '@blocksuite/affine';
```

### **Architecture for Custom API**

#### **&#x20;Express.js Middleware Layer**

```javascript
// Custom API server that sits between GitHub and AFFiNE
const express = require('express');
const { AFFiNEImporter } = require('./affine-importer');

const app = express();
app.post('/api/import/markdown', async (req, res) => {
  const { collectionId, markdownContent, metadata } = req.body;

  try {
    const result = await AFFiNEImporter.importToCollection(collectionId, markdownContent, metadata);
    res.json({ success: true, pageId: result.pageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **Key Technical Challenges**

#### **1. Access to Internal BlockSuite Store**

```javascript
// How to get the workspace instance?
const workspace = ??? // This is the hard part

// Once we have it:
const collection = workspace.getCollection(collectionId);
const page = workspace.createPage();
const markdownAdapter = workspace.transformer.markdown;
```

#### **2. Markdown → BlockSuite Conversion**

```javascript
class MarkdownConverter {
  async convert(markdown, targetPage) {
    // Parse markdown into BlockSuite blocks
    const blocks = this.parseMarkdown(markdown);

    // Add blocks to page
    blocks.forEach(blockConfig => {
      targetPage.addBlock(blockConfig.type, blockConfig.props);
    });
  }

  parseMarkdown(markdown) {
    // Convert headers, lists, code blocks, etc.
    // to corresponding BlockSuite block types
    return [
      { type: 'heading', props: { level: 1, text: 'Title' } },
      { type: 'paragraph', props: { text: 'Content' } },
    ];
  }
}
```

### **Implementation Strategy**

#### **Phase 1: Research & Discovery**

1. **Analyze AFFiNE's internal APIs** via browser dev tools
2. **Document BlockSuite's public methods** that are accessible
3. **Test C3PM manipulation** with simple examples

#### **Phase 2: Proof of Concept**

```javascript
// Test if we can programmatically create pages
const testWorkspace = window.workspace; // If accessible globally
const testPage = testWorkspace.createPage();
testPage.addBlock('paragraph', { text: 'Hello from API' });
```

#### **Phase 3: Build Import Engine**

- Markdown parser → BlockSuite blocks converter
- Collection/page management
- Error handling and validation

#### **Phase 4: API Layer**

- REST endpoints for import operations
- Authentication/authorization
- Rate limiting and monitoring

### **Risks & Considerations**

#### **High Risk Areas**

1. **Internal API Stability**: BlockSuite APIs may change without notice
2. **Security**: Direct workspace manipulation could corrupt data
3. **Performance**: Large imports could impact AFFiNE performance

#### **Mitigation Strategies**

```javascript
// Safe wrapper around internal APIs
class SafeAFFiNEIntegration {
  async importMarkdownSafely(collectionId, markdown) {
    try {
      // Validate inputs
      this.validateMarkdown(markdown);
      this.validateCollection(collectionId);

      // Create backup point
      const backup = this.createWorkspaceBackup();

      // Perform import
      const result = await this.performImport(collectionId, markdown);

      return result;
    } catch (error) {
      // Restore from backup on failure
      await this.restoreWorkspace(backup);
      throw error;
    }
  }
}
```

### **Alternative: Simpler "Hack" Approach**

If full API is too complex, consider a **UI automation approach**:

```javascript
// Use Puppeteer to automate the manual import flow
const puppeteer = require('puppeteer');

class AFFiNEAutomation {
  async importMarkdown(collectionId, markdown) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to AFFiNE
    await page.goto('https://your-affine-instance');

    // Use AFFiNE's existing import UI programmatically
    await page.click(`[data-collection="${collectionId}"]`);
    await page.click('.import-button');
    // ... automate the file selection and import process
  }
}
```

### **Recommended Next Steps**

1. **Start with browser dev tools analysis** - see what BlockSuite objects are accessible
2. **Create a simple test** - try to programmatically add a block to a page
3. **Document findings** - what internal APIs are stable enough to use
4. **Build minimal PoC** - import a single markdown file into a test collection

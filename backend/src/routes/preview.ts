import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { ProjectRepository } from '../repositories/ProjectRepository';
import crypto from 'crypto';

const projectRepository = new ProjectRepository();

const router = express.Router();

// In-memory storage for preview URLs (in production, use Redis or database)
const previewStorage = new Map<string, {
  content: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}>();

// Clean up expired previews every hour
const cleanupInterval = setInterval(() => {
  const now = new Date();
  for (const [key, value] of previewStorage.entries()) {
    if (value.expiresAt < now) {
      previewStorage.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Export cleanup function for testing
export const clearCleanupInterval = () => {
  clearInterval(cleanupInterval);
};

/**
 * Generate a shareable preview URL for a project
 */
router.post('/generate-share-url', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user!.userId;

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PROJECT_ID',
          message: 'Project ID is required',
        },
      });
    }

    // Verify project ownership
    const project = await projectRepository.findWithFiles(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    if (project.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to share this project',
        },
      });
    }

    // Generate preview content
    const htmlFile = project.files?.find((f: any) => f.type === 'HTML');
    const cssFiles = project.files?.filter((f: any) => f.type === 'CSS') || [];
    const jsFiles = project.files?.filter((f: any) => f.type === 'JS') || [];

    let htmlContent = htmlFile?.content || `
      <html>
        <head>
          <title>${project.name}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
            <h1>Welcome to ${project.name}</h1>
            <p>No HTML file found in this project.</p>
          </div>
        </body>
      </html>
    `;

    // Ensure proper HTML structure
    if (!htmlContent.includes('<html')) {
      htmlContent = `<html><head><title>${project.name}</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${htmlContent}</body></html>`;
    }

    // Inject CSS files
    if (cssFiles.length > 0) {
      const cssContent = cssFiles.map((file: any) => `<style data-filename="${file.filename}">${file.content}</style>`).join('\n');
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${cssContent}\n</head>`);
      } else {
        htmlContent = htmlContent.replace('<html>', `<html><head>${cssContent}</head>`);
      }
    }

    // Inject JavaScript files (without console capture for shared previews)
    if (jsFiles.length > 0) {
      const jsContent = jsFiles.map((file: any) => `<script data-filename="${file.filename}">${file.content}</script>`).join('\n');
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${jsContent}\n</body>`);
      } else {
        htmlContent += jsContent;
      }
    }

    // Generate unique preview ID
    const previewId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store preview content
    previewStorage.set(previewId, {
      content: htmlContent,
      projectId,
      userId,
      createdAt: new Date(),
      expiresAt,
    });

    const shareUrl = `${req.protocol}://${req.get('host')}/api/preview/share/${previewId}`;

    return res.json({
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error generating share URL:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate share URL',
      },
    });
  }
});

/**
 * Serve shared preview content
 */
router.get('/share/:previewId', (req, res) => {
  try {
    const { previewId } = req.params;
    
    if (!previewId) {
      return res.status(400).send('Preview ID is required');
    }
    const preview = previewStorage.get(previewId);

    if (!preview) {
      return res.status(404).send(`
        <html>
          <head>
            <title>Preview Not Found</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f5f5f5;
              }
              .error-container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .error-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
              }
              h1 {
                color: #333;
                margin-bottom: 0.5rem;
              }
              p {
                color: #666;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <div class="error-icon">🔗</div>
              <h1>Preview Not Found</h1>
              <p>This preview link has expired or does not exist.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Check if preview has expired
    if (preview.expiresAt < new Date()) {
      previewStorage.delete(previewId);
      return res.status(410).send(`
        <html>
          <head>
            <title>Preview Expired</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f5f5f5;
              }
              .error-container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .error-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
              }
              h1 {
                color: #333;
                margin-bottom: 0.5rem;
              }
              p {
                color: #666;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <div class="error-icon">⏰</div>
              <h1>Preview Expired</h1>
              <p>This preview link has expired. Shared previews are valid for 24 hours.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; font-src 'self' data: https:;");
    
    return res.send(preview.content);
  } catch (error) {
    console.error('Error serving shared preview:', error);
    return res.status(500).send(`
      <html>
        <head>
          <title>Server Error</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div style="text-align: center; padding: 2rem; font-family: Arial, sans-serif;">
            <h1>Server Error</h1>
            <p>An error occurred while loading the preview.</p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * Get preview info (for debugging/admin purposes)
 */
router.get('/info/:previewId', authenticateToken, (req, res) => {
  try {
    const { previewId } = req.params;
    
    if (!previewId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PREVIEW_ID',
          message: 'Preview ID is required',
        },
      });
    }
    
    const preview = previewStorage.get(previewId);

    if (!preview) {
      return res.status(404).json({
        error: {
          code: 'PREVIEW_NOT_FOUND',
          message: 'Preview not found',
        },
      });
    }

    // Only allow the owner to view preview info
    if (preview.userId !== req.user!.userId) {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to view this preview info',
        },
      });
    }

    return res.json({
      previewId,
      projectId: preview.projectId,
      createdAt: preview.createdAt.toISOString(),
      expiresAt: preview.expiresAt.toISOString(),
      isExpired: preview.expiresAt < new Date(),
    });
  } catch (error) {
    console.error('Error getting preview info:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get preview info',
      },
    });
  }
});

// Export for testing purposes
export { previewStorage };
export default router;
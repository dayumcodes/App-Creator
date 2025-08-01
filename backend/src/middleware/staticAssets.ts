import { Request, Response, NextFunction } from 'express';
import { cdnService } from '../services/CDNService';
import { logger } from '../utils/logger';

export interface StaticAssetOptions {
  maxAge?: number; // Cache duration in seconds
  immutable?: boolean; // Whether the asset is immutable
  compress?: boolean; // Enable compression
}

/**
 * Middleware for serving static assets with CDN integration and caching
 */
export function staticAssets(options: StaticAssetOptions = {}) {
  const {
    maxAge = 86400, // 24 hours default
    immutable = false,
    compress = true
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const { path } = req;
    
    // Skip non-static asset requests
    if (!isStaticAsset(path)) {
      return next();
    }

    try {
      // Set caching headers
      setCacheHeaders(res, maxAge, immutable);
      
      // Set compression headers if enabled
      if (compress) {
        setCompressionHeaders(res, path);
      }

      // For CDN-enabled assets, redirect to CDN
      if (shouldUseCDN(path)) {
        const cdnUrl = cdnService.getAssetUrl(path);
        return res.redirect(301, cdnUrl);
      }

      // Continue to serve locally
      next();
    } catch (error) {
      logger.error('Static asset middleware error:', error);
      next(error);
    }
  };
}

/**
 * Check if the request path is for a static asset
 */
function isStaticAsset(path: string): boolean {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav'
  ];
  
  return staticExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

/**
 * Set appropriate cache headers
 */
function setCacheHeaders(res: Response, maxAge: number, immutable: boolean): void {
  const cacheControl = [
    `max-age=${maxAge}`,
    'public'
  ];
  
  if (immutable) {
    cacheControl.push('immutable');
  }
  
  res.set({
    'Cache-Control': cacheControl.join(', '),
    'ETag': generateETag(),
    'Last-Modified': new Date().toUTCString()
  });
}

/**
 * Set compression headers based on file type
 */
function setCompressionHeaders(res: Response, path: string): void {
  const compressibleTypes = ['.js', '.css', '.html', '.json', '.svg'];
  const isCompressible = compressibleTypes.some(type => path.endsWith(type));
  
  if (isCompressible) {
    res.set('Vary', 'Accept-Encoding');
  }
}

/**
 * Determine if asset should be served from CDN
 */
function shouldUseCDN(path: string): boolean {
  // Only use CDN for production and if CDN is configured
  const isProduction = process.env.NODE_ENV === 'production';
  const cdnConfigured = process.env.CDN_PROVIDER && process.env.CDN_PROVIDER !== 'local';
  
  return isProduction && cdnConfigured;
}

/**
 * Generate a simple ETag for caching
 */
function generateETag(): string {
  return `"${Date.now().toString(36)}"`;
}

/**
 * Middleware for handling asset versioning
 */
export function assetVersioning() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { path, query } = req;
    
    // Remove version parameter from path for file lookup
    if (query.v && isStaticAsset(path)) {
      // Set long-term caching for versioned assets
      res.set('Cache-Control', 'max-age=31536000, public, immutable'); // 1 year
    }
    
    next();
  };
}

/**
 * Middleware for serving optimized images
 */
export function optimizedImages() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { path, query } = req;
    
    // Check if it's an image request with optimization parameters
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(path);
    const hasOptimization = query.width || query.height || query.quality || query.format;
    
    if (isImage && hasOptimization) {
      try {
        const optimizedUrl = cdnService.getOptimizedImageUrl(path, {
          width: query.width ? parseInt(query.width as string) : undefined,
          height: query.height ? parseInt(query.height as string) : undefined,
          quality: query.quality ? parseInt(query.quality as string) : undefined,
          format: query.format as any
        });
        
        // Redirect to optimized image URL
        return res.redirect(301, optimizedUrl);
      } catch (error) {
        logger.error('Image optimization error:', error);
      }
    }
    
    next();
  };
}
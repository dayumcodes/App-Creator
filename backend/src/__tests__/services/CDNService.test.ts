import { CDNService } from '../../services/CDNService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CDNService', () => {
  let cdnService: CDNService;

  beforeEach(() => {
    cdnService = new CDNService();
    jest.clearAllMocks();
  });

  describe('uploadAsset', () => {
    it('should upload asset successfully', async () => {
      const mockResponse = {
        data: {
          url: 'https://cdn.example.com/assets/test-file.js',
          id: 'asset-123',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const file = Buffer.from('console.log("test");');
      const filename = 'test-file.js';
      const contentType = 'application/javascript';

      const result = await cdnService.uploadAsset(file, filename, contentType);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        })
      );
      expect(result).toEqual({
        url: 'https://cdn.example.com/assets/test-file.js',
        id: 'asset-123',
      });
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      mockedAxios.post.mockRejectedValue(error);

      const file = Buffer.from('console.log("test");');
      const filename = 'test-file.js';
      const contentType = 'application/javascript';

      await expect(
        cdnService.uploadAsset(file, filename, contentType)
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('deleteAsset', () => {
    it('should delete asset successfully', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });

      const assetId = 'asset-123';
      await cdnService.deleteAsset(assetId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining(`/assets/${assetId}`)
      );
    });

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed');
      mockedAxios.delete.mockRejectedValue(error);

      const assetId = 'asset-123';

      await expect(cdnService.deleteAsset(assetId)).rejects.toThrow('Delete failed');
    });
  });

  describe('getAssetUrl', () => {
    it('should return CDN URL for asset', () => {
      const assetId = 'asset-123';
      const filename = 'test-file.js';

      const url = cdnService.getAssetUrl(assetId, filename);

      expect(url).toMatch(/^https:\/\/cdn\.example\.com\/assets\//);
      expect(url).toContain(assetId);
      expect(url).toContain(filename);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate CDN cache for asset', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      const assetId = 'asset-123';
      await cdnService.invalidateCache(assetId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/invalidate'),
        expect.objectContaining({
          assetId,
        })
      );
    });

    it('should handle cache invalidation errors', async () => {
      const error = new Error('Invalidation failed');
      mockedAxios.post.mockRejectedValue(error);

      const assetId = 'asset-123';

      await expect(cdnService.invalidateCache(assetId)).rejects.toThrow(
        'Invalidation failed'
      );
    });
  });

  describe('optimizeAsset', () => {
    it('should optimize asset for web delivery', async () => {
      const mockResponse = {
        data: {
          optimizedUrl: 'https://cdn.example.com/optimized/test-file.min.js',
          originalSize: 1024,
          optimizedSize: 512,
          compressionRatio: 0.5,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const assetId = 'asset-123';
      const optimizationOptions = {
        minify: true,
        compress: true,
        format: 'modern',
      };

      const result = await cdnService.optimizeAsset(assetId, optimizationOptions);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/optimize'),
        expect.objectContaining({
          assetId,
          options: optimizationOptions,
        })
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});
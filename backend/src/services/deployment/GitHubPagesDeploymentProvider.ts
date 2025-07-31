import axios from 'axios';
import { ProjectFile, DeploymentStatus } from '../../types/database';
import {
  DeploymentProvider,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
} from '../DeploymentService';

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
}

interface GitHubPagesInfo {
  url: string;
  status: 'built' | 'building' | null;
  cname?: string;
}

export class GitHubPagesDeploymentProvider implements DeploymentProvider {
  private apiToken: string;
  private baseUrl = 'https://api.github.com';
  private username: string;

  constructor() {
    this.apiToken = process.env['GITHUB_API_TOKEN'] || '';
    this.username = process.env['GITHUB_USERNAME'] || '';
    
    if (!this.apiToken) {
      throw new Error('GITHUB_API_TOKEN environment variable is required');
    }
    
    if (!this.username) {
      throw new Error('GITHUB_USERNAME environment variable is required');
    }
  }

  async deploy(files: ProjectFile[], config: DeploymentConfig): Promise<DeploymentResult> {
    try {
      // Create or get repository
      const repo = await this.createOrGetRepository(config.projectName);

      // Prepare files for deployment
      const fileMap = this.prepareFiles(files, config);

      // Upload files to repository
      await this.uploadFiles(repo.name, fileMap);

      // Enable GitHub Pages
      const pagesInfo = await this.enableGitHubPages(repo.name);

      return {
        deploymentId: repo.id.toString(),
        url: pagesInfo.url,
        status: this.mapGitHubPagesStatus(pagesInfo.status),
      };
    } catch (error: any) {
      throw new Error(`GitHub Pages deployment failed: ${error.message}`);
    }
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatusResult> {
    try {
      // Get repository name from deployment ID
      const repoResponse = await axios.get(`${this.baseUrl}/repositories/${deploymentId}`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const repo = repoResponse.data;

      // Get GitHub Pages status
      const pagesResponse = await axios.get(`${this.baseUrl}/repos/${repo.full_name}/pages`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const pagesInfo: GitHubPagesInfo = pagesResponse.data;

      return {
        status: this.mapGitHubPagesStatus(pagesInfo.status),
        url: pagesInfo.url,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          status: DeploymentStatus.FAILED,
          errorMessage: 'GitHub Pages not enabled for this repository' as string | undefined,
        };
      }
      throw new Error(`Failed to get GitHub Pages status: ${error.message}`);
    }
  }

  async updateDomain(deploymentId: string, domain: string): Promise<void> {
    try {
      // Get repository name from deployment ID
      const repoResponse = await axios.get(`${this.baseUrl}/repositories/${deploymentId}`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const repo = repoResponse.data;

      // Update GitHub Pages custom domain
      await axios.put(`${this.baseUrl}/repos/${repo.full_name}/pages`, {
        cname: domain,
      }, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to update GitHub Pages domain: ${error.message}`);
    }
  }

  async rollback(_deploymentId: string, _targetDeploymentId: string): Promise<DeploymentResult> {
    // GitHub Pages doesn't support direct rollback, so we'll need to implement
    // this by reverting commits or re-uploading previous files
    throw new Error('Rollback is not currently supported for GitHub Pages deployments');
  }

  async delete(deploymentId: string): Promise<void> {
    try {
      // Get repository name from deployment ID
      const repoResponse = await axios.get(`${this.baseUrl}/repositories/${deploymentId}`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const repo = repoResponse.data;

      // Delete the repository (this will also delete GitHub Pages)
      await axios.delete(`${this.baseUrl}/repos/${repo.full_name}`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to delete GitHub Pages deployment: ${error.message}`);
    }
  }

  private async createOrGetRepository(projectName: string): Promise<GitHubRepository> {
    try {
      // Try to get existing repository
      const response = await axios.get(`${this.baseUrl}/repos/${this.username}/${projectName}`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Repository doesn't exist, create it
        return await this.createRepository(projectName);
      }
      throw error;
    }
  }

  private async createRepository(projectName: string): Promise<GitHubRepository> {
    try {
      const response = await axios.post(`${this.baseUrl}/user/repos`, {
        name: projectName,
        description: `Deployed from Lovable Clone`,
        public: true, // GitHub Pages requires public repos for free accounts
        auto_init: true,
      }, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create GitHub repository: ${error.message}`);
    }
  }

  private async uploadFiles(repoName: string, files: Record<string, string>): Promise<void> {
    try {
      // Get the default branch SHA
      const branchResponse = await axios.get(`${this.baseUrl}/repos/${this.username}/${repoName}/branches/main`, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const baseSha = branchResponse.data.commit.sha;

      // Create a tree with all files
      const tree = Object.entries(files).map(([path, content]) => ({
        path,
        mode: '100644',
        type: 'blob',
        content,
      }));

      const treeResponse = await axios.post(`${this.baseUrl}/repos/${this.username}/${repoName}/git/trees`, {
        tree,
        base_tree: baseSha,
      }, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      });

      const treeSha = treeResponse.data.sha;

      // Create a commit
      const commitResponse = await axios.post(`${this.baseUrl}/repos/${this.username}/${repoName}/git/commits`, {
        message: `Deploy from Lovable Clone - ${new Date().toISOString()}`,
        tree: treeSha,
        parents: [baseSha],
      }, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      });

      const commitSha = commitResponse.data.sha;

      // Update the main branch reference
      await axios.patch(`${this.baseUrl}/repos/${this.username}/${repoName}/git/refs/heads/main`, {
        sha: commitSha,
      }, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to upload files to GitHub: ${error.message}`);
    }
  }

  private async enableGitHubPages(repoName: string): Promise<GitHubPagesInfo> {
    try {
      // Enable GitHub Pages
      const response = await axios.post(`${this.baseUrl}/repos/${this.username}/${repoName}/pages`, {
        source: {
          branch: 'main',
          path: '/',
        },
      }, {
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Pages already enabled, get the current status
        const response = await axios.get(`${this.baseUrl}/repos/${this.username}/${repoName}/pages`, {
          headers: {
            'Authorization': `token ${this.apiToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        return response.data;
      }
      throw new Error(`Failed to enable GitHub Pages: ${error.message}`);
    }
  }

  private prepareFiles(files: ProjectFile[], config: DeploymentConfig): Record<string, string> {
    const fileMap: Record<string, string> = {};

    // Add project files
    files.forEach(file => {
      fileMap[file.filename] = file.content;
    });

    // Ensure there's an index.html
    if (!fileMap['index.html'] && !fileMap['index.htm']) {
      const htmlFile = files.find(f => f.type === 'HTML');
      if (htmlFile && htmlFile.filename !== 'index.html') {
        fileMap['index.html'] = htmlFile.content;
      }
    }

    // Add CNAME file for custom domain
    if (config.customDomain) {
      fileMap['CNAME'] = config.customDomain;
    }

    return fileMap;
  }

  private mapGitHubPagesStatus(githubStatus: string | null): DeploymentStatus {
    switch (githubStatus) {
      case 'building':
        return DeploymentStatus.BUILDING;
      case 'built':
        return DeploymentStatus.SUCCESS;
      case null:
        return DeploymentStatus.PENDING;
      default:
        return DeploymentStatus.PENDING;
    }
  }
}
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeploymentModal } from '../DeploymentModal';
import { DeploymentPlatform } from '../../services/deploymentApi';

// Mock the Modal component
jest.mock('../Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => (
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null
  ),
}));

describe('DeploymentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onDeploy: jest.fn(),
    projectId: 'project-1',
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render deployment modal', () => {
    render(<DeploymentModal {...defaultProps} />);

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Deploy Project');
    expect(screen.getByLabelText('Deployment Platform')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom Domain (Optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<DeploymentModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('should handle platform selection', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const platformSelect = screen.getByLabelText('Deployment Platform');
    
    await user.selectOptions(platformSelect, DeploymentPlatform.VERCEL);
    
    expect(platformSelect).toHaveValue(DeploymentPlatform.VERCEL);
  });

  it('should show build command and output dir for non-GitHub Pages platforms', () => {
    render(<DeploymentModal {...defaultProps} />);

    expect(screen.getByLabelText('Build Command (Optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Output Directory (Optional)')).toBeInTheDocument();
  });

  it('should hide build command and output dir for GitHub Pages', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const platformSelect = screen.getByLabelText('Deployment Platform');
    await user.selectOptions(platformSelect, DeploymentPlatform.GITHUB_PAGES);

    expect(screen.queryByLabelText('Build Command (Optional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Output Directory (Optional)')).not.toBeInTheDocument();
  });

  it('should handle form submission with valid data', async () => {
    const user = userEvent.setup();
    const mockOnDeploy = jest.fn().mockResolvedValue(undefined);
    
    render(<DeploymentModal {...defaultProps} onDeploy={mockOnDeploy} />);

    const customDomainInput = screen.getByLabelText('Custom Domain (Optional)');
    const buildCommandInput = screen.getByLabelText('Build Command (Optional)');
    const deployButton = screen.getByRole('button', { name: 'Deploy' });

    await user.type(customDomainInput, 'example.com');
    await user.type(buildCommandInput, 'npm run build');
    await user.click(deployButton);

    await waitFor(() => {
      expect(mockOnDeploy).toHaveBeenCalledWith({
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
        customDomain: 'example.com',
        buildCommand: 'npm run build',
        outputDir: undefined,
        envVars: undefined,
      });
    });
  });

  it('should validate custom domain format', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const customDomainInput = screen.getByLabelText('Custom Domain (Optional)');
    const deployButton = screen.getByRole('button', { name: 'Deploy' });

    await user.type(customDomainInput, 'invalid-domain');
    await user.click(deployButton);

    expect(screen.getByText('Please enter a valid domain name')).toBeInTheDocument();
    expect(defaultProps.onDeploy).not.toHaveBeenCalled();
  });

  it('should handle environment variables', async () => {
    const user = userEvent.setup();
    const mockOnDeploy = jest.fn().mockResolvedValue(undefined);
    
    render(<DeploymentModal {...defaultProps} onDeploy={mockOnDeploy} />);

    const addEnvVarButton = screen.getByRole('button', { name: 'Add Environment Variable' });
    await user.click(addEnvVarButton);

    const keyInputs = screen.getAllByPlaceholderText('KEY');
    const valueInputs = screen.getAllByPlaceholderText('value');

    await user.type(keyInputs[0], 'NODE_ENV');
    await user.type(valueInputs[0], 'production');

    const deployButton = screen.getByRole('button', { name: 'Deploy' });
    await user.click(deployButton);

    await waitFor(() => {
      expect(mockOnDeploy).toHaveBeenCalledWith({
        projectId: 'project-1',
        platform: DeploymentPlatform.NETLIFY,
        customDomain: undefined,
        buildCommand: undefined,
        outputDir: undefined,
        envVars: { NODE_ENV: 'production' },
      });
    });
  });

  it('should validate environment variables', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const addEnvVarButton = screen.getByRole('button', { name: 'Add Environment Variable' });
    await user.click(addEnvVarButton);

    const keyInputs = screen.getAllByPlaceholderText('KEY');
    await user.type(keyInputs[0], 'NODE_ENV');
    // Leave value empty

    const deployButton = screen.getByRole('button', { name: 'Deploy' });
    await user.click(deployButton);

    expect(screen.getByText('Value is required when key is provided')).toBeInTheDocument();
    expect(defaultProps.onDeploy).not.toHaveBeenCalled();
  });

  it('should remove environment variables', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const addEnvVarButton = screen.getByRole('button', { name: 'Add Environment Variable' });
    await user.click(addEnvVarButton);

    expect(screen.getByPlaceholderText('KEY')).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: 'Remove' });
    await user.click(removeButton);

    expect(screen.queryByPlaceholderText('KEY')).not.toBeInTheDocument();
  });

  it('should handle cancel button', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle modal close', async () => {
    const user = userEvent.setup();
    render(<DeploymentModal {...defaultProps} />);

    const closeButton = screen.getByTestId('modal-close');
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should disable form when loading', () => {
    render(<DeploymentModal {...defaultProps} loading={true} />);

    expect(screen.getByRole('button', { name: 'Deploying...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('should reset form on close', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeploymentModal {...defaultProps} />);

    const customDomainInput = screen.getByLabelText('Custom Domain (Optional)');
    await user.type(customDomainInput, 'example.com');

    // Close and reopen modal
    rerender(<DeploymentModal {...defaultProps} isOpen={false} />);
    rerender(<DeploymentModal {...defaultProps} isOpen={true} />);

    expect(screen.getByLabelText('Custom Domain (Optional)')).toHaveValue('');
  });
});